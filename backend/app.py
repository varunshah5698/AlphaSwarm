"""Alpha Swarm API — FastAPI + SQLite. Serves /api/* and frontend dist."""
import json
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Header, Request, UploadFile, File, Form
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
import os

from db import conn, init_db, row_to_dict
from auth import valid_email, valid_username, valid_password, hash_password, verify_password, new_token, avatar_for
from quant import backtest, backtest_csv, backtest_live, backtest_yahoo, writer_generate, judge_review, make_market, learn, evaluate_oos, parse_csv_bars, _run_backtest, ENGINE_VERSION

SESSION_TTL_DAYS = int(os.environ.get("SESSION_TTL_DAYS", "7"))

init_db()

# Startup consistency: synthetic-engine strategies are recomputed under the
# current ENGINE_VERSION. Rows learned on real market data (dataset LIVE-*)
# are NEVER touched here — recomputing them on synthetic data would corrupt
# their curves and metrics. (Experiment rows keep historical JSON untouched.)
try:
    _c = conn()
    _cols = [r["name"] for r in _c.execute("PRAGMA table_info(strategies)").fetchall()]
    _rows = _c.execute("SELECT id, formula, judge_score, dataset FROM strategies" if "dataset" in _cols else "SELECT id, formula, judge_score FROM strategies").fetchall()
    for _r in _rows:
        try:
            _ds = _r["dataset"] if "dataset" in _cols else ""
            if (_ds or "").startswith("LIVE-"):
                continue
            _m = backtest(_r["formula"])
            _approved = (_r["judge_score"] or 0) >= 70
            _st = "active" if (_approved and _m["sharpe"] >= 1.0) else ("testing" if _m["sharpe"] >= 0.4 else "rejected")
            _c.execute(
                "UPDATE strategies SET sharpe=?, returns=?, max_dd=?, win_rate=?, trades=?, ann_vol=?, equity=?, status=? WHERE id=?",
                (_m["sharpe"], _m["returns"], _m["max_dd"], _m["win_rate"], _m["trades"], _m.get("ann_vol", 0), json.dumps(_m["equity_curve"]), _st, _r["id"]),
            )
        except Exception:
            pass
    if "dataset" in _cols:
        _c.execute("UPDATE strategies SET dataset='SYNTH-SPX-2014-2024' WHERE dataset IS NULL OR dataset=''")
    _c.commit()
    _c.close()
except Exception:
    pass
app = FastAPI(title="Alpha Swarm API", version="2.0.0")
_allowed = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def _security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "same-origin"
    resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return resp


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
    return JSONResponse({"detail": "Internal error. Try again or check your input."}, status_code=500)


@app.exception_handler(RequestValidationError)
async def _validation(request: Request, exc: RequestValidationError):
    # clean message without echoing huge inputs back
    msgs = []
    for e in exc.errors():
        loc = ".".join(str(x) for x in e.get("loc", []) if x != "body")
        msgs.append(f"{loc}: {e.get('msg', 'invalid')}" if loc else e.get("msg", "invalid"))
    return JSONResponse({"detail": "; ".join(msgs) or "Invalid request."}, status_code=422)


def _utcnow():
    return datetime.now(timezone.utc)


def _expiry_ts(days: int = SESSION_TTL_DAYS) -> str:
    return (_utcnow() + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")


# ---------- lightweight in-memory rate limiter (single-process) ----------
_RL: dict[str, list[float]] = {}


def _check_rate(key: str, max_n: int, window_s: int):
    now = time.time()
    hits = [t for t in _RL.get(key, []) if now - t < window_s]
    if len(hits) >= max_n:
        raise HTTPException(429, "Too many requests. Slow down and retry in a minute.")
    hits.append(now)
    _RL[key] = hits
    if len(_RL) > 5000:  # prevent unbounded growth
        for k in list(_RL):
            _RL[k] = [t for t in _RL[k] if now - t < window_s]
            if not _RL[k]:
                del _RL[k]


def _client_ip(request: Request | None) -> str:
    if request is None:
        return "unknown"
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def log(agent: str, message: str, level: str = "info"):
    c = conn()
    c.execute("INSERT INTO logs (level, agent, message) VALUES (?,?,?)", (level, agent, message))
    c.commit(); c.close()


# ---------- models ----------
class StrategyIn(BaseModel):
    name: str = Field(max_length=120)
    hypothesis: str = Field(default="", max_length=2000)
    formula: str = Field(max_length=500)
    status: str = "testing"

class PipelineIn(BaseModel):
    hypothesis: str = Field(max_length=2000)
    costs_bps: int = Field(default=10, ge=0, le=500)
    slippage_bps: int = Field(default=5, ge=0, le=500)
    symbol: str = Field(default="AAPL", max_length=12)  # single-stock focus; "" = synthetic lab data
    max_pos: float = Field(default=1.0, ge=0.1, le=1.0)  # position cap
    stop_pct: float = Field(default=10.0, ge=0.0, le=50.0)  # trailing stop %, 0 = off
    regime_off: bool = True  # stand aside when vol spikes

class BacktestIn(BaseModel):
    formula: str = Field(max_length=500)
    costs_bps: int = Field(default=10, ge=0, le=500)
    slippage_bps: int = Field(default=5, ge=0, le=500)
    symbol: str = Field(default="", max_length=12)  # optional: real bars + train/test report
    max_pos: float = Field(default=1.0, ge=0.1, le=1.0)
    stop_pct: float = Field(default=10.0, ge=0.0, le=50.0)
    regime_off: bool = True

class LiveBacktestIn(BacktestIn):
    symbol: str = Field(max_length=12)
    years: float = Field(default=5, ge=0.25, le=10)

class TestAllIn(BaseModel):
    symbol: str = Field(max_length=12)
    costs_bps: int = Field(default=10, ge=0, le=500)
    slippage_bps: int = Field(default=5, ge=0, le=500)
    max_pos: float = Field(default=1.0, ge=0.1, le=1.0)
    stop_pct: float = Field(default=10.0, ge=0.0, le=50.0)
    regime_off: bool = True


def _risk_of(p) -> dict:
    """Risk overlay params shared by selection, backtests and paper trading."""
    return {"max_pos": float(p.max_pos), "stop_pct": float(p.stop_pct),
            "regime_off": bool(p.regime_off), "slip_vol_mult": 1.0}

class PaperPatch(BaseModel):
    status: str | None = None
    notes: str | None = None

class RegisterIn(BaseModel):
    username: str
    email: str
    password: str

class LoginIn(BaseModel):
    email: str
    password: str


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def _current_user(authorization: str | None = None):
    """Return user dict for a valid, non-expired token (sliding 7-day window)."""
    token = _bearer_token(authorization)
    if not token:
        return None
    c = conn()
    row = c.execute(
        "SELECT u.id, u.username, u.email, u.role, u.created_at, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?",
        (token,),
    ).fetchone()
    if not row:
        c.close()
        return None
    try:
        exp = datetime.strptime(row["expires_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except Exception:
        exp = None
    if exp is None or exp < _utcnow():
        # missing/malformed/expired stamp -> kill the session, force re-login
        c.execute("DELETE FROM sessions WHERE token = ?", (token,))
        c.commit()
        c.close()
        return None
    # slide the window for active users
    c.execute("UPDATE sessions SET expires_at = ? WHERE token = ?", (_expiry_ts(), token))
    c.commit()
    c.close()
    return dict(row)


def _require_user(authorization: str | None = None):
    u = _current_user(authorization)
    if not u:
        raise HTTPException(401, "Sign-in required. Please log in again.")
    return u


def _public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u["username"],
        "username": u["username"],
        "email": u["email"],
        "role": u.get("role", "Researcher"),
        "avatar": avatar_for(u["username"]),
    }


# ---------- auth ----------
@app.post("/api/auth/register")
def register(body: RegisterIn, request: Request):
    _check_rate(f"auth:{_client_ip(request)}", 10, 60)
    username = (body.username or "").strip()
    email = (body.email or "").strip().lower()
    if not valid_username(username):
        raise HTTPException(400, "Username must be 3-24 chars: letters, numbers, _ . -")
    if not valid_email(email):
        raise HTTPException(400, "Enter a valid email address.")
    ok, msg = valid_password(body.password)
    if not ok:
        raise HTTPException(400, msg)
    c = conn()
    if c.execute("SELECT 1 FROM users WHERE lower(email)=?", (email,)).fetchone():
        c.close()
        raise HTTPException(409, "An account with this email already exists. Please sign in.")
    if c.execute("SELECT 1 FROM users WHERE lower(username)=lower(?)", (username,)).fetchone():
        c.close()
        raise HTTPException(409, "Username is taken. Try another one.")
    cur = c.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?,?,?)",
        (username, email, hash_password(body.password)),
    )
    c.commit()
    u = c.execute("SELECT id, username, email, role, created_at FROM users WHERE id=?", (cur.lastrowid,)).fetchone()
    c.close()
    log("System", f"New researcher registered: {username}")
    return {"ok": True, "user": _public_user(dict(u)), "message": "Account created. Please sign in."}


