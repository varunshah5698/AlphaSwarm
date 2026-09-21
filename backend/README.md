# Alpha Swarm Backend — FastAPI + SQLite + Quant Engine

## Run (port 8001 — 8000 is taken by LendSure)
```bash
cd alpha-swarm/backend
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8001
```
API docs → http://127.0.0.1:8001/docs · Health → /api/health

## What it does
- `quant.py` — synthetic SPX market (2520 bars), formula ops (rank/delay/sma/ema/rsi/std/correlation/zscore/atr/sign/beta), vector backtest with costs+slippage, Writer + Judge agents
- `db.py` — SQLite (`alpha_swarm.db`), auto-seeds 6 strategies + 7 papers
- `app.py` — REST API + serves frontend `dist/` in production

## Key endpoints
- POST /api/pipeline/run — {hypothesis} → Writer → Judge → Backtest → store
- POST /api/backtest — {formula} → metrics + equity curve
- GET /api/strategies, /api/experiments, /api/agents, /api/logs, /api/papers
