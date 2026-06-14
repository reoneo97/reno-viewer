from typing import List
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from ..db import get_session
from ..models import (
    Anchor, AnchorRead, CategoryCreate, CategoryUpdate,
    DEFAULT_CATEGORIES, Project, ProjectCreate, ProjectListItem, ProjectRead, ProjectUpdate,
)
from .. import storage
from .candidates import anchor_candidate_reads


def _project_categories(project: Project) -> list[dict]:
    """Current category list, materialising preset defaults for legacy
    projects that have never been edited (categories is NULL)."""
    if project.categories is None:
        return [dict(c) for c in DEFAULT_CATEGORIES]
    return [dict(c) for c in project.categories]

router = APIRouter(prefix="/projects", tags=["projects"])


def _build_project_read(project: Project, session: Session) -> ProjectRead:
    anchors = []
    for anchor in project.anchors:
        candidates = anchor_candidate_reads(session, anchor)
        anchors.append(AnchorRead(**anchor.model_dump(), candidates=candidates))
    data = ProjectRead(**project.model_dump(), anchors=anchors)
    if project.floor_plan_key:
        data.floor_plan_url = storage.presigned_url(project.floor_plan_key)
    return data


def _build_project_list_item(project: Project) -> ProjectListItem:
    data = ProjectListItem.model_validate(project)
    if project.floor_plan_key:
        data.floor_plan_url = storage.presigned_url(project.floor_plan_key)
    return data


@router.get("", response_model=List[ProjectListItem])
def list_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project)).all()
    return [_build_project_list_item(p) for p in projects]


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(body: ProjectCreate, session: Session = Depends(get_session)):
    # Seed a fresh copy of the preset categories so each project owns its own.
    project = Project(**body.model_dump(), categories=[dict(c) for c in DEFAULT_CATEGORIES])
    session.add(project)
    session.commit()
    session.refresh(project)
    return _build_project_read(project, session)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: uuid.UUID, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return _build_project_read(project, session)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(project, k, v)
    session.add(project)
    session.commit()
    session.refresh(project)
    return _build_project_read(project, session)


FALLBACK_CATEGORY = "Others"


def _save_categories(project: Project, categories: list[dict], session: Session) -> ProjectRead:
    project.categories = categories
    session.add(project)
    session.commit()
    session.refresh(project)
    return _build_project_read(project, session)


@router.post("/{project_id}/categories", response_model=ProjectRead, status_code=201)
def add_category(project_id: uuid.UUID, body: CategoryCreate, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Category name is required")
    cats = _project_categories(project)
    if any(c["name"].lower() == name.lower() for c in cats):
        raise HTTPException(409, "A category with that name already exists")
    cats.append({"name": name, "color": body.color})
    return _save_categories(project, cats, session)


@router.patch("/{project_id}/categories", response_model=ProjectRead)
def rename_category(project_id: uuid.UUID, body: CategoryUpdate, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    new_name = body.name.strip()
    if not new_name:
        raise HTTPException(422, "Category name is required")
    cats = _project_categories(project)
    target = next((c for c in cats if c["name"] == body.old_name), None)
    if not target:
        raise HTTPException(404, "Category not found")
    if new_name.lower() != body.old_name.lower() and any(
        c["name"].lower() == new_name.lower() for c in cats
    ):
        raise HTTPException(409, "A category with that name already exists")

    renamed = new_name != body.old_name
    target["name"] = new_name
    target["color"] = body.color

    # A rename cascades to every anchor that referenced the old name, so pins
    # don't get orphaned (anchor.category is a plain string, not an FK).
    if renamed:
        for anchor in project.anchors:
            if anchor.category == body.old_name:
                anchor.category = new_name
                session.add(anchor)
    return _save_categories(project, cats, session)


@router.delete("/{project_id}/categories/{name}", response_model=ProjectRead)
def delete_category(project_id: uuid.UUID, name: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    cats = _project_categories(project)
    if not any(c["name"] == name for c in cats):
        raise HTTPException(404, "Category not found")
    remaining = [c for c in cats if c["name"] != name]

    # Reassign anchors using the deleted category to the fallback (or clear it
    # if the fallback itself was deleted).
    has_fallback = any(c["name"] == FALLBACK_CATEGORY for c in remaining)
    for anchor in project.anchors:
        if anchor.category == name:
            anchor.category = FALLBACK_CATEGORY if has_fallback else None
            session.add(anchor)
    return _save_categories(project, remaining, session)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: uuid.UUID, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if project.floor_plan_key:
        storage.delete(project.floor_plan_key)
    session.delete(project)
    session.commit()


@router.post("/{project_id}/floor-plan", response_model=ProjectRead)
def upload_floor_plan(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if project.floor_plan_key:
        storage.delete(project.floor_plan_key)
    project.floor_plan_key = storage.upload(file, prefix="floor-plans")
    session.add(project)
    session.commit()
    session.refresh(project)
    return _build_project_read(project, session)