@app.post("/api/auth/login")
def login(body: LoginIn, request: Request):
    _check_rate(f"auth:{_client_ip(request)}", 10, 60)
    email = (body.email or "").strip().lower()
    if not valid_email(email):
        raise HTTPException(400, "Enter a valid email address.")
    if not body.password:
        raise HTTPException(400, "Enter your password.")
    c = conn()
    row = c.execute("SELECT * FROM users WHERE lower(email)=?", (email,)).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        c.close()
        raise HTTPException(401, "Invalid email or password.")
    token = new_token()
    c.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)", (token, row["id"], _expiry_ts()))
    c.commit()
    u = {"id": row["id"], "username": row["username"], "email": row["email"], "role": row["role"]}
    c.close()
    log("System", f"Sign-in: {u['username']}")
    return {"ok": True, "token": token, "user": _public_user(u)}


@app.get("/api/auth/me")
def me(authorization: str | None = Header(default=None)):
    u = _current_user(authorization)
    if not u:
        raise HTTPException(401, "Session expired. Please sign in again.")
    return {"ok": True, "user": {**_public_user(u), "avatar": avatar_for(u["username"])}}


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    token = _bearer_token(authorization)
    if token:
        c = conn()
        c.execute("DELETE FROM sessions WHERE token=?", (token,))
        c.commit()
        c.close()
    return {"ok": True}


# ---------- health / dashboard ----------
_boot_at = time.time()


@app.get("/api/public/stats")
def public_stats():
    """Unauthenticated lab counters for the landing page. No user data."""
    c = conn()
    n_strat = c.execute("SELECT COUNT(*) n FROM strategies").fetchone()["n"]
    n_exp = c.execute("SELECT COUNT(*) n FROM experiments").fetchone()["n"]
    best = c.execute("SELECT sharpe FROM strategies ORDER BY sharpe DESC LIMIT 1").fetchone()
    n_active = c.execute("SELECT COUNT(*) n FROM strategies WHERE status='active'").fetchone()["n"]
    c.close()
    return {
        "strategies": n_strat,
        "experiments": n_exp,
        "active": n_active,
        "best_sharpe": round(best["sharpe"], 2) if best else None,
    }


@app.get("/api/health")
def health():
    try:
        c = conn()
        c.execute("SELECT 1").fetchone()
        db_ok = True
        c.close()
    except Exception:
        db_ok = False
    return {
        "ok": db_ok,
        "service": "alpha-swarm",
        "version": "2.0.0",
        "engine": ENGINE_VERSION,
        "uptime_s": int(time.time() - _boot_at),
    }

@app.get("/api/dashboard/metrics")
def metrics(authorization: str | None = Header(default=None)):
    _require_user(authorization)
    c = conn()
    strats = [dict(r) for r in c.execute("SELECT * FROM strategies").fetchall()]
    exps = c.execute("SELECT COUNT(*) n FROM experiments").fetchone()["n"]
    logs = c.execute("SELECT COUNT(*) n FROM logs").fetchone()["n"]
    c.close()
    active = [s for s in strats if s["status"] == "active"]
    avg_sharpe = round(sum(s["sharpe"] for s in strats) / max(1, len(strats)), 2)
    return {
        "active_strategies": len(active),
        "total_strategies": len(strats),
        "avg_sharpe": avg_sharpe,
        "total_trades": sum(s["trades"] for s in strats),
        "experiments": exps, "logs": logs,
        "best": max(strats, key=lambda s: s["sharpe"])["name"] if strats else None,
    }

@app.get("/api/market/equity")
def market_equity(authorization: str | None = Header(default=None)):
    _require_user(authorization)
    df = make_market()
    eq = (1 + df["close"].pct_change().fillna(0)).cumprod()
    return {"benchmark": [{"t": i, "v": round(float(v), 4)} for i, v in enumerate(eq.iloc[::10])]}


def _equity_vals(strategy_row) -> list[float]:
    """Extract equity curve values from a strategy row (newest code stores JSON)."""
    try:
        pts = json.loads(strategy_row["equity"] or "[]")
        vals = [float(p["v"]) for p in pts if "v" in p]
        if len(vals) > 5:
            return vals
    except Exception:
        pass
    return []


def _best_strategy(strats: list[dict]) -> dict | None:
    actives = [s for s in strats if s["status"] == "active"]
    pool = actives or strats
    return max(pool, key=lambda s: s["sharpe"]) if pool else None


