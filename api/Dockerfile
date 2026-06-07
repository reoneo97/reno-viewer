FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Install deps as a separate layer for cache efficiency
COPY pyproject.toml ./
RUN uv pip install --system \
    "fastapi[standard]>=0.115.0" \
    "sqlmodel>=0.0.22" \
    "psycopg2-binary>=2.9.10" \
    "boto3>=1.35.0" \
    "python-multipart>=0.0.12" \
    "pydantic-settings>=2.0.0"

COPY src/ ./src/

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
