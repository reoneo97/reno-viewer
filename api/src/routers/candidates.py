import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session, select

from ..db import get_session
from ..models import (
    Anchor, AnchorCandidate, AnchorRef,
    Candidate, CandidatePhoto, CandidateRead, CandidateUpdate,
)
from .. import storage

router = APIRouter(tags=["candidates"])


def candidate_read(c: Candidate) -> CandidateRead:
    """Shared helper used by all routers that return CandidateRead."""
    data = CandidateRead.model_validate(c)
    data.image_urls = [storage.presigned_url(p.image_key) for p in c.photos]
    data.anchors = [AnchorRef(id=a.id, label=a.label) for a in c.anchors]
    return data


@router.post("/anchors/{anchor_id}/candidates", response_model=CandidateRead, status_code=201)
def create_candidate(
    anchor_id: uuid.UUID,
    files: List[UploadFile] = File(default=[]),
    name: str = Form(""),
    description: str = Form(""),
    width: str = Form(""),
    height: str = Form(""),
    depth: str = Form(""),
    price: str = Form(""),
    link: str = Form(""),
    session: Session = Depends(get_session),
):
    if not session.get(Anchor, anchor_id):
        raise HTTPException(404, "Anchor not found")

    candidate = Candidate(
        name=name or "Untitled",
        description=description or None,
        width=width or None,
        height=height or None,
        depth=depth or None,
        price=price or None,
        link=link or None,
    )
    session.add(candidate)
    session.flush()

    for i, file in enumerate(files):
        image_key = storage.upload(file, prefix="candidates")
        session.add(CandidatePhoto(candidate_id=candidate.id, image_key=image_key, position=i))

    session.add(AnchorCandidate(anchor_id=anchor_id, candidate_id=candidate.id))
    session.commit()
    session.refresh(candidate)
    return candidate_read(candidate)


@router.post("/candidates/{candidate_id}/images", response_model=CandidateRead, status_code=201)
def add_candidate_image(
    candidate_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    candidate = session.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    position = len(candidate.photos)
    image_key = storage.upload(file, prefix="candidates")
    session.add(CandidatePhoto(candidate_id=candidate_id, image_key=image_key, position=position))
    session.commit()
    session.refresh(candidate)
    return candidate_read(candidate)


@router.delete("/candidate-images/{photo_id}", status_code=204)
def delete_candidate_image(photo_id: uuid.UUID, session: Session = Depends(get_session)):
    photo = session.get(CandidatePhoto, photo_id)
    if not photo:
        raise HTTPException(404, "Photo not found")
    if photo.image_key:
        storage.delete(photo.image_key)
    session.delete(photo)
    session.commit()


@router.delete("/anchors/{anchor_id}/candidates/{candidate_id}", status_code=204)
def remove_candidate_from_anchor(
    anchor_id: uuid.UUID,
    candidate_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    """Remove a candidate from a specific anchor. Deletes the candidate entirely if it has no other anchors."""
    link = session.get(AnchorCandidate, (anchor_id, candidate_id))
    if not link:
        raise HTTPException(404, "Candidate not linked to this anchor")
    session.delete(link)
    session.flush()

    candidate = session.get(Candidate, candidate_id)
    if candidate and len(candidate.anchors) == 0:
        for photo in candidate.photos:
            if photo.image_key:
                storage.delete(photo.image_key)
        session.delete(candidate)

    session.commit()


@router.patch("/candidates/{candidate_id}", response_model=CandidateRead)
def update_candidate(
    candidate_id: uuid.UUID,
    body: CandidateUpdate,
    session: Session = Depends(get_session),
):
    candidate = session.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(candidate, k, v)
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate_read(candidate)


@router.delete("/candidates/{candidate_id}", status_code=204)
def delete_candidate(candidate_id: uuid.UUID, session: Session = Depends(get_session)):
    candidate = session.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    for photo in candidate.photos:
        if photo.image_key:
            storage.delete(photo.image_key)
    session.delete(candidate)
    session.commit()
