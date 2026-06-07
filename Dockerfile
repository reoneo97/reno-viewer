# Stage 1 — build the Vite frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — FastAPI + static files
FROM python:3.12-slim AS api
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

COPY api/pyproject.toml ./
RUN uv pip install --system \
    "fastapi[standard]>=0.115.0" \
    "sqlmodel>=0.0.22" \
    "psycopg2-binary>=2.9.10" \
    "boto3>=1.35.0" \
    "python-multipart>=0.0.12" \
    "pydantic-settings>=2.0.0" \
    "python-jose[cryptography]>=3.3.0" \
    "bcrypt>=4.0.0" \
    "aiofiles>=23.0.0"

COPY api/src/ ./src/
COPY --from=frontend /app/dist/ ./static/

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
