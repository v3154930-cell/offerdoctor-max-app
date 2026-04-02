/**
 * POST /api/analyze
 * AI analysis via GigaChat
 */

require('dotenv').config({ quiet: true });

const express = require('express');
const router = express.Router();

const prompts = require('./prompts');
const gigachat = require('./gigachat');
const demoMocks = require('./demoMocks');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

// POST /api/analyze
router.post('/', function (req, res) {
  const data = req.body;

  // ===== Validation =====
  const errors = [];

  if (typeof data.product !== 'string' || data.product.trim().length === 0) {
    errors.push('product: укажите, что вы продаете');
  }
  if (typeof data.audience !== 'string' || data.audience.trim().length === 0) {
    errors.push('audience: укажите, для кого предложение');
  }

  const hasLink = typeof data.link === 'string' && data.link.trim().length > 0;
  const hasText = typeof data.text === 'string' && data.text.trim().length > 0;
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

  // ===== Normalization =====
  const normalizedData = {
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
    const mockResult = demoMocks.getMockResponse(
      normalizedData.scenario,
      normalizedData.platform,
      normalizedData.mode,
      normalizedData.tariff
    );

    return setTimeout(function () {
      res.json(mockResult);
    }, 800);
  }

  // ===== Check credentials =====
  const authKey = process.env.GIGACHAT_AUTH_KEY;
  if (!authKey || authKey.trim() === '' || authKey === 'your_auth_key_here') {
    return res.status(503).json({
      error: 'provider_not_configured',
      message: 'GigaChat credentials are not configured. Set GIGACHAT_AUTH_KEY in .env or enable DEMO_MODE=true for testing.'
    });
  }

  // ===== Build prompt =====
  let prompt;
  if (normalizedData.mode === 'preview') {
    prompt = prompts.buildPreviewPrompt(normalizedData);
  } else if (normalizedData.tariff === 'competitor') {
    prompt = prompts.buildCompetitorPrompt(normalizedData);
  } else {
    prompt = prompts.buildFullPrompt(normalizedData);
  }

  // ===== Request to GigaChat =====
  gigachat.requestGigachatWithRetry(prompt)
    .then(function (responseText) {
      console.log('[' + normalizedData.mode + '] Ответ от GigaChat получен (' + responseText.length + ' символов)');

      const parsed = gigachat.safeParseJsonFromModel(responseText);

      if (!parsed) {
        console.error('[' + normalizedData.mode + '] Не удалось распарсить JSON. Ответ:', responseText.substring(0, 500));
        return res.status(502).json({
          error: 'invalid_model_response',
          message: 'AI вернул ответ в невалидном формате. Попробуйте снова.'
        });
      }

      let result;
      if (normalizedData.mode === 'preview') {
        result = gigachat.normalizePreviewResponse(parsed);
      } else if (normalizedData.tariff === 'competitor') {
        result = gigachat.normalizeFullWithCompetitorResponse(parsed);
      } else {
        result = gigachat.normalizeFullResponse(parsed);
      }

      console.log('[' + normalizedData.mode + '] Результат отправлен');
      res.json(result);
    })
    .catch(function (error) {
      console.error('[' + normalizedData.mode + '] Ошибка:', error.message);

      let statusCode = 500;
      let errorMessage = 'Внутренняя ошибка сервера';

      if (error.message.indexOf('PROVIDER_NOT_CONFIGURED') !== -1) {
        return res.status(503).json({
          error: 'provider_not_configured',
          message: 'GigaChat credentials are not configured'
        });
      }

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
});

module.exports = router;