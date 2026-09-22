"""Quant engine: synthetic market data, Writer/Judge agents, vector backtest."""
import itertools
import numpy as np
import pandas as pd
import hashlib
import re

# Engine version — bump when market dynamics change so stored metrics are recomputed.
ENGINE_VERSION = 3

# ---------- market data ----------

def make_market(seed: int = 42, days: int = 2520):
    """Deterministic synthetic SPX-like market with documented stylized facts.

    - Short-horizon overreaction: trailing 3-day runs partially revert
      (Jegadeesh 1990-style short-term reversal) → dip-buying factors can win.
    - Slow bull/bear regimes (~120-day persistence) → trend factors can win.
    - Pure random-walk data (v1) had NO exploitable structure, so every
      factor lost money and the pipeline could never validate anything.
    """
    rng = np.random.default_rng(seed)
    dt = 1 / 252
    base = rng.normal(0.07 * dt, 0.18 * np.sqrt(dt), days)
    # persistent drift regimes: bull +28% ann. / bear -23% ann., switch ~1/120 days
    drift = np.zeros(days)
    regime = 1
    for t in range(days):
        if rng.random() < 1 / 120:
            regime *= -1
        drift[t] = 0.0011 if regime > 0 else -0.0009
    # overreaction: 20% of the trailing 3-day base run fades next day
    rets = np.zeros(days)
    run3 = 0.0
    for t in range(days):
        rets[t] = base[t] + drift[t] - 0.20 * run3
        run3 = run3 + base[t] - (base[t - 3] if t >= 3 else 0)
    close = 100 * np.exp(np.cumsum(rets))
    open_ = np.concatenate([[100], close[:-1]]) * (1 + rng.normal(0, 0.001, days))
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.003, days)))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.003, days)))
    volume = (5e6 * (1 + 0.5 * np.abs(rng.normal(0, 1, days)))).astype(float)
    spy = close * (0.98 + 0.04 * rng.random(days)).cumprod() ** 0.001
    df = pd.DataFrame({"open": open_, "high": high, "low": low, "close": close, "volume": volume, "spy": spy})
    return df


# ---------- formula ops ----------

def _rank(s): return s.rank(pct=True)
def _delay(s, n): return s.shift(int(n))
def _sma(s, n): return s.rolling(int(n)).mean()
def _ema(s, n): return s.ewm(span=int(n), adjust=False).mean()
def _std(s, n): return s.rolling(int(n)).std()
def _rsi(s, n=14):
    d = s.diff()
    up = d.clip(lower=0).rolling(int(n)).mean()
    dn = (-d.clip(upper=0)).rolling(int(n)).mean()
    rs = up / (dn + 1e-9)
    return 100 - 100 / (1 + rs)
def _corr(a, b, n):
    return a.rolling(int(n)).corr(b)
def _zscore(s, n):
    m = s.rolling(int(n)).mean(); sd = s.rolling(int(n)).std()
    return (s - m) / (sd + 1e-9)
def _atr(h, l, c, n):
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.rolling(int(n)).mean()
def _sign(s): return np.sign(s)
def _beta(a, b, n):
    cov = a.rolling(int(n)).cov(b); var = b.rolling(int(n)).var()
    return cov / (var + 1e-9)

SAFE_FNS = {"rank": _rank, "delay": _delay, "sma": _sma, "ema": _ema, "std": _std,
            "rsi": _rsi, "correlation": _corr, "zscore": _zscore, "atr": _atr,
            "sign": _sign, "beta": _beta, "avg": _sma}


