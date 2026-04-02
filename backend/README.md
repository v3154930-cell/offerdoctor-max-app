# ОфферДоктор Backend

Backend для AI-разбора УТП через GigaChat API.

## Быстрый запуск (Demo mode)

```bash
cd backend
npm install
# .env уже содержит DEMO_MODE=true — запускаем сразу
npm start
```

Сервер запустится на http://localhost:3000 с mock-данными (без GigaChat).

## Запуск с реальным GigaChat

1. Скопируйте `.env.example` → `.env`
2. Установите `DEMO_MODE=false`
3. Заполните `GIGACHAT_AUTH_KEY` (формат: `client_id:client_secret`)
4. `npm start`

## Demo Mode

Когда `DEMO_MODE=true`, сервер возвращает правдоподобные mock-результаты
для всех сценариев без обращения к GigaChat.

Mock-ответы зависят от:
- **scenario**: `marketplace` | `avito` | `landing`
- **platform**: `ozon` | `wb` | `ym` (только для marketplace)
- **mode**: `preview` | `full`
- **tariff**: `main` | `competitor` (только для full marketplace)

## API

### POST /api/analyze

Запрос:
```json
{
  "product": "Кроссовки для бега",
  "audience": "Начинающие бегуны",
  "link": "https://ozon.ru/product/...",
  "text": "",
  "pain": "Мало продаж",
  "scenario": "marketplace",
  "platform": "ozon",
  "mode": "preview",
  "tariff": "main"
}
```

Ответ (preview):
```json
{
  "previewProblem": "...",
  "previewHint": "..."
}
```

Ответ (full):
```json
{
  "problems": ["...", "...", "..."],
  "offers": ["...", "...", "..."],
  "shortVersion": "...",
  "firstAdvice": "...",
  "competitorAnalysis": "..."
}
```

### Ошибки

| Код | Причина |
|-----|---------|
| 400 | Ошибка валидации входных данных |
| 503 | GigaChat credentials не настроены (provider_not_configured) |
| 502 | AI вернул невалидный формат ответа |
| 504 | Таймаут запроса к GigaChat |

## Структура

```
backend/
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── server.js        # Express-сервер, /api/analyze
    ├── gigachat.js      # Модуль работы с GigaChat API
    ├── prompts.js       # Промты для preview/full
    └── demoMocks.js     # Mock-данные для demo mode
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `PORT` | 3000 | Порт сервера |
| `DEMO_MODE` | false | Включить mock-данные |
| `GIGACHAT_AUTH_KEY` | — | Ключ авторизации GigaChat |
| `GIGACHAT_SCOPE` | GIGACHAT_API_PERS | Область доступа |
| `GIGACHAT_MODEL` | GigaChat-2-Pro | Модель |

## Деплой

### Render
- Build Command: `cd backend && npm install`
- Start Command: `cd backend && npm start`
- Environment: `DEMO_MODE=true` для теста, `DEMO_MODE=false` + credentials для продакшена

## CORS

Разрешены origins:
- `https://v3154930-cell.github.io`
- `http://localhost:3000`
- `http://localhost:5500`
- `http://127.0.0.1:5500`
- `http://localhost:8080`
