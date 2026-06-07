# Deployment Guide — DigitalOcean Droplet

## Prerequisites

- DigitalOcean account
- Domain name (optional but recommended)
- Neon database already provisioned
- Cloudflare R2 bucket already provisioned
- Docker + Docker Compose installed on the droplet

---

## 1. Create the Droplet

In the DigitalOcean dashboard:

- **Image**: Ubuntu 24.04 LTS
- **Size**: Basic — 1 vCPU / 1 GB RAM ($6/mo) is enough to start
- **Authentication**: SSH key (recommended over password)
- **Hostname**: e.g. `reno-viewer`

Once created, note the droplet's public IP address.

---

## 2. Initial Server Setup

SSH into the droplet:

```bash
ssh root@<your-droplet-ip>
```

Install Docker:

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Verify:

```bash
docker --version
docker compose version
```

---

## 3. Deploy the App

Clone the repo:

```bash
git clone <your-repo-url> /app
cd /app/viewer
```

Create the `.env` file:

```bash
cp api/.env.example api/.env
nano api/.env
```

Fill in the production values:

```env
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require

S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<r2_access_key>
S3_SECRET_KEY=<r2_secret_key>
S3_BUCKET=reno-project
S3_PRESIGN_EXPIRES=86400

AUTH_USERNAME=reo
AUTH_PASSWORD_HASH=<bcrypt hash — see below>
JWT_SECRET=<random hex — see below>
JWT_EXPIRE_HOURS=72
```

Generate the password hash and JWT secret:

```bash
docker run --rm python:3.12-slim python -c \
  "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt()).decode())"

docker run --rm python:3.12-slim python -c \
  "import secrets; print(secrets.token_hex(32))"
```

Build and start:

```bash
docker compose up -d --build
```

Check it's running:

```bash
docker compose logs -f
curl http://localhost:8000/health
```

---

## 4. Point a Domain (Optional but Recommended)

In your DNS provider, create an **A record**:

```
Type: A
Name: @  (or a subdomain like viewer)
Value: <your-droplet-ip>
TTL: 3600
```

---

## 5. HTTPS with Caddy (Recommended)

Caddy auto-provisions Let's Encrypt certificates. Install it on the droplet:

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```
your-domain.com {
    reverse_proxy localhost:8000
}
```

Start Caddy:

```bash
systemctl enable caddy
systemctl start caddy
```

Caddy handles HTTPS automatically — no certbot or manual certificate management needed.

Update CORS in `api/src/main.py` to include your domain:

```python
allow_origins=["https://your-domain.com"]
```

Rebuild and redeploy after the CORS change:

```bash
docker compose up -d --build
```

---

## 6. Redeploying After Code Changes

```bash
cd /app/viewer
git pull
docker compose up -d --build
```

---

## 7. Useful Commands

```bash
# View live logs
docker compose logs -f

# Restart without rebuilding
docker compose restart

# Stop everything
docker compose down

# Check container status
docker compose ps
```