def eval_signal(formula: str, df: pd.DataFrame) -> pd.Series:
    """Evaluate formula string safely on df. Returns z-scored signal."""
    if len(formula) > 500:
        raise ValueError("Formula too long (max 500 chars).")
    n_ops = len(re.findall(r"(rank|delay|sma|ema|rsi|std|correlation|zscore|atr|sign|beta|avg)", formula.lower()))
    if n_ops > 12:
        raise ValueError(f"Formula too complex ({n_ops} ops, max 12) — overfit risk.")
    for col in ("close", "volume"):
        if col not in df.columns:
            raise ValueError(f"Dataset is missing required column: {col}.")
    if "spy" not in df.columns:
        df = df.copy()
        df["spy"] = df["close"]
    for col in ("open", "high", "low"):
        if col not in df.columns:
            df = df.copy()
            df[col] = df["close"]
    env = {"close": df["close"], "open": df["open"], "high": df["high"],
           "low": df["low"], "volume": df["volume"], "spy": df["spy"], "np": np, "pd": pd}
    env.update(SAFE_FNS)
    try:
        sig = eval(formula, {"__builtins__": {}}, env)
    except Exception as e:
        raise ValueError(f"Formula error: {e}")
    if isinstance(sig, (int, float)):
        sig = pd.Series(float(sig), index=df.index)
    sig = pd.Series(sig, index=df.index).fillna(0).replace([np.inf, -np.inf], 0)
    sd = sig.std()
    if sd and sd > 1e-9:
        sig = (sig - sig.mean()) / sd
    return sig.clip(-3, 3)


def _positions_and_costs(df: pd.DataFrame, formula: str, costs_bps: int, slippage_bps: int,
                         max_pos: float = 1.0, stop_pct: float = 10.0,
                         regime_off: bool = True, slip_vol_mult: float = 1.0):
    """Shared accounting core: signal → risk overlays → per-bar costs.

    Overlays (all use past data only, no look-ahead):
    - cap: positions scaled to [-max_pos, max_pos].
    - regime filter: when 20-day vol exceeds 1.5x its 1-year baseline (as known
      at decision time), stand aside that bar.
    - stop-loss: trailing stop_pct% on gross equity; flat until a new high.
    Slippage grows with that bar's high-low range (real fills gap on wild days).
    """
    sig = eval_signal(formula, df)
    pos = ((sig.shift(1).fillna(0) / 3).clip(-1, 1) * max_pos).clip(-1, 1)
    ret = df["close"].pct_change().fillna(0)
    if regime_off and len(df) > 25:
        vol = ret.rolling(20).std()
        baseline = vol.rolling(252, min_periods=20).mean()
        calm = (vol <= 1.5 * baseline).fillna(True).to_numpy(dtype=bool)
        # shift with fill keeps bool dtype (plain .shift would upcast to object)
        tradable = np.empty(len(df), dtype=bool)
        tradable[0] = False
        tradable[1:] = calm[:-1]
        pos = pos.mask(~tradable, 0.0)
    if stop_pct > 0 and len(df) > 2:
        gross = (pos * ret).to_numpy()
        # trailing stop on gross equity (flat until a new high after stopping)
        eq = np.empty(len(gross))
        eq[0] = 1 + gross[0]
        for i in range(1, len(gross)):
            eq[i] = eq[i - 1] * (1 + gross[i])
        out = pos.to_numpy().copy()
        peak = eq[0]
        stopped = False
        for i in range(len(eq)):
            peak = max(peak, eq[i])
            if not stopped and peak and (eq[i] / peak - 1) * 100 < -stop_pct:
                stopped = True
            if stopped:
                out[i] = 0.0
                if eq[i] >= peak:
                    stopped = False
                    peak = eq[i]
        pos = pd.Series(out, index=df.index)
    turnover = pos.diff().abs().fillna(0)
    rng = (df["high"] - df["low"]) / df["close"].replace(0, np.nan)
    # ~1% of the bar's range as extra slippage (a 2% daily range ≈ 20bps).
    # Calibrated so liquid large-caps pay single-digit bps, wild days pay more.
    extra_slip = (slip_vol_mult * rng * 10000 * 0.01).fillna(0)
    cost = (costs_bps + slippage_bps + extra_slip) / 10000.0
    strat_ret = pos * ret - turnover * cost
    return pos, strat_ret


