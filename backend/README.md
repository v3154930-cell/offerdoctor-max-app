# ОфферДоктор Backend

Backend для AI-разбора УТП через GigaChat API.

## Локальный запуск (Real mode)

```bash
cd backend
npm install
# .env должен содержать:
#   DEMO_MODE=false
#   GIGACHAT_AUTH_KEY=ваш_ключ
#   GIGACHAT_MODEL=GigaChat-2-Pro
npm start
# http://localhost:3000
```

## Локальный запуск (Demo mode)

```bash
cd backend
# Установите DEMO_MODE=true в .env
npm start
```

## Деплой на Render

1. Создайте новый Web Service на https://render.com
2. Подключите репозиторий
3. Настройки:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
4. Environment Variables:
   - `DEMO_MODE` = `false`
   - `GIGACHAT_AUTH_KEY` = ваш ключ
   - `GIGACHAT_SCOPE` = `GIGACHAT_API_PERS`
   - `GIGACHAT_MODEL` = `GigaChat-2-Pro`
   - `PORT` = `10000` (Render задаёт автоматически)

После деплоя вы получите URL вида `https://offerdoctor-api.onrender.com`.

## Настройка API_BASE_URL в frontend

После деплоя backend нужно указать его URL в `index.html`.

Откройте `index.html` и замените `{{API_BASE_URL}}` на реальный URL:

```js
// Было:
var API_BASE_URL = window.API_BASE_URL || '{{API_BASE_URL}}' || 'http://localhost:3000';

// Стало (пример для Render):
var API_BASE_URL = window.API_BASE_URL || 'https://offerdoctor-api.onrender.com' || 'http://localhost:3000';
```

Или задайте через window.API_BASE_URL перед загрузкой скрипта:
```html
<script>window.API_BASE_URL = 'https://offerdoctor-api.onrender.com';</script>
```

## API

### POST /api/analyze

Запрос:
```json
{
  "product": "Кроссовки для бега",
  "audience": "Начинающие бегуны",
  "text": "Лёгкие кроссовки для бега",
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
  "previewHint": "...",
  "cta": "..."
}
```

Ответ (full):
```json
{
  "problems": ["...", "...", "..."],
  "offers": ["...", "...", "..."],
  "shortVersion": "...",
  "firstAdvice": "..."
}
```

Ответ (full + competitor):
```json
{
  "problems": ["...", "...", "..."],
  "offers": ["...", "...", "..."],
  "shortVersion": "...",
  "firstAdvice": "...",
  "competitorAnalysis": [
    {"title": "...", "text": "..."},
    {"title": "...", "text": "..."},
    {"title": "...", "text": "..."}
  ]
}
```

### Ошибки

| Код | Тип | Причина |
|-----|-----|---------|
| 400 | validation_error | Не заполнены обязательные поля |
| 429 | internal_error | Rate limit GigaChat |
| 502 | invalid_model_response | AI вернул невалидный JSON |
| 503 | provider_not_configured | Не задан GIGACHAT_AUTH_KEY |
| 504 | internal_error | Таймаут GigaChat |

## Переменные окружения

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `PORT` | Нет | Порт (по умолчанию 3000) |
| `DEMO_MODE` | Нет | `true` = mock-данные, `false` = реальный GigaChat |
| `GIGACHAT_AUTH_KEY` | Да (для real mode) | Base64-ключ `client_id:client_secret` |
| `GIGACHAT_SCOPE` | Нет | `GIGACHAT_API_PERS` по умолчанию |
| `GIGACHAT_MODEL` | Нет | `GigaChat-2-Pro` по умолчанию |

## Структура

```
backend/
├── package.json
├── .env              # не в репозитории
├── .env.example      # шаблон
├── .gitignore
├── README.md
└── src/
    ├── server.js     # Express, /api/analyze
    ├── gigachat.js   # OAuth, запросы, парсинг
    ├── prompts.js    # промты preview/full/competitor
    └── demoMocks.js  # mock-данные
```

## CORS

CORS настроен на разрешение всех origins. Для production рекомендуется ограничить в `server.js`.

## Robokassa (опционально)

Для приёма оплат через Robokassa:

### 1. Регистрация и настройка

1. Зарегистрируйтесь на https://robokassa.ru
2. Создайте магазин и получите **Login** ( MerchantLogin )
3. В настройках магазина:
   - **Алгоритм подписи**: MD5
   - **Result URL**: `https://your-domain.com/api/payment/result`
   - **Success URL**: `https://your-domain.com/#?orderId={InvId}`
   - **Fail URL**: `https://your-domain.com/#?fail=true`
   - Включите **Тестовый режим** для проверки

### 2. Переменные окружения

```bash
# Базовый URL вашего deployed приложения (обязательно для callback!)
ROBOKASSA_BASE_URL=https://your-domain.com

# Login магазина
ROBOKASSA_LOGIN=your_shop_login

# Password1 (для подписи)
ROBOKASSA_PASSWORD1=your_password1

# Тестовый режим (true/false)
ROBOKASSA_IS_TEST=true
```

### 3. URLs в кабинете Robokassa

| Параметр | Значение | Примечание |
|----------|----------|------------|
| ResultURL | `https://your-domain.com/api/payment/result` | Robokassa шлёт POST после оплаты |
| SuccessURL | `https://your-domain.com/#?orderId={InvId}` | Редирект после успешной оплаты |
| FailURL | `https://your-domain.com/#?fail=true` | Редирект после отмены |

### 4. Важно

- **ResultURL должен быть публичным** — localhost не работает. Используйте ngrok для локального тестирования.
- **HTTPS обязателен** — Robokassa требует защищённое соединение для callback.
- **IsTest=1** — в тестовом режиме используйте тестовые карты (можно получить в кабинете Robokassa).
- После проверки переключите `ROBOKASSA_IS_TEST=false` и пройдите модерацию.

### 5. Проверка callback

После оплаты в тестовом режиме:
1. Пользователь оплачивает
2. Robokassa шлёт POST на ResultURL
3. Backend запускает анализ
4. Frontend polling проверяет статус и показывает результат
