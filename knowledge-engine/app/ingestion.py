from sqlalchemy.orm import Session
from app.models import Source, Chunk
from app.embeddings import embedding_service
from app.chunker import TextChunker
import uuid
from datetime import datetime

class IngestionService:
    def __init__(self, db: Session):
        self.db = db
    
    def process_source(self, source_id: str):
        """Обрабатывает источник: извлекает текст, разбивает на чанки, создает эмбеддинги"""
        source = self.db.query(Source).filter(Source.id == source_id).first()
        if not source:
            return {"error": "Source not found"}
        
        # Извлекаем текст в зависимости от типа источника
        text = self._extract_text(source)
        if not text:
            return {"error": "No text extracted"}
        
        # Разбиваем на чанки
        chunks = TextChunker.chunk_by_characters(text, chunk_size=500, overlap=100)
        
        # Создаем эмбеддинги для всех чанков
        embeddings = embedding_service.embed_batch(chunks)
        
        # Сохраняем чанки в базу
        for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk = Chunk(
                id=str(uuid.uuid4()),
                project_id=source.project_id,
                source_id=source.id,
                chunk_text=chunk_text,
                chunk_index=i,
                embedding=embedding,
                source_priority=source.priority_level,
                source_type=source.source_type
            )
            self.db.add(chunk)
        
        # Обновляем статус источника
        source.last_sync_at = datetime.utcnow()
        source.sync_status = "success"
        self.db.commit()
        
        return {"processed": len(chunks), "source_id": source_id}
    
    def _extract_text(self, source: Source) -> str:
        """Извлекает текст из источника"""
        if source.source_type == "manual":
            return source.manual_text or ""
        elif source.source_type == "text":
            return source.manual_text or ""
        elif source.source_type == "url":
            return f"Sample text from URL: {source.url}"
        elif source.source_type == "pdf":
            return f"Sample text from PDF: {source.file_name}"
        else:
            return ""