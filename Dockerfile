FROM python:3.12-slim
WORKDIR /app/backend

# backend deps first (better layer caching)
COPY alpha-swarm/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# backend code + prebuilt frontend (served from /app/dist by the API)
COPY alpha-swarm/backend ./
COPY alpha-swarm/dist /app/dist

ENV PORT=8001 SESSION_TTL_DAYS=7
EXPOSE 8001
CMD ["sh", "-c", "python -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-8001}"]
