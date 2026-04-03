/**
 * Supabase client for Vercel serverless functions
 * Tables:
 *   orders - stores order data, payment status, analysis results
 */

const { createClient } = require('@supabase/supabase-js');

// In-memory fallback for debugging (per-request in serverless)
const memoryOrders = {};

// Always read fresh env vars for each serverless invocation
function getSupabase() {
  // List ALL env vars starting with common prefixes to debug
  const allEnvKeys = Object.keys(process.env).filter(k => 
    k.includes('SUPABASE') || k.includes('DB') || k.includes('POSTGRES')
  );
  console.log('[getSupabase] Available env keys with SUPABASE/DB/POSTGRES:', allEnvKeys.join(', '));
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('[getSupabase] Direct check - SUPABASE_URL:', url ? `present (${url.length} chars)` : 'NOT PRESENT');
  console.log('[getSupabase] Direct check - SUPABASE_SERVICE_ROLE_KEY:', key ? `present (${key.length} chars)` : 'NOT PRESENT');
  
  if (url && key) {
    try {
      const client = createClient(url, key);
      console.log('[getSupabase] Client: OK');
      return client;
    } catch(e) {
      console.error('[getSupabase] Client ERROR:', e.message);
      return null;
    }
  }
  
  console.log('[getSupabase] Client: NULL (no credentials)');
  return null;
}

// Debug: test Supabase connection directly
async function testSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('[testSupabase] Testing with URL:', url ? 'present' : 'missing');
  console.log('[testSupabase] Testing with KEY:', key ? 'present' : 'missing');
  
  if (!url || !key) {
    return { success: false, error: 'Missing credentials' };
  }
  
  try {
    const supabase = createClient(url, key);
    // Try a simple query
    const { data, error } = await supabase.from('orders').select('id').limit(1);
    console.log('[testSupabase] Query result:', error ? error.message : 'success');
    return { success: !error, error: error?.message };
  } catch(e) {
    console.log('[testSupabase] Exception:', e.message);
    return { success: false, error: e.message };
  }
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
  console.log('[createOrder] START. OrderId:', orderId, 'Client:', supabase ? 'EXISTS' : 'NULL');
  
  if (!supabase) {
    console.warn('[createOrder] Using memory fallback (no Supabase client)');
    console.log('[createOrder] This means SUPABASE_URL or SERVICE_KEY is not available in this runtime');
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
    console.log('[createOrder] Saved to memory:', orderId);
    return orderId;
  }

  console.log('[createOrder] Attempting DB insert for order_id:', orderId);
  const { data, error } = await supabase
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
    })
    .select();

  if (error) {
    console.error('[createOrder] INSERT FAILED. Error:', error.message, 'Code:', error.code, 'Details:', error.details);
    return null;
  }
  console.log('[createOrder] INSERT SUCCESS. Insert data:', JSON.stringify(data));
  return orderId;
}

async function getOrder(orderId) {
  const supabase = getSupabase();
  console.log('[getOrder] START. Looking for orderId:', orderId, 'Client:', supabase ? 'EXISTS' : 'NULL');
  
  if (!supabase) {
    console.log('[getOrder] No client - checking memory. Keys:', Object.keys(memoryOrders).length);
    const memOrder = memoryOrders[orderId];
    console.log('[getOrder] Found in memory:', memOrder ? 'YES' : 'NO');
    return memOrder || null;
  }

  try {
    console.log('[getOrder] Query: SELECT * FROM orders WHERE order_id =', orderId);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) {
      console.error('[getOrder] Query ERROR:', error.message, error.code);
      return null;
    }
    console.log('[getOrder] Found:', data ? 'YES, id=' + data.id : 'NO');
    return data;
  } catch(e) {
    console.error('[getOrder] Exception:', e.message);
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

async function listAllOrders() {
  const supabase = getSupabase();
  console.log('[listAllOrders] START. Client:', supabase ? 'EXISTS' : 'NULL');
  
  if (!supabase) {
    console.log('[listAllOrders] No client - returning memory orders. Count:', Object.keys(memoryOrders).length);
    return Object.values(memoryOrders);
  }

  console.log('[listAllOrders] Query: SELECT * FROM orders');
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[listAllOrders] Query ERROR:', error.message);
    return [];
  }
  
  console.log('[listAllOrders] Found rows:', data ? data.length : 0);
  return data || [];
}

module.exports = {
  getSupabase,
  createOrder,
  getOrder,
  updatePaymentStatus,
  updateAnalysisStatus,
  testSupabase,
  listAllOrders,
  PaymentStatus,
  AnalysisStatus
};