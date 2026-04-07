from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import secrets
import uuid
import os
import shutil
from pathlib import Path
from app.database import get_db
from app.models import KnowledgeBase, KnowledgeItem, Project, Source
from app.schemas import (
    KnowledgeBaseCreate, KnowledgeBaseResponse,
    KnowledgeItemCreate, KnowledgeItemResponse,
    ProjectCreate, ProjectResponse,
    SourceCreate, SourceResponse
)

router = APIRouter(prefix="/api", tags=["knowledge"])


# Project endpoints
@router.post("/projects", response_model=ProjectResponse, status_code=201)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    api_key = secrets.token_hex(32)
    db_project = Project(
        id=str(uuid.uuid4()),
        name=project.name,
        description=project.description,
        domain=project.domain,
        language=project.language,
        api_key=api_key
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("/projects", response_model=List[ProjectResponse])
def get_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return None


# Source endpoints
@router.post("/projects/{project_id}/sources", response_model=SourceResponse, status_code=201)
def create_source(project_id: str, source: SourceCreate, db: Session = Depends(get_db)):
    # Check if project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_source = Source(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=source.title,
        source_type=source.source_type,
        priority_level=source.priority_level,
        url=source.url,
        manual_text=source.manual_text,
        api_config=str(source.api_config) if source.api_config else None
    )
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


@router.get("/projects/{project_id}/sources", response_model=List[SourceResponse])
def get_sources(project_id: str, db: Session = Depends(get_db)):
    sources = db.query(Source).filter(Source.project_id == project_id).all()
    return sources


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(source_id: str, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return None


@router.post("/projects/{project_id}/upload-pdf", status_code=201)
async def upload_pdf(project_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Check if project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Create upload directory
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    # Save file
    file_path = upload_dir / f"{project_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Create source
    db_source = Source(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=file.filename,
        source_type="pdf",
        file_path=str(file_path),
        file_name=file.filename,
        priority_level=1
    )
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    
    return {"message": "PDF uploaded", "source_id": db_source.id, "file_path": str(file_path)}


# KnowledgeBase endpoints
@router.post("/knowledge-bases", response_model=KnowledgeBaseResponse, status_code=201)
def create_knowledge_base(base: KnowledgeBaseCreate, db: Session = Depends(get_db)):
    db_base = KnowledgeBase(
        name=base.name,
        description=base.description,
        tags=",".join(base.tags) if base.tags else ""
    )
    db.add(db_base)
    db.commit()
    db.refresh(db_base)
    return db_base


@router.get("/knowledge-bases", response_model=List[KnowledgeBaseResponse])
def get_knowledge_bases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    bases = db.query(KnowledgeBase).offset(skip).limit(limit).all()
    return bases


@router.get("/knowledge-bases/{base_id}", response_model=KnowledgeBaseResponse)
def get_knowledge_base(base_id: int, db: Session = Depends(get_db)):
    base = db.query(KnowledgeBase).filter(KnowledgeBase.id == base_id).first()
    if not base:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return base


@router.delete("/knowledge-bases/{base_id}", status_code=204)
def delete_knowledge_base(base_id: int, db: Session = Depends(get_db)):
    base = db.query(KnowledgeBase).filter(KnowledgeBase.id == base_id).first()
    if not base:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    db.delete(base)
    db.commit()
    return None


# KnowledgeItem endpoints
@router.post("/knowledge-bases/{base_id}/items", response_model=KnowledgeItemResponse, status_code=201)
def create_knowledge_item(base_id: int, item: KnowledgeItemCreate, db: Session = Depends(get_db)):
    base = db.query(KnowledgeBase).filter(KnowledgeBase.id == base_id).first()
    if not base:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    db_item = KnowledgeItem(
        title=item.title,
        content=item.content,
        source=item.source,
        tags=",".join(item.tags) if item.tags else "",
        knowledge_base_id=base_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@router.get("/knowledge-bases/{base_id}/items", response_model=List[KnowledgeItemResponse])
def get_knowledge_items(base_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    base = db.query(KnowledgeBase).filter(KnowledgeBase.id == base_id).first()
    if not base:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    items = db.query(KnowledgeItem).filter(KnowledgeItem.knowledge_base_id == base_id).offset(skip).limit(limit).all()
    return items