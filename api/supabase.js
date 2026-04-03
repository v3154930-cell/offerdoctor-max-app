/**
 * Supabase client for Vercel serverless functions
 * Tables:
 *   orders - stores order data, payment status, analysis results
 */

const { createClient } = require('@supabase/supabase-js');

let supabaseUrl, supabaseKey;

// Lazy load env vars to ensure they're available
function getEnvVars() {
  if (!supabaseUrl) supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseKey) supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, supabaseKey };
}

// In-memory fallback for debugging
const memoryOrders = {};

function getSupabase() {
  const { supabaseUrl: url, supabaseKey: key } = getEnvVars();
  
  // Always recreate the client - lazy init on every call
  if (url && key) {
    try {
      supabase = createClient(url, key);
      console.log('[Supabase] Client created on this call');
      return supabase;
    } catch(e) {
      console.error('[Supabase] Error creating client:', e.message);
    }
  }
  
  console.log('[Supabase] No client created. URL:', !!url, 'Key:', !!key);
  return null;
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
  console.log('[Supabase] createOrder. OrderId:', orderId, 'Client exists:', !!supabase);
  
  if (!supabase) {
    console.warn('[Supabase] No client - using memory fallback');
    memoryOrders[orderId] = {
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
    };
    console.log('[Supabase] Saved to memory:', orderId, '. Total in memory:', Object.keys(memoryOrders).length);
    return orderId;
  }

  console.log('[Supabase] Attempting DB insert for:', orderId);
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
    console.error('[Supabase] Error creating order:', error.message, error.code, error.details);
    return null;
  }
  console.log('[Supabase] Order created in DB:', orderId);
  return orderId;
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
  console.log('[Supabase] getOrder called. OrderId:', orderId, 'Client exists:', !!supabase);
  
  if (!supabase) {
    console.log('[Supabase] No client - checking memory. Keys in memory:', Object.keys(memoryOrders).length);
    const memOrder = memoryOrders[orderId];
    console.log('[Supabase] Found in memory:', !!memOrder);
    return memOrder || null;
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) {
      console.error('[Supabase] Error getting order:', error.message, error.code);
      return null;
    }
    console.log('[Supabase] Found in DB:', !!data);
    return data;
  } catch(e) {
    console.error('[Supabase] Exception in getOrder:', e.message);
    return null;
  }
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