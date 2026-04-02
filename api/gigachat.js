/**
 * Модуль для работы с GigaChat API
 * Авторизация, кэширование токена, отправка запросов, парсинг ответов
 */

var https = require('https');

// ===== Конфигурация =====
var AUTH_URL_HOST = 'ngw.devices.sberbank.ru';
var AUTH_URL_PATH = '/api/v2/oauth';
var API_URL_HOST = 'gigachat.devices.sberbank.ru';
var API_URL_PATH = '/api/v1/chat/completions';
var REQUEST_TIMEOUT = 60000; // 60 секунд

// ===== Кэш токена =====
var tokenCache = {
    token: null,
    expiresAt: 0
};

/**
 * Генерация UUID v4 для RqUID
 */
function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Получить access token от GigaChat
 * @returns {Promise<string>}
 */
function getGigachatToken() {
    var authKey = process.env.GIGACHAT_AUTH_KEY;
    var scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';

    if (!authKey || authKey.trim() === '' || authKey === 'your_auth_key_here') {
        return Promise.reject(new Error('PROVIDER_NOT_CONFIGURED: GIGACHAT_AUTH_KEY is missing or empty'));
    }

    // GIGACHAT_AUTH_KEY уже в формате base64 (client_id:client_secret)
    var authHeader = 'Basic ' + authKey.trim();
    var body = 'scope=' + encodeURIComponent(scope);

    return new Promise(function (resolve, reject) {
        var options = {
            hostname: AUTH_URL_HOST,
            port: 9443,
            path: AUTH_URL_PATH,
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
                'RqUID': generateUuid()
            },
            rejectUnauthorized: false
        };

        var req = https.request(options, function (res) {
            var data = '';
            res.on('data', function (chunk) { data += chunk; });
            res.on('end', function () {
                try {
                    var parsed = JSON.parse(data);
                    if (parsed.access_token) {
                        resolve(parsed.access_token);
                    } else if (parsed.error) {
                        reject(new Error('OAuth error: ' + (parsed.error_description || parsed.error)));
                    } else {
                        reject(new Error('Не удалось получить токен: ' + data.substring(0, 200)));
                    }
                } catch (e) {
                    reject(new Error('Ошибка парсинга ответа OAuth (' + res.statusCode + '): ' + e.message));
                }
            });
        });

        req.on('error', function (e) {
            reject(new Error('Ошибка подключения к OAuth: ' + e.message));
        });

        req.setTimeout(15000, function () {
            req.destroy();
            reject(new Error('Таймаут подключения к OAuth серверу'));
        });

        req.write(body);
        req.end();
    });
}

/**
 * Получить токен с кэшированием
 */
function getCachedGigachatToken() {
    var now = Date.now();

    if (tokenCache.token && tokenCache.expiresAt > now + 30000) {
        return Promise.resolve(tokenCache.token);
    }

    return getGigachatToken().then(function (token) {
        tokenCache.token = token;
        tokenCache.expiresAt = now + 25 * 60 * 1000;
        console.log('[GigaChat] Новый access token получен');
        return token;
    });
}

/**
 * Отправить запрос к GigaChat API
 * @param {string} prompt - текст запроса
 * @param {Object} options - опциональные параметры (temperature, maxTokens)
 * @returns {Promise<string>}
 */
function requestGigachat(prompt, options) {
    options = options || {};
    var model = process.env.GIGACHAT_MODEL || 'GigaChat-2-Pro';
    var temperature = options.temperature !== undefined ? options.temperature : 0.3;
    var maxTokens = options.maxTokens || 2048;

    return getCachedGigachatToken().then(function (token) {
        return new Promise(function (resolve, reject) {
            var payload = JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: temperature,
                max_tokens: maxTokens,
                n: 1
            });

            var options = {
                hostname: API_URL_HOST,
                port: 443,
                path: API_URL_PATH,
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                rejectUnauthorized: false
            };

            var req = https.request(options, function (res) {
                var data = '';
                res.on('data', function (chunk) { data += chunk; });
                res.on('end', function () {
                    if (res.statusCode === 401) {
                        // Токен истёк, сбрасываем кэш
                        tokenCache.token = null;
                        tokenCache.expiresAt = 0;
                        return reject(new Error('Unauthorized: токен истёк, будет получен новый'));
                    }

                    if (res.statusCode === 429) {
                        return reject(new Error('Rate limit exceeded. Попробуйте через несколько секунд.'));
                    }

                    if (res.statusCode >= 400) {
                        return reject(new Error('GigaChat API error ' + res.statusCode + ': ' + data.substring(0, 300)));
                    }

                    try {
                        var parsed = JSON.parse(data);
                        if (parsed.choices && parsed.choices.length > 0 && parsed.choices[0].message) {
                            resolve(parsed.choices[0].message.content);
                        } else if (parsed.error) {
                            reject(new Error('GigaChat error: ' + (parsed.error.message || JSON.stringify(parsed.error))));
                        } else {
                            reject(new Error('Неожиданный формат ответа GigaChat: ' + data.substring(0, 300)));
                        }
                    } catch (e) {
                        reject(new Error('Ошибка парсинга JSON от GigaChat (' + res.statusCode + '): ' + e.message));
                    }
                });
            });

            req.on('error', function (e) {
                reject(new Error('Ошибка соединения с GigaChat: ' + e.message));
            });

            req.setTimeout(REQUEST_TIMEOUT, function () {
                req.destroy();
                reject(new Error('Таймаут запроса к GigaChat (' + (REQUEST_TIMEOUT/1000) + ' сек)'));
            });

            req.write(payload);
            req.end();
        });
    });
}

