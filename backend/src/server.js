/**
 * ОфферДоктор Backend
 * Express-сервер для AI-разбора УТП через GigaChat
 * Поддерживает DEMO_MODE для демонстрации без credentials
 * Использует модули из api/* (единый источник правды)
 */

require('dotenv').config();

var express = require('express');
var cors = require('cors');
var prompts = require('../../api/prompts');
var gigachat = require('../../api/gigachat');
var knowledge = require('../../api/knowledge');
var demoMocks = require('./demoMocks');

var app = express();
var PORT = process.env.PORT || 3000;
var DEMO_MODE = process.env.DEMO_MODE === 'true';
var robokassaConfigured = false;
var robokassaIsTest = false;

// ===== Middleware =====
app.use(cors({
    origin: function (origin, callback) {
        callback(null, true);
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
        demo_mode: DEMO_MODE,
        model: process.env.GIGACHAT_MODEL || 'GigaChat-2-Pro'
    });
});

app.get('/health', function (req, res) {
    res.json({ status: 'ok', demo_mode: DEMO_MODE });
});

// ===== POST /api/analyze =====
app.post('/api/analyze', function (req, res) {
    var data = req.body;

    // ===== DEBUG: Логирование входных данных =====
    console.log('[DEBUG HTTP] req.body:', JSON.stringify(data, null, 2));
    console.log('[DEBUG HTTP] product:', data.product);
    console.log('[DEBUG HTTP] audience:', data.audience);
    console.log('[DEBUG HTTP] text:', data.text);

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

    console.log('[' + normalizedData.mode + '] Запрос:', normalizedData.scenario, '/', normalizedData.platform || 'n/a', '/', normalizedData.tariff);

    // ===== DEMO MODE =====
    if (DEMO_MODE) {
        console.log('[DEMO] Возвращаем mock-результат');
        var mockResult = demoMocks.getMockResponse(
            normalizedData.scenario,
            normalizedData.platform,
            normalizedData.mode,
            normalizedData.tariff
        );

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

    // ===== RAG: получение контекста из knowledge engine =====
    var knowledgeContext = null;
    if (knowledge.isEnabled()) {
        console.log('[DEBUG KNOWLEDGE] normalizedData:', JSON.stringify({
            product: normalizedData.product,
            audience: normalizedData.audience,
            text: normalizedData.text,
            link: normalizedData.link,
            pain: normalizedData.pain,
            scenario: normalizedData.scenario,
            platform: normalizedData.platform
        }, null, 2));
        
        console.log('[Knowledge] RAG включен, получаем контекст...');
        knowledge.getKnowledgeContext(normalizedData)
            .then(function(context) {
                knowledgeContext = context;
                console.log('[Knowledge] Контекст получен:', context ? context.substring(0, 100) + '...' : 'null');
                return buildAndSendPrompt(normalizedData, knowledgeContext, res);
            })
            .catch(function(err) {
                console.error('[Knowledge] Ошибка:', err.message);
                return buildAndSendPrompt(normalizedData, null, res);
            });
    } else {
        console.log('[Knowledge] RAG выключен');
        return buildAndSendPrompt(normalizedData, null, res);
    }
});

function buildAndSendPrompt(data, knowledgeContext, res) {
    // ===== DEBUG: Логирование перед сборкой prompt =====
    console.log('[DEBUG PROMPT] data:', JSON.stringify({
        format: data.scenario,
        product: data.product,
        audience: data.audience,
        offerText: data.text,
        pain: data.pain
    }, null, 2));
    console.log('[DEBUG PROMPT] knowledgeContext:', knowledgeContext ? knowledgeContext.substring(0, 200) + '...' : 'null');
    
    // ===== Построение промта =====
    var prompt;
    if (data.mode === 'preview') {
        prompt = prompts.buildPreviewPrompt(data, knowledgeContext);
    } else if (data.tariff === 'competitor') {
        prompt = prompts.buildCompetitorPrompt(data, knowledgeContext);
    } else {
        prompt = prompts.buildFullPrompt(data, knowledgeContext);
    }

    console.log('[DEBUG PROMPT] Built prompt preview (first 200 chars):', prompt.substring(0, 200));

    // ===== Запрос к GigaChat =====
    gigachat.requestGigachatWithRetry(prompt)
        .then(function (responseText) {
            console.log('[' + data.mode + '] RAW RESPONSE:', responseText);
            console.log('[' + data.mode + '] Response length:', responseText.length);

            var parsed = gigachat.safeParseJsonFromModel(responseText);
            
            // Only log OK if parsed is actually a valid object with keys
            var isParsedNonEmpty = parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;
            console.log('[' + data.mode + '] Parsed result:', isParsedNonEmpty ? 'OK' : 'FAILED/EMPTY');
            console.log('[' + data.mode + '] Parsed object:', JSON.stringify(parsed));
            
            // If initial parse failed or returned empty object {}, try manual fallback
            if (!isParsedNonEmpty) {
                console.log('[' + data.mode + '] PARSE FAILED: Trying manual parse...');
                try {
                    var cleaned = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/, '').trim();
                    console.log('[' + data.mode + '] DEBUG cleaned:', cleaned.substring(0, 200));
                    var manual = JSON.parse(cleaned);
                    console.log('[' + data.mode + '] DEBUG manual parse SUCCESS');
                    parsed = manual;
                    isParsedNonEmpty = parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;
                    console.log('[' + data.mode + '] Parsed after manual:', JSON.stringify(parsed), 'isNonEmpty:', isParsedNonEmpty);
                } catch(e) {
                    console.log('[' + data.mode + '] PARSE FAILED:', e.message);
                }
            }

            // If still no valid parsed result, return error
            if (!isParsedNonEmpty) {
                console.error('[' + data.mode + '] PARSE FAILED: Не удалось распарсить JSON. Ответ:', responseText.substring(0, 500));
                return res.status(502).json({
                    error: 'invalid_model_response',
                    message: 'AI вернул ответ в невалидном формате. Попробуйте снова.'
                });
            }
            
            // For preview mode, check if parsed object has required fields
            if (data.mode === 'preview') {
                var isValid = gigachat.isValidPreviewResponse(parsed);
                console.log('[' + data.mode + '] Preview validation:', isValid ? 'VALID' : 'INVALID');
                if (!isValid) {
                    console.error('[' + data.mode + '] PREVIEW VALIDATION FAILED: missing required fields. Parsed:', JSON.stringify(parsed));
                    return res.status(502).json({
                        error: 'invalid_model_response',
                        message: 'AI вернул ответ с неполными данными. Попробуйте снова.'
                    });
                }
            }

            var result;
            if (data.mode === 'preview') {
                // Only call normalize if we already validated the response
                result = gigachat.normalizePreviewResponse(parsed);
                console.log('[' + data.mode + '] Normalized result:', JSON.stringify(result));
            } else if (data.tariff === 'competitor') {
                result = gigachat.normalizeFullWithCompetitorResponse(parsed);
            } else {
                result = gigachat.normalizeFullResponse(parsed);
            }

            console.log('[' + data.mode + '] RESULT SENT: SUCCESS');
            res.json(result);
        })
        .catch(function (error) {
            console.error('[' + data.mode + '] Ошибка:', error.message);

            if (error.message.indexOf('PROVIDER_NOT_CONFIGURED') !== -1) {
                return res.status(503).json({
                    error: 'provider_not_configured',
                    message: 'GigaChat credentials are not configured'
                });
            }

            var statusCode = 500;
            var errorMessage = 'Внутренняя ошибка сервера';

            if (error.message.indexOf('таймаут') !== -1 || error.message.indexOf('timeout') !== -1 || error.message.indexOf('Timeout') !== -1) {
                statusCode = 504;
                errorMessage = 'Таймаут запроса к AI. Попробуйте снова.';
            } else if (error.message.indexOf('Rate limit') !== -1) {
                statusCode = 429;
                errorMessage = 'Слишком много запросов. Подождите несколько секунд.';
            } else if (error.message.indexOf('OAuth') !== -1 || error.message.indexOf('токен') !== -1 || error.message.indexOf('Unauthorized') !== -1) {
                statusCode = 500;
                errorMessage = 'Ошибка авторизации в GigaChat. Проверьте credentials.';
            } else if (error.message.indexOf('ECONNREFUSED') !== -1 || error.message.indexOf('ENOTFOUND') !== -1) {
                statusCode = 502;
                errorMessage = 'Не удалось подключиться к GigaChat. Проверьте сеть.';
            }

            res.status(statusCode).json({
                error: 'internal_error',
                message: errorMessage
            });
        });
}

