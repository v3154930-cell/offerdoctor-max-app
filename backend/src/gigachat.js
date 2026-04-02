/**
 * Модуль для работы с GigaChat API
 * Авторизация, кэширование токена, отправка запросов
 */

var https = require('https');

// ===== Конфигурация =====
var AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
var API_URL = 'https://gigachat.devices.sberbank.ru/api/v2/chat/completions';

// ===== Кэш токена =====
var tokenCache = {
    token: null,
    expiresAt: 0
};

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

    var authHeader = 'Basic ' + Buffer.from(authKey).toString('base64');

    var body = 'scope=' + encodeURIComponent(scope);

    return new Promise(function (resolve, reject) {
        var options = {
            hostname: 'ngw.devices.sberbank.ru',
            port: 9443,
            path: '/api/v2/oauth',
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
                'RqUID': generateUuid()
            },
            rejectUnauthorized: false // GigaChat использует self-signed сертификаты
        };

        var req = https.request(options, function (res) {
            var data = '';

            res.on('data', function (chunk) {
                data += chunk;
            });

            res.on('end', function () {
                try {
                    var parsed = JSON.parse(data);
                    if (parsed.access_token) {
                        resolve(parsed.access_token);
                    } else {
                        reject(new Error('Не удалось получить токен: ' + data));
                    }
                } catch (e) {
                    reject(new Error('Ошибка парсинга ответа OAuth: ' + e.message));
                }
            });
        });

        req.on('error', function (e) {
            reject(new Error('Ошибка запроса OAuth: ' + e.message));
        });

        req.write(body);
        req.end();
    });
}

/**
 * Получить токен с кэшированием
 * Если токен ещё действителен, возвращается из кэша
 * @returns {Promise<string>}
 */
function getCachedGigachatToken() {
    var now = Date.now();

    // Если токен есть и не истёк (запас 30 секунд)
    if (tokenCache.token && tokenCache.expiresAt > now + 30000) {
        return Promise.resolve(tokenCache.token);
    }

    // Запрашиваем новый токен
    return getGigachatToken().then(function (token) {
        tokenCache.token = token;
        // Токен живёт ~30 минут, кэшируем на 25 минут
        tokenCache.expiresAt = now + 25 * 60 * 1000;
        console.log('Получен новый токен GigaChat');
        return token;
    });
}

/**
 * Отправить запрос к GigaChat API
 * @param {string} prompt - текст запроса
 * @returns {Promise<string>} - ответ модели
 */
function requestGigachat(prompt) {
    var model = process.env.GIGACHAT_MODEL || 'GigaChat-2-Pro';

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
                temperature: 0.3,
                top_p: 0.1,
                n: 1
            });

            var options = {
                hostname: 'gigachat.devices.sberbank.ru',
                port: 443,
                path: '/api/v2/chat/completions',
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

                res.on('data', function (chunk) {
                    data += chunk;
                });

                res.on('end', function () {
                    try {
                        var parsed = JSON.parse(data);
                        if (parsed.choices && parsed.choices.length > 0) {
                            resolve(parsed.choices[0].message.content);
                        } else {
                            reject(new Error('Пустой ответ от GigaChat: ' + data));
                        }
                    } catch (e) {
                        reject(new Error('Ошибка парсинга ответа GigaChat: ' + e.message));
                    }
                });
            });

            req.on('error', function (e) {
                reject(new Error('Ошибка запроса к GigaChat: ' + e.message));
            });

            req.on('timeout', function () {
                req.destroy();
                reject(new Error('Таймаут запроса к GigaChat'));
            });

            req.write(payload);
            req.end();
        });
    });
}

/**
 * Безопасное извлечение JSON из текста ответа модели
 * Пытается найти JSON в тексте, даже если модель добавила пояснения
 * @param {string} text - текст ответа
 * @returns {Object|null}
 */
function safeParseJsonFromModel(text) {
    if (!text) return null;

    // Попытка 1: весь текст — валидный JSON
    try {
        return JSON.parse(text.trim());
    } catch (e) {
        // Не валидный JSON целиком
    }

    // Попытка 2: ищем JSON между { и }
    var startIdx = text.indexOf('{');
    var endIdx = text.lastIndexOf('}');

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        var jsonStr = text.substring(startIdx, endIdx + 1);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            // Не удалось распарсить найденный JSON
        }
    }

    // Попытка 3: убираем markdown-обёртку ```json ... ```
    var cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Не удалось
    }

    // Попытка 4: ищем JSON в очищенном тексте
    startIdx = cleaned.indexOf('{');
    endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        var jsonStr2 = cleaned.substring(startIdx, endIdx + 1);
        try {
            return JSON.parse(jsonStr2);
        } catch (e) {
            // Не удалось
        }
    }

    return null;
}

/**
 * Нормализовать ответ для режима preview
 * @param {Object} data - распарсенный ответ
 * @returns {Object}
 */
function normalizePreviewResponse(data) {
    return {
        previewProblem: data.previewProblem || data.problem || 'Не удалось определить проблему',
        previewHint: data.previewHint || data.hint || 'Не удалось сформировать совет',
        cta: data.cta || 'Получить полный разбор за 149 ₽'
    };
}

/**
 * Нормализовать ответ для режима full
 * @param {Object} data - распарсенный ответ
 * @returns {Object}
 */
function normalizeFullResponse(data) {
    return {
        problems: Array.isArray(data.problems) ? data.problems : ['Не удалось определить проблемы'],
        offers: Array.isArray(data.offers) ? data.offers : ['Не удалось сформировать варианты УТП'],
        shortVersion: data.shortVersion || data.short || 'Не удалось сформировать короткую версию',
        firstAdvice: data.firstAdvice || data.advice || 'Не удалось сформировать рекомендацию'
    };
}

/**
 * Генерация UUID v4 для RqUID
 * @returns {string}
 */
function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

module.exports = {
    getGigachatToken: getGigachatToken,
    getCachedGigachatToken: getCachedGigachatToken,
    requestGigachat: requestGigachat,
    safeParseJsonFromModel: safeParseJsonFromModel,
    normalizePreviewResponse: normalizePreviewResponse,
    normalizeFullResponse: normalizeFullResponse
};