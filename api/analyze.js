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
const knowledge = require('./knowledge');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

// POST /api/analyze
router.post('/', function (req, res) {
  const data = req.body;

  // ===== DEBUG: Логирование входных данных =====
  console.log('[DEBUG HTTP] req.body:', JSON.stringify(data, null, 2));
  console.log('[DEBUG HTTP] product:', data.product);
  console.log('[DEBUG HTTP] audience:', data.audience);
  console.log('[DEBUG HTTP] text:', data.text);

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

  // ===== Get knowledge context (async) =====
  let knowledgeContext = null;
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
    
    knowledge.getKnowledgeContext(normalizedData)
      .then((context) => {
        knowledgeContext = context;
        console.log('[Knowledge] Контекст получен:', context ? context.substring(0, 100) + '...' : 'null');
        return buildAndSendPrompt(normalizedData, knowledgeContext, res);
      })
      .catch((err) => {
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

  // ===== Build prompt =====
  let prompt;
  if (data.mode === 'preview') {
    prompt = prompts.buildPreviewPrompt(data, knowledgeContext);
  } else if (data.tariff === 'competitor') {
    prompt = prompts.buildCompetitorPrompt(data, knowledgeContext);
  } else {
    prompt = prompts.buildFullPrompt(data, knowledgeContext);
  }

  console.log('[DEBUG PROMPT] Built prompt preview (first 200 chars):', prompt.substring(0, 200));

  // ===== Request to GigaChat with retry for preview =====
  var attempt = 0;
  var maxAttempts = 2;

  function tryRequest() {
    return gigachat.requestGigachatWithRetry(prompt)
      .then(function (responseText) {
        console.log('[' + data.mode + '] RAW RESPONSE from GigaChat:', responseText);
        console.log('[' + data.mode + '] Response length:', responseText.length);
        
        var parsed = gigachat.safeParseJsonFromModel(responseText);
        
        // FIXED: Check for empty object {} - this was the bug!
        // Only log OK if parsed is actually a valid object with KEYS
        var isParsedNonEmpty = false;
        if (parsed && typeof parsed === 'object') {
            var keys = Object.keys(parsed);
            isParsedNonEmpty = keys.length > 0;
            console.log('[' + data.mode + '] Parsed keys count:', keys.length, 'keys:', keys);
        }
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
            // FIXED: Proper check for empty object after manual parse
            var manualKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
            isParsedNonEmpty = manualKeys.length > 0;
            console.log('[' + data.mode + '] Parsed after manual:', JSON.stringify(parsed), 'keys count:', manualKeys.length);
          } catch(e) {
            console.log('[' + data.mode + '] PARSE FAILED:', e.message);
          }
        }
        
        if (!isParsedNonEmpty && data.mode === 'preview' && attempt < maxAttempts) {
          attempt++;
          console.log('[' + data.mode + '] Попытка ' + attempt + ' не удалась, пробуем снова...');
          console.log('[' + data.mode + '] Raw response:', responseText.substring(0, 300));
          return tryRequest();
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
        console.log('[DEBUG analyze] mode =', data.mode, ', parsed =', JSON.stringify(parsed).substring(0, 200));
        if (data.mode === 'preview') {
          result = gigachat.normalizePreviewResponse(parsed);
          console.log('[' + data.mode + '] Normalized result:', JSON.stringify(result));
        } else if (data.tariff === 'competitor') {
          result = gigachat.normalizeFullWithCompetitorResponse(parsed);
        } else {
          result = gigachat.normalizeFullResponse(parsed);
        }

        console.log('[' + data.mode + '] RESULT SENT: SUCCESS');
        res.json(result);
      });
  }

  tryRequest()
    .catch(function (error) {
      console.error('[' + data.mode + '] Ошибка:', error.message);

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
}

module.exports = router;