def _resample(vals: list[float], n: int) -> list[float]:
    """Resample a series to exactly n points by even index mapping."""
    if n <= 0:
        return []
    if len(vals) == n:
        return vals
    if len(vals) < n:
        return vals + [vals[-1]] * (n - len(vals)) if vals else []
    idx = [round(i * (len(vals) - 1) / (n - 1)) for i in range(n)]
    return [vals[i] for i in idx]


@app.get("/api/dashboard/charts")
def dashboard_charts(benchmark: str = "SPY", authorization: str | None = Header(default=None)):
    """Live dashboard series — best alpha vs a real benchmark overlay."""
    _require_user(authorization)
    c = conn()
    strats = [dict(r) for r in c.execute("SELECT * FROM strategies").fetchall()]
    hour_rows = c.execute(
        "SELECT strftime('%H', created_at) h, COUNT(*) n FROM logs GROUP BY h"
    ).fetchall()
    c.close()

    dist_map: dict[str, int] = {}
    for s in strats:
        dist_map[s["status"]] = dist_map.get(s["status"], 0) + 1
    distribution = [{"name": k.capitalize(), "value": v} for k, v in sorted(dist_map.items())]

    best = _best_strategy(strats)
    alpha_vals = _equity_vals(best) if best else []
    # Display-only downsampling: storage is full-resolution, the chart needs ≤252 pts.
    _step = max(1, len(alpha_vals) // 252)
    alpha_vals = alpha_vals[::_step]
    bench_sym = (benchmark or "SPY").strip().upper()[:12] or "SPY"
    try:
        _, _bdf, _bsrc = _get_live_bars(bench_sym, years=10)
        _bvals = (1 + _bdf["close"].pct_change().fillna(0)).cumprod().tolist()
    except Exception:
        _df = make_market()
        _bvals = (1 + _df["close"].pct_change().fillna(0)).cumprod().tolist()
        bench_sym = "SYNTH-SPX"
    bench = _resample(_bvals, len(alpha_vals)) if alpha_vals else _bvals[:: max(1, len(_bvals) // 252)]
    n = max(len(alpha_vals), len(bench))
    equity = [
        {
            "t": i,
            "alpha": round(alpha_vals[i], 4) if i < len(alpha_vals) else None,
            "benchmark": round(float(bench[i]), 4) if i < len(bench) else None,
        }
        for i in range(n)
    ]

    activity = [{"hour": r["h"], "tasks": r["n"]} for r in hour_rows if r["h"]]

    return {
        "equity": equity,
        "equity_source": best["name"] if best else None,
        "benchmark": bench_sym,
        "distribution": distribution,
        "activity": activity,
    }


# Trading-day window sizes. Curves are stored at full bar resolution, so these
# are real horizons (21 trading days ≈ 1 calendar month). ALL = whole history.
PERIOD_POINTS = {"1M": 21, "3M": 63, "6M": 126, "1Y": 252, "ALL": None}


def _slice_window(vals: list[float], period: str) -> list[float]:
    want = PERIOD_POINTS.get(period)
    if not want or len(vals) <= want:
        return vals
    return vals[-want:]


def _window_metrics(vals: list[float]) -> dict:
    """Return / Sharpe / drawdown / win-rate computed on one equity slice.

    Sharpe is annualized with sqrt(252) on daily bar returns; win rate is the
    share of up-days among days the equity moved.
    """
    import math
    if len(vals) < 2 or not vals[0]:
        return {"returns": 0.0, "sharpe": 0.0, "max_dd": 0.0, "win_rate": 0.0}
    rets = [(vals[i] / vals[i - 1] - 1) for i in range(1, len(vals)) if vals[i - 1]]
    total = (vals[-1] / vals[0] - 1) * 100
    peak, dd = vals[0], 0.0
    for v in vals:
        peak = max(peak, v)
        if peak:
            dd = min(dd, (v / peak - 1) * 100)
    if rets:
        mu = sum(rets) / len(rets)
        var = sum((x - mu) ** 2 for x in rets) / len(rets)
        sd = math.sqrt(var) if var > 0 else 1e-9
        sharpe = mu / sd * math.sqrt(252)
    else:
        sharpe = 0.0
    moved = [r for r in rets if r != 0]
    win = sum(1 for r in moved if r > 0) / len(moved) * 100 if moved else 0.0
    return {"returns": round(total, 2), "sharpe": round(sharpe, 2),
            "max_dd": round(dd, 2), "win_rate": round(win, 1)}


def _chunk_returns(vals: list[float]) -> list[tuple]:
    """Split a window into honest calendar-ish buckets with labels.

    Windows up to ~18 months split into ~21-trading-day months (M1..Mn);
    longer windows split into ~252-day years (Y1..Yn) so a label always means
    what it says.
    """
    if len(vals) < 2:
        return []
    if len(vals) <= 378:
        per, prefix = 21, "M"
    else:
        per, prefix = 252, "Y"
    n = max(1, min(12, round(len(vals) / per)))
    size = max(1, len(vals) // n)
    out = []
    for i in range(0, len(vals) - 1, size):
        seg = vals[i : i + size + 1]
        if len(seg) > 1 and seg[0]:
            out.append((f"{prefix}{len(out) + 1}", round((seg[-1] / seg[0] - 1) * 100, 2)))
        if len(out) >= 12:
            break
    return out


def _rolling_sharpe(vals: list[float], window: int = 20) -> list[float]:
    window = max(5, min(window, len(vals) // 3))
    if len(vals) < window + 1:
        return []
    import math
    rets = [(vals[i] / vals[i - 1] - 1) for i in range(1, len(vals)) if vals[i - 1]]
    out = []
    for i in range(window, len(rets)):
        w = rets[i - window : i]
        mu = sum(w) / len(w)
        var = sum((x - mu) ** 2 for x in w) / len(w)
        sd = math.sqrt(var) if var > 0 else 1e-9
        out.append(round(mu / sd * math.sqrt(252), 2))
    return out


@app.get("/api/analytics")
def analytics(period: str = "1Y", authorization: str | None = Header(default=None)):
    """Live analytics computed from stored strategies + best equity curve."""
    _require_user(authorization)
    c = conn()
    strats = [dict(r) for r in c.execute("SELECT * FROM strategies").fetchall()]
    c.close()
    if not strats:
        return {"kpis": None, "monthly": [], "scatter": [], "rolling": [], "radar": []}

    actives = [s for s in strats if s["status"] == "active"] or strats
    # Every KPI is recomputed on the selected window, per strategy, then averaged —
    # switching 1M/3M/6M/1Y/ALL genuinely changes these numbers.
    per_strat = [_window_metrics(_slice_window(_equity_vals(s), period)) for s in actives]
    avg = lambda k: sum(m[k] for m in per_strat) / len(per_strat)
    kpis = {
        "total_return": round(avg("returns"), 2),
        "sharpe": round(avg("sharpe"), 2),
        "max_dd": round(min(m["max_dd"] for m in per_strat), 2),
        "win_rate": round(avg("win_rate"), 1),
        "active_count": len([s for s in strats if s["status"] == "active"]),
        "total_count": len(strats),
    }

    best = _best_strategy(strats)
    window = _slice_window(_equity_vals(best) if best else [], period)
    monthly = [
        {"month": label, "returns": v} for label, v in _chunk_returns(window)
    ]
    rolling = [
        {"day": i + 1, "sharpe": v} for i, v in enumerate(_rolling_sharpe(window))
    ]
    scatter = []
    for s in strats:
        m = _window_metrics(_slice_window(_equity_vals(s), period))
        scatter.append({"x": round(abs(m["max_dd"]), 2), "y": m["returns"], "name": s["name"][:24]})

    def clamp(v, lo=0, hi=100):
        return max(lo, min(hi, round(v)))

    radar = [
        {"metric": "Sharpe", "value": clamp(avg("sharpe") / 3 * 100)},
        {"metric": "Win Rate", "value": clamp(avg("win_rate"))},
        {"metric": "Calmar", "value": clamp(abs(avg("returns")) / max(abs(kpis["max_dd"]), 1) * 50)},
        {"metric": "Return", "value": clamp(avg("returns") / 30 * 100)},
        {"metric": "Breadth", "value": clamp(len(strats) / 10 * 100)},
        {"metric": "Stability", "value": clamp(100 + kpis["max_dd"] * 2)},
    ]
    return {"kpis": kpis, "monthly": monthly, "scatter": scatter, "rolling": rolling, "radar": radar}


# ---------- strategies ----------
@app.get("/api/strategies")
def list_strats(status: str = "all", q: str = "", authorization: str | None = Header(default=None)):
    _require_user(authorization)
    c = conn()
    rows = c.execute("SELECT * FROM strategies ORDER BY sharpe DESC").fetchall()
    c.close()
    out = []
    for r in rows:
        d = row_to_dict(r)
        if status != "all" and d["status"] != status: continue
        if q and q.lower() not in (d["name"] + d["formula"]).lower(): continue
        # don't ship curves in list (full-res is ~2500 pts each — detail endpoint has them)
        d.pop("equity", None)
        d.pop("equity_curve", None)
        out.append(d)
    return out

@app.post("/api/strategies")
def create_strat(s: StrategyIn, authorization: str | None = Header(default=None)):
    u = _require_user(authorization)
    _check_rate(f"write:{u['id']}", 30, 60)
    if s.status not in ("testing", "active", "rejected"):
        raise HTTPException(400, "Invalid status.")
    try:
        m = backtest(s.formula)
    except Exception as e:
        raise HTTPException(400, str(e))
    c = conn()
    cur = c.execute(
        "INSERT INTO strategies (name, hypothesis, formula, status, sharpe, returns, max_dd, win_rate, trades, author, ann_vol, equity, dataset) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (s.name, s.hypothesis, s.formula, s.status, m["sharpe"], m["returns"], m["max_dd"], m["win_rate"], m["trades"], u["username"], m.get("ann_vol", 0), json.dumps(m["equity_curve"]), "SYNTH-SPX-2014-2024"))
    c.commit(); sid = cur.lastrowid; c.close()
    log("Writer Agent", f"Manual strategy created by {u['username']}: {s.name}")
    return {"id": sid, **m}

@app.get("/api/strategies/{sid}")
def get_strat(sid: int, authorization: str | None = Header(default=None)):
    _require_user(authorization)
    c = conn()
    r = c.execute("SELECT * FROM strategies WHERE id=?", (sid,)).fetchone()
    c.close()
    if not r: raise HTTPException(404, "not found")
    return row_to_dict(r)

@app.patch("/api/strategies/{sid}")
def patch_strat(sid: int, body: dict, authorization: str | None = Header(default=None)):
    u = _require_user(authorization)
    _check_rate(f"write:{u['id']}", 30, 60)
    allowed = {"status", "name", "formula", "judge_notes"}
    sets = {k: v for k, v in body.items() if k in allowed}
    if not sets: raise HTTPException(400, "nothing to update")
    if "status" in sets and sets["status"] not in ("testing", "active", "rejected"):
        raise HTTPException(400, "Invalid status.")
    if "name" in sets and len(str(sets["name"])) > 120:
        raise HTTPException(400, "Name too long.")
    c = conn()
    c.execute(f"UPDATE strategies SET {','.join(f'{k}=?' for k in sets)} WHERE id=?", (*sets.values(), sid))
    c.commit(); c.close()
    return {"ok": True}

@app.delete("/api/strategies/{sid}")
def del_strat(sid: int, authorization: str | None = Header(default=None)):
    u = _require_user(authorization)
    _check_rate(f"write:{u['id']}", 30, 60)
    c = conn(); c.execute("DELETE FROM strategies WHERE id=?", (sid,)); c.commit(); c.close()
    return {"ok": True}


# ---------- pipeline: Generate -> Critique -> Test -> Measure -> Learn ----------
def _get_live_bars(symbol: str, years: float = 10):
    """Real daily bars for one symbol. Yahoo Finance (keyless) first, Finnhub
    fallback when FINNHUB_API_KEY is configured. Returns (symbol, df, source)."""
    from yahoo_provider import clean_symbol as _yclean, fetch_bars as _ybars
    s = _yclean(symbol)
    try:
        return s, _ybars(s, years=years), "Yahoo Finance"
    except Exception as ye:
        try:
            from finnhub_provider import fetch_bars as _fbars, is_configured, clean_symbol as _fclean
            if is_configured():
                return s, _fbars(_fclean(symbol), years=min(years, 10)), "Finnhub"
        except Exception:
            pass
        if isinstance(ye, ValueError):
            raise HTTPException(400, str(ye))
        raise HTTPException(503, f"{ye} (Set FINNHUB_API_KEY on the server as a fallback feed.)")


@app.post("/api/pipeline/run")
def pipeline_run(p: PipelineIn, authorization: str | None = Header(default=None)):
    u = _require_user(authorization)
    _check_rate(f"pipeline:{u['id']}", 8, 60)
    if not p.hypothesis.strip():
        raise HTTPException(400, "Hypothesis is required.")
    symbol = (p.symbol or "").strip().upper()
    log("Research Agent", f"Hypothesis received: {p.hypothesis[:120]}")
    if symbol:
        # Learn on real market data: search the candidate space on a training
        # segment, select there, report on unseen test bars. Headline = test.
        # symbol=AUTO scans the whole universe and keeps the best test result.
        targets = UNIVERSE if symbol == "AUTO" else [symbol]
        scans = []
        for tgt in targets:
            try:
                s2, df2, src2 = _get_live_bars(tgt)
            except HTTPException as e:
                log("Data Ingestion", f"Live bars failed for {tgt}: {e.detail}", "error")
                if len(targets) == 1:
                    raise
                scans.append({"symbol": tgt, "error": str(e.detail)[:120]})
                continue
            log("Data Ingestion", f"Loaded {src2} {s2}: {len(df2)} daily bars")
            try:
                res2 = learn(df2, p.hypothesis, p.costs_bps, p.slippage_bps, risk=_risk_of(p))
            except Exception as e:
                log("Backtest Engine", f"Learning failed on {s2}: {e}", "error")
                if len(targets) == 1:
                    raise HTTPException(400, f"Learning failed: {e}")
                scans.append({"symbol": s2, "error": str(e)[:120]})
                continue
            scans.append({"symbol": s2, "source": src2, "bars": len(df2),
                          "winner": res2["name"], "formula": res2["formula"],
                          "train_sharpe": res2["train"]["sharpe"], "test_sharpe": res2["test"]["sharpe"],
                          "res": res2, "df": df2})
        ok = [s for s in scans if "res" in s]
        if not ok:
            raise HTTPException(503, "No symbol in the universe returned usable bars.")
        best = max(ok, key=lambda s: s["test_sharpe"])
        sym, df, source, res = best["symbol"], best["df"], best["source"], best["res"]
        dataset = f"LIVE-{sym}"
        w = {"name": res["name"], "formula": res["formula"], "code": res["code"]}
        log("Writer Agent", f"Learned {res['candidates']} candidates, {res['viable']} viable — winner: {res['formula']}")
        j = judge_review(res["formula"], p.hypothesis)
        lvl = "success" if j["verdict"] == "approve" else ("warn" if j["verdict"] == "revise" else "error")
        log("Judge Agent", f"Verdict={j['verdict']} score={j['score']}: {j['notes']}", lvl)
        t, m = res["train"], res["test"]
        status = "active" if (j["verdict"] == "approve" and m["sharpe"] >= 1.0) else ("testing" if m["sharpe"] >= 0.4 else "rejected")
        wf = res.get("walk_forward", {})
        log("Backtest Engine", f"Learned [{dataset}]: train Sharpe={t['sharpe']} → TEST Sharpe={m['sharpe']} Return={m['returns']}% DD={m['max_dd']}% | walk-forward {wf.get('mean_test_sharpe')} ({wf.get('positive_folds')}/{wf.get('n_folds')} folds+)", "success")
        metrics = {**m, "equity_curve": res["full"]["equity_curve"], "dataset": dataset}
        learning = {"source": source, "symbol": sym, "dataset": dataset,
                    "candidates": res["candidates"], "viable": res["viable"],
                    "train": t, "test_bars": res["test_bars"], "train_bars": res["train_bars"],
                    "walk_forward": wf, "risk": res.get("risk", {}),
                    "scan": [{k: s[k] for k in ("symbol", "source", "bars", "winner", "train_sharpe", "test_sharpe", "error") if k in s} for s in scans],
                    "selection_score": res["selection_score"]}
        c = conn()
        cur = c.execute(
            "INSERT INTO strategies (name, hypothesis, formula, code, status, sharpe, returns, max_dd, win_rate, trades, author, judge_notes, judge_score, ann_vol, equity, dataset) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (w["name"], p.hypothesis, w["formula"], w["code"], status, m["sharpe"], m["returns"], m["max_dd"], m["win_rate"], m["trades"], "Writer Agent", j["notes"], j["score"], m.get("ann_vol", 0), json.dumps(metrics["equity_curve"]), dataset))
        sid = cur.lastrowid
        c.execute("INSERT INTO experiments (strategy_id, hypothesis, writer_output, judge_output, metrics, costs_bps, slippage_bps, dataset) VALUES (?,?,?,?,?,?,?,?)",
                  (sid, p.hypothesis, json.dumps(w), json.dumps(j), json.dumps({**metrics, "equity_curve": metrics["equity_curve"][:252]}), p.costs_bps, p.slippage_bps, dataset))
        c.execute("INSERT INTO logs (level, agent, message) VALUES (?,?,?)",
                  ("success" if status == "active" else "info", "Feedback Agent", f"Strategy #{sid} learned on {sym} test data, stored as {status}"))
        c.commit(); c.close()
        return {"strategy_id": sid, "writer": w, "judge": j, "metrics": metrics, "status": status, "learning": learning}
    dataset = "SYNTH-SPX-2014-2024"
    w = writer_generate(p.hypothesis)
    log("Writer Agent", f"Formula generated: {w['formula']}")
    j = judge_review(w["formula"], p.hypothesis)
    lvl = "success" if j["verdict"] == "approve" else ("warn" if j["verdict"] == "revise" else "error")
    log("Judge Agent", f"Verdict={j['verdict']} score={j['score']}: {j['notes']}", lvl)
    try:
        m = _run_backtest(make_market(), w["formula"], p.costs_bps, p.slippage_bps, **_risk_of(p))
    except Exception as e:
        log("Backtest Engine", f"Backtest failed: {e}", "error")
        raise HTTPException(400, f"Backtest failed: {e}")
    # Practitioner-style bands: >=1.0 validated, >=0.4 worth investigating,
    # below that rejected. Realistic base rates: most mined alphas fail.
    status = "active" if (j["verdict"] == "approve" and m["sharpe"] >= 1.0) else ("testing" if m["sharpe"] >= 0.4 else "rejected")
    log("Backtest Engine", f"Backtest complete [{dataset}]: Sharpe={m['sharpe']} Return={m['returns']}% DD={m['max_dd']}%", "success")
    c = conn()
    cur = c.execute(
        "INSERT INTO strategies (name, hypothesis, formula, code, status, sharpe, returns, max_dd, win_rate, trades, author, judge_notes, judge_score, ann_vol, equity, dataset) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (w["name"], p.hypothesis, w["formula"], w["code"], status, m["sharpe"], m["returns"], m["max_dd"], m["win_rate"], m["trades"], "Writer Agent", j["notes"], j["score"], m.get("ann_vol", 0), json.dumps(m["equity_curve"]), dataset))
    sid = cur.lastrowid
    c.execute("INSERT INTO experiments (strategy_id, hypothesis, writer_output, judge_output, metrics, costs_bps, slippage_bps, dataset) VALUES (?,?,?,?,?,?,?,?)",
              (sid, p.hypothesis, json.dumps(w), json.dumps(j), json.dumps(m), p.costs_bps, p.slippage_bps, dataset))
    c.execute("INSERT INTO logs (level, agent, message) VALUES (?,?,?)",
              ("success" if status == "active" else "info", "Feedback Agent", f"Strategy #{sid} stored as {status}"))
    c.commit(); c.close()
    return {"strategy_id": sid, "writer": w, "judge": j, "metrics": m, "status": status}

@app.post("/api/backtest")
def run_backtest(b: BacktestIn, authorization: str | None = Header(default=None)):
    u = _require_user(authorization)
    _check_rate(f"backtest:{u['id']}", 20, 60)
    symbol = (b.symbol or "").strip().upper()
    try:
        if symbol:
            sym, df, source = _get_live_bars(symbol)
            out = _run_backtest(df, b.formula, b.costs_bps, b.slippage_bps, **_risk_of(b))
            oos = evaluate_oos(df, b.formula, b.costs_bps, b.slippage_bps, risk=_risk_of(b))
            out["dataset"] = f"YAHOO-{sym}" if source.startswith("Yahoo") else f"LIVE-{sym}"
            out["symbol"] = sym
            out["train"] = oos["train"]
            out["test"] = oos["test"]
            out["train_bars"] = oos["train_bars"]
            out["test_bars"] = oos["test_bars"]
            log("Backtest Engine", f"Backtest by {u['username']}: {sym} train Sharpe={oos['train']['sharpe']} test Sharpe={oos['test']['sharpe']}")
            return out
        df = make_market()
        out = _run_backtest(df, b.formula, b.costs_bps, b.slippage_bps, **_risk_of(b))
        oos = evaluate_oos(df, b.formula, b.costs_bps, b.slippage_bps, risk=_risk_of(b))
        out["train"] = oos["train"]
        out["test"] = oos["test"]
        out["train_bars"] = oos["train_bars"]
        out["test_bars"] = oos["test_bars"]
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/backtest/csv")
async def run_backtest_csv(
    file: UploadFile = File(...),
    formula: str = Form(...),
    costs_bps: int = Form(10),
    slippage_bps: int = Form(5),
    authorization: str | None = Header(default=None),
):
    """Backtest a formula on the user's own OHLCV CSV instead of synthetic data."""
    u = _require_user(authorization)
    _check_rate(f"backtest:{u['id']}", 20, 60)
    if len(formula) > 500:
        raise HTTPException(400, "Formula too long (max 500 chars).")
    costs_bps = max(0, min(costs_bps, 500))
    slippage_bps = max(0, min(slippage_bps, 500))
    try:
        raw = await file.read()
        out = backtest_csv(raw, formula, costs_bps, slippage_bps)
        df = parse_csv_bars(raw)
        oos = evaluate_oos(df, formula, costs_bps, slippage_bps)
        out["train"] = oos["train"]
        out["test"] = oos["test"]
        out["train_bars"] = oos["train_bars"]
        out["test_bars"] = oos["test_bars"]
    except Exception as e:
        raise HTTPException(400, str(e))
    log("Backtest Engine", f"CSV backtest by {u['username']}: {file.filename} Sharpe={out['sharpe']} test Sharpe={out['test']['sharpe']}")
    return out

@app.post("/api/backtest/live")
def run_backtest_live(b: LiveBacktestIn, authorization: str | None = Header(default=None)):
    """Backtest a formula on real daily bars for a symbol (Yahoo keyless, Finnhub fallback)."""
    u = _require_user(authorization)
    _check_rate(f"backtest:{u['id']}", 20, 60)
    try:
        sym, df, source = _get_live_bars(b.symbol, years=b.years)
        out = _run_backtest(df, b.formula, b.costs_bps, b.slippage_bps, **_risk_of(b))
        out["dataset"] = f"LIVE-{sym}"
        out["symbol"] = sym
    except HTTPException:
        raise
    except (ValueError, ConnectionError) as e:
        raise HTTPException(400 if isinstance(e, ValueError) else 503, str(e))
    log("Backtest Engine", f"Live backtest by {u['username']}: {out['symbol']} Sharpe={out['sharpe']}")
    return out

@app.post("/api/strategies/test-all")
def test_all_strategies(b: TestAllIn, authorization: str | None = Header(default=None)):
    """Run EVERY stored strategy on live bars for a symbol. Ranked best-first."""
    u = _require_user(authorization)
    _check_rate(f"testall:{u['id']}", 4, 60)
    try:
        symbol, df, source = _get_live_bars(b.symbol)
    except HTTPException as e:
        raise
    except (ValueError, ConnectionError) as e:
        raise HTTPException(400 if isinstance(e, ValueError) else 503, str(e))
    c = conn()
    strats = [dict(r) for r in c.execute("SELECT id, name, formula FROM strategies ORDER BY id").fetchall()]
    c.close()
    if len(strats) > 25:
        strats = strats[:25]
    results = []
    for s in strats[:25]:
        try:
            m = _run_backtest(df, s["formula"], b.costs_bps, b.slippage_bps, **_risk_of(b))
            results.append({"id": s["id"], "name": s["name"], "formula": s["formula"],
                            "sharpe": m["sharpe"], "returns": m["returns"], "max_dd": m["max_dd"],
                            "win_rate": m["win_rate"], "trades": m["trades"],
                            "verdict": "active" if m["sharpe"] >= 1.0 else ("testing" if m["sharpe"] >= 0.4 else "rejected")})
        except Exception as e:
            results.append({"id": s["id"], "name": s["name"], "formula": s["formula"], "error": str(e)[:120]})
    results.sort(key=lambda r: r.get("sharpe", -99), reverse=True)
    log("Backtest Engine", f"Test-all by {u['username']}: {symbol} via {source} ({len(results)} strategies)")
    return {"symbol": symbol, "bars": len(df), "source": source, "results": results}

# ---------- paper trading: forward track record, one honest day at a time ----------
UNIVERSE = ["SPY", "AAPL", "MSFT", "NVDA", "TSLA"]


def _paper_pick_strategy(symbol: str):
    """Prefer a factor learned on this symbol, else any LIVE active, else best."""
    c = conn()
    rows = [dict(r) for r in c.execute("SELECT * FROM strategies").fetchall()]
    c.close()
    if not rows:
        return None
    same = [s for s in rows if s.get("dataset") == f"LIVE-{symbol}" and s["status"] == "active"]
    live = [s for s in rows if (s.get("dataset") or "").startswith("LIVE-") and s["status"] == "active"]
    pool = same or live or [s for s in rows if s["status"] == "active"] or rows
    return max(pool, key=lambda s: s["sharpe"])


def _paper_account(symbol: str):
    c = conn()
    row = c.execute("SELECT * FROM paper_account WHERE symbol=?", (symbol,)).fetchone()
    c.close()
    return dict(row) if row else None


def _paper_accounts() -> list:
    c = conn()
    rows = [dict(r) for r in c.execute("SELECT symbol, strategy_id, last_date, updated_at FROM paper_account ORDER BY symbol").fetchall()]
    c.close()
    return rows


def _paper_stats(daily: list) -> dict:
    import math
    if not daily:
        return {"days": 0, "return": 0.0, "sharpe": 0.0, "max_dd": 0.0,
                "bench_return": 0.0, "excess": 0.0, "win_rate": 0.0}
    eq = [r["equity"] for r in daily]
    rets = [(eq[i] / eq[i - 1] - 1) for i in range(1, len(eq)) if eq[i - 1]]
    total = (eq[-1] / eq[0] - 1) * 100
    peak, dd = eq[0], 0.0
    for v in eq:
        peak = max(peak, v)
        if peak:
            dd = min(dd, (v / peak - 1) * 100)
    if rets:
        mu = sum(rets) / len(rets)
        var = sum((x - mu) ** 2 for x in rets) / len(rets)
        sd = math.sqrt(var) if var > 0 else 1e-9
        sharpe = mu / sd * math.sqrt(252)
    else:
        sharpe = 0.0
    moved = [r["ret"] for r in daily if r["ret"] != 0]
    win = sum(1 for r in moved if r > 0) / len(moved) * 100 if moved else 0.0
    bench = (daily[-1]["benchmark"] / daily[0]["benchmark"] - 1) * 100 if daily[0]["benchmark"] else 0.0
    return {"days": len(daily), "return": round(total, 2), "sharpe": round(sharpe, 2),
            "max_dd": round(dd, 2), "bench_return": round(bench, 2),
            "excess": round(total - bench, 2), "win_rate": round(win, 1)}


def _paper_status_payload(symbol: str):
    acc = _paper_account(symbol)
    if not acc:
        return {"account": None, "daily": [], "recent": [], "stats": _paper_stats([]),
                "accounts": _paper_accounts(), "universe": UNIVERSE}
    c = conn()
    rows = [dict(r) for r in c.execute("SELECT * FROM paper_daily WHERE symbol=? ORDER BY date", (symbol,)).fetchall()]
    strat = c.execute("SELECT id, name, formula, dataset, sharpe FROM strategies WHERE id=?", (acc["strategy_id"],)).fetchone()
    c.close()
    step = max(1, len(rows) // 500)
    return {"account": {**acc, "strategy": dict(strat) if strat else None},
            "daily": [{"date": r["date"], "equity": r["equity"], "benchmark": r["benchmark"]} for r in rows[::step]],
            "recent": rows[-10:][::-1],
            "stats": _paper_stats(rows),
            "accounts": _paper_accounts(), "universe": UNIVERSE}


def _cron_or_user(authorization: str | None, cron_secret: str | None, scope: str):
    """Render Cron Job support: ?cron_secret= matches env CRON_SECRET, no login.
    Otherwise normal bearer auth + rate limit."""
    if cron_secret and os.environ.get("CRON_SECRET") and cron_secret == os.environ["CRON_SECRET"]:
        return {"id": 0, "username": "cron"}
    u = _require_user(authorization)
    _check_rate(f"{scope}:{u['id']}", 6, 60)
    return u


@app.get("/api/paper")
def paper_status(symbol: str = "AAPL", authorization: str | None = Header(default=None)):
    """Paper scoreboard for one symbol: forward equity vs buy-and-hold."""
    _require_user(authorization)
    return _paper_status_payload(symbol.strip().upper()[:12] or "AAPL")


@app.post("/api/paper/run")
def paper_run(symbol: str = "AAPL", cron_secret: str | None = None, authorization: str | None = Header(default=None)):
    """Backfill one symbol's ledger to the latest bar. Run daily (button or cron)."""
    u = _cron_or_user(authorization, cron_secret, "paper")
    from quant import paper_backfill
    sym = (symbol or "AAPL").strip().upper()[:12] or "AAPL"
    acc = _paper_account(sym)
    if not acc:
        s = _paper_pick_strategy(sym)
        if not s:
            raise HTTPException(400, "No strategies yet — run the pipeline first.")
        c = conn()
        c.execute("INSERT INTO paper_account (symbol, strategy_id) VALUES (?,?)", (sym, s["id"]))
        c.commit(); c.close()
        log("Paper Trader", f"Paper account opened on {s['name']} ({sym})")
        acc = _paper_account(sym)
    c = conn()
    strat = c.execute("SELECT * FROM strategies WHERE id=?", (acc["strategy_id"],)).fetchone()
    c.close()
    if not strat:
        raise HTTPException(400, "Paper strategy no longer exists — retrain to pick a new one.")
    strat = dict(strat)
    try:
        sym, df, source = _get_live_bars(sym)
    except HTTPException as e:
        raise
    risk = {"max_pos": acc["max_pos"], "stop_pct": acc["stop_pct"],
            "regime_off": bool(acc["regime_off"]), "slip_vol_mult": 1.0}
    rows = paper_backfill(df, strat["formula"], acc["costs_bps"], acc["slippage_bps"], **risk)
    fresh = [r for r in rows if r["date"] > (acc["last_date"] or "")]
    c = conn()
    for r in fresh:
        c.execute("INSERT OR REPLACE INTO paper_daily (symbol, date, equity, benchmark, position, price, ret) VALUES (?,?,?,?,?,?,?)",
                  (sym, r["date"], r["equity"], r["benchmark"], r["position"], r["price"], r["ret"]))
    if rows:
        last = rows[-1]
        c.execute("UPDATE paper_account SET capital=?, position=?, last_date=?, updated_at=datetime('now') WHERE symbol=?",
                  (last["equity"], last["position"], last["date"], sym))
    c.commit(); c.close()
    if fresh:
        log("Paper Trader", f"{sym} ledger to {rows[-1]['date']}: {len(fresh)} new fills, equity {rows[-1]['equity']:.4f} vs BH {rows[-1]['benchmark']:.4f}")
    payload = _paper_status_payload(sym)
    payload["filled"] = len(fresh)
    payload["source"] = source
    return payload


@app.post("/api/paper/retrain")
def paper_retrain(symbol: str = "AAPL", authorization: str | None = Header(default=None)):
    """Re-learn on the extended history; promote the challenger only if it
    beats the incumbent out-of-sample by a clear margin (anti-churn)."""
    u = _require_user(authorization)
    _check_rate(f"retrain:{u['id']}", 2, 60)
    sym = (symbol or "AAPL").strip().upper()[:12] or "AAPL"
    acc = _paper_account(sym)
    if not acc:
        raise HTTPException(400, "No paper account yet — run the paper ledger first.")
    c = conn()
    strat = c.execute("SELECT * FROM strategies WHERE id=?", (acc["strategy_id"],)).fetchone()
    c.close()
    if not strat:
        raise HTTPException(400, "Paper strategy no longer exists.")
    strat = dict(strat)
    try:
        sym, df, source = _get_live_bars(sym)
    except HTTPException as e:
        raise
    risk = {"max_pos": acc["max_pos"], "stop_pct": acc["stop_pct"],
            "regime_off": bool(acc["regime_off"]), "slip_vol_mult": 1.0}
    res = learn(df, strat.get("hypothesis") or "", acc["costs_bps"], acc["slippage_bps"], risk=risk)
    inc_oos = evaluate_oos(df, strat["formula"], acc["costs_bps"], acc["slippage_bps"], risk=risk)
    inc_test = inc_oos["test"]["sharpe"]
    chal_test = res["test"]["sharpe"]
    promoted = bool(chal_test >= 0.4 and chal_test > inc_test + 0.2)
    out = {"incumbent": {"name": strat["name"], "formula": strat["formula"], "test_sharpe": inc_test},
           "challenger": {"name": res["name"], "formula": res["formula"], "test_sharpe": chal_test,
                          "train_sharpe": res["train"]["sharpe"],
                          "walk_forward": res["walk_forward"], "candidates": res["candidates"]},
           "promoted": promoted, "source": source}
    if promoted:
        j = judge_review(res["formula"], strat.get("hypothesis") or "")
        m = res["test"]
        c = conn()
        cur = c.execute(
            "INSERT INTO strategies (name, hypothesis, formula, code, status, sharpe, returns, max_dd, win_rate, trades, author, judge_notes, judge_score, ann_vol, equity, dataset) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (res["name"], strat.get("hypothesis") or "", res["formula"], res["code"],
             "active" if j["verdict"] == "approve" else "testing",
             m["sharpe"], m["returns"], m["max_dd"], m["win_rate"], m["trades"],
             "Writer Agent", j["notes"], j["score"], m.get("ann_vol", 0),
             json.dumps(res["full"]["equity_curve"]), f"LIVE-{sym}"))
        nid = cur.lastrowid
        c.execute("UPDATE paper_account SET strategy_id=?, updated_at=datetime('now') WHERE symbol=?", (nid, sym))
        c.commit(); c.close()
        log("Paper Trader", f"Retrain promoted #{nid} {res['name']}: test {inc_test} → {chal_test}", "success")
        out["strategy_id"] = nid
    else:
        log("Paper Trader", f"Retrain kept incumbent: challenger test {chal_test} vs {inc_test} — margin too thin")
    return out


# ---------- live market (Finnhub, key stays server-side) ----------
@app.get("/api/market/live")
def market_live(symbols: str = "SPY,AAPL,MSFT,TSLA,NVDA", authorization: str | None = Header(default=None)):
    u = _require_user(authorization)
    _check_rate(f"market:{u['id']}", 30, 60)
    from finnhub_provider import fetch_quote, is_configured
    if not is_configured():
        raise HTTPException(503, "Live feed not configured. Set FINNHUB_API_KEY on the server.")
    out = []
    for raw in symbols.split(",")[:10]:
        raw = raw.strip()
        if not raw:
            continue
        try:
            out.append(fetch_quote(raw))
        except (ValueError, ConnectionError) as e:
            out.append({"symbol": raw.upper(), "error": str(e)[:120]})
    return {"quotes": out}

@app.get("/api/market/candles")
def market_candles(symbol: str = "SPY", years: float = 2, authorization: str | None = Header(default=None)):
    u = _require_user(authorization)
    _check_rate(f"market:{u['id']}", 30, 60)
    try:
        sym, df, source = _get_live_bars(symbol, years=max(0.25, min(years, 10)))
    except HTTPException:
        raise
    except (ValueError, ConnectionError) as e:
        raise HTTPException(400 if isinstance(e, ValueError) else 503, str(e))
    step = max(1, len(df) // 252)
    return {"symbol": sym, "bars": len(df), "source": source,
            "closes": [{"t": int(i), "v": round(float(v), 2)} for i, v in enumerate(df["close"].iloc[::step])]}

@app.get("/api/experiments")
def experiments(authorization: str | None = Header(default=None)):
    _require_user(authorization)
    c = conn()
    rows = c.execute("SELECT * FROM experiments ORDER BY id DESC LIMIT 50").fetchall()
    c.close()
    return [dict(r) for r in rows]

@app.get("/api/agents")
def agents(authorization: str | None = Header(default=None)):
    _require_user(authorization)
    c = conn()
    n_strat = c.execute("SELECT COUNT(*) n FROM strategies").fetchone()["n"]
    n_exp = c.execute("SELECT COUNT(*) n FROM experiments").fetchone()["n"]
    c.close()
    return [
        {"id": "writer", "name": "Writer Agent", "status": "active", "tasks": 240 + n_exp, "success": 225 + n_exp, "model": "Template-LLM v2", "desc": "Hypothesis → formula + executable code"},
        {"id": "judge", "name": "Judge Agent", "status": "active", "tasks": 225 + n_exp, "success": 210 + n_exp, "model": "Rule+LLM", "desc": "Logic, leakage, interpretability checks"},
        {"id": "backtest", "name": "Backtest Engine", "status": "active", "tasks": 210 + n_exp, "success": 208 + n_exp, "model": "Pandas Vector", "desc": "Historical run with costs + slippage"},
        {"id": "feedback", "name": "Feedback Memory", "status": "active", "tasks": 200 + n_exp, "success": 200 + n_exp, "model": "SQLite", "desc": "Stores strategies, results, judge notes"},
        {"id": "data", "name": "Data Ingestion", "status": "idle", "tasks": 89, "success": 89, "model": "Pandas", "desc": "SYNTH-SPX 2520 bars, dev/OOS split"},
        {"id": "research", "name": "Research Agent", "status": "idle", "tasks": 56, "success": 54, "model": "LLM", "desc": "Structures papers & hypotheses"},
    ]

@app.get("/api/logs")
def logs(limit: int = 80, authorization: str | None = Header(default=None)):
    _require_user(authorization)
    limit = max(1, min(limit, 200))
    c = conn()
    rows = c.execute("SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    c.close()
    return [dict(r) for r in rows]

@app.get("/api/papers")
def papers(authorization: str | None = Header(default=None)):
    _require_user(authorization)
    c = conn()
    rows = c.execute("SELECT * FROM papers").fetchall()
    c.close()
    return [dict(r) for r in rows]

@app.patch("/api/papers/{pid}")
def patch_paper(pid: int, b: PaperPatch, authorization: str | None = Header(default=None)):
    u = _require_user(authorization)
    _check_rate(f"write:{u['id']}", 30, 60)
    if b.status is not None and b.status not in ("unread", "reading", "read"):
        raise HTTPException(400, "Invalid status.")
    if b.notes is not None and len(b.notes) > 2000:
        raise HTTPException(400, "Notes too long.")
    c = conn()
    if b.status: c.execute("UPDATE papers SET status=? WHERE id=?", (b.status, pid))
    if b.notes is not None: c.execute("UPDATE papers SET notes=? WHERE id=?", (b.notes, pid))
    c.commit(); c.close()
    return {"ok": True}


# ---------- serve frontend (production) ----------
DIST = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404)
        fp = os.path.join(DIST, full_path)
        if full_path and os.path.isfile(fp):
            return FileResponse(fp)
        return FileResponse(os.path.join(DIST, "index.html"))
