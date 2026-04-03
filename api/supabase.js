/**
 * Supabase client for Vercel serverless functions
 * Tables:
 *   orders - stores order data, payment status, analysis results
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[Supabase] Module loaded. URL present:', !!supabaseUrl, 'Key present:', !!supabaseKey);

let supabase = null;

function getSupabase() {
  console.log('[Supabase] getSupabase called. Current client:', !!supabase, 'URL present:', !!supabaseUrl, 'Key present:', !!supabaseKey);
  if (!supabase && supabaseUrl && supabaseKey) {
    try {
      console.log('[Supabase] Creating client with URL:', supabaseUrl.substring(0, 25) + '...');
      supabase = createClient(supabaseUrl, supabaseKey);
      console.log('[Supabase] Client created successfully');
    } catch(e) {
      console.error('[Supabase] Error creating client:', e.message);
    }
  }
  if (!supabase) {
    console.warn('[Supabase] Not initialized - returning null');
  }
  return supabase;
}

// Order statuses
const PaymentStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed'
};

const AnalysisStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed'
};

async function createOrder(orderId, payload, amount) {
  const supabase = getSupabase();
  console.log('[Supabase] createOrder called. Client:', !!supabase, 'URL:', supabaseUrl ? 'set' : 'null', 'Key:', supabaseKey ? 'set' : 'null');
  if (!supabase) {
    console.warn('[Supabase] Not configured, using memory fallback');
    return null;
  }

  const { error } = await supabase
    .from('orders')
    .insert({
      order_id: orderId,
      scenario: payload.scenario,
      platform: payload.platform,
      tariff: payload.tariff,
      product: payload.product,
      audience: payload.audience,
      link: payload.link,
      text: payload.text,
      pain: payload.pain,
      amount: amount,
      payment_status: PaymentStatus.PENDING,
      analysis_status: AnalysisStatus.PENDING,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('[Supabase] Error creating order:', error);
    return null;
  }
  return orderId;
}

async function getOrder(orderId) {
  const supabase = getSupabase();
  console.log('[Supabase] getOrder called. OrderId:', orderId, 'Client:', !!supabase);
  if (!supabase) return null;

  console.log('[Supabase] Querying orders table for:', orderId);
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error) {
    console.error('[Supabase] Error getting order:', error.message, error.code);
    return null;
  }
  console.log('[Supabase] Found order:', !!data);
  return data;
}

async function updatePaymentStatus(orderId, status, amount) {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase
    .from('orders')
    .update({
      payment_status: status,
      paid_amount: amount,
      paid_at: status === PaymentStatus.PAID ? new Date().toISOString() : null
    })
    .eq('order_id', orderId);
}

async function updateAnalysisStatus(orderId, status, result, error) {
  const supabase = getSupabase();
  if (!supabase) return;

  const update = {
    analysis_status: status,
    result: result ? JSON.stringify(result) : null,
    error: error || null,
    completed_at: status === AnalysisStatus.READY || status === AnalysisStatus.FAILED 
      ? new Date().toISOString() 
      : null
  };

  await supabase
    .from('orders')
    .update(update)
    .eq('order_id', orderId);
}

module.exports = {
  getSupabase,
  createOrder,
  getOrder,
  updatePaymentStatus,
  updateAnalysisStatus,
  PaymentStatus,
  AnalysisStatus
};