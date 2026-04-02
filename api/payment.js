/**
 * Payment routes for Vercel serverless
 * - POST /api/payment/create
 * - POST /api/payment/result
 * - GET /api/payment/status/:orderId
 */

require('dotenv').config();

const express = require('express');
const router = express.Router();

const crypto = require('crypto');
const supabase = require('./supabase');
const prompts = require('./prompts');
const gigachat = require('./gigachat');
const demoMocks = require('./demoMocks');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const PORT = process.env.PORT || 3000;

// Prices
const prices = {
  marketplace: { main: 249, competitor: 299 },
  avito: { main: 149 },
  landing: { main: 199 }
};

// ===== POST /api/payment/create =====
router.post('/create', function (req, res) {
  const data = req.body;
  const scenario = data.scenario || 'marketplace';
  const platform = data.platform || '';
  const tariff = data.tariff || 'main';

  const amount = (prices[scenario] || prices.marketplace)[tariff] || 249;

  const robokassaLogin = process.env.ROBOKASSA_LOGIN;
  const robokassaPassword1 = process.env.ROBOKASSA_PASSWORD1;
  const robokassaIsTest = process.env.ROBOKASSA_IS_TEST === 'true';

  const robokassaConfigured = !!(robokassaLogin && robokassaLogin.trim() !== '' && robokassaPassword1 && robokassaPassword1.trim() !== '');

  const orderId = 'OD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

  // Payload for analysis
  const orderPayload = {
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

  // Save to Supabase
  supabase.createOrder(orderId, orderPayload, amount);

  // Stub mode: Robokassa not configured
  if (!robokassaConfigured) {
    // Run analysis immediately
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

  // Robokassa integration
  const robokassaBaseUrlEnv = process.env.ROBOKASSA_BASE_URL;
  const host = req.get('host') || 'localhost:' + PORT;
  const protocol = req.protocol || (req.get('X-Forwarded-Proto') === 'https' ? 'https' : 'http');

  const baseUrl = robokassaBaseUrlEnv || (protocol + '://' + host);

  const resultUrl = process.env.ROBOKASSA_RESULT_URL || (baseUrl + '/api/payment/result');
  const successUrl = process.env.ROBOKASSA_SUCCESS_URL || (baseUrl + '/#?orderId=' + orderId);
  const failUrl = process.env.ROBOKASSA_FAIL_URL || (baseUrl + '/#?fail=true');

  const description = 'Оплата разбора УТП: ' + scenario + '/' + tariff;

  // Signature: Login:Amount:OrderId:Password1
  const signatureStr = robokassaLogin + ':' + amount + ':' + orderId + ':' + robokassaPassword1;
  const signature = crypto.createHash('md5').update(signatureStr).digest('hex');

  const robokassaBaseUrl = 'https://auth.robokassa.ru/Merchant/Index.aspx';

  const paymentUrl = robokassaBaseUrl
    + '?MerchantLogin=' + encodeURIComponent(robokassaLogin)
    + '&OutSum=' + encodeURIComponent(amount)
    + '&InvId=' + encodeURIComponent(orderId)
    + '&Description=' + encodeURIComponent(description)
    + '&SignatureValue=' + encodeURIComponent(signature)
    + '&IsTest=' + (robokassaIsTest ? '1' : '0')
    + '&ResultURL=' + encodeURIComponent(resultUrl)
    + '&SuccessURL=' + encodeURIComponent(successUrl)
    + '&FailURL=' + encodeURIComponent(failUrl);

  const provider = robokassaIsTest ? 'robokassa-test' : 'robokassa';

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
router.post('/result', function (req, res) {
  const outSum = req.body.OutSum || req.query.OutSum;
  const invId = req.body.InvId || req.query.InvId;
  const signatureValue = req.body.SignatureValue || req.query.SignatureValue;
  const robokassaPassword1 = process.env.ROBOKASSA_PASSWORD1;

  console.log('[PAYMENT][result] Callback received:', { outSum: outSum, invId: invId });

  if (!outSum || !invId || !signatureValue) {
    console.warn('[PAYMENT][result] Missing required fields');
    return res.status(400).send('Missing required fields');
  }

  if (!robokassaPassword1) {
    console.error('[PAYMENT][result] ROBOKASSA_PASSWORD1 not configured');
    return res.status(500).send('Payment provider not configured');
  }

  // Verify signature: OutSum:InvId:Password1
  const signatureStr = outSum + ':' + invId + ':' + robokassaPassword1;
  const expectedSignature = crypto.createHash('md5').update(signatureStr).digest('hex').toLowerCase();
  const actualSignature = (signatureValue || '').toLowerCase();

  if (expectedSignature !== actualSignature) {
    console.warn('[PAYMENT][result] Invalid signature. Expected:', expectedSignature, 'Got:', actualSignature);
    return res.status(400).send('Invalid signature');
  }

  // Get order from Supabase
  supabase.getOrder(invId).then(function(order) {
    supabase.updatePaymentStatus(invId, 'paid', parseFloat(outSum));

    if (order) {
      const payload = {
        product: order.product,
        audience: order.audience,
        link: order.link || '',
        text: order.text || '',
        pain: order.pain || '',
        scenario: order.scenario,
        platform: order.platform || '',
        tariff: order.tariff
      };

      supabase.updateAnalysisStatus(invId, 'processing', null, null);

      runFullAnalysis(invId, payload, function(err, result) {
        if (err) {
          supabase.updateAnalysisStatus(invId, 'failed', null, err.message);
          console.error('[PAYMENT][result] Analysis failed:', err.message);
        } else {
          supabase.updateAnalysisStatus(invId, 'ready', result, null);
          console.log('[PAYMENT][result] Analysis completed:', invId);
        }
      });
    } else {
      console.warn('[PAYMENT][result] Order not found:', invId);
    }

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send('OK' + invId);
  }).catch(function(err) {
    console.error('[PAYMENT][result] Error:', err.message);
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send('OK' + invId); // Still return OK to not block payment
  });
});

// ===== GET /api/payment/status/:orderId =====
router.get('/status/:orderId', function(req, res) {
  const orderId = req.params.orderId;

  supabase.getOrder(orderId).then(function(order) {
    if (order) {
      // Map to statuses
      let status;
      if (order.analysis_status === 'ready') {
        status = 'paid_ready';
      } else if (order.analysis_status === 'processing') {
        status = 'paid_processing';
      } else if (order.analysis_status === 'failed') {
        status = 'paid_failed';
      } else if (order.payment_status === 'paid') {
        status = 'paid_processing';
      } else {
        status = 'awaiting_payment';
      }

      const response = {
        order_id: orderId,
        status: status,
        amount: order.amount,
        paid_at: order.paid_at
      };

      if (order.result && status === 'paid_ready') {
        try {
          response.result = JSON.parse(order.result);
        } catch(e) {
          response.result = order.result;
        }
      }

      if (order.error) {
        response.error = order.error;
      }

      return res.json(response);
    }

    return res.status(404).json({
      error: 'not_found',
      message: 'Order not found'
    });
  }).catch(function(err) {
    console.error('[PAYMENT][status] Error:', err.message);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Error retrieving order'
    });
  });
});

// ===== Helper: Run full analysis =====
function runFullAnalysis(orderId, payload, callback) {
  if (!payload || !payload.product || !payload.audience) {
    return callback(new Error('Invalid payload'));
  }

  if (DEMO_MODE) {
    const mockResult = demoMocks.getMockResponse(
      payload.scenario,
      payload.platform,
      'full',
      payload.tariff
    );
    return setTimeout(function() {
      callback(null, mockResult);
    }, 1000);
  }

  const authKey = process.env.GIGACHAT_AUTH_KEY;
  if (!authKey || authKey.trim() === '' || authKey === 'your_auth_key_here') {
    return callback(new Error('GIGACHAT_AUTH_KEY not configured'));
  }

  const normalizedData = {
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

  let prompt;
  if (normalizedData.tariff === 'competitor') {
    prompt = prompts.buildCompetitorPrompt(normalizedData);
  } else {
    prompt = prompts.buildFullPrompt(normalizedData);
  }

  gigachat.requestGigachatWithRetry(prompt)
    .then(function(responseText) {
      const parsed = gigachat.safeParseJsonFromModel(responseText);
      if (!parsed) {
        return callback(new Error('Invalid model response'));
      }

      let result;
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

module.exports = router;