# Reno Viewer

A floor plan viewer for interior design and renovation planning. Place anchors on a floor plan, attach candidate items (furniture, lights, appliances) with images, dimensions, pricing, and links. Share a read-only snapshot with anyone via a public URL.

## Stack

- **Frontend** — React 18 + TypeScript + Vite
- **Backend** — FastAPI + SQLModel
- **Database** — PostgreSQL (Neon serverless)
- **Storage** — Cloudflare R2 (images)
- **Auth** — JWT (single user)

## Local Development

```bash
# install deps
make install

# run API + frontend with hot reload
make dev
```

Frontend: http://localhost:5173  
API: http://localhost:8001

### Environment setup

```bash
cp api/.env.example api/.env
# edit api/.env with your credentials
```

Generate a password hash:
```bash
python -c "import bcrypt; print(bcrypt.hashpw(b'yourpassword', bcrypt.gensalt()).decode())"
```

Generate a JWT secret:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## Deployment (Docker + Digital Ocean)

```bash
# build and run locally with Docker
make up

# on the server
git clone https://github.com/reoneo97/reno-viewer.git /opt/reno-viewer
cp /opt/reno-viewer/api/.env.example /opt/reno-viewer/api/.env
# fill in /opt/reno-viewer/api/.env
docker compose up -d --build
```

Pushes to `main` auto-deploy via GitHub Actions (requires `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY` secrets).
