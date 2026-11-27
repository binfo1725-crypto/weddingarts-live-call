// OmniSix AI — Next-Gen Advance AI Capabilities
// 1. Live Chat Copilot | 2. Photo-to-Product | 3. Ask Your Data | 4. Stock Forecast
// 5. CLV & Churn Predictor | 6. Price Elasticity Advisor | 7. Voice-to-Order Extractor

const { parseLkrAmount } = require('./commerceIntegrations.js');

const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function callGeminiJsonOrText(prompt, apiKey, imagePart = null, expectJson = false) {
  const key = String(apiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!key) return null;
  const parts = [];
  if (imagePart && imagePart.data) {
    parts.push({ inline_data: { mime_type: imagePart.mimeType || 'image/jpeg', data: imagePart.data } });
  }
  parts.push({ text: prompt });

  try {
    const res = await fetch(`${GEMINI_TEXT_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 700,
          ...(expectJson ? { responseMimeType: 'application/json' } : {})
        }
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return null;
    if (expectJson) {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      return JSON.parse(cleaned);
    }
    return text.trim();
  } catch (_) {
    return null;
  }
}

// ─── 1. AI Live Chat Copilot (Suggest Replies & 1-Click Polish) ───────────────
async function generateCopilotSuggestions({ chat, business, settings, draftText = '', mode = 'suggest' }) {
  const storeName = business?.name || 'OmniSix Store';
  const apiKey = settings?.geminiApiKey || business?.geminiApiKey || process.env.GEMINI_API_KEY;
  const recentMsgs = (chat?.messages || []).slice(-6).map(m => `${m.sender}: ${m.text}`).join('\n');
  const lastCustomerMsg = [...(chat?.messages || [])].reverse().find(m => m.sender === 'customer')?.text || '';

  if (mode === 'polish' && draftText.trim()) {
    const prompt = `You are a polite Sri Lankan customer support copilot for "${storeName}".
Recent conversation:
${recentMsgs || 'None'}

Rewrite and polish the agent's short draft into a warm, clear, professional customer reply (matching the customer's language — Sinhala, Singlish, or English). Return ONLY the polished message text.
Agent draft: "${draftText}"`;

    const polishedAi = await callGeminiJsonOrText(prompt, apiKey, null, false);
    const fallbackPolished = draftText.trim().endsWith('.') || draftText.trim().endsWith('!') || draftText.trim().endsWith('?')
      ? `ආයුබෝවන්! ${draftText.trim()} 🙏`
      : `ආයුබෝවන්! ${draftText.trim()}. වැඩිදුර විස්තර අවශ්‍ය නම් කරුණාකර දන්වන්න. 🙏`;
    return {
      mode: 'polish',
      polished: polishedAi || fallbackPolished,
      suggestions: []
    };
  }

  const prompt = `You are a sales & support copilot for Sri Lankan store "${storeName}".
Recent chat:
${recentMsgs || 'Customer opened chat'}

Generate 3 short, ready-to-send reply options in JSON format:
{ "suggestions": [
  { "label": "Sinhala", "text": "..." },
  { "label": "Singlish", "text": "..." },
  { "label": "English", "text": "..." }
] }`;

  const aiJson = await callGeminiJsonOrText(prompt, apiKey, null, true);
  if (aiJson && Array.isArray(aiJson.suggestions) && aiJson.suggestions.length > 0) {
    return { mode: 'suggest', suggestions: aiJson.suggestions.slice(0, 3), polished: '' };
  }

  const priceHint = /price|ganan|keeyada|මිල|කීයද/i.test(lastCustomerMsg);
  return {
    mode: 'suggest',
    polished: '',
    suggestions: [
      {
        label: 'Sinhala',
        text: priceHint
          ? `ආයුබෝවන්! ${storeName} වෙත සාදරයෙන් පිළිගන්නවා. ඔබට අවශ්‍ය භාණ්ඩයේ නම හෝ ප්‍රමාණය කියන්න, මම නිවැරදි මිල ගණන් එවන්නම්. 🙏`
          : `ආයුබෝවන්! ඔබට අවශ්‍ය විස්තර කුමක්ද? අපි ඔබට ඉක්මනින් සහය වන්නම්. ✨`
      },
      {
        label: 'Singlish',
        text: priceHint
          ? `Ayubowan! Oyage item eka mokakda kiyanna, api hariyata price saha details ewannam. 😊`
          : `Ayubowan! ${storeName} ekata welcome. Oyage order eka ho prashnaya kiyanna, api help karannam! 👍`
      },
      {
        label: 'English',
        text: priceHint
          ? `Hello! Welcome to ${storeName}. Please let us know which item you are looking for and we will share the exact price & availability.`
          : `Hello! Thank you for contacting ${storeName}. How can we assist you today?`
      }
    ]
  };
}

// ─── 2. AI Photo-to-Product Auto-Generator ────────────────────────────────────
async function generateProductFromImage(inputData, mimeType = 'image/jpeg', storeName = 'Store', apiKey = '') {
  const str = String(inputData || '');
  const match = /^data:([^;]+);base64,(.+)$/s.exec(str);
  const resolvedMime = match ? match[1] : mimeType;
  const rawBase64 = match ? match[2] : str;

  const prompt = `Analyze this product photo for Sri Lankan online store "${storeName}".
Return JSON only with keys:
{
  "name": "Short clear product title (English)",
  "category": "Single category name (e.g. UV Frames, Electronics, Fashion, Gifts)",
  "description": "Attractive 1-2 sentence bilingual English + Sinhala product description",
  "suggestedPrice": 0
}`;

  const aiJson = rawBase64
    ? await callGeminiJsonOrText(prompt, apiKey, { mimeType: resolvedMime, data: rawBase64 }, true)
    : null;

  if (aiJson && aiJson.name) {
    return {
      name: String(aiJson.name).trim(),
      category: String(aiJson.category || 'General').trim(),
      description: String(aiJson.description || '').trim(),
      suggestedPrice: Number(aiJson.suggestedPrice) || 0,
      source: 'gemini_vision'
    };
  }

  return {
    name: `${storeName} Featured Item`,
    category: 'General',
    description: 'High-quality product available for islandwide delivery. උසස් තත්ත්වයේ නිෂ්පාදනයකි.',
    suggestedPrice: 2500,
    source: 'fallback'
  };
}

// ─── 3. "Ask Your Data" Natural-Language Business Analyst ─────────────────────
async function answerBusinessDataQuery(question, { orders = [], products = [], chats = [], leads = [] }, apiKey = '') {
  const q = String(question || '').trim();
  const totalOrders = orders.length;
  const paidOrders = orders.filter(o => !/cancelled/i.test(o.status || ''));
  const totalRevenue = paidOrders.reduce((s, o) => s + parseLkrAmount(o.amount), 0);
  const pendingOrders = orders.filter(o => /pending/i.test(o.status || '')).length;

  const productCounts = {};
  for (const o of paidOrders) {
    const key = String(o.item || 'Other').split(',')[0].trim();
    productCounts[key] = (productCounts[key] || 0) + 1;
  }
  const topSold = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lowStock = products.filter(p => typeof p.stockQty === 'number' && p.stockQty <= (p.lowStockThreshold || 5))
    .map(p => `${p.name} (${p.stockQty} left)`);

  const unconvertedLeads = leads.filter(l => !l.converted).length;

  const metrics = {
    totalOrders,
    totalRevenue,
    pendingOrders,
    totalProducts: products.length,
    totalChats: chats.length,
    unconvertedLeads,
    topSoldProducts: topSold,
    lowStockAlerts: lowStock
  };

  if (q) {
    const prompt = `You are the AI Business Analyst for an e-commerce dashboard.
Answer the owner's question concisely in the same language (Sinhala, Singlish, or English) using ONLY these verified store metrics:
${JSON.stringify(metrics, null, 2)}

Owner question: "${q}"`;

    const aiAnswer = await callGeminiJsonOrText(prompt, apiKey, null, false);
    if (aiAnswer) {
      return { answer: aiAnswer, metrics, source: 'gemini' };
    }
  }

  const topStr = topSold.length > 0 ? topSold.map(([n, c]) => `${n} (${c})`).join(', ') : 'No sales yet';
  const lowStr = lowStock.length > 0 ? lowStock.join(', ') : 'All tracked items healthy';
  const deterministic = [
    `📊 *Store Summary:* Orders ${totalOrders} (Pending: ${pendingOrders}) | Revenue: Rs. ${totalRevenue.toLocaleString()}`,
    `🏆 *Top Items:* ${topStr}`,
    `📦 *Low Stock:* ${lowStr}`,
    `🎯 *Unconverted Leads:* ${unconvertedLeads} | Total Chats: ${chats.length}`
  ].join('\n');

  return { answer: deterministic, metrics, source: 'deterministic' };
}

// ─── 4. AI Demand & Inventory Forecasting ─────────────────────────────────────
function computeDemandForecast(orders = [], products = [], chats = []) {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const recentOrders = orders.filter(o => {
    const ts = new Date(o.createdAt || 0).getTime();
    return !isNaN(ts) && (now - ts) <= thirtyDaysMs && !/cancelled/i.test(o.status || '');
  });

  return products.map(p => {
    const pName = String(p.name || '').toLowerCase();
    let sold30d = 0;
    for (const o of recentOrders) {
      const txt = String(o.item || '').toLowerCase();
      if (pName && txt.includes(pName)) {
        sold30d += 1;
      }
    }
    let chatInquiries = 0;
    for (const c of chats) {
      const msgTxt = (c.messages || []).slice(-6).map(m => m.text || '').join(' ').toLowerCase();
      if (pName && msgTxt.includes(pName)) chatInquiries += 1;
    }

    const dailyVelocity = +(sold30d / 30).toFixed(2);
    const hasStock = typeof p.stockQty === 'number';
    const daysUntilStockout = hasStock
      ? (p.stockQty === 0 ? 0 : (dailyVelocity > 0 ? Math.round(p.stockQty / dailyVelocity) : null))
      : null;

    let riskLevel = 'UNTRACKED';
    if (hasStock) {
      if (p.stockQty === 0 || (daysUntilStockout !== null && daysUntilStockout <= 5)) riskLevel = 'CRITICAL';
      else if (p.stockQty <= (p.lowStockThreshold || 5) || (daysUntilStockout !== null && daysUntilStockout <= 14)) riskLevel = 'WARNING';
      else riskLevel = 'HEALTHY';
    }

    const recommendedRestockQty = hasStock
      ? Math.max(0, Math.ceil(Math.max(dailyVelocity, 0.2) * 14) - p.stockQty)
      : 0;

    return {
      productId: p.id,
      name: p.name,
      stockQty: hasStock ? p.stockQty : null,
      sold30d,
      chatInquiries,
      dailyVelocity,
      daysUntilStockout,
      riskLevel,
      recommendedRestockQty
    };
  }).sort((a, b) => {
    const rank = { CRITICAL: 0, WARNING: 1, HEALTHY: 2, UNTRACKED: 3 };
    return (rank[a.riskLevel] ?? 9) - (rank[b.riskLevel] ?? 9);
  });
}

// ─── 5. AI Customer Lifetime Value (CLV) & Churn Risk Predictor ───────────────
function computeCustomerClvScores(orders = [], chats = []) {
  const byCustomer = new Map();
  const normPhone = ph => String(ph || '').replace(/\D/g, '').slice(-9);

  for (const o of orders) {
    if (/cancelled/i.test(o.status || '')) continue;
    const key = normPhone(o.customerPhone) || String(o.customerName || 'Unknown').toLowerCase();
    if (!key) continue;
    if (!byCustomer.has(key)) {
      byCustomer.set(key, {
        customerName: o.customerName || 'Customer',
        customerPhone: o.customerPhone || '',
        totalSpent: 0,
        orderCount: 0,
        lastActivityMs: 0
      });
    }
    const rec = byCustomer.get(key);
    rec.totalSpent += parseLkrAmount(o.amount);
    rec.orderCount += 1;
    const ts = new Date(o.createdAt || 0).getTime();
    if (!isNaN(ts) && ts > rec.lastActivityMs) rec.lastActivityMs = ts;
  }

  for (const c of chats) {
    const key = normPhone(c.customerPhone || c.id);
    if (!key || !byCustomer.has(key)) continue;
    const ts = new Date(c.lastTime || 0).getTime();
    if (!isNaN(ts) && ts > byCustomer.get(key).lastActivityMs) {
      byCustomer.get(key).lastActivityMs = ts;
    }
  }

  const now = Date.now();
  return Array.from(byCustomer.values()).map(rec => {
    const daysInactive = rec.lastActivityMs > 0
      ? Math.max(0, Math.floor((now - rec.lastActivityMs) / (24 * 60 * 60 * 1000)))
      : 0;
    let segment = 'NEW';
    if (rec.totalSpent >= 15000 || rec.orderCount >= 3) segment = 'VIP';
    else if (daysInactive >= 30 && rec.orderCount >= 1) segment = 'AT_RISK';
    else if (rec.orderCount >= 2) segment = 'LOYAL';

    const clvScore = Math.min(100, Math.round((rec.orderCount * 20) + (rec.totalSpent / 1000) - (daysInactive * 0.5)));
    return {
      ...rec,
      daysInactive,
      segment,
      clvScore: Math.max(1, clvScore),
      recommendedAction: segment === 'VIP'
        ? 'Offer VIP early-access bundle'
        : (segment === 'AT_RISK' ? 'Send win-back 10% coupon' : 'Upsell complementary item')
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20);
}

// ─── 6. AI Price Elasticity & Optimal Discount Advisor ───────────────────────
function computePriceElasticityAdvice(orders = [], products = [], chats = []) {
  const bargainMsgs = [];
  for (const c of chats) {
    for (const m of (c.messages || [])) {
      if (m.sender === 'customer' && /discount|adu|last|floor|bargain|අඩු|ඩිස්කවුන්ට්/i.test(m.text || '')) {
        bargainMsgs.push(String(m.text || '').toLowerCase());
      }
    }
  }

  return products.map(p => {
    const price = Number(p.price) || 0;
    const cost = Number(p.cost) || 0;
    const floor = Number(p.minFloorPrice) || Math.round(price * 0.9);
    const pName = String(p.name || '').toLowerCase();
    const bargainHits = bargainMsgs.filter(t => pName && t.includes(pName)).length;
    const salesHits = orders.filter(o => pName && String(o.item || '').toLowerCase().includes(pName) && !/cancelled/i.test(o.status || '')).length;

    const marginPct = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;
    let optimalPrice = price;
    let recommendedFloorPrice = floor;
    let insight = 'Balanced pricing & conversion.';

    if (bargainHits >= 2 && salesHits === 0 && price > 0) {
      optimalPrice = Math.max(cost > 0 ? Math.round(cost * 1.2) : floor, Math.round(price * 0.95));
      insight = 'High bargain resistance — testing a 5% price drop may boost conversions.';
    } else if (salesHits >= 3 && bargainHits === 0 && price > 0) {
      optimalPrice = Math.round(price * 1.05);
      insight = 'Strong demand with zero price pushback — room for +5% margin optimization.';
    }

    return {
      productId: p.id,
      name: p.name,
      currentPrice: price,
      currentFloor: floor,
      marginPct,
      bargainHits,
      salesHits,
      optimalPrice,
      recommendedFloorPrice,
      insight
    };
  });
}

// ─── 7. AI Voice-to-Structured-Checkout Card Extractor ───────────────────────
async function extractStructuredOrderFromText(transcriptText, products = [], apiKey = '') {
  const text = String(transcriptText || '').trim();
  if (!text) return null;

  const catalogList = (products || []).map(p => `${p.name} (Rs. ${p.price})`).join(', ');
  const prompt = `Extract order details from this Sri Lankan customer voice/chat message.
Catalog: ${catalogList || 'General store items'}
Message: "${text}"
Return JSON only:
{ "customerName": "", "customerPhone": "", "address": "", "item": "", "qty": 1, "amount": 0, "hasOrderIntent": false }`;

  const aiJson = await callGeminiJsonOrText(prompt, apiKey, null, true);
  if (aiJson && (aiJson.hasOrderIntent || aiJson.item || aiJson.customerPhone)) {
    return {
      customerName: String(aiJson.customerName || '').trim(),
      customerPhone: String(aiJson.customerPhone || '').trim(),
      address: String(aiJson.address || '').trim(),
      item: String(aiJson.item || '').trim(),
      qty: Math.max(1, parseInt(aiJson.qty, 10) || 1),
      amount: Number(aiJson.amount) || 0,
      source: 'gemini'
    };
  }

  // Deterministic Sri Lankan regex fallback
  const phoneMatch = /(?:\+?94|0)7\d[\s-]?\d{3}[\s-]?\d{4}/.exec(text);
  const customerPhone = phoneMatch ? phoneMatch[0].replace(/[\s-]/g, '') : '';
  const nameMatch = /(?:mama|my name is|name[:\s]+|නම[:\s]+)([A-Za-z\u0D80-\u0DFF ]{2,25})/i.exec(text);
  const customerName = nameMatch ? nameMatch[1].trim() : '';

  const lower = text.toLowerCase();
  const matchedProd = (products || []).find(p => p.name && lower.includes(p.name.toLowerCase()));
  const qtyMatch = /(\d+)\s*(?:x|pcs|units|කෑලි|ක්)/i.exec(text);
  const qty = qtyMatch ? Math.max(1, parseInt(qtyMatch[1], 10) || 1) : 1;

  const hasIntent = !!(matchedProd || customerPhone || /order|ewanna|ganna|ඇණවුම්|එවන්න/i.test(text));
  if (!hasIntent) return null;

  return {
    customerName,
    customerPhone,
    address: '',
    item: matchedProd ? matchedProd.name : '',
    qty,
    amount: matchedProd ? (Number(matchedProd.price) || 0) * qty : 0,
    source: 'regex'
  };
}

module.exports = {
  generateCopilotSuggestions,
  generateProductFromImage,
  answerBusinessDataQuery,
  computeDemandForecast,
  computeCustomerClvScores,
  computePriceElasticityAdvice,
  extractStructuredOrderFromText
};