// ===== POST /api/payment/create =====
app.post('/api/payment/create', function (req, res) {
    var data = req.body;
    var scenario = data.scenario || 'marketplace';
    var platform = data.platform || '';
    var tariff = data.tariff || 'main';

    var prices = {
        marketplace: { main: 249, competitor: 299 },
        avito: { main: 149 },
        landing: { main: 199 }
    };
    var amount = (prices[scenario] || prices.marketplace)[tariff] || 249;

    var robokassaLogin = process.env.ROBOKASSA_LOGIN;
    var robokassaPassword1 = process.env.ROBOKASSA_PASSWORD1;
    var robokassaIsTest = process.env.ROBOKASSA_IS_TEST === 'true';

    var robokassaConfigured = !!(robokassaLogin && robokassaLogin.trim() !== '' && robokassaPassword1 && robokassaPassword1.trim() !== '');

    var orderId = 'OD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

    // Сохраняем payload заказа для запуска analysis после оплаты
    var orderPayload = {
        product: (data.product || '').trim(),
        audience: (data.audience || '').trim(),
        link: (data.link || '').trim(),
        text: (data.text || '').trim(),
        pain: (data.pain || '').trim(),
        scenario: scenario,
        platform: platform,
        tariff: tariff,
        amount: amount,
        createdAt: new Date().toISOString()
    };

    // Stub mode: Robokassa not configured
    if (!robokassaConfigured) {
        // Сохраняем для консистентности (хотя в stub уже запускаем analysis)
        if (!global.orders) {
            global.orders = {};
        }
        global.orders[orderId] = orderPayload;

        // Для stub-режима сразу запускаем analysis
        runFullAnalysis(orderId, orderPayload, function(err, result) {
            if (err) {
                console.log('[PAYMENT][stub] Ошибка analysis:', err.message);
            }
            console.log('[PAYMENT][stub] Создан заказ:', orderId, scenario, tariff, amount + '₽');
            return res.json({
                ok: true,
                order_id: orderId,
                payment_url: null,
                provider: 'stub',
                amount: amount,
                currency: 'RUB',
                result: result || null
            });
        });
        return;
    }

    // Robokassa test mode integration
    var robokassaBaseUrlEnv = process.env.ROBOKASSA_BASE_URL;
    var host = req.get('host') || 'localhost:' + PORT;
    var protocol = req.protocol || (req.get('X-Forwarded-Proto') === 'https' ? 'https' : 'http');

    // Используем ROBOKASSA_BASE_URL если задан, иначе хост из запроса
    var baseUrl = robokassaBaseUrlEnv || (protocol + '://' + host);

    var resultUrl = process.env.ROBOKASSA_RESULT_URL || (baseUrl + '/api/payment/result');
    var successUrl = process.env.ROBOKASSA_SUCCESS_URL || (baseUrl + '/#?orderId=' + orderId);
    var failUrl = process.env.ROBOKASSA_FAIL_URL || (baseUrl + '/#?fail=true');

    var description = 'Оплата разбора УТП: ' + scenario + '/' + tariff;

    // Формирование сигнатуры: Login:Amount:OrderId:Password1
    var signatureStr = robokassaLogin + ':' + amount + ':' + orderId + ':' + robokassaPassword1;
    var signature = require('crypto').createHash('md5').update(signatureStr).digest('hex');

    // Base URL: тестовый или боевой шлюз
    var robokassaBaseUrl = robokassaIsTest
        ? 'https://auth.robokassa.ru/Merchant/Index.aspx'
        : 'https://auth.robokassa.ru/Merchant/Index.aspx';

    var paymentUrl = robokassaBaseUrl
        + '?MerchantLogin=' + encodeURIComponent(robokassaLogin)
        + '&OutSum=' + encodeURIComponent(amount)
        + '&InvId=' + encodeURIComponent(orderId)
        + '&Description=' + encodeURIComponent(description)
        + '&SignatureValue=' + encodeURIComponent(signature)
        + '&IsTest=' + (robokassaIsTest ? '1' : '0')
        + '&ResultURL=' + encodeURIComponent(resultUrl)
        + '&SuccessURL=' + encodeURIComponent(successUrl)
        + '&FailURL=' + encodeURIComponent(failUrl);

    // Дополнительная сигнатура (Shp_*) — опционально для будущих версий
    // var signatureWithShp = require('crypto').createHash('md5').update(signatureStr + '&Shp_tariff=' + tariff).digest('hex');

    var provider = robokassaIsTest ? 'robokassa-test' : 'robokassa';

    // Сохраняем заказ в памяти для обработки после callback
    if (!global.orders) {
        global.orders = {};
    }
    global.orders[orderId] = orderPayload;

    console.log('[PAYMENT][' + provider + '] Создан заказ:', orderId, scenario, tariff, amount + '₽');
    console.log('[PAYMENT][' + provider + '] Payment URL:', paymentUrl);

    res.json({
        ok: true,
        order_id: orderId,
        payment_url: paymentUrl,
        provider: provider,
        amount: amount,
        currency: 'RUB',
        is_test: robokassaIsTest
    });
});

