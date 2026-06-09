from typing import List
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from ..db import get_session
from ..models import (
    Anchor, AnchorRead,
    Project, ProjectCreate, ProjectListItem, ProjectRead, ProjectUpdate,
)
from .. import storage
from .candidates import anchor_candidate_reads

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
    project = Project(**body.model_dump())
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
