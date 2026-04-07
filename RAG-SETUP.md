# Запуск с RAG (Knowledge Engine)

## Быстрый старт

### 1. Запустить Knowledge Engine (отдельный сервис)

```bash
cd knowledge-engine
pip install -r requirements.txt
python run.py
```

Сервис будет доступен на http://127.0.0.1:8000

### 2. Создать проект в Knowledge Engine

После запуска создайте проект:

```bash
curl -X POST http://127.0.0.1:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"offerdoctor","description":"База знаний для OfferDoctor","domain":"marketing","language":"ru"}'
```

Скопируйте полученный `id` (например, `ke_xxx...`) — это `KNOWLEDGE_PROJECT_ID`

### 3. Запустить OfferDoctor

```bash
cd backend
npm install
node src/server.js
```

### 4. Настроить переменные окружения

В `backend/.env`:

```
ENABLE_RAG=true
KNOWLEDGE_ENGINE_URL=http://127.0.0.1:8000
KNOWLEDGE_PROJECT_ID=ke_xxx...  # полученный на шаге 2
RAG_TOP_K=5
```

### 5. Протестировать

```bash
# Запрос с RAG
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "product": "Курс по пиару",
    "audience": "Предприниматели",
    "text": "Научим пиару за неделю",
    "mode": "preview"
  }'
```

## Проверка работы RAG

1. Включите RAG: `ENABLE_RAG=true`
2. Отправьте запрос — в логах появится `[Knowledge] Поиск по базе знаний`
3. Если knowledge-engine недоступен — OfferDoctor работает без RAG (fallback)

## Без RAG (по-старому)

Просто оставьте `ENABLE_RAG=false` или удалите переменную — OfferDoctor работает как раньше.