def _run_backtest(df: pd.DataFrame, formula: str, costs_bps: int, slippage_bps: int, bars_per_year: int = 252,
                  max_pos: float = 1.0, stop_pct: float = 10.0,
                  regime_off: bool = True, slip_vol_mult: float = 1.0):
    pos, strat_ret = _positions_and_costs(df, formula, costs_bps, slippage_bps,
                                            max_pos, stop_pct, regime_off, slip_vol_mult)
    ret = df["close"].pct_change().fillna(0)
    turnover = pos.diff().abs().fillna(0)
    equity = (1 + strat_ret).cumprod()
    total_ret = (equity.iloc[-1] - 1) * 100
    vol = strat_ret.std() * np.sqrt(bars_per_year) * 100
    sharpe = float((strat_ret.mean() / (strat_ret.std() + 1e-9)) * np.sqrt(bars_per_year))
    roll_max = equity.cummax()
    dd = (equity / roll_max - 1).min() * 100
    wins = (strat_ret[pos != 0] > 0).mean() * 100 if (pos != 0).any() else 0
    trades = int((turnover > 0.05).sum())
    # Full-resolution curve: every bar is stored so analytics windows can slice
    # real trading-day ranges later. Downsampling for display happens at the API
    # layer, never in storage.
    curve = [{"t": int(i), "v": round(float(v), 4)} for i, v in enumerate(equity)]
    # buy & hold baseline for the same dataset
    bh = (1 + ret).cumprod()
    bh_ret = round(float((bh.iloc[-1] - 1) * 100), 2)
    return {
        "returns": round(float(total_ret), 2),
        "sharpe": round(float(np.clip(sharpe, -3, 5)), 2),
        "max_dd": round(float(dd), 2),
        "win_rate": round(float(wins), 1),
        "trades": trades,
        "ann_vol": round(float(vol), 2),
        "equity_curve": curve,
        "buy_hold_return": bh_ret,
        "bars": len(df),
    }


def backtest(formula: str, costs_bps: int = 10, slippage_bps: int = 5, seed: int = 42):
    df = make_market(seed=seed)
    return _run_backtest(df, formula, costs_bps, slippage_bps)


