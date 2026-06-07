from sqlalchemy import text
from sqlmodel import SQLModel, Session, create_engine
from .config import settings

engine = create_engine(settings.database_url, echo=False, pool_pre_ping=True)

_MIGRATIONS = [
    "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS description TEXT",
    """CREATE TABLE IF NOT EXISTS candidatephotos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        image_key TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
    )""",
    # migrate existing single image_key into candidatephotos
    """INSERT INTO candidatephotos (candidate_id, image_key, position)
       SELECT id, image_key, 0 FROM candidates
       WHERE image_key IS NOT NULL
         AND id NOT IN (SELECT candidate_id FROM candidatephotos)""",
    # make anchor_id nullable — candidates are now linked via anchor_candidates join table
    "ALTER TABLE candidates ALTER COLUMN anchor_id DROP NOT NULL",
    """CREATE TABLE IF NOT EXISTS anchor_candidates (
        anchor_id UUID NOT NULL REFERENCES anchors(id) ON DELETE CASCADE,
        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        PRIMARY KEY (anchor_id, candidate_id)
    )""",
    # migrate existing anchor_id relationships into join table
    """INSERT INTO anchor_candidates (anchor_id, candidate_id)
       SELECT anchor_id, id FROM candidates
       WHERE anchor_id IS NOT NULL
       ON CONFLICT DO NOTHING""",
]


def create_tables() -> None:
    SQLModel.metadata.create_all(engine)
    with engine.connect() as conn:
        for stmt in _MIGRATIONS:
            conn.execute(text(stmt))
        conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
