# 🧠 Knowledge Engine

**Универсальная база знаний для ботов и AI-агентов**

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com/)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.35+-red.svg)](https://streamlit.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ Возможности

- 🔍 **Семантический поиск** через эмбеддинги (all-MiniLM-L6-v2)
- 🤖 **Встроенная LLM** Gemma 3 270M (через Ollama)
- 💬 **Веб-админка** на Streamlit (чат с Gemma, управление проектами)
- 📁 **Управление проектами** (создание, удаление, конфиг)
- 📄 **Загрузка источников** (URL, PDF, текст)
- 🐍 **Клиент для ботов** (MCP-подобный протокол)
- 🐳 **Docker поддержка**

## 🚀 Быстрый старт

### 1. Клонируйте репозиторий
```bash
git clone https://github.com/yourusername/knowledge-engine.git
cd knowledge-engine
```

### 2. Установите зависимости
```bash
pip install -r requirements.txt
```

### 3. Установите Ollama и скачайте модель
```bash
# Установите Ollama с https://ollama.com
ollama pull gemma3:270m
```

### 4. Запустите сервер
```bash
python run.py
```

### 5. Запустите админку
```bash
streamlit run chat_admin.py
```

## 📖 Использование в боте

```python
from ke_client import KnowledgeEngineClient

ke = KnowledgeEngineClient("http://localhost:8000")
project_id = ke.create_project("Мой бот")
results = ke.search(project_id, "вопрос пользователя")
```

## 📁 Структура

```
knowledge-engine/
├── app/           # FastAPI приложение
├── run.py         # Запуск сервера
├── chat_admin.py  # Streamlit админка
├── ke_client.py   # Клиент для ботов
└── requirements.txt
```

## 📄 Лицензия

MIT