/**
 * Повторный запрос при истечении токена
 */
function requestGigachatWithRetry(prompt, options) {
    return requestGigachat(prompt, options).catch(function (error) {
        if (error.message.indexOf('Unauthorized') !== -1 || error.message.indexOf('токен истёк') !== -1) {
            console.log('[GigaChat] Токен истёк, повторяем с новым...');
            tokenCache.token = null;
            tokenCache.expiresAt = 0;
            return requestGigachat(prompt, options);
        }
        throw error;
    });
}

/**
 * Безопасное извлечение JSON из текста ответа модели
 */
function safeParseJsonFromModel(text) {
    if (!text || typeof text !== 'string') return null;

    text = text.trim();

    // Попытка 1: весь текст — валидный JSON
    try {
        return JSON.parse(text);
    } catch (e) { }

    // Попытка 2: убираем markdown-обёртку ```json ... ```
    var cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (e) { }

    // Попытка 3: ищем JSON между первой { и последней }
    var startIdx = cleaned.indexOf('{');
    var endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        try {
            return JSON.parse(cleaned.substring(startIdx, endIdx + 1));
        } catch (e) { }
    }

    // Попытка 4: ищем JSON между [ и ]
    startIdx = cleaned.indexOf('[');
    endIdx = cleaned.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        try {
            var arr = JSON.parse(cleaned.substring(startIdx, endIdx + 1));
            return { problems: arr };
        } catch (e) { }
    }

    return null;
}

/**
 * Нормализовать ответ для режима preview
 */
function normalizePreviewResponse(data) {
    if (!data) return {
        previewProblem: 'Не удалось определить проблему',
        previewHint: 'Попробуйте повторить запрос',
        cta: 'Получить полный разбор'
    };

    return {
        previewProblem: data.previewProblem || data.problem || data.main_problem || 'Не удалось определить проблему',
        previewHint: data.previewHint || data.hint || data.advice || data.recommendation || 'Попробуйте повторить запрос',
        cta: data.cta || 'Получить полный разбор'
    };
}

/**
 * Нормализовать ответ для режима full
 */
function normalizeFullResponse(data) {
    if (!data) return {
        problems: ['Не удалось определить проблемы'],
        offers: ['Не удалось сформировать варианты УТП'],
        shortVersion: 'Не удалось сформировать',
        firstAdvice: 'Не удалось сформировать рекомендацию'
    };

    var problems = data.problems;
    if (!Array.isArray(problems)) {
        problems = [data.problem || data.main_problem || 'Не удалось определить проблему'];
    }
    problems = problems.filter(function(p) { return p && typeof p === 'string'; });
    if (problems.length === 0) problems = ['Не удалось определить проблемы'];

    var offers = data.offers;
    if (!Array.isArray(offers)) {
        offers = [data.offer || data.UTP || 'Не удалось сформировать вариант УТП'];
    }
    offers = offers.filter(function(o) { return o && typeof o === 'string'; });
    if (offers.length === 0) offers = ['Не удалось сформировать варианты УТП'];

    return {
        problems: problems.slice(0, 5),
        offers: offers.slice(0, 5),
        shortVersion: data.shortVersion || data.short || data.short_version || 'Не удалось сформировать короткую версию',
        firstAdvice: data.firstAdvice || data.advice || data.recommendation || data.first_advice || 'Не удалось сформировать рекомендацию'
    };
}

/**
 * Нормализовать ответ для full + competitor (beta)
 */
function normalizeFullWithCompetitorResponse(data) {
    var base = normalizeFullResponse(data);

    // Обрабатываем competitorAnalysis
    var comp = data.competitorAnalysis || data.competitor_analysis || data.competitors || null;
    if (comp) {
        if (typeof comp === 'string') {
            // Строку превращаем в массив объектов
            base.competitorAnalysis = [
                { title: 'Что у конкурентов сильнее', text: comp }
            ];
        } else if (Array.isArray(comp)) {
            base.competitorAnalysis = comp.map(function(item) {
                if (typeof item === 'string') {
                    return { title: 'Сравнение', text: item };
                }
                return {
                    title: item.title || item.name || 'Сравнение',
                    text: item.text || item.description || item.content || ''
                };
            }).filter(function(item) { return item.text; });
        }
    }

    return base;
}

module.exports = {
    getGigachatToken: getGigachatToken,
    getCachedGigachatToken: getCachedGigachatToken,
    requestGigachat: requestGigachat,
    requestGigachatWithRetry: requestGigachatWithRetry,
    safeParseJsonFromModel: safeParseJsonFromModel,
    normalizePreviewResponse: normalizePreviewResponse,
    normalizeFullResponse: normalizeFullResponse,
    normalizeFullWithCompetitorResponse: normalizeFullWithCompetitorResponse
};
