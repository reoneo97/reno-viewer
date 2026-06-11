from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from .auth import require_auth, router as auth_router, seed_admin, users_router
from .db import create_tables
from .observability import install_logging
from .routers import projects, anchors, candidates, snapshots
from . import storage

STATIC_DIR = Path(__file__).parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    seed_admin()
    yield


app = FastAPI(title="Reno Viewer API", lifespan=lifespan)

install_logging(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

_protected = {"dependencies": [Depends(require_auth)]}
app.include_router(users_router, **_protected)
app.include_router(projects.router, **_protected)
app.include_router(anchors.router, **_protected)
app.include_router(candidates.router, **_protected)
app.include_router(snapshots.router, **_protected)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/snapshots/{snapshot_id}", include_in_schema=False)
def get_snapshot(snapshot_id: str):
    """Public — no auth required. Serves a shared snapshot HTML page."""
    key = f"snapshots/{snapshot_id}.html"
    html = storage.download(key)
    if html is None:
        raise HTTPException(404, "Snapshot not found")
    return HTMLResponse(content=html.decode())


# Serve built frontend — must be last so API routes take precedence
if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(_full_path: str = ""):
        return FileResponse(str(STATIC_DIR / "index.html"))
