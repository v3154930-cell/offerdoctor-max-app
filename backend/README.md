# ОфферДоктор Backend

Backend для AI-разбора УТП через GigaChat API.

## Структура проекта

```
backend/
├── package.json          # Зависимости и скрипты
├── .env.example          # Пример переменных окружения
├── README.md             # Этот файл
└── src/
    ├── server.js         # Express-сервер, endpoint /api/analyze
    ├── gigachat.js       # Модуль работы с GigaChat API
    └── prompts.js        # Билдеры промтов для разных режимов
```

## Локальный запуск

1. Установите Node.js 18+ (если ещё не установлен)

2. Установите зависимости:
   ```bash
   cd backend
   npm install
   ```

3. Создайте файл `.env` на основе `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Настройте переменные в `.env`:
   - `GIGACHAT_AUTH_KEY` — авторизационный ключ от GigaChat (формат: `client_id:client_secret`)
   - `GIGACHAT_SCOPE` — область доступа (по умолчанию `GIGACHAT_API_B2B`)
   - `GIGACHAT_MODEL` — модель (по умолчанию `GigaChat-2-Pro`)
   - `PORT` — порт сервера (по умолчанию `3000`)

5. Запустите сервер:
   ```bash
   # Для разработки (с авто-перезагрузкой)
   npm run dev

   # Для продакшена
   npm start
   ```

6. Проверьте работоспособность:
   - Health check: http://localhost:3000/health
   - API endpoint: POST http://localhost:3000/api/analyze

## Пример запроса

### Preview режим (бесплатный мини-разбор)

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "product": "Консультации по маркетплейсам",
    "audience": "Селлеры малого бизнеса",
    "offer": "Помогаю продавцам выйти на маркетплейсы и увеличить продажи",
    "pain": "Сравнивают только по цене",
    "mode": "preview"
  }'
```

Ответ:
```json
{
  "previewProblem": "...",
  "previewHint": "...",
  "cta": "Получить полный разбор за 299 ₽"
}
```

### Full режим (полный разбор)

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "product": "Консультации по маркетплейсам",
    "audience": "Селлеры малого бизнеса",
    "offer": "Помогаю продавцам выйти на маркетплейсы и увеличить продажи",
    "pain": "Сравнивают только по цене",
    "mode": "full"
  }'
```

Ответ:
```json
{
  "problems": ["...", "...", "..."],
  "offers": ["...", "...", "..."],
  "shortVersion": "...",
  "firstAdvice": "..."
}
```

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `PORT` | Порт сервера | `3000` |
| `GIGACHAT_AUTH_KEY` | Ключ авторизации (client_id:client_secret) | — |
| `GIGACHAT_SCOPE` | Область доступа | `GIGACHAT_API_B2B` |
| `GIGACHAT_MODEL` | Модель GigaChat | `GigaChat-2-Pro` |

### Настройка scope

- `GIGACHAT_API_B2B` — B2B-контур (основной, рекомендуется)
- `GIGACHAT_API_CORP` — корпоративный контур
- `GIGACHAT_API_PERS` — персональный контур

### Доступные модели

- `GigaChat` — базовая версия
- `GigaChat-Pro` — продвинутая версия
- `GigaChat-2-Pro` — последняя версия (рекомендуется)
- `GigaChat-Max` — максимальная версия

## Деплой на Render

1. Создайте новый Web Service на Render
2. Подключите репозиторий
3. Укажите:
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
4. Добавьте Environment Variables из `.env.example`
5. Деплой

После деплоя вы получите URL вида `https://your-app.onrender.com`

## CORS

CORS настроен только для origin: `https://v3154930-cell.github.io`

Для добавления других доменов измените `corsOptions` в `src/server.js`.

## Где менять логику

### Изменение промтов
Редактируйте функции в `src/prompts.js`:
- `buildPreviewPrompt(data)` — промт для preview
- `buildFullPrompt(data)` — промт для full

### Изменение модели
Измените `GIGACHAT_MODEL` в `.env` или укажите при деплое.

### Изменение параметров запроса
В `src/gigachat.js`, функция `requestGigachat()`:
- `temperature` — креативность (0.0–1.0)
- `top_p` — разнообразие токенов

## Обработка ошибок

| Код | Причина |
|-----|---------|
| `400` | Ошибка валидации входных данных |
| `500` | Ошибка авторизации или внутренняя ошибка |
| `502` | AI вернул невалидный формат ответа |
| `504` | Таймаут запроса к GigaChat |