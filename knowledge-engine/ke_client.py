"""
Knowledge Engine Client для интеграции в бота.
Установка: pip install requests
"""

import requests
from typing import List, Dict, Optional


class KnowledgeEngineClient:
    """MCP-подобный клиент для работы с базой знаний"""
    
    def __init__(self, api_url: str = "http://localhost:8000"):
        self.api_url = api_url
    
    def health(self) -> Dict:
        """Проверка доступности"""
        resp = requests.get(f"{self.api_url}/")
        return resp.json()
    
    def search(self, project_id: str, query: str, top_k: int = 5) -> List[Dict]:
        """Поиск по базе знаний"""
        resp = requests.post(
            f"{self.api_url}/projects/{project_id}/search",
            json={"query": query, "top_k": top_k}
        )
        return resp.json()
    
    def get_rules(self, project_id: str, platform: str = None) -> List[Dict]:
        """Получить правила маркетплейсов"""
        return self.search(project_id, "правила")
    
    def create_project(self, name: str, description: str = "", config: Dict = None) -> Dict:
        """Создать новый проект"""
        payload = {"name": name, "description": description}
        if config:
            payload["config"] = config
        
        resp = requests.post(f"{self.api_url}/projects", json=payload)
        return resp.json()
    
    def list_projects(self) -> List[Dict]:
        """Список проектов"""
        resp = requests.get(f"{self.api_url}/projects")
        return resp.json()