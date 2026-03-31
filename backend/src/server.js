/**
 * ОфферДоктор Backend
 * Express-сервер для AI-разбора УТП через GigaChat
 */

// Загрузка переменных окружения
require('dotenv').config();

var express = require('express');
var cors = require('cors');
var prompts = require('./prompts');
var gigachat = require('./gigachat');

var app = express();
var PORT = process.env.PORT || 3000;

// ===== Middleware =====

// CORS только для GitHub Pages
var corsOptions = {
    origin: 'https://v3154930-cell.github.io',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// ===== Health check =====
app.get('/', function (req, res) {
    res.json({ status: 'ok', service: 'ОфферДоктор API' });
});

app.get('/health', function (req, res) {
    res.json({ status: 'ok' });
});

// ===== POST /api/analyze =====
app.post('/api/analyze', function (req, res) {
    var data = req.body;

    // ===== Валидация входных данных =====
    var errors = [];

    if (typeof data.product !== 'string' || data.product.trim().length === 0) {
        errors.push('product должен быть непустой строкой');
    }
    if (typeof data.audience !== 'string' || data.audience.trim().length === 0) {
        errors.push('audience должен быть непустой строкой');
    }
    if (typeof data.offer !== 'string' || data.offer.trim().length === 0) {
        errors.push('offer должен быть непустой строкой');
    }
    if (typeof data.pain !== 'string' || data.pain.trim().length === 0) {
        errors.push('pain должен быть непустой строкой');
    }
    if (data.mode !== 'preview' && data.mode !== 'full') {
        errors.push('mode должен быть "preview" или "full"');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: 'validation_error',
            message: 'Ошибка валидации входных данных',
            details: errors
        });
    }

    // ===== Построение промта =====
    var prompt;
    if (data.mode === 'preview') {
        prompt = prompts.buildPreviewPrompt(data);
    } else {
        prompt = prompts.buildFullPrompt(data);
    }

    console.log('[' + data.mode + '] Запрос к GigaChat для:', data.product);

    // ===== Запрос к GigaChat =====
    gigachat.requestGigachat(prompt)
        .then(function (responseText) {
            console.log('[' + data.mode + '] Ответ от GigaChat получен');

            // ===== Парсинг JSON из ответа =====
            var parsed = gigachat.safeParseJsonFromModel(responseText);

            if (!parsed) {
                console.error('[' + data.mode + '] Не удалось распарсить JSON из ответа:', responseText.substring(0, 200));
                return res.status(502).json({
                    error: 'invalid_model_response',
                    message: 'AI вернул ответ в невалидном формате. Попробуйте снова.'
                });
            }

            // ===== Нормализация ответа =====
            var result;
            if (data.mode === 'preview') {
                result = gigachat.normalizePreviewResponse(parsed);
            } else {
                result = gigachat.normalizeFullResponse(parsed);
            }

            console.log('[' + data.mode + '] Результат:', JSON.stringify(result).substring(0, 100) + '...');
            res.json(result);
        })
        .catch(function (error) {
            console.error('[' + data.mode + '] Ошибка:', error.message);

            // Определяем тип ошибки
            var statusCode = 500;
            var errorMessage = 'Внутренняя ошибка сервера';

            if (error.message.includes('GIGACHAT_AUTH_KEY')) {
                statusCode = 500;
                errorMessage = 'Сервис временно недоступен: не настроен GigaChat';
            } else if (error.message.includes('таймаут') || error.message.includes('timeout')) {
                statusCode = 504;
                errorMessage = 'Таймаут запроса к AI. Попробуйте снова.';
            } else if (error.message.includes('токен') || error.message.includes('OAuth')) {
                statusCode = 500;
                errorMessage = 'Ошибка авторизации в GigaChat';
            }

            res.status(statusCode).json({
                error: 'internal_error',
                message: errorMessage
            });
        });
});

// ===== Обработка 404 =====
app.use(function (req, res) {
    res.status(404).json({ error: 'not_found', message: 'Endpoint не найден' });
});

// ===== Обработка ошибок =====
app.use(function (err, req, res, next) {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'internal_error',
        message: 'Внутренняя ошибка сервера'
    });
});

// ===== Запуск сервера =====
app.listen(PORT, function () {
    console.log('ОфферДоктор API запущен на порту ' + PORT);
    console.log('Health check: http://localhost:' + PORT + '/health');
    console.log('POST /api/analyze: http://localhost:' + PORT + '/api/analyze');
});

module.exports = app;