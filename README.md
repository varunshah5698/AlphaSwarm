# Alpha Swarm — Agentic AI for Automated Quantitative Strategy Discovery

Autonomous alpha-mining loop: **Generate → Critique → Test → Measure → Learn → Repeat**.
Stack: FastAPI + SQLite + Pandas/NumPy backend, React + Vite + Recharts frontend.

## Run locally (2 terminals)
```bash
cd alpha-swarm/backend
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8001

cd alpha-swarm
npm install
npm run dev -- --port 3000 --host 127.0.0.1
```
App → http://127.0.0.1:3000 · API → http://127.0.0.1:8001/docs

## Run with Docker (single service, serves API + frontend)
```bash
cd alpha-swarm
docker compose up -d --build
```
App + API → http://127.0.0.1:8001 (API docs at /docs).
The image builds the React bundle inside Docker — no local `dist/` needed.

## Deploy on Render (Docker runtime — recommended)
1. Render dashboard → New → **Web Service** → select `varunshah5698/AlphaSwarm`
2. **Runtime: Docker** (NOT Node — Node builds only the UI and the API stays dead,
   which is exactly the `vite: not found` failure: dependencies were never installed)
3. Add env vars: `SESSION_TTL_DAYS=7`, `FINNHUB_API_KEY=<your key>` (optional fallback feed —
   market data is keyless via Yahoo by default), `CRON_SECRET=<long random string>` (for daily paper fills)
   (Render injects `$PORT` itself; the server listens on it automatically)
4. Deploy → one URL serves the full app + API + docs.
5. Daily paper fills (automatic): Render dashboard → New → **Cron Job** → same repo,
   command `curl -s "https://<your-service>.onrender.com/api/paper/run?symbol=AAPL&cron_secret=<CRON_SECRET>"`,
   schedule `30 21 * * 1-5` (after US close, weekdays). Repeat per symbol (SPY, MSFT, NVDA, TSLA).
> Do NOT use Render's Node runtime for this repo: `npm run build` alone fails
> without `npm ci` first, and even then the Python API would be missing.

## 3-minute demo script
1. `/register` — create account (username + email + password) → sign in.
2. `/dashboard` — live equity (best alpha vs benchmark), distribution, log activity.
3. `/pipeline` — enter "oversold dip bounce", run full cycle, read Judge verdict + metrics.
4. `/backtest` — paste a formula, or **upload your own OHLCV CSV** (date,open,high,low,close,volume) to test on real data with buy & hold baseline.
5. `/analytics` — switch 1M/3M/6M/1Y, inspect rolling Sharpe + risk radar.
6. `/reports` — every run recorded with hypothesis, code, metrics, costs.

## Production notes
- Auth: PBKDF2-hashed passwords, bearer tokens, 7-day sliding expiry (`SESSION_TTL_DAYS`), all data endpoints require sign-in, auth/pipeline/backtest rate-limited.
- Validation: formula ≤500 chars / ≤12 ops, hypothesis ≤2000 chars, costs 0–500bps, CSV ≤5MB / 60–5000 bars.
- Env: `PORT`, `SESSION_TTL_DAYS`, `ALLOWED_ORIGINS` (see `.env.example`).
- SQLite file: `backend/alpha_swarm.db` (auto-created + seeded). Back up with `docker cp …:/app/backend/alpha_swarm.db ./backup.db`.
- Research tool, not investment advice. Synthetic data has injected reversal + regime structure; real-data conclusions need your own CSVs.
