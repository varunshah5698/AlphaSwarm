# ---------- stage 1: build the React frontend ----------
FROM node:22-slim AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---------- stage 2: Python API + serve the built frontend ----------
FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
# start fresh inside the image (dev DB never ships)
RUN rm -f alpha_swarm.db && rm -rf __pycache__
COPY --from=web /web/dist /app/dist

ENV PORT=8001 SESSION_TTL_DAYS=7
EXPOSE 8001
# Render/Docker inject $PORT — the server listens on it, one URL serves API + UI
CMD ["sh", "-c", "python -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-8001}"]
