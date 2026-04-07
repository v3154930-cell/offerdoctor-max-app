from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db, init_db
from app.schemas import ProjectCreate, ProjectResponse, SourceCreate, SourceResponse
from app.models import Project, Source, Chunk
import secrets
import shutil
from pathlib import Path
import numpy as np
from app.embeddings import embedding_service
from app.ingestion import IngestionService
from datetime import datetime

# Создаем таблицы при старте
init_db()

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

@app.get("/")
def root():
    return {"message": "Knowledge Engine API", "version": "0.1.0"}

@app.post("/projects", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    # Генерируем API ключ
    api_key = f"ke_{secrets.token_urlsafe(32)}"
    
    db_project = Project(
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

@app.get("/projects", response_model=list[ProjectResponse])
def list_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.is_active == True).offset(skip).limit(limit).all()
    return projects

@app.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.is_active = False
    db.commit()
    return {"message": "Project deleted"}

# ============ Sources endpoints ============
@app.post("/projects/{project_id}/sources", response_model=SourceResponse)
def create_source(project_id: str, source: SourceCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.is_active == True).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_source = Source(
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

@app.get("/projects/{project_id}/sources", response_model=list[SourceResponse])
def list_sources(project_id: str, db: Session = Depends(get_db)):
    sources = db.query(Source).filter(Source.project_id == project_id, Source.is_active == True).all()
    return sources

@app.delete("/sources/{source_id}")
def delete_source(source_id: str, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    source.is_active = False
    db.commit()
    return {"message": "Source deleted"}

@app.post("/projects/{project_id}/upload-pdf")
async def upload_pdf(project_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.is_active == True).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    file_path = upload_dir / f"{project_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    source = Source(
        project_id=project_id,
        title=file.filename,
        source_type="pdf",
        file_path=str(file_path),
        file_name=file.filename,
        priority_level=1
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    
    return {"message": "PDF uploaded", "source_id": source.id, "file_path": str(file_path)}

# ============ Embeddings & Search endpoints ============
@app.post("/sources/{source_id}/process")
def process_source(source_id: str, db: Session = Depends(get_db)):
    """Обрабатывает источник: создает чанки и эмбеддинги"""
    ingestion = IngestionService(db)
    result = ingestion.process_source(source_id)
    return result

@app.post("/projects/{project_id}/search")
def search_in_project(project_id: str, query: str, top_k: int = 5, db: Session = Depends(get_db)):
    """Ищет похожие чанки в проекте"""
    # Получаем эмбеддинг запроса
    query_embedding = embedding_service.embed_text(query)
    
    # Ищем похожие чанки
    chunks = db.query(Chunk).filter(Chunk.project_id == project_id).all()
    
    # Считаем косинусное сходство
    results = []
    for chunk in chunks:
        if chunk.embedding:
            similarity = cosine_similarity(query_embedding, chunk.embedding)
            results.append((chunk, similarity))
    
    # Сортируем и берем top_k
    results.sort(key=lambda x: x[1], reverse=True)
    top_results = results[:top_k]
    
    return [
        {
            "text": chunk.chunk_text,
            "source_id": chunk.source_id,
            "priority": chunk.source_priority,
            "similarity": float(sim)
        }
        for chunk, sim in top_results
    ]


def cosine_similarity(a, b):
    """Вычисляет косинусное сходство между двумя векторами"""
    a = np.array(a)
    b = np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)