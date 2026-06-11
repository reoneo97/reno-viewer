from datetime import datetime, timezone


def _now() -> datetime:
    return datetime.now(timezone.utc)
from typing import List, Optional
import uuid

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlmodel import Field, Relationship, SQLModel


# ── Table models ──────────────────────────────────────────────────────────────

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[uuid.UUID] = Field(
        default_factory=uuid.uuid4,
        sa_column=Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    )
    username: str = Field(unique=True, index=True)
    password_hash: str  # bcrypt — never the raw password
    display_name: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: Optional[uuid.UUID] = Field(
        default_factory=uuid.uuid4,
        sa_column=Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    )
    name: str
    floor_plan_key: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)

    anchors: List["Anchor"] = Relationship(
        back_populates="project",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "passive_deletes": True},
    )


class AnchorCandidate(SQLModel, table=True):
    __tablename__ = "anchor_candidates"

    anchor_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("anchors.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    candidate_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("candidates.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    # Decision for this candidate at this anchor:
    # '' (undecided) | 'shortlisted' | 'chosen' | 'rejected'.
    # 'chosen' is radio-style — at most one per anchor.
    status: str = ""


class Anchor(SQLModel, table=True):
    __tablename__ = "anchors"

    id: Optional[uuid.UUID] = Field(
        default_factory=uuid.uuid4,
        sa_column=Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    )
    project_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    x: float
    y: float
    label: str
    category: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)

    project: Optional["Project"] = Relationship(back_populates="anchors")
    candidates: List["Candidate"] = Relationship(
        back_populates="anchors",
        link_model=AnchorCandidate,
    )


class Candidate(SQLModel, table=True):
    __tablename__ = "candidates"

    id: Optional[uuid.UUID] = Field(
        default_factory=uuid.uuid4,
        sa_column=Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    )
    # anchor_id kept in DB as nullable legacy column — not mapped here
    name: str
    description: Optional[str] = None
    width: Optional[str] = None
    height: Optional[str] = None
    depth: Optional[str] = None
    price: Optional[str] = None
    link: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)

    anchors: List["Anchor"] = Relationship(
        back_populates="candidates",
        link_model=AnchorCandidate,
    )
    photos: List["CandidatePhoto"] = Relationship(
        back_populates="candidate",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "passive_deletes": True,
            "order_by": "CandidatePhoto.position",
        },
    )


class CandidatePhoto(SQLModel, table=True):
    __tablename__ = "candidatephotos"

    id: Optional[uuid.UUID] = Field(
        default_factory=uuid.uuid4,
        sa_column=Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    )
    candidate_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("candidates.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    image_key: str
    position: int = 0

    candidate: Optional["Candidate"] = Relationship(back_populates="photos")


# ── Request schemas ───────────────────────────────────────────────────────────

class UserCreate(SQLModel):
    username: str
    password: str
    display_name: Optional[str] = None


class UserRead(SQLModel):
    id: uuid.UUID
    username: str
    display_name: Optional[str] = None
    created_at: datetime


class PasswordChange(SQLModel):
    current_password: str
    new_password: str


class ProjectCreate(SQLModel):
    name: str


class ProjectUpdate(SQLModel):
    name: Optional[str] = None


class AnchorCreate(SQLModel):
    x: float
    y: float
    label: str
    category: Optional[str] = None
    notes: Optional[str] = None


class AnchorUpdate(SQLModel):
    x: Optional[float] = None
    y: Optional[float] = None
    label: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None


class CandidateUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    width: Optional[str] = None
    height: Optional[str] = None
    depth: Optional[str] = None
    price: Optional[str] = None
    link: Optional[str] = None


# ── Response schemas ──────────────────────────────────────────────────────────

class AnchorRef(SQLModel):
    id: uuid.UUID
    label: str


class CandidateRead(SQLModel):
    id: uuid.UUID
    name: str
    image_urls: List[str] = []
    description: Optional[str] = None
    width: Optional[str] = None
    height: Optional[str] = None
    depth: Optional[str] = None
    price: Optional[str] = None
    link: Optional[str] = None
    created_at: datetime
    anchors: List[AnchorRef] = []
    status: str = ""  # decision for the anchor this candidate was read under


class AnchorRead(SQLModel):
    id: uuid.UUID
    project_id: uuid.UUID
    x: float
    y: float
    label: str
    category: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    candidates: List[CandidateRead] = []


class ProjectRead(SQLModel):
    id: uuid.UUID
    name: str
    floor_plan_url: Optional[str] = None
    created_at: datetime
    anchors: List[AnchorRead] = []


class ProjectListItem(SQLModel):
    id: uuid.UUID
    name: str
    floor_plan_url: Optional[str] = None
    created_at: datetime
