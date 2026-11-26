// OmniSix AI — Sri Lankan Payment Gateways, Live Courier Dispatch & Meta Omnichannel Helpers
const crypto = require('crypto');

function md5Upper(str) {
  return crypto.createHash('md5').update(String(str || ''), 'utf8').digest('hex').toUpperCase();
}

function parseLkrAmount(raw) {
  const num = parseFloat(String(raw || '0').replace(/[^0-9.]/g, '')) || 0;
  return num > 0 ? num : 0;
}

function buildOrderSignToken(orderId, secret) {
  return crypto.createHmac('sha256', String(secret || 'omnisix_pay_fallback_2026'))
    .update(String(orderId || ''))
    .digest('hex')
    .slice(0, 24);
}

function verifyOrderSignToken(orderId, sig, secret) {
  if (!orderId || !sig) return false;
  const expected = buildOrderSignToken(orderId, secret);
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── 1. PayHere Checkout Hash & ITN Verification ──────────────────────────────
function buildPayHereCheckoutParams(order, business = {}, gatewayCfg = {}, baseUrl = '') {
  const merchantId = String(gatewayCfg.merchantId || '').trim();
  const merchantSecret = String(gatewayCfg.merchantSecret || '').trim();
  const currency = String(gatewayCfg.currency || 'LKR').toUpperCase().trim() || 'LKR';
  const amountNum = parseLkrAmount(order.amount);
  const formattedAmount = amountNum.toFixed(2);
  const orderId = String(order.id);
  const hash = (merchantId && merchantSecret)
    ? md5Upper(`${merchantId}${orderId}${formattedAmount}${currency}${md5Upper(merchantSecret)}`)
    : '';

  const nameParts = String(order.customerName || 'Valued Customer').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || 'Sri Lanka';
  const actionUrl = gatewayCfg.sandbox
    ? 'https://sandbox.payhere.lk/pay/checkout'
    : 'https://www.payhere.lk/pay/checkout';

  return {
    actionUrl,
    sandbox: !!gatewayCfg.sandbox,
    fields: {
      merchant_id: merchantId,
      return_url: `${baseUrl}/api/payments/payhere/return?order_id=${encodeURIComponent(orderId)}`,
      cancel_url: `${baseUrl}/api/payments/payhere/cancel?order_id=${encodeURIComponent(orderId)}`,
      notify_url: `${baseUrl}/api/webhook/payhere`,
      order_id: orderId,
      items: String(order.item || `Order #${orderId}`),
      currency,
      amount: formattedAmount,
      first_name: firstName,
      last_name: lastName,
      email: 'customer@omnisix.ai',
      phone: String(order.customerPhone || '').replace(/\D/g, '') || '0770000000',
      address: String(order.address || 'Colombo'),
      city: String((order.address || 'Colombo').split(/[,\n]/).pop() || 'Colombo').trim(),
      country: 'Sri Lanka',
      custom_1: String(business.id || order.businessId || 'weddingarts'),
      hash
    }
  };
}

function verifyPayHereNotifySignature(body = {}, merchantSecret = '') {
  const {
    merchant_id,
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig
  } = body;
  if (!merchant_id || !order_id || !md5sig || !merchantSecret) return false;
  const localSig = md5Upper(
    `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${md5Upper(merchantSecret)}`
  );
  const a = Buffer.from(String(md5sig).toUpperCase());
  const b = Buffer.from(localSig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function buildCustomerPaymentUrl(orderId, baseUrl, signSecret, customLink = '') {
  if (customLink && /^https?:\/\//i.test(customLink)) {
    return customLink;
  }
  const cleanBase = String(baseUrl || 'https://omnisix-ai.onrender.com').replace(/\/+$/, '');
  const sig = buildOrderSignToken(orderId, signSecret);
  return `${cleanBase}/api/payments/checkout/${encodeURIComponent(orderId)}?sig=${sig}`;
}

// ─── 2. Live Courier REST Dispatch (Koombiyo, Domex, Prompt X, Custom) ────────
const COURIER_PRESETS = {
  koombiyo: {
    name: 'Koombiyo Delivery',
    defaultEndpoint: 'https://application.koombiyodelivery.lk/api/Addorders/users'
  },
  domex: {
    name: 'Domex Express',
    defaultEndpoint: 'https://api.domex.lk/api/v1/orders'
  },
  promptx: {
    name: 'Prompt Xpress',
    defaultEndpoint: 'https://api.promptxpress.lk/api/orders'
  },
  custom: {
    name: 'Custom Courier Webhook',
    defaultEndpoint: ''
  }
};

async function dispatchOrderToCourier(order, business = {}, courierCfg = {}) {
  const provider = String(courierCfg.provider || 'koombiyo').toLowerCase().trim();
  const preset = COURIER_PRESETS[provider] || COURIER_PRESETS.custom;
  const endpoint = String(courierCfg.apiUrl || courierCfg.endpoint || preset.defaultEndpoint || '').trim();
  const apiKey = String(courierCfg.apiKey || '').trim();

  if (!endpoint) {
    return { ok: false, error: `Courier API endpoint not configured for ${provider}.` };
  }
  if (!apiKey && provider !== 'custom') {
    return { ok: false, error: `Courier API key required for ${preset.name}. Configure in AI Settings -> Live Courier API.` };
  }

  let cleanPhone = String(order.customerPhone || '').replace(/\D/g, '');
  if (cleanPhone.startsWith('94')) cleanPhone = '0' + cleanPhone.slice(2);
  const city = String(order.address || 'Colombo').split(/[,\n]/).pop().trim() || 'Colombo';
  const codAmount = /paid/i.test(order.status || '') ? 0 : parseLkrAmount(order.amount);

  const payload = {
    apikey: apiKey,
    order_id: order.id,
    orderWaybillid: order.trackingNumber || undefined,
    receiverName: order.customerName || 'Customer',
    receiverStreet: order.address || 'Sri Lanka',
    receiverCity: city,
    receiverPhone: cleanPhone || '0770000000',
    description: order.item || `${business.name || 'Store'} Package`,
    cod: codAmount,
    store: business.name || 'OmniSix Store',
    refCode: order.id
  };

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    if (apiKey) headers['X-API-KEY'] = apiKey;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000)
    });
    const raw = await res.text();
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch (_) { parsed = { message: raw }; }

    if (!res.ok) {
      return {
        ok: false,
        error: parsed.message || parsed.error || `Courier HTTP ${res.status}`,
        provider
      };
    }

    const trackingNumber = String(
      parsed.waybill_id ||
      parsed.waybillNo ||
      parsed.trackingNumber ||
      parsed.tracking_no ||
      parsed.data?.waybill ||
      order.trackingNumber ||
      `${provider.toUpperCase()}-${String(order.id).replace(/\D/g, '').slice(-6) || Date.now().toString().slice(-6)}`
    ).trim();

    return {
      ok: true,
      provider,
      providerName: preset.name,
      trackingNumber,
      rawResponse: parsed
    };
  } catch (e) {
    return { ok: false, error: e.message, provider };
  }
}

// ─── 3. Meta Facebook Messenger & Instagram DM Graph API Sender ───────────────
async function sendMetaSocialMessage(recipientId, text, pageAccessToken) {
  if (!recipientId || !text || !pageAccessToken) {
    return { ok: false, error: 'Missing Meta recipientId, text, or Page Access Token' };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: String(recipientId) },
        message: { text: String(text).slice(0, 1900) }
      }),
      signal: AbortSignal.timeout(12000)
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `Meta Social HTTP ${res.status}` };
    }
    return { ok: true, id: data?.message_id, recipientId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  md5Upper,
  parseLkrAmount,
  buildOrderSignToken,
  verifyOrderSignToken,
  buildPayHereCheckoutParams,
  verifyPayHereNotifySignature,
  buildCustomerPaymentUrl,
  dispatchOrderToCourier,
  sendMetaSocialMessage,
  COURIER_PRESETS
};