// ===== POST /api/payment/result — Robokassa callback =====
app.post('/api/payment/result', function (req, res) {
    var outSum = req.body.OutSum || req.query.OutSum;
    var invId = req.body.InvId || req.query.InvId;
    var signatureValue = req.body.SignatureValue || req.query.SignatureValue;
    var robokassaPassword1 = process.env.ROBOKASSA_PASSWORD1;

    console.log('[PAYMENT][result] Callback received:', { outSum: outSum, invId: invId });

    if (!outSum || !invId || !signatureValue) {
        console.warn('[PAYMENT][result] Missing required fields');
        return res.status(400).send('Missing required fields');
    }

    if (!robokassaPassword1) {
        console.error('[PAYMENT][result] ROBOKASSA_PASSWORD1 not configured');
        return res.status(500).send('Payment provider not configured');
    }

    // Проверка подписи: OutSum:InvId:Password1
    var signatureStr = outSum + ':' + invId + ':' + robokassaPassword1;
    var expectedSignature = require('crypto').createHash('md5').update(signatureStr).digest('hex').toLowerCase();
    var actualSignature = (signatureValue || '').toLowerCase();

    if (expectedSignature !== actualSignature) {
        console.warn('[PAYMENT][result] Invalid signature. Expected:', expectedSignature, 'Got:', actualSignature);
        return res.status(400).send('Invalid signature');
    }

    // Ищем заказ в памяти
    var orderPayload = (global.orders && global.orders[invId]);

    // Упрощённое хранилище в памяти (для боевого режима нужен персистентный storage)
    if (!global.paidOrders) {
        global.paidOrders = {};
    }

    if (orderPayload) {
        // Запускаем full analysis после оплаты
        global.paidOrders[invId] = {
            status: 'paid_processing',
            amount: parseFloat(outSum),
            paidAt: new Date().toISOString(),
            payload: orderPayload
        };

        runFullAnalysis(invId, orderPayload, function(err, result) {
            if (err) {
                global.paidOrders[invId].status = 'paid_failed';
                global.paidOrders[invId].error = err.message;
                console.error('[PAYMENT][result] Analysis failed:', err.message);
            } else {
                global.paidOrders[invId].status = 'paid_ready';
                global.paidOrders[invId].result = result;
                console.log('[PAYMENT][result] Analysis completed:', invId);
            }
        });
    } else {
        global.paidOrders[invId] = {
            status: 'paid',
            amount: parseFloat(outSum),
            paidAt: new Date().toISOString()
        };
    }

    console.log('[PAYMENT][result] Order marked as paid:', invId);

    // Для Robokassa обязательно вернуть "OK" в определённом формате
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send('OK' + invId);
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
    } else {
        console.log('[REAL] GigaChat mode — credentials detected');
        console.log('[REAL] Model: ' + (process.env.GIGACHAT_MODEL || 'GigaChat-2-Pro'));
    }

    if (robokassaConfigured) {
        console.log('[PAYMENT] Robokassa: ON (' + (robokassaIsTest ? 'TEST' : 'PROD') + ')');
    } else {
        console.log('[PAYMENT] Robokassa: OFF (stub mode)');
    }

    console.log('ОфферДоктор API запущен на порту ' + PORT);
    console.log('Demo mode: ' + (DEMO_MODE ? 'ON' : 'OFF'));
    console.log('Health: http://localhost:' + PORT + '/health');
    console.log('Analyze: POST http://localhost:' + PORT + '/api/analyze');
});

