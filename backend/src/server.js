/**
 * ОфферДоктор Backend
 * Express-сервер для AI-разбора УТП через GigaChat
 * Поддерживает DEMO_MODE для демонстрации без credentials
 */

require('dotenv').config();

var express = require('express');
var cors = require('cors');
var prompts = require('./prompts');
var gigachat = require('./gigachat');
var demoMocks = require('./demoMocks');

var app = express();
var PORT = process.env.PORT || 3000;
var DEMO_MODE = process.env.DEMO_MODE === 'true';

// ===== Middleware =====
var allowedOrigins = [
    'https://v3154930-cell.github.io',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    methods: ['POST', 'OPTIONS', 'GET'],
    allowedHeaders: ['Content-Type'],
    credentials: false
}));
app.use(express.json({ limit: '1mb' }));

// ===== Health check =====
app.get('/', function (req, res) {
    res.json({
        status: 'ok',
        service: 'ОфферДоктор API',
        demo_mode: DEMO_MODE
    });
});

app.get('/health', function (req, res) {
    res.json({ status: 'ok', demo_mode: DEMO_MODE });
});

// ===== POST /api/analyze =====
app.post('/api/analyze', function (req, res) {
    var data = req.body;

    // ===== Валидация =====
    var errors = [];

    if (typeof data.product !== 'string' || data.product.trim().length === 0) {
        errors.push('product: укажите, что вы продаете');
    }
    if (typeof data.audience !== 'string' || data.audience.trim().length === 0) {
        errors.push('audience: укажите, для кого предложение');
    }

    var hasLink = typeof data.link === 'string' && data.link.trim().length > 0;
    var hasText = typeof data.text === 'string' && data.text.trim().length > 0;
    if (!hasLink && !hasText) {
        errors.push('link или text: добавьте хотя бы одно из полей');
    }

    if (data.mode !== 'preview' && data.mode !== 'full') {
        errors.push('mode: должен быть "preview" или "full"');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: 'validation_error',
            message: 'Ошибка валидации: ' + errors.join('; '),
            details: errors
        });
    }

    // ===== Нормализация =====
    var normalizedData = {
        product: data.product.trim(),
        audience: data.audience.trim(),
        link: (data.link || '').trim(),
        text: (data.text || '').trim(),
        pain: (data.pain || '').trim(),
        mode: data.mode,
        scenario: data.scenario || 'marketplace',
        platform: data.platform || '',
        tariff: data.tariff || 'main'
    };

    console.log('[' + normalizedData.mode + '] Запрос:', normalizedData.scenario, '/', normalizedData.platform || 'n/a');

    // ===== DEMO MODE =====
    if (DEMO_MODE) {
        console.log('[DEMO] Возвращаем mock-результат');
        var mockResult = demoMocks.getMockResponse(
            normalizedData.scenario,
            normalizedData.platform,
            normalizedData.mode,
            normalizedData.tariff
        );

        // Simulate slight delay for realism
        return setTimeout(function () {
            res.json(mockResult);
        }, 800);
    }

    // ===== Проверка credentials =====
    var authKey = process.env.GIGACHAT_AUTH_KEY;
    if (!authKey || authKey.trim() === '' || authKey === 'your_auth_key_here') {
        return res.status(503).json({
            error: 'provider_not_configured',
            message: 'GigaChat credentials are not configured. Set GIGACHAT_AUTH_KEY in .env or enable DEMO_MODE=true for testing.'
        });
    }

    // ===== Построение промта =====
    var prompt;
    if (normalizedData.mode === 'preview') {
        prompt = prompts.buildPreviewPrompt(normalizedData);
    } else {
        prompt = prompts.buildFullPrompt(normalizedData);
    }

    // ===== Запрос к GigaChat =====
    gigachat.requestGigachat(prompt)
        .then(function (responseText) {
            console.log('[' + normalizedData.mode + '] Ответ от GigaChat получен');

            var parsed = gigachat.safeParseJsonFromModel(responseText);

            if (!parsed) {
                console.error('[' + normalizedData.mode + '] Не удалось распарсить JSON:', responseText.substring(0, 200));
                return res.status(502).json({
                    error: 'invalid_model_response',
                    message: 'AI вернул ответ в невалидном формате. Попробуйте снова.'
                });
            }

            var result;
            if (normalizedData.mode === 'preview') {
                result = gigachat.normalizePreviewResponse(parsed);
            } else {
                result = gigachat.normalizeFullResponse(parsed);
            }

            console.log('[' + normalizedData.mode + '] Результат отправлен');
            res.json(result);
        })
        .catch(function (error) {
            console.error('[' + normalizedData.mode + '] Ошибка:', error.message);

            if (error.message.indexOf('PROVIDER_NOT_CONFIGURED') !== -1) {
                return res.status(503).json({
                    error: 'provider_not_configured',
                    message: 'GigaChat credentials are not configured'
                });
            }

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

// ===== 404 =====
app.use(function (req, res) {
    res.status(404).json({ error: 'not_found', message: 'Endpoint не найден' });
});

// ===== Error handler =====
app.use(function (err, req, res, next) {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'internal_error',
        message: 'Внутренняя ошибка сервера'
    });
});

// ===== Start =====
app.listen(PORT, function () {
    var authKey = process.env.GIGACHAT_AUTH_KEY;
    if (DEMO_MODE) {
        console.log('[DEMO] Режим демо активен — используются mock-данные');
    } else if (!authKey || authKey.trim() === '' || authKey === 'your_auth_key_here') {
        console.warn('[WARN] GIGACHAT_AUTH_KEY is not configured.');
        console.warn('[WARN] Set DEMO_MODE=true for testing without credentials.');
        console.warn('[WARN] Or create backend/.env with your GigaChat credentials.');
    }
    console.log('ОфферДоктор API запущен на порту ' + PORT);
    console.log('Demo mode: ' + (DEMO_MODE ? 'ON' : 'OFF'));
    console.log('Health: http://localhost:' + PORT + '/health');
    console.log('Analyze: POST http://localhost:' + PORT + '/api/analyze');
});

module.exports = app;
