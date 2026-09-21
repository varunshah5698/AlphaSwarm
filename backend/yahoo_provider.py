"""Real market data via Yahoo Finance chart API (no key required).

Keyless and Render-safe: no secrets, no signup. Responses are cached in the
same SQLite market_cache table as the Finnhub provider (12h TTL for daily
bars) so rate limits are rarely touched. Hosts query1/query2 rotate on 429s.
"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import re

import pandas as pd

from db import conn

SYMBOL_RE = re.compile(r"^[A-Z][A-Z.\-]{0,11}$")
CANDLE_TTL = 12 * 3600
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

CACHE_SCHEMA = """
CREATE TABLE IF NOT EXISTS market_cache (
  key TEXT PRIMARY KEY,
  updated_at REAL,
  payload TEXT
);
"""


def _ensure_cache():
    c = conn()
    c.executescript(CACHE_SCHEMA)
    c.commit()
    c.close()


_ensure_cache()


def clean_symbol(symbol: str) -> str:
    s = (symbol or "").strip().upper()
    if not SYMBOL_RE.match(s):
        raise ValueError("Symbol must be 1-12 chars: letters, dots, dashes (e.g. AAPL).")
    return s


def _cache_get(ckey: str, ttl: float):
    c = conn()
    row = c.execute("SELECT updated_at, payload FROM market_cache WHERE key=?", (ckey,)).fetchone()
    c.close()
    if row and time.time() - row["updated_at"] < ttl:
        try:
            return json.loads(row["payload"])
        except Exception:
            return None
    return None


def _cache_set(ckey: str, payload):
    c = conn()
    c.execute(
        "INSERT OR REPLACE INTO market_cache (key, updated_at, payload) VALUES (?,?,?)",
        (ckey, time.time(), json.dumps(payload)),
    )
    c.commit()
    c.close()


def _download(symbol: str, years: float) -> dict:
    now = int(time.time())
    start = now - int(years * 365.25 * 86400)
    params = urllib.parse.urlencode({
        "interval": "1d", "period1": start, "period2": now,
        "events": "div,split",
    })
    last_err = None
    for attempt, host in enumerate(("query2", "query1")):
        url = f"https://{host}.finance.yahoo.com/v8/finance/chart/{symbol}?{params}"
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            last_err = f"Yahoo feed HTTP {e.code}"
            if e.code == 429:
                time.sleep(3 + 5 * attempt)
                continue
            raise ConnectionError(f"Market feed unreachable: HTTP Error {e.code}")
        except Exception as e:
            last_err = str(e)
            time.sleep(2)
    raise ConnectionError(f"Market feed unreachable: {last_err}")


def _parse_chart(s: str, d: dict) -> pd.DataFrame:
    """Parse a Yahoo v8 chart payload into split/dividend-adjusted OHLCV."""
    import numpy as np
    try:
        r = d["chart"]["result"][0]
        ts = r["timestamp"]
        q = r["indicators"]["quote"][0]
        adj = r["indicators"].get("adjclose", [{}])[0].get("adjclose")
    except Exception:
        raise ValueError(f"No data for {s} (unknown symbol?).")

    def _arr(key):
        return np.array(q.get(key) or [], dtype=float)

    o, h, l, v = _arr("open"), _arr("high"), _arr("low"), _arr("volume")
    c = _arr("close")
    a = np.array(adj, dtype=float) if adj is not None else c
    # truncate ragged arrays to a common length, then split-adjust OHLC
    n = min(len(ts), len(o), len(h), len(l), len(c), len(v), len(a))
    if n < 60:
        raise ValueError(f"Only {n} bars for {s} — need at least 60.")
    ts, o, h, l, c, v, a = ts[:n], o[:n], h[:n], l[:n], c[:n], v[:n], a[:n]
    factor = np.where(c != 0, a / c, 1.0)
    df = pd.DataFrame({
        "date": pd.to_datetime(ts, unit="s").strftime("%Y-%m-%d"),
        "open": o * factor, "high": h * factor,
        "low": l * factor, "close": a, "volume": v,
    })
    df = df.replace([float("inf"), float("-inf")], float("nan")).dropna().reset_index(drop=True)
    if len(df) < 60:
        raise ValueError(f"Only {len(df)} usable bars for {s} — need at least 60.")
    return df


def fetch_bars(symbol: str, years: float = 10) -> pd.DataFrame:
    """Daily OHLCV bars for a symbol, split/dividend-adjusted, cached 12h."""
    s = clean_symbol(symbol)
    years = max(0.5, min(years, 12))
    ck = f"y:c:{s}:{years}"
    hit = _cache_get(ck, CANDLE_TTL)
    if hit is not None:
        df = pd.DataFrame(hit)
        if len(df) >= 60:
            return df
    df = _parse_chart(s, _download(s, years))
    _cache_set(ck, df.to_dict(orient="list"))
    return df
