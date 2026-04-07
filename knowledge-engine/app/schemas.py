from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    tags: List[str] = Field(default_factory=list)


class KnowledgeBaseResponse(KnowledgeBaseCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    @field_validator('tags', mode='before')
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            return v.split(',') if v else []
        return v or []

    class Config:
        from_attributes = True


class KnowledgeItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)
    source: Optional[str] = Field(None, max_length=500)
    tags: List[str] = Field(default_factory=list)


class KnowledgeItemResponse(KnowledgeItemCreate):
    id: int
    knowledge_base_id: int
    created_at: datetime
    updated_at: datetime

    @field_validator('tags', mode='before')
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            return v.split(',') if v else []
        return v or []

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    language: str = "ru"


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    domain: Optional[str]
    language: str
    api_key: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Source schemas
class SourceCreate(BaseModel):
    title: str
    source_type: str  # url, pdf, api, manual, csv
    priority_level: int = 3
    url: Optional[str] = None
    manual_text: Optional[str] = None
    api_config: Optional[Dict[str, Any]] = None


class SourceResponse(BaseModel):
    id: str
    project_id: str
    title: str
    source_type: str
    priority_level: int
    url: Optional[str]
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    is_active: bool
    last_sync_at: Optional[datetime]
    sync_status: str
    created_at: datetime

    class Config:
        from_attributes = True