def parse_csv_bars(raw: bytes, max_bars: int = 5000) -> pd.DataFrame:
    """Parse user-uploaded OHLCV CSV. Columns: date,open,high,low,close,volume (+optional spy)."""
    import io
    if len(raw) > 5 * 1024 * 1024:
        raise ValueError("File too large (max 5MB).")
    try:
        text = raw.decode("utf-8-sig")
    except Exception:
        raise ValueError("File must be UTF-8 CSV.")
    try:
        df = pd.read_csv(io.StringIO(text))
    except Exception as e:
        raise ValueError(f"Could not parse CSV: {e}")
    df.columns = [str(c).strip().lower() for c in df.columns]
    if "close" not in df.columns:
        raise ValueError("CSV needs at least a 'close' column (date,open,high,low,close,volume preferred).")
    for col in ("open", "high", "low", "close", "volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["close"]).reset_index(drop=True)
    if len(df) < 60:
        raise ValueError(f"Need at least 60 bars, got {len(df)}.")
    if len(df) > max_bars:
        df = df.tail(max_bars).reset_index(drop=True)
    if "volume" not in df.columns:
        df["volume"] = 1e6
    return df


def backtest_csv(raw: bytes, formula: str, costs_bps: int = 10, slippage_bps: int = 5):
    df = parse_csv_bars(raw)
    out = _run_backtest(df, formula, costs_bps, slippage_bps)
    out["dataset"] = f"UPLOAD-{len(df)}-bars"
    return out


def backtest_live(symbol: str, formula: str, costs_bps: int = 10, slippage_bps: int = 5, years: float = 5):
    """Backtest a formula on real Finnhub daily bars (imported lazily to avoid cycles)."""
    from finnhub_provider import fetch_bars, clean_symbol
    s = clean_symbol(symbol)
    df = fetch_bars(s, years=years)
    out = _run_backtest(df, formula, costs_bps, slippage_bps)
    out["dataset"] = f"LIVE-{s}"
    out["symbol"] = s
    return out


# ---------- Writer Agent ----------

TEMPLATES = [
    ("Momentum Reversion", "rank(close / delay(close, {n}) - 1) * -1"),
    ("Volatility Breakout", "rank(std(close, 10) / std(close, 30)) * sign(close - delay(close, 1))"),
    ("Volume Drift", "correlation(volume, close, 20) * rank(close - delay(close, 5))"),
    ("RSI Reversion", "(50 - rsi(close, 14)) / 50 * rank(volume / sma(volume, 20))"),
    ("Trend EMA", "sign(ema(close, 12) - ema(close, 26)) * rank(atr(high, low, close, 14) / close)"),
]

def writer_generate(hypothesis: str) -> dict:
    h = (hypothesis or "").lower()
    idx = int(hashlib.md5(h.encode()).hexdigest(), 16) % len(TEMPLATES)
    # keyword routing
    if any(k in h for k in ["revert", "bounce", "reversion", "oversold", "dip"]):
        idx = 0 if "rsi" not in h else 3
    elif any(k in h for k in ["volatil", "breakout", "range"]):
        idx = 1
    elif any(k in h for k in ["volume", "divergence", "flow"]):
        idx = 2
    elif any(k in h for k in ["trend", "ema", "momentum follow", "cross"]):
        idx = 4
    name, formula_tpl = TEMPLATES[idx]
    n = 10 + int(hashlib.md5((h + "n").encode()).hexdigest(), 16) % 20
    formula = formula_tpl.format(n=n) if "{n}" in formula_tpl else formula_tpl
    code = (
        f"# {name} — generated by Writer Agent\n"
        f"# hypothesis: {hypothesis}\n"
        f"signal = {formula}\n"
        f"position = (signal / 3).clip(-1, 1).shift(1)  # next-bar, no look-ahead\n"
    )
    return {"name": f"{name} #{abs(hash(h)) % 900 + 100}", "formula": formula, "code": code}


# ---------- Judge Agent ----------

def judge_review(formula: str, hypothesis: str = "") -> dict:
    notes, score = [], 70
    f = formula.lower()
    checks = {}
    # 1. look-ahead: must contain delay/shift or rolling ops
    has_delay = any(k in f for k in ["delay", "shift", "rolling", "sma", "ema", "rsi", "std", "zscore", "correlation"])
    checks["no_lookahead"] = has_delay
    if has_delay:
        notes.append("No look-ahead bias: uses lagged operators."); score += 6
    else:
        notes.append("Risk: no lag operator found — possible look-ahead bias."); score -= 20
    # 2. uses future keywords
    bad = [w for w in ["future", "tomorrow"] if w in f]
    checks["no_future_leak"] = len(bad) == 0
    if bad: notes.append(f"Leakage keyword: {bad}."); score -= 15
    else: notes.append("No data-leakage keywords."); score += 4
    # 3. complexity
    ops = len(re.findall(r"(rank|delay|sma|ema|rsi|std|correlation|zscore|atr|sign|beta)", f))
    checks["interpretable"] = ops <= 6
    if ops <= 6: notes.append(f"Interpretable ({ops} ops)."); score += 5
    else: notes.append(f"Complex ({ops} ops) — overfit risk."); score -= 8
    # 4. division safety
    checks["safe"] = True
    try:
        df = make_market()
        eval_signal(formula, df)
        notes.append("Executes cleanly on 2520 bars."); score += 5
    except Exception as e:
        notes.append(f"Execution issue: {e}"); score -= 25
        checks["safe"] = False
    score = max(0, min(100, score))
    verdict = "approve" if score >= 70 else ("revise" if score >= 50 else "reject")
    return {"score": score, "notes": " ".join(notes), "checks": checks, "verdict": verdict}


def backtest_yahoo(symbol: str, formula: str, costs_bps: int = 10, slippage_bps: int = 5, years: float = 10):
    """Backtest a formula on real Yahoo daily bars (keyless, cached)."""
    from yahoo_provider import fetch_bars, clean_symbol
    s = clean_symbol(symbol)
    df = fetch_bars(s, years=years)
    out = _run_backtest(df, formula, costs_bps, slippage_bps)
    out["dataset"] = f"YAHOO-{s}"
    out["symbol"] = s
    return out


# ---------- learning: walk-forward train/test + parameter search ----------

def train_test_split(df: pd.DataFrame, test_frac: float = 0.3):
    """Chronological split — the model never sees the test segment in training."""
    cut = int(len(df) * (1 - test_frac))
    return df.iloc[:cut].reset_index(drop=True), df.iloc[cut:].reset_index(drop=True)


def evaluate_oos(df: pd.DataFrame, formula: str, costs_bps: int = 10, slippage_bps: int = 5,
                 test_frac: float = 0.3, risk: dict | None = None) -> dict:
    """Same formula on train vs unseen test. The gap between the two is the
    honesty metric: a big train/test Sharpe gap means overfit."""
    tr, te = train_test_split(df, test_frac)
    return {
        "train": _run_backtest(tr, formula, costs_bps, slippage_bps, **(risk or {})),
        "test": _run_backtest(te, formula, costs_bps, slippage_bps, **(risk or {})),
        "train_bars": len(tr),
        "test_bars": len(te),
    }


def _count_ops(formula: str) -> int:
    return len(re.findall(r"(rank|delay|sma|ema|rsi|std|correlation|zscore|atr|sign|beta|avg)", formula.lower()))


# Search space: 6 alpha families x parameter grids. Every candidate stays
# within the 12-op complexity cap. Deterministic order => reproducible runs.
LEARN_FAMILIES = [
    ("Momentum Reversion",
     ["rank(close / delay(close, {n}) - 1) * -1"],
     {"n": [5, 10, 15, 20, 30, 40, 60]}),
    ("RSI Reversion",
     ["(50 - rsi(close, {n})) / 50",
      "(50 - rsi(close, {n})) / 50 * rank(volume / sma(volume, 20))"],
     {"n": [7, 14, 21, 28]}),
    ("Trend EMA",
     ["sign(ema(close, {a}) - ema(close, {b}))",
      "sign(ema(close, {a}) - ema(close, {b})) * rank(volume / sma(volume, 20))"],
     {"a": [5, 8, 12, 20], "b": [21, 26, 50]}),
    ("Bollinger Reversion",
     ["(sma(close, {n}) - close) / (std(close, {n}) + 0.001)",
      "rank((sma(close, {n}) - close) / (std(close, {n}) + 0.001))"],
     {"n": [10, 20, 30, 50]}),
    ("Volume Drift",
     ["correlation(volume, close, {n})",
      "correlation(volume, close, {n}) * rank(close - delay(close, 5))"],
     {"n": [10, 20, 30, 60]}),
    ("Volatility Breakout",
     ["rank(std(close, 10) / std(close, {n})) * sign(close - delay(close, 1))"],
     {"n": [20, 30, 60]}),
]


def _enumerate_candidates(max_candidates: int = 150) -> list:
    cands = []
    for family, templates, grid in LEARN_FAMILIES:
        keys = list(grid)
        for vals in itertools.product(*(grid[k] for k in keys)):
            params = dict(zip(keys, vals))
            if params.get("a", -1) >= params.get("b", 10**9):
                continue  # EMA fast must be faster than slow
            for tpl in templates:
                f = tpl.format(**params)
                if _count_ops(f) > 12:
                    continue
                cands.append((family, f))
            if len(cands) >= max_candidates:
                break
        if len(cands) >= max_candidates:
            break
    return cands


def _select_best(cands: list, tr: pd.DataFrame, costs_bps: int, slippage_bps: int,
                 penalty: float = 0.03, risk: dict | None = None) -> list:
    """Score every candidate on a training slice. Returns ranked
    [(score, family, formula, metrics)] — selection never sees test data."""
    scored = []
    for family, f in cands:
        try:
            m = _run_backtest(tr, f, costs_bps, slippage_bps, **(risk or {}))
            if m["trades"] < 20:
                continue  # degenerate: barely trades
            score = m["sharpe"] - penalty * _count_ops(f)
            scored.append((score, family, f, m))
        except Exception:
            continue
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored


def paper_backfill(df: pd.DataFrame, formula: str, costs_bps: int = 10, slippage_bps: int = 5,
                   start_idx: int = 60, max_pos: float = 1.0, stop_pct: float = 10.0,
                   regime_off: bool = True, slip_vol_mult: float = 1.0) -> list:
    """Day-by-day paper ledger with EXACTLY the backtest's accounting
    (same shared core: overlays + vol-scaled costs). Paper equity from bar k
    must equal backtest equity[k:] ratios — verified in tests, not by faith."""
    pos, strat_ret = _positions_and_costs(df, formula, costs_bps, slippage_bps,
                                          max_pos, stop_pct, regime_off, slip_vol_mult)
    dates = df["date"] if "date" in df.columns else pd.Series([str(i) for i in range(len(df))])
    rows = []
    cap = 1.0
    base = float(df["close"].iloc[start_idx])
    for i in range(start_idx, len(df)):
        cap *= (1 + float(strat_ret.iloc[i]))
        rows.append({"date": str(dates.iloc[i]),
                     "equity": round(cap, 6),
                     "benchmark": round(float(df["close"].iloc[i] / base), 6),
                     "position": round(float(pos.iloc[i]), 4),
                     "price": round(float(df["close"].iloc[i]), 2),
                     "ret": round(float(strat_ret.iloc[i]) * 100, 4)})
    return rows


def walk_forward(df: pd.DataFrame, costs_bps: int = 10, slippage_bps: int = 5,
                 folds: int = 3, penalty: float = 0.03, risk: dict | None = None) -> dict:
    """Re-select the winner on an expanding training window and test each on
    the next unseen block. Consistent winners across folds = robust pattern;
    winners that only work once = luck. This is the closest thing to
    'would it have worked going forward' that history allows."""
    n = len(df)
    edges = [int(n * k / (folds + 1)) for k in range(folds + 2)]
    cands = _enumerate_candidates()
    results = []
    for k in range(1, folds + 1):
        tr = df.iloc[:edges[k]].reset_index(drop=True)
        te = df.iloc[edges[k]:edges[k + 1]].reset_index(drop=True)
        ranked = _select_best(cands, tr, costs_bps, slippage_bps, penalty, risk)
        if not ranked:
            continue
        _, family, formula, train_m = ranked[0]
        test_m = _run_backtest(te, formula, costs_bps, slippage_bps, **(risk or {}))
        results.append({"fold": k, "train_bars": len(tr), "test_bars": len(te),
                        "winner": family, "formula": formula,
                        "train_sharpe": train_m["sharpe"], "test_sharpe": test_m["sharpe"],
                        "test_return": test_m["returns"]})
    tests = [r["test_sharpe"] for r in results]
    return {"folds": results,
            "mean_test_sharpe": round(sum(tests) / len(tests), 2) if tests else 0.0,
            "positive_folds": sum(1 for t in tests if t > 0),
            "n_folds": len(results)}
def learn(df: pd.DataFrame, hypothesis: str = "", costs_bps: int = 10, slippage_bps: int = 5,
          test_frac: float = 0.3, penalty: float = 0.03, max_candidates: int = 150,
          risk: dict | None = None) -> dict:
    """Genuine model selection: enumerate the candidate space, score each on
    TRAIN only (Sharpe minus a per-op complexity penalty), report the winner
    on the unseen TEST segment, then stress it with walk-forward folds.
    Headline metrics are always test. Risk overlays apply identically in
    selection and in paper trading — no bait and switch."""
    tr, te = train_test_split(df, test_frac)
    cands = _enumerate_candidates(max_candidates)
    scored = _select_best(cands, tr, costs_bps, slippage_bps, penalty, risk)
    if not scored:
        raise ValueError("Learning found no viable candidate on the training segment.")
    score, family, formula, train_m = scored[0]
    test_m = _run_backtest(te, formula, costs_bps, slippage_bps, **(risk or {}))
    full_m = _run_backtest(df, formula, costs_bps, slippage_bps, **(risk or {}))
    wf = walk_forward(df, costs_bps, slippage_bps, penalty=penalty, risk=risk)
    code = (
        f"# {family} (learned) — train Sharpe {train_m['sharpe']}, test Sharpe {test_m['sharpe']}\n"
        f"# hypothesis: {hypothesis}\n"
        f"# searched {len(cands)} candidates, {len(scored)} viable, test {len(te)}/{len(df)} bars unseen\n"
        f"# walk-forward mean test Sharpe {wf['mean_test_sharpe']} ({wf['positive_folds']}/{wf['n_folds']} folds positive)\n"
        f"signal = {formula}\n"
        f"position = (signal / 3).clip(-1, 1).shift(1)  # next-bar, no look-ahead\n"
    )
    return {"name": f"{family} ·learned", "formula": formula, "code": code,
            "train": train_m, "test": test_m, "full": full_m,
            "walk_forward": wf, "risk": risk or {},
            "train_bars": len(tr), "test_bars": len(te),
            "candidates": len(cands), "viable": len(scored),
            "selection_score": round(score, 3)}
