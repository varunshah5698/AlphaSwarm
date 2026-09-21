"""Live market data via Finnhub (proxied by backend — the key never reaches the browser).

Free tier: 60 calls/min. A SQLite cache (quotes 120s, candles 12h) keeps us
far under the limit and keeps the app working when the feed is down.
"""
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

import pandas as pd

from db import conn

SYMBOL_RE = re.compile(r"^[A-Z][A-Z.\-]{0,11}$")
BASE = "https://api.finnhub.io/api/v1"

CACHE_SCHEMA = """
CREATE TABLE IF NOT EXISTS market_cache (
  key TEXT PRIMARY KEY,
  updated_at REAL,
  payload TEXT
);
"""

QUOTE_TTL = 120
CANDLE_TTL = 12 * 3600


def _load_dotenv():
    """Minimal .env loader (stdlib only): backend/.env KEY=VALUE lines."""
    path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.isfile(path):
        return
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


_load_dotenv()
_c = conn()
_c.executescript(CACHE_SCHEMA)
_c.commit()
_c.close()


def get_key() -> str:
    return (os.environ.get("FINNHUB_API_KEY") or "").strip()


def is_configured() -> bool:
    return bool(get_key())


def clean_symbol(symbol: str) -> str:
    s = (symbol or "").strip().upper()
    if not SYMBOL_RE.match(s):
        raise ValueError("Symbol must be 1-12 chars: letters, dots, dashes (e.g. AAPL, SPY).")
    return s


def _get(path: str, params: dict) -> dict:
    key = get_key()
    if not key:
        raise ConnectionError("Live feed not configured. Set FINNHUB_API_KEY on the server.")
    params = {**params, "token": key}
    url = f"{BASE}{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "alpha-swarm/2.0"})
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise ValueError("Market feed rejected the API key — check FINNHUB_API_KEY on the server.")
        if e.code == 429:
            raise ConnectionError("Market feed rate limit hit (60/min) — cached data will serve until it clears.")
        raise ConnectionError(f"Market feed unreachable: HTTP Error {e.code}")
    except Exception as e:
        raise ConnectionError(f"Market feed unreachable: {e}")
    if isinstance(data, dict) and data.get("error"):
        raise ValueError(f"Market feed error: {data['error']}")
    return data


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


def fetch_quote(symbol: str) -> dict:
    s = clean_symbol(symbol)
    ck = f"q:{s}"
    hit = _cache_get(ck, QUOTE_TTL)
    if hit is not None:
        return {**hit, "cached": True}
    d = _get("/quote", {"symbol": s})
    if not d.get("c"):
        raise ValueError(f"No quote for {s} (unknown symbol?).")
    out = {
        "symbol": s,
        "price": round(float(d["c"]), 2),
        "prev_close": round(float(d.get("pc") or 0), 2),
        "change": round(float(d.get("d") or 0), 2),
        "change_pct": round(float(d.get("dp") or 0), 2),
        "high": round(float(d.get("h") or 0), 2),
        "low": round(float(d.get("l") or 0), 2),
        "time": int(d.get("t") or 0),
    }
    _cache_set(ck, out)
    return {**out, "cached": False}


def fetch_bars(symbol: str, years: float = 5) -> pd.DataFrame:
    """Daily OHLCV bars for a symbol, cached 12h. Raises clean errors."""
    s = clean_symbol(symbol)
    years = max(0.25, min(years, 10))
    ck = f"c:{s}:{years}"
    hit = _cache_get(ck, CANDLE_TTL)
    if hit is not None:
        return pd.DataFrame(hit)
    now = int(time.time())
    d = _get("/stock/candle", {
        "symbol": s, "resolution": "D",
        "from": now - int(years * 365.25 * 86400), "to": now,
    })
    if d.get("s") != "ok" or not d.get("c"):
        raise ValueError(f"No candle data for {s} (unknown symbol or out of range?).")
    df = pd.DataFrame({
        "open": d.get("o", d["c"]),
        "high": d.get("h", d["c"]),
        "low": d.get("l", d["c"]),
        "close": d["c"],
        "volume": d.get("v", [1e6] * len(d["c"])),
    })
    df = df.dropna().reset_index(drop=True)
    if len(df) < 60:
        raise ValueError(f"Only {len(df)} bars for {s} — need at least 60.")
    _cache_set(ck, df.to_dict(orient="list"))
    return df