module.exports = app;

// ===== Helper: Run full analysis for paid order =====
function runFullAnalysis(orderId, payload, callback) {
    if (!payload || !payload.product || !payload.audience) {
        return callback(new Error('Invalid payload'));
    }

    if (DEMO_MODE) {
        var mockResult = demoMocks.getMockResponse(
            payload.scenario,
            payload.platform,
            'full',
            payload.tariff
        );
        return setTimeout(function() {
            callback(null, mockResult);
        }, 1000);
    }

    var authKey = process.env.GIGACHAT_AUTH_KEY;
    if (!authKey || authKey.trim() === '' || authKey === 'your_auth_key_here') {
        return callback(new Error('GIGACHAT_AUTH_KEY not configured'));
    }

    var normalizedData = {
        product: payload.product,
        audience: payload.audience,
        link: payload.link || '',
        text: payload.text || '',
        pain: payload.pain || '',
        mode: 'full',
        scenario: payload.scenario || 'marketplace',
        platform: payload.platform || '',
        tariff: payload.tariff || 'main'
    };

    var prompt;
    if (normalizedData.tariff === 'competitor') {
        prompt = prompts.buildCompetitorPrompt(normalizedData);
    } else {
        prompt = prompts.buildFullPrompt(normalizedData);
    }

    gigachat.requestGigachatWithRetry(prompt)
        .then(function(responseText) {
            var parsed = gigachat.safeParseJsonFromModel(responseText);
            if (!parsed) {
                return callback(new Error('Invalid model response'));
            }

            var result;
            if (normalizedData.tariff === 'competitor') {
                result = gigachat.normalizeFullWithCompetitorResponse(parsed);
            } else {
                result = gigachat.normalizeFullResponse(parsed);
            }

            callback(null, result);
        })
        .catch(function(error) {
            callback(error);
        });
}

// ===== GET /api/payment/status/:orderId =====
app.get('/api/payment/status/:orderId', function(req, res) {
    var orderId = req.params.orderId;

    var paidOrder = global.paidOrders && global.paidOrders[orderId];

    if (paidOrder) {
        return res.json({
            order_id: orderId,
            status: paidOrder.status,
            amount: paidOrder.amount,
            paid_at: paidOrder.paidAt,
            result: paidOrder.result || null,
            error: paidOrder.error || null
        });
    }

    var pendingOrder = global.orders && global.orders[orderId];
    if (pendingOrder) {
        return res.json({
            order_id: orderId,
            status: 'awaiting_payment',
            amount: pendingOrder.amount,
            created_at: pendingOrder.createdAt
        });
    }

    return res.status(404).json({
        error: 'not_found',
        message: 'Order not found'
    });
});
