from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List

class EmbeddingService:
    def __init__(self):
        # Легковесная модель (80MB)
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.dimension = 384
    
    def embed_text(self, text: str) -> List[float]:
        """Преобразует текст в вектор эмбеддинга"""
        embedding = self.model.encode(text)
        return embedding.tolist()
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Преобразует список текстов в векторы"""
        embeddings = self.model.encode(texts)
        return embeddings.tolist()

# Глобальный экземпляр
embedding_service = EmbeddingService()