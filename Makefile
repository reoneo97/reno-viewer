API_PYTHON := api/.venv/bin/python
API_UVICORN := api/.venv/bin/uvicorn
API_PYTEST  := api/.venv/bin/pytest

.PHONY: dev api frontend test build up install

## Run API + frontend together with hot reload
dev:
	npx concurrently --names "api,web" --prefix-colors "cyan,green" \
		"$(MAKE) api" \
		"$(MAKE) frontend"

## API only (hot reload)
api:
	cd api && PYTHONPATH=. ../$(API_UVICORN) src.main:app --port 8001 --reload

## Frontend only (hot reload)
frontend:
	npm run dev

## Run tests
test:
	cd api && PYTHONPATH=. ../$(API_PYTEST) -v

## Type-check + production build
build:
	npm run build

## Build Docker image and start (production-like)
up:
	docker compose up --build

## Install all dependencies
install:
	npm install
	cd api && uv venv .venv && uv pip install --python $(API_PYTHON) \
		"fastapi[standard]>=0.115.0" \
		"sqlmodel>=0.0.22" \
		"psycopg2-binary>=2.9.10" \
		"boto3>=1.35.0" \
		"python-multipart>=0.0.12" \
		"pydantic-settings>=2.0.0" \
		"python-jose[cryptography]>=3.3.0" \
		"bcrypt>=4.0.0" \
		"aiofiles>=23.0.0" \
		"pytest>=8.0.0" \
		"httpx2>=0.28.0"
