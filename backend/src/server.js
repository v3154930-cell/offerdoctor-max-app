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

// CORS: GitHub Pages + localhost для разработки
var allowedOrigins = [
    'https://v3154930-cell.github.io',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080'
];
var corsOptions = {
    origin: function (origin, callback) {
        // Разрешаем запросы без origin (curl, Postman) и из списка
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); //временно разрешаем все для отладки
        }
    },
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

    // link или text — хотя бы один должен быть заполнен
    var hasLink = typeof data.link === 'string' && data.link.trim().length > 0;
    var hasText = typeof data.text === 'string' && data.text.trim().length > 0;
    if (!hasLink && !hasText) {
        errors.push('нужен хотя бы один из: link или text');
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

    // Нормализация данных для промтов
    var normalizedData = {
        product: data.product.trim(),
        audience: data.audience.trim(),
        link: (data.link || '').trim(),
        text: (data.text || '').trim(),
        pain: (data.pain || '').trim(),
        mode: data.mode
    };

    // ===== Построение промта =====
    var prompt;
    if (normalizedData.mode === 'preview') {
        prompt = prompts.buildPreviewPrompt(normalizedData);
    } else {
        prompt = prompts.buildFullPrompt(normalizedData);
    }

    console.log('[' + normalizedData.mode + '] Запрос к GigaChat для:', normalizedData.product);

    // ===== Запрос к GigaChat =====
    gigachat.requestGigachat(prompt)
        .then(function (responseText) {
            console.log('[' + normalizedData.mode + '] Ответ от GigaChat получен');

            // ===== Парсинг JSON из ответа =====
            var parsed = gigachat.safeParseJsonFromModel(responseText);

            if (!parsed) {
                console.error('[' + normalizedData.mode + '] Не удалось распарсить JSON из ответа:', responseText.substring(0, 200));
                return res.status(502).json({
                    error: 'invalid_model_response',
                    message: 'AI вернул ответ в невалидном формате. Попробуйте снова.'
                });
            }

            // ===== Нормализация ответа =====
            var result;
            if (normalizedData.mode === 'preview') {
                result = gigachat.normalizePreviewResponse(parsed);
            } else {
                result = gigachat.normalizeFullResponse(parsed);
            }

            console.log('[' + normalizedData.mode + '] Результат:', JSON.stringify(result).substring(0, 100) + '...');
            res.json(result);
        })
        .catch(function (error) {
            console.error('[' + normalizedData.mode + '] Ошибка:', error.message);

            // Провайдер не сконфигурирован — возвращаем 503
            if (error.message.indexOf('PROVIDER_NOT_CONFIGURED') !== -1) {
                return res.status(503).json({
                    error: 'provider_not_configured',
                    message: 'GigaChat credentials are not configured'
                });
            }

            // Определяем тип ошибки
            var statusCode = 500;
            var errorMessage = 'Внутренняя ошибка сервера';

            if (error.message.includes('таймаут') || error.message.includes('timeout')) {
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
    var authKey = process.env.GIGACHAT_AUTH_KEY;
    if (!authKey || authKey.trim() === '' || authKey === 'your_auth_key_here') {
        console.warn('[WARN] GIGACHAT_AUTH_KEY is not configured. API calls will return 503.');
        console.warn('[WARN] Create backend/.env with your GigaChat credentials to enable AI.');
    }
    console.log('ОфферДоктор API запущен на порту ' + PORT);
    console.log('Health check: http://localhost:' + PORT + '/health');
    console.log('POST /api/analyze: http://localhost:' + PORT + '/api/analyze');
});

module.exports = app;