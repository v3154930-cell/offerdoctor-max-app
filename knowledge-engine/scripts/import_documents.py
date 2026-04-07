#!/usr/bin/env python3
"""
Document Import Script for Knowledge Engine
半自动ческий импорт документов в базу знаний.

Usage:
    python scripts/import_documents.py [--manifest manifest.json]

Config (via imports.env or environment):
    KNOWLEDGE_ENGINE_URL - URL движка (default: http://localhost:8000)
    KNOWLEDGE_PROJECT_ID - ID проекта для загрузки
    DEFAULT_PRIORITY_LEVEL - приоритет по умолчанию (default: 3)
    DRY_RUN=true/false - режим проверки (ничего не загружает)
"""

import os
import sys
import json
import shutil
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import requests

SCRIPT_DIR = Path(__file__).parent.parent
IMPORTS_DIR = SCRIPT_DIR / "imports"
INBOX_DIR = IMPORTS_DIR / "inbox"
PROCESSED_DIR = IMPORTS_DIR / "processed"
FAILED_DIR = IMPORTS_DIR / "failed"
MANIFESTS_DIR = IMPORTS_DIR / "manifests"
ENV_FILE = SCRIPT_DIR / "imports.env"

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s"
)
log = logging.getLogger(__name__)


class ImportConfig:
    def __init__(self):
        self._load_env_file()
        self.knowledge_url = os.environ.get("KNOWLEDGE_ENGINE_URL", "http://localhost:8000")
        self.project_id = os.environ.get("KNOWLEDGE_PROJECT_ID", "")
        self.default_priority = int(os.environ.get("DEFAULT_PRIORITY_LEVEL", "3"))
        self.dry_run = os.environ.get("DRY_RUN", "true").lower() == "true"

    def _load_env_file(self):
        if ENV_FILE.exists():
            with open(ENV_FILE) as f:
                for line in f:
                    line = line.strip()
                    if line and "=" in line and not line.startswith("#"):
                        key, value = line.split("=", 1)
                        if not os.environ.get(key):
                            os.environ[key] = value

    def validate(self) -> bool:
        if not self.project_id:
            log.error("KNOWLEDGE_PROJECT_ID не задан!")
            return False
        return True


class DocumentManifest:
    """Схема одного документа в манифесте"""
    
    @staticmethod
    def parse_manifest(manifest_path: Path) -> List[Dict[str, Any]]:
        if not manifest_path.exists():
            raise FileNotFoundError(f"Manifest not found: {manifest_path}")
        
        with open(manifest_path) as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            raise ValueError("Manifest must be a JSON array of documents")
        
        return data
    
    @staticmethod
    def encode_metadata_to_title(doc: Dict[str, Any]) -> str:
        """Кодирует метаданные в title: [key=value] Title"""
        title = doc.get("title", "Untitled")
        
        tags = []
        for key in ["scenario", "platform", "topic", "type", "level"]:
            if doc.get(key):
                tags.append(f"[{key}={doc[key]}]")
        
        if tags:
            return " ".join(tags) + " " + title
        return title


