from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlmodel import Session, select

from .config import settings
from .db import engine, get_session
from .models import PasswordChange, User, UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), password_hash.encode())
    except ValueError:
        return False


def _seed_password_hash() -> str | None:
    """Resolve the seed password from env: plaintext AUTH_PASSWORD, or
    base64-encoded bcrypt AUTH_PASSWORD_HASH (base64 keeps $ out of env files)."""
    if settings.auth_password:
        return hash_password(settings.auth_password)
    if settings.auth_password_hash:
        import base64
        try:
            return base64.b64decode(settings.auth_password_hash).decode()
        except Exception:
            return None
    return None


def seed_admin() -> None:
    """Env-bootstrap: create the first account from the AUTH_* env vars when
    the users table is empty, so a fresh deploy can always log in.
    Idempotent — does nothing once any user exists."""
    with Session(engine) as session:
        if session.exec(select(User)).first():
            return
        password_hash = _seed_password_hash()
        if not password_hash:
            return  # no seed credentials configured; table stays empty
        session.add(User(
            username=settings.auth_username,
            password_hash=password_hash,
            is_admin=True,  # the founding account manages everyone else
        ))
        session.commit()


def _create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    return jwt.encode(
        {"sub": username, "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    is_admin: bool = False


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == body.username)).first()
    # Same generic error whether the username or the password is wrong.
    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(
        access_token=_create_token(user.username),
        username=user.username,
        is_admin=user.is_admin,
    )


def require_auth(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        username: str = payload.get("sub")
        if not username:
            raise ValueError
        return username
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def current_user(
    username: str = Depends(require_auth),
    session: Session = Depends(get_session),
) -> User:
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")
    return user


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(current_user)):
    return user


# ── User management ───────────────────────────────────────────────────────────
# Listing is open to any signed-in user (see who's on the team); creating and
# deleting accounts is admin-only. Changing your own password is self-service.

users_router = APIRouter(prefix="/users", tags=["users"])


@users_router.get("", response_model=list[UserRead])
def list_users(session: Session = Depends(get_session)):
    return session.exec(select(User).order_by(User.created_at)).all()


@users_router.post("", response_model=UserRead, status_code=201)
def create_user(
    body: UserCreate,
    _admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    username = body.username.strip().lower()
    if not username or len(body.password) < 4:
        raise HTTPException(422, "Username required; password must be at least 4 characters")
    if session.exec(select(User).where(User.username == username)).first():
        raise HTTPException(409, "Username already taken")
    user = User(
        username=username,
        password_hash=hash_password(body.password),
        display_name=(body.display_name or "").strip() or None,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@users_router.post("/me/password", status_code=204)
def change_password(
    body: PasswordChange,
    username: str = Depends(require_auth),
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not _verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if len(body.new_password) < 4:
        raise HTTPException(422, "Password must be at least 4 characters")
    user.password_hash = hash_password(body.new_password)
    session.add(user)
    session.commit()


@users_router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.username == admin.username:
        raise HTTPException(409, "You can't delete the account you're signed in with")
    session.delete(user)
    session.commit()
