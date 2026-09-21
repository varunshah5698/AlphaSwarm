"""SQLite layer for Alpha Swarm — stdlib sqlite3, no ORM."""
import sqlite3
import os
import json
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "alpha_swarm.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hypothesis TEXT DEFAULT '',
  formula TEXT NOT NULL,
  code TEXT DEFAULT '',
  status TEXT DEFAULT 'testing',
  sharpe REAL DEFAULT 0,
  returns REAL DEFAULT 0,
  max_dd REAL DEFAULT 0,
  win_rate REAL DEFAULT 0,
  trades INTEGER DEFAULT 0,
  ann_vol REAL DEFAULT 0,
  author TEXT DEFAULT 'Writer Agent',
  judge_notes TEXT DEFAULT '',
  judge_score INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  equity TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id INTEGER,
  hypothesis TEXT,
  writer_output TEXT,
  judge_output TEXT,
  metrics TEXT,
  costs_bps INTEGER DEFAULT 10,
  slippage_bps INTEGER DEFAULT 5,
  dataset TEXT DEFAULT 'SYNTH-SPX-2014-2024',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT DEFAULT 'info',
  agent TEXT DEFAULT 'System',
  message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT, authors TEXT, year INTEGER, source TEXT,
  status TEXT DEFAULT 'unread', notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'Researcher',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT DEFAULT (datetime('now', '+7 days')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
"""

SEED_STRATEGIES = [
    ("Momentum Reversion Alpha", "Stocks that fall hard bounce back", "rank(close / delay(close, 20) - 1) * -1", "active", 1.82, 24.5, -8.3, 62.4, 1847, "Writer Agent", "No look-ahead bias. Uses delay(20). Low correlation risk.", 88),
    ("Volatility Breakout", "Breakouts on expanding volatility persist", "rank(std(close, 10) / std(close, 30)) * sign(close - delay(close, 1))", "active", 1.45, 18.2, -12.1, 58.7, 2103, "Writer Agent", "Volatility ratio is stable. Cost-sensitive.", 81),
    ("Volume Price Divergence", "Volume + price divergence predicts drift", "correlation(volume, close, 20) * rank(close - delay(close, 5))", "testing", 1.21, 15.8, -15.4, 55.2, 1654, "Writer Agent", "Needs OOS check. Correlation term can lag.", 74),
    ("Mean Reversion RSI", "Oversold RSI reverts", "(50 - rsi(close, 14)) / 50 * rank(volume / sma(volume, 20))", "rejected", 0.89, 9.4, -22.6, 51.1, 1923, "Writer Agent", "Rejected: crowded signal, high drawdown.", 52),
    ("Trend Following EMA", "EMA cross follows trend", "sign(ema(close, 12) - ema(close, 26)) * rank(atr(high, low, close, 14) / close)", "active", 1.67, 21.3, -9.8, 60.1, 1567, "Writer Agent", "Clean trend logic. Passes leakage checks.", 85),
    ("Pairs Spread Alpha", "Spread vs SPY mean-reverts", "rank(zscore(close - spy, 20)) * -1", "testing", 1.34, 16.9, -11.2, 57.3, 1432, "Writer Agent", "Needs pair-data validation.", 77),
]

SEED_PAPERS = [
    ("Alpha-GPT: Human-AI Interactive Alpha Mining", "Wang, Yuan, Zhou et al.", 2025, "EMNLP", "read", "Foundation for Writer Agent architecture"),
    ("AutoAlpha: Hierarchical Evolutionary Algorithm", "Zhang, Li, Jin, Li", 2020, "arXiv", "read", "Non-LLM baseline comparison"),
    ("AlphaForge: Mining Formulaic Alpha Factors", "Shi, Song, Zhang et al.", 2025, "AAAI", "reading", "Dynamic factor combination"),
    ("101 Formulaic Alphas", "Kakushadze", 2016, "arXiv", "read", "Seed library of alpha formulas"),
    ("Probability of Backtest Overfitting", "Bailey, Borwein, Lopez de Prado", 2015, "JCF", "read", "Overfitting risk framework"),
    ("Deep Symbolic Regression", "Petersen et al.", 2019, "arXiv", "unread", ""),
    ("LLM-Assisted Semantic Pruning for GP", "Chen, Qi", 2026, "MDPI", "unread", ""),
]


def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    c = conn()
    c.executescript(SCHEMA)
    # lightweight migration for DBs created before ann_vol existed
    cols = [r["name"] for r in c.execute("PRAGMA table_info(strategies)").fetchall()]
    if "ann_vol" not in cols:
        c.execute("ALTER TABLE strategies ADD COLUMN ann_vol REAL DEFAULT 0")
        c.commit()
    # lightweight migration for DBs created before session expiry existed
    # (SQLite forbids non-constant defaults in ALTER TABLE, so backfill after.)
    sess_cols = [r["name"] for r in c.execute("PRAGMA table_info(sessions)").fetchall()]
    if sess_cols and "expires_at" not in sess_cols:
        c.execute("ALTER TABLE sessions ADD COLUMN expires_at TEXT DEFAULT ''")
        c.execute("UPDATE sessions SET expires_at = datetime('now', '+7 days') WHERE expires_at = ''")
        c.commit()
    # seed once
    n = c.execute("SELECT COUNT(*) as n FROM strategies").fetchone()["n"]
    if n == 0:
        for s in SEED_STRATEGIES:
            c.execute(
                "INSERT INTO strategies (name, hypothesis, formula, status, sharpe, returns, max_dd, win_rate, trades, author, judge_notes, judge_score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                s,
            )
        for p in SEED_PAPERS:
            c.execute(
                "INSERT INTO papers (title, authors, year, source, status, notes) VALUES (?,?,?,?,?,?)", p
            )
        c.execute("INSERT INTO logs (level, agent, message) VALUES (?,?,?)",
                  ("info", "System", "Pipeline initialized successfully"))
        c.execute("INSERT INTO logs (level, agent, message) VALUES (?,?,?)",
                  ("info", "Data Ingestion", "Loaded SYNTH-SPX dataset: 2520 trading days"))
        c.commit()
    c.close()


def row_to_dict(r):
    d = dict(r)
    # parse equity json if present
    if "equity" in d and isinstance(d["equity"], str):
        try:
            d["equity_curve"] = json.loads(d["equity"])
        except Exception:
            d["equity_curve"] = []
    return d