class KnowledgeEngineImporter:
    """Импортер документов в Knowledge Engine"""
    
    def __init__(self, config: ImportConfig):
        self.config = config
        self.api_url = config.knowledge_url.rstrip("/")
        self.session = requests.Session()
        self.stats = {
            "total": 0,
            "success": 0,
            "failed": 0,
            "skipped": 0
        }
    
    def _make_title_with_metadata(self, doc: Dict) -> str:
        """Создает title с метаданными для API"""
        return DocumentManifest.encode_metadata_to_title(doc)
    
    def create_source(self, doc: Dict) -> Optional[Dict]:
        """Создает source в движке"""
        title = self._make_title_with_metadata(doc)
        source_type = doc.get("source_type", "text")
        priority = doc.get("priority_level", self.config.default_priority)
        
        payload = {
            "title": title,
            "source_type": source_type,
            "priority_level": priority
        }
        
        if source_type in ("manual", "text"):
            file_path = INBOX_DIR / doc.get("file_path", "")
            if not file_path.exists():
                log.error(f"  ❌ Файл не найден: {file_path}")
                return None
            
            text = file_path.read_text(encoding="utf-8")
            payload["manual_text"] = text
        
        try:
            resp = self.session.post(
                f"{self.api_url}/projects/{self.config.project_id}/sources",
                json=payload,
                timeout=30
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            log.error(f"  ❌ Ошибка создания source: {e}")
            return None
    
    def process_source(self, source_id: str) -> bool:
        """Обрабатывает source (создает чанки и эмбеддинги)"""
        try:
            resp = self.session.post(
                f"{self.api_url}/sources/{source_id}/process",
                timeout=60
            )
            resp.raise_for_status()
            return True
        except requests.RequestException as e:
            log.error(f"  ❌ Ошибка обработки: {e}")
            return False
    
    def import_document(self, doc: Dict, index: int) -> bool:
        """Импортирует один документ"""
        file_path = doc.get("file_path", "")
        
        self.stats["total"] += 1
        log.info(f"[{index+1}] {doc.get('title', file_path)}")
        
        if self.config.dry_run:
            log.info(f"  🔍 [DRY-RUN] Создал бы source: {file_path}")
            self.stats["skipped"] += 1
            return True
        
        source = self.create_source(doc)
        if not source:
            self.stats["failed"] += 1
            self._move_to_failed(doc, "source_creation_failed")
            return False
        
        source_id = source.get("id")
        log.info(f"  ✅ Source created: {source_id}")
        
        success = self.process_source(source_id)
        if not success:
            self.stats["failed"] += 1
            self._move_to_failed(doc, "processing_failed")
            return False
        
        log.info(f"  ✅ Source processed")
        self.stats["success"] += 1
        self._move_to_processed(doc)
        return True
    
    def _move_to_processed(self, doc: Dict):
        """Перемещает файл в processed"""
        src = INBOX_DIR / doc.get("file_path", "")
        if src.exists():
            dst = PROCESSED_DIR / src.name
            shutil.move(str(src), str(dst))
    
    def _move_to_failed(self, doc: Dict, reason: str):
        """Перемещает файл в failed"""
        src = INBOX_DIR / doc.get("file_path", "")
        if src.exists():
            dst = FAILED_DIR / f"{reason}_{src.name}"
            shutil.move(str(src), str(dst))
            err_file = FAILED_DIR / f"{reason}_{src.name}.error"
            err_file.write_text(json.dumps(doc, ensure_ascii=False, indent=2))


def find_manifest(name: str = None) -> Optional[Path]:
    """Ищет manifest.json"""
    if name:
        return MANIFESTS_DIR / name
    
    default = MANIFESTS_DIR / "manifest.json"
    if default.exists():
        return default
    
    manifests = list(MANIFESTS_DIR.glob("*.json"))
    if manifests:
        return manifests[0]
    
    return None


def check_engine_health(config: ImportConfig) -> bool:
    """Проверяет доступность движка"""
    import time
    for attempt in range(3):
        try:
            log.info(f"Health check attempt {attempt + 1}/3...")
            resp = requests.get(f"{config.knowledge_url}/", timeout=30)
            if resp.status_code == 200:
                return True
            log.error(f"Health check failed: status={resp.status_code}")
        except requests.RequestException as e:
            log.error(f"Health check error: {e}")
        time.sleep(2)
    return False


def main():
    parser = argparse.ArgumentParser(description="Импорт документов в Knowledge Engine")
    parser.add_argument("--manifest", "-m", help="Имя manifest файла")
    parser.add_argument("--verbose", "-v", action="store_true", help="Подробный вывод")
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    config = ImportConfig()
    
    log.info("=" * 50)
    log.info("📥 Knowledge Engine Document Importer")
    log.info("=" * 50)
    log.info(f"URL: {config.knowledge_url}")
    log.info(f"Project ID: {config.project_id or '(не задан)'}")
    log.info(f"Mode: {'🔍 DRY-RUN (проверка)' if config.dry_run else '🚀 REAL (загрузка)'}")
    log.info("=" * 50)
    
    if not check_engine_health(config):
        log.error("❌ Knowledge Engine недоступен!")
        log.info("Запустите: python run.py")
        sys.exit(1)
    
    if not config.validate():
        sys.exit(1)
    
    manifest_path = find_manifest(args.manifest)
    if not manifest_path:
        log.error(f"❌ Manifest не найден в {MANIFESTS_DIR}")
        sys.exit(1)
    
    log.info(f"📄 Читаю manifest: {manifest_path}")
    documents = DocumentManifest.parse_manifest(manifest_path)
    log.info(f"📊 Найдено документов: {len(documents)}")
    
    files_in_inbox = [f.name for f in INBOX_DIR.glob("*") if f.is_file()]
    if files_in_inbox:
        log.info(f"📁 Файлов в inbox: {len(files_in_inbox)}")
    
    log.info("-" * 50)
    
    importer = KnowledgeEngineImporter(config)
    
    for i, doc in enumerate(documents):
        importer.import_document(doc, i)
    
    log.info("=" * 50)
    log.info("📊 Итоги:")
    log.info(f"  Всего: {importer.stats['total']}")
    
    colors = {"success": "✅", "failed": "❌", "skipped": "⏭️"}
    for key, label in [("success", "Загружено"), ("failed", "Ошибки"), ("skipped", "Пропущено")]:
        count = importer.stats[key]
        if count > 0:
            log.info(f"  {colors[key]} {label}: {count}")
    
    log.info("=" * 50)
    
    if config.dry_run:
        log.info("💡 Это был тестовый прогон. Для реальной загрузки:")
        log.info("   DRY_RUN=false python scripts/import_documents.py")


if __name__ == "__main__":
    main()