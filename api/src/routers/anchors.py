import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ..db import get_session
from ..models import Anchor, AnchorCandidate, AnchorCreate, AnchorRead, AnchorUpdate, Candidate, Project
from sqlmodel import select
from .candidates import candidate_read

router = APIRouter(tags=["anchors"])


def _build_anchor_read(anchor: Anchor) -> AnchorRead:
    candidates = [candidate_read(c) for c in anchor.candidates]
    return AnchorRead(**anchor.model_dump(), candidates=candidates)


@router.post("/projects/{project_id}/anchors", response_model=AnchorRead, status_code=201)
def create_anchor(
    project_id: uuid.UUID,
    body: AnchorCreate,
    session: Session = Depends(get_session),
):
    if not session.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    anchor = Anchor(project_id=project_id, **body.model_dump())
    session.add(anchor)
    session.commit()
    session.refresh(anchor)
    return _build_anchor_read(anchor)


@router.patch("/anchors/{anchor_id}", response_model=AnchorRead)
def update_anchor(
    anchor_id: uuid.UUID,
    body: AnchorUpdate,
    session: Session = Depends(get_session),
):
    anchor = session.get(Anchor, anchor_id)
    if not anchor:
        raise HTTPException(404, "Anchor not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(anchor, k, v)
    session.add(anchor)
    session.commit()
    session.refresh(anchor)
    return _build_anchor_read(anchor)


@router.post("/anchors/{anchor_id}/duplicate", response_model=AnchorRead, status_code=201)
def duplicate_anchor(
    anchor_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    anchor = session.get(Anchor, anchor_id)
    if not anchor:
        raise HTTPException(404, "Anchor not found")

    new_anchor = Anchor(
        project_id=anchor.project_id,
        x=min(anchor.x + 2.0, 98.0),
        y=min(anchor.y + 2.0, 98.0),
        label=f"{anchor.label} (copy)",
        category=anchor.category,
        notes=anchor.notes,
    )
    session.add(new_anchor)
    session.flush()

    for candidate in anchor.candidates:
        session.add(AnchorCandidate(anchor_id=new_anchor.id, candidate_id=candidate.id))

    session.commit()
    session.refresh(new_anchor)
    return _build_anchor_read(new_anchor)


@router.delete("/anchors/{anchor_id}", status_code=204)
def delete_anchor(anchor_id: uuid.UUID, session: Session = Depends(get_session)):
    from .. import storage
    anchor = session.get(Anchor, anchor_id)
    if not anchor:
        raise HTTPException(404, "Anchor not found")

    # collect candidates before deleting so we can clean up orphans
    candidates = list(anchor.candidates)
    session.delete(anchor)
    session.flush()

    for c in candidates:
        session.refresh(c)
        if len(c.anchors) == 0:
            for photo in c.photos:
                if photo.image_key:
                    storage.delete(photo.image_key)
            session.delete(c)

    session.commit()
