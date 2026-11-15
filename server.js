// OmniSix Live AI Call Server
// Real-time Voice Call Server for WEDDING ARTS & OMNISIX AI PRO
// Full Dataset Integration + Instant Full-Duplex Barge-in + Gemini 3.5 Flash & Aoede Voice

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const fs = require('fs');
const path = require('path');
const db = require('./db.js');
const waEngine = require('./whatsapp.js');
const pdfParse = require('pdf-parse');
const {
  CustomerArchetypeEngine,
  AngryCustomerEscalationEngine,
  SmartNegotiationEngine,
  SmartUpsellEngine,
  SlipDetectionEngine
} = require('./ai_engines.js');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const CALL_SERVER_URL = process.env.CALL_SERVER_URL || `http://localhost:${PORT}`;

const GEMINI_TEXT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
];
const GEMINI_TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts'
];
const VOICE_NAME = 'Leda'; // Exact soft, youthful, warm female voice profile from the app

// ─── Multi-Key Pool for Unlimited Gemini Voice AI ─────────────────────────────
const ENCODED_KEYS = [
  'QVEuQWI4Uk42Slc4Sk1BXzBSc05CTVZpb21zNjFCSjZBQlpueDJKMGpGQUlTcUpaZVJ5WHc=',
  'QVEuQWI4Uk42SWhsaWhsU2hVTnZWOUpKTWt3azNrd0d4VmZsblotdmk2dXZqQVlBQWhFYmc=',
  'QVEuQWI4Uk42TFVmVEEwLU9YV0dNMmhYdzMtb0tfdWtXd2NDRzlxM2Vsd0ZSWG4tMzM1Y3c='
];
const POOLED_GEMINI_API_KEYS = ENCODED_KEYS.map(k => Buffer.from(k, 'base64').toString('utf8'));
if (DEFAULT_GEMINI_API_KEY && !POOLED_GEMINI_API_KEYS.includes(DEFAULT_GEMINI_API_KEY)) {
  POOLED_GEMINI_API_KEYS.unshift(DEFAULT_GEMINI_API_KEY);
}

const keyCooldowns = new Map(); // key -> cooldown until epoch ms
function markKeyCooldown(key, durationMs = 15 * 60 * 1000) {
  keyCooldowns.set(key, Date.now() + durationMs);
}

let keyRoundRobin = 0;
function getOrderedKeys(sessionKey) {
  const now = Date.now();
  const available = POOLED_GEMINI_API_KEYS.filter(k => {
    const cd = keyCooldowns.get(k);
    return !cd || cd <= now;
  });

  const activePool = available.length > 0 ? available : POOLED_GEMINI_API_KEYS;

  const base = sessionKey && !activePool.includes(sessionKey)
    ? [sessionKey, ...activePool]
    : [...activePool];

  const start = keyRoundRobin % base.length;
  keyRoundRobin = (keyRoundRobin + 1) % base.length;
  return [...base.slice(start), ...base.slice(0, start)];
}

// ─── Load Built-in Unified Dataset ───────────────────────────────────────────
let BUILTIN_DATASET = '';
try {
  const dsPath = path.join(__dirname, 'dataset.txt');
  if (fs.existsSync(dsPath)) {
    BUILTIN_DATASET = fs.readFileSync(dsPath, 'utf8');
    console.log(`[dataset] Loaded built-in dataset (${BUILTIN_DATASET.length} chars)`);
  }
} catch (e) {
  console.warn('[dataset] Failed to load dataset.txt:', e.message);
}

// ─── Session Store ───────────────────────────────────────────────────────────
const sessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.createdAt > 60 * 60 * 1000) {
      try { s.browserWs && s.browserWs.close(); } catch {}
      sessions.delete(id);
      console.log(`[session] Expired & removed: ${id}`);
    }
  }
}, 10 * 60 * 1000);

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();

// Disable aggressive browser caching for all HTML and dynamic responses
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

app.get('/health', (req, res) => {
  const activeBiz = db.getActiveBusiness();
  res.json({
    status: 'ok',
    activeBusiness: activeBiz.name,
    sessions: sessions.size,
    datasetChars: (activeBiz.dataset || BUILTIN_DATASET).length,
    time: new Date().toISOString()
  });
});

// ─── Executive Web Admin Dashboard & Omnichannel UI ─────────────────────────
app.get(['/admin', '/dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Business Profile & Preset Management
app.get('/api/business', (req, res) => {
  res.json({
    ok: true,
    active: db.getActiveBusiness(),
    businesses: db.getAllBusinesses()
  });
});

app.post('/api/business/select', (req, res) => {
  const { id } = req.body;
  const active = db.setActiveBusiness(id);
  res.json({ ok: true, active });
});

app.post('/api/business/save', (req, res) => {
  const business = db.saveBusiness(req.body);
  res.json({ ok: true, business });
});

// Real-time Business Analytics
app.get('/api/analytics', (req, res) => {
  res.json({
    ok: true,
    analytics: db.getAnalytics()
  });
});

// Orders Pipeline & Slips
app.get('/api/orders', (req, res) => {
  const activeBiz = db.getActiveBusiness();
  res.json({
    ok: true,
    orders: db.getOrders(activeBiz.id)
  });
});

app.post('/api/orders/status', (req, res) => {
  const { id, status, trackingNumber } = req.body;
  const order = db.updateOrderStatus(id, status, trackingNumber);
  res.json({ ok: true, order });
});

app.post('/api/orders/create', (req, res) => {
  const activeBiz = db.getActiveBusiness();
  const order = db.addOrder({
    ...req.body,
    businessId: activeBiz.id,
    source: 'Manual Dashboard'
  });
  res.json({ ok: true, order });
});

app.post('/api/orders/delete', (req, res) => {
  const { id } = req.body;
  db.deleteOrder(id);
  res.json({ ok: true });
});

// ─── Products Catalog CRUD (From APK) ─────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const activeBiz = db.getActiveBusiness();
  res.json({ ok: true, products: db.getProducts(activeBiz.id) });
});

app.post('/api/products', (req, res) => {
  const product = db.addProduct(req.body);
  res.json({ ok: true, product });
});

app.post('/api/products/update', (req, res) => {
  const { id, ...updates } = req.body;
  const product = db.updateProduct(id, updates);
  res.json({ ok: true, product });
});

app.post('/api/products/delete', (req, res) => {
  const { id } = req.body;
  const success = db.deleteProduct(id);
  res.json({ ok: success });
});

// ─── Custom Keyword Flows CRUD (From APK) ──────────────────────────────────────
app.get('/api/flows', (req, res) => {
  const activeBiz = db.getActiveBusiness();
  res.json({ ok: true, flows: db.getCustomFlows(activeBiz.id) });
});

app.post('/api/flows', (req, res) => {
  const flow = db.addCustomFlow(req.body);
  res.json({ ok: true, flow });
});

app.post('/api/flows/update', (req, res) => {
  const { id, ...updates } = req.body;
  const flow = db.updateCustomFlow(id, updates);
  res.json({ ok: true, flow });
});

app.post('/api/flows/delete', (req, res) => {
  const { id } = req.body;
  const success = db.deleteCustomFlow(id);
  res.json({ ok: success });
});

// ─── Store & AI Persona Settings (From APK) ───────────────────────────────────
app.get('/api/settings', (req, res) => {
  res.json({ ok: true, settings: db.getSettings() });
});

app.post('/api/settings', (req, res) => {
  const settings = db.updateSettings(req.body);
  res.json({ ok: true, settings });
});

// Live Chat Inbox & Human Takeover
app.get('/api/chats', (req, res) => {
  res.json({
    ok: true,
    chats: db.getChats()
  });
});

app.post('/api/chats/reply', async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) return res.status(400).json({ error: 'chatId and text required' });
  const result = db.addChatMessage(chatId, 'agent', text);
  if (waEngine && waEngine.connected) {
    try {
      await waEngine.sendTextMessage(chatId, text);
    } catch (e) {
      console.warn('[chats/reply] WhatsApp send failed:', e.message);
    }
  }
  res.json({ ok: true, ...result });
});

app.post('/api/chats/mute', (req, res) => {
  const { chatId, isMuted } = req.body;
  const chat = db.setChatAiMute(chatId, !!isMuted);
  res.json({ ok: true, chat });
});

// WhatsApp Simulated / Webhook Incoming Message
app.post('/api/whatsapp/incoming', async (req, res) => {
  const { chatId, customerName, text } = req.body;
  const id = chatId || ('9477' + Math.floor(1000000 + Math.random() * 9000000));
  const name = customerName || 'Customer';
  const incomingText = text || '';

  const activeBiz = db.getActiveBusiness();
  db.addChatMessage(id, 'customer', incomingText, name);

  const chat = db.getChat(id);
  if (chat && chat.aiMuted) {
    console.log(`[whatsapp] Chat ${id} is human-takeover muted. AI will not reply.`);
    return res.json({ ok: true, aiMuted: true });
  }

  const tempSess = {
    storeName: activeBiz.name,
    customerName: name,
    customerPhone: id,
    dataset: activeBiz.dataset || BUILTIN_DATASET,
    voice: VOICE_NAME,
    apiKey: DEFAULT_GEMINI_API_KEY,
    history: (chat?.messages || []).slice(-6).map(m => ({
      role: m.sender === 'customer' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }))
  };

  try {
    const aiReply = await getGeminiReply(incomingText, tempSess);
    checkForOrderTag(aiReply, tempSess, id);
    db.addChatMessage(id, 'ai', aiReply, name);
    res.json({ ok: true, reply: aiReply });
  } catch (err) {
    const fallback = `${activeBiz.name} වෙතින් ස්තූතියි! ඔබේ පණිවිඩය අප වෙත ලැබුණා. අපේ නියෝජිතයෙක් ඉක්මනින් සම්බන්ධ වනු ඇත.`;
    db.addChatMessage(id, 'ai', fallback, name);
    res.json({ ok: true, reply: fallback });
  }
});

// Safe Broadcast Campaigns
app.get('/api/broadcasts', (req, res) => {
  res.json({
    ok: true,
    broadcasts: db.getBroadcasts()
  });
});

app.post('/api/broadcasts', async (req, res) => {
  const activeBiz = db.getActiveBusiness();
  const broadcast = db.addBroadcast({
    ...req.body,
    businessId: activeBiz.id
  });

  if (waEngine && waEngine.connected && req.body.message) {
    const chats = db.getChats();
    const uniquePhones = [...new Set(chats.map(c => c.customerPhone).filter(Boolean))];
    (async () => {
      for (const phone of uniquePhones.slice(0, 100)) {
        try {
          await waEngine.sendTextMessage(phone, req.body.message);
          await new Promise(r => setTimeout(r, 2500 + Math.random() * 2000));
        } catch (e) {}
      }
    })();
  }

  res.json({ ok: true, broadcast });
});

// ─── Multi-Account WhatsApp (Baileys Multi-Device) Endpoints ───────────────
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    ok: true,
    ...waEngine.getStatus()
  });
});

app.get('/api/whatsapp/accounts', (req, res) => {
  res.json({
    ok: true,
    accounts: waEngine.getAccounts()
  });
});

app.post('/api/whatsapp/accounts/add', async (req, res) => {
  try {
    const { label } = req.body;
    const session = await waEngine.addAccount(label);
    res.json({
      ok: true,
      account: session.getStatus()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/accounts/:id/pairing-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const code = await waEngine.requestPhonePairingCode(phoneNumber, req.params.id);
    res.json({ ok: true, pairingCode: code, accountId: req.params.id });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/accounts/:id/toggle-bot', async (req, res) => {
  try {
    const { botActive } = req.body;
    const result = await waEngine.toggleBot(req.params.id, botActive);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/accounts/:id/logout', async (req, res) => {
  try {
    const result = await waEngine.logout(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/accounts/:id/delete', async (req, res) => {
  try {
    const result = await waEngine.deleteAccount(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/pairing-code', async (req, res) => {
  try {
    const { phoneNumber, accountId } = req.body;
    const code = await waEngine.requestPhonePairingCode(phoneNumber, accountId || 'default');
    res.json({ ok: true, pairingCode: code });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/logout', async (req, res) => {
  const { accountId } = req.body;
  await waEngine.logout(accountId || 'default');
  res.json({ ok: true });
});

app.post('/api/whatsapp/restart', async (req, res) => {
  await waEngine.start();
  res.json({ ok: true });
});

// ─── Master Dataset Upload (.TXT & .PDF) ─────────────────────────────────────
app.post('/api/dataset/upload', async (req, res) => {
  try {
    const { fileName, fileType, fileBase64, mode } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ ok: false, error: 'fileBase64 data is required' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    let extractedText = '';

    const isPdf = (fileType && fileType.includes('pdf')) || (fileName && fileName.toLowerCase().endsWith('.pdf'));

    if (isPdf) {
      console.log(`[dataset-upload] Parsing PDF document: "${fileName}" (${buffer.length} bytes)...`);
      const parsedPdf = await pdfParse(buffer);
      extractedText = (parsedPdf.text || '').trim();
    } else {
      console.log(`[dataset-upload] Reading text document: "${fileName}" (${buffer.length} bytes)...`);
      extractedText = buffer.toString('utf8').trim();
    }

    // Clean up excessive whitespace while preserving structure
    extractedText = extractedText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    if (!extractedText || extractedText.length < 5) {
      return res.status(400).json({ ok: false, error: 'The uploaded file is empty or no text could be extracted.' });
    }

    const activeBiz = db.getActiveBusiness();
    const isAppend = mode === 'append';
    const header = `=== UPLOADED KNOWLEDGE [${fileName || 'Document'}] ===\n`;

    if (isAppend && activeBiz.dataset && activeBiz.dataset.length > 20) {
      activeBiz.dataset = activeBiz.dataset.trim() + '\n\n' + header + extractedText;
    } else {
      activeBiz.dataset = header + extractedText;
    }

    db.saveBusiness(activeBiz);
    BUILTIN_DATASET = activeBiz.dataset;

    console.log(`[dataset-upload] ✅ Successfully saved dataset for ${activeBiz.name}. Length: ${extractedText.length} chars (Total: ${activeBiz.dataset.length})`);

    res.json({
      ok: true,
      fileName,
      isPdf,
      extractedChars: extractedText.length,
      totalChars: activeBiz.dataset.length,
      preview: extractedText.slice(0, 500),
      dataset: activeBiz.dataset
    });
  } catch (err) {
    console.error('[dataset-upload] Failed to process uploaded file:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to parse dataset file: ' + err.message });
  }
});

// ─── Session Management ──────────────────────────────────────────────────────
app.post('/api/session', (req, res) => {
  const activeBiz = db.getActiveBusiness();
  const { sessionId, customerName, customerPhone, storeName, geminiApiKey, dataset } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const serverHost = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
    ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
    : CALL_SERVER_URL;

  const id = sessionId;
  sessions.set(id, {
    browserWs: null,
    customerName: customerName || 'Customer',
    customerPhone: customerPhone || '',
    storeName: storeName || activeBiz.name,
    apiKey: geminiApiKey || DEFAULT_GEMINI_API_KEY,
    dataset: (dataset && dataset.trim().length > 50) ? dataset : (activeBiz.dataset || BUILTIN_DATASET),
    history: [],
    createdAt: Date.now(),
  });

  console.log(`[session] Created: ${id} | store: ${storeName || activeBiz.name}`);
  res.json({ ok: true, sessionId: id, callUrl: `${serverHost}/call?s=${id}` });
});

app.get('/call', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Direct HTTP Chat API
app.post('/api/chat', async (req, res) => {
  const activeBiz = db.getActiveBusiness();
  const { sessionId, message } = req.body;
  const sess = sessions.get(sessionId) || {
    customerName: 'Customer',
    storeName: activeBiz.name,
    voice: VOICE_NAME,
    apiKey: DEFAULT_GEMINI_API_KEY,
    history: [],
    dataset: activeBiz.dataset || BUILTIN_DATASET
  };

  try {
    const aiReply = await getGeminiReply(message, sess);
    checkForOrderTag(aiReply, sess, sessionId);
    const audioResult = await synthesizeVoiceAudio(aiReply, sess.voice, sess.apiKey);

    res.json({
      ok: true,
      reply: aiReply,
      audioBase64: audioResult.audioBase64,
      mimeType: audioResult.mimeType,
      isGeminiVoice: audioResult.isGemini
    });
  } catch (err) {
    console.error('[chat-api] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── HTTP & WebSocket Server ─────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (browserWs, req) => {
  db.recordLiveCall();
  const url = new URL(req.url, `http://localhost`);
  const activeBiz = db.getActiveBusiness();
  const sessionId = url.searchParams.get('s');
  const customerName = url.searchParams.get('n') || 'Customer';
  const paramStore = url.searchParams.get('store');
  const storeName = (paramStore && paramStore !== 'WEDDING ARTS') ? paramStore : activeBiz.name;
  const voice = url.searchParams.get('v') || VOICE_NAME;

  let sess = sessions.get(sessionId);
  if (!sess) {
    sess = {
      browserWs: null,
      customerName: customerName,
      customerPhone: '',
      storeName: storeName,
      voice: voice,
      apiKey: DEFAULT_GEMINI_API_KEY,
      dataset: activeBiz.dataset || BUILTIN_DATASET,
      history: [],
      createdAt: Date.now()
    };
    if (sessionId) sessions.set(sessionId, sess);
  } else {
    if (customerName && customerName !== 'Customer') sess.customerName = customerName;
    if (paramStore && paramStore !== 'WEDDING ARTS') sess.storeName = paramStore;
    if (voice) sess.voice = voice;
  }

  sess.browserWs = browserWs;
  console.log(`[ws] Browser connected — session: ${sessionId} | customer: ${sess.customerName} | store: ${sess.storeName} | voice: ${sess.voice}`);

  safeSend(browserWs, JSON.stringify({
    type: 'ready',
    message: 'AI Connected! Call සූදානම්.'
  }));

  // Initial welcome greeting with guaranteed natural Gemini Voice audio
  (async () => {
    try {
      const currentBiz = db.getActiveBusiness();
      const welcomeStore = sess.storeName || currentBiz.name;
      const welcomeText = currentBiz.welcomeMessage || `ආයුබෝවන්! ${welcomeStore} වෙත සාදරයෙන් පිළිගන්නවා. මම කොහොමද ඔබට උදව් කරන්න පුළුවන්?`;
      const audioResult = await synthesizeVoiceAudio(welcomeText, sess.voice, sess.apiKey);
      safeSend(browserWs, JSON.stringify({
        type: 'ai_speech',
        text: welcomeText,
        audioBase64: audioResult.audioBase64,
        mimeType: audioResult.mimeType,
        isGeminiVoice: audioResult.isGemini
      }));
    } catch (e) {
      console.warn('[welcome] greeting failed:', e.message);
    }
  })();

  browserWs.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Barge-in cancel notification from browser
      if (msg.type === 'barge_in') {
        console.log(`[ws] Customer barge-in triggered on session ${sessionId}`);
        return;
      }

      if (msg.type === 'user_speech' && msg.text) {
        console.log(`[ws] User said (${sessionId}) [lang: ${msg.lang || 'auto'}]: "${msg.text}"`);

        safeSend(browserWs, JSON.stringify({ type: 'ai_thinking' }));

        const aiReply = await getGeminiReply(msg.text, sess, msg.lang);
        console.log(`[ws] AI reply (${sessionId}): "${aiReply}"`);

        checkForOrderTag(aiReply, sess, sessionId);

        const audioResult = await synthesizeVoiceAudio(aiReply, sess.voice, sess.apiKey);

        safeSend(browserWs, JSON.stringify({
          type: 'ai_speech',
          text: aiReply,
          audioBase64: audioResult.audioBase64,
          mimeType: audioResult.mimeType,
          isGeminiVoice: audioResult.isGemini
        }));
      }
    } catch (err) {
      console.error(`[ws] Message processing error:`, err);
      // Soft conversational recovery in polite spoken Sinhala
      const softReply = 'සමාවෙන්න, මට පැහැදිලි වුණේ නෑ. ඔබට අවශ්‍ය දේ නැවත කියන්න පුළුවන්ද?';
      let audioResult = { audioBase64: null, mimeType: 'audio/wav', isGemini: false };
      try {
        audioResult = await synthesizeVoiceAudio(softReply, sess ? sess.voice : VOICE_NAME, sess ? sess.apiKey : null);
      } catch (audioErr) {}

      safeSend(browserWs, JSON.stringify({
        type: 'ai_speech',
        text: softReply,
        audioBase64: audioResult.audioBase64,
        mimeType: audioResult.mimeType,
        isGeminiVoice: audioResult.isGemini
      }));
    }
  });

  browserWs.on('close', () => {
    console.log(`[ws] Browser disconnected — session: ${sessionId}`);
  });
});

// ─── Gemini AI Engine with Smart Dataset Query ────────────────────────────────
async function getGeminiReply(userMessage, sess, userLang) {
  const activeBiz = db.getActiveBusiness();

  // 1. Angry Customer Escalation Engine
  const angryCheck = AngryCustomerEscalationEngine.check(userMessage);
  if (angryCheck.isAngry) {
    console.log(`[ai-engine] 😡 Angry customer escalation triggered: "${angryCheck.trigger}"`);
    if (sess.customerPhone) {
      db.setChatEscalation(sess.customerPhone, true, angryCheck.trigger);
    }
    return angryCheck.deEscalationReply;
  }

  // 2. Slip / Receipt Detection Engine
  if (SlipDetectionEngine.isSlipSubmission(userMessage)) {
    console.log(`[ai-engine] 💳 Bank slip / receipt submission detected.`);
    if (sess.customerPhone) {
      const orders = db.getOrders(activeBiz.id);
      const pendingOrd = orders.find(o => o.customerPhone === sess.customerPhone && o.status === 'Pending Payment');
      if (pendingOrd) {
        db.updateOrderStatus(pendingOrd.id, 'Slip Received');
      }
    }
  }

  // 3. Keyword-Triggered Custom Flows
  const matchedFlow = db.matchCustomFlow(userMessage, activeBiz.id);
  if (matchedFlow) {
    console.log(`[ai-engine] ⚡ Custom Flow triggered: "${matchedFlow.trigger}"`);
    return matchedFlow.response;
  }

  const datasetContext = (sess.dataset && sess.dataset.length > 50) ? sess.dataset : (activeBiz.dataset || BUILTIN_DATASET);
  const systemInstruction = buildSystemPrompt(sess, datasetContext, userLang, userMessage);

  if (!Array.isArray(sess.history)) sess.history = [];

  // Build clean alternating conversation history to prevent Gemini API 400 bad request errors
  const cleanHistory = [];
  let expectedRole = 'user';
  for (const item of sess.history.slice(-8)) {
    if (item.role === expectedRole && item.parts?.[0]?.text) {
      cleanHistory.push(item);
      expectedRole = expectedRole === 'user' ? 'model' : 'user';
    }
  }

  const isEnglishQuery = userLang === 'en-US' || (!/[\u0D80-\u0DFF]/.test(userMessage) && /\b(hello|hi|good morning|good afternoon|how much|what is|price|pricing|delivery|bank|order|can i|please|package|packages|edit|editing|shoot)\b/i.test(userMessage));

  const turnInstruction = isEnglishQuery
    ? `\n[VOICE RULE: The user is speaking in English. You MUST reply in fluent, natural English in 1 to 2 concise spoken sentences using exact dataset prices.]`
    : `\n[VOICE RULE: The user is speaking in Sinhala/Singlish. You MUST reply in natural spoken Sinhala script (සිංහල අකුරින්). NEVER output Latin Singlish. 1 to 2 concise spoken sentences using exact dataset prices.]`;

  // Append user message with per-turn steering prompt for the API call
  cleanHistory.push({ role: 'user', parts: [{ text: userMessage + turnInstruction }] });

  const initialModelAck = isEnglishQuery
    ? `Understood. I represent ${sess.storeName || 'WEDDING ARTS'} and will provide concise answers in English with 100% accurate prices and details from the official dataset.`
    : `තේරුණා. මම ${sess.storeName || 'WEDDING ARTS'} වෙනුවෙන් නිල Dataset එකේ ඇති නිවැරදිම මිල ගණන් සහ විස්තර මත පමණක් පදනම්ව, කිසිවක් මගනොහැර ස්වභාවික සිංහලෙන් පැහැදිලිව කතා කරන්නම්.`;

  const contents = [
    { role: 'user', parts: [{ text: `[OFFICIAL MASTER DATASET & SYSTEM INSTRUCTIONS]\n${systemInstruction}\n[END SYSTEM INSTRUCTIONS]` }] },
    { role: 'model', parts: [{ text: initialModelAck }] },
    ...cleanHistory
  ];

  const keysToTry = getOrderedKeys(sess.apiKey);
  let lastError = null;

  // Auto-failover across available models and key pool
  for (const model of GEMINI_TEXT_MODELS) {
    for (const key of keysToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents,
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 250
            }
          }),
          signal: AbortSignal.timeout(4500)
        });

        const data = await response.json();
        if (data.error) {
          lastError = data.error.message;
          if (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED' || data.error.code === 401) {
            markKeyCooldown(key, 20 * 60 * 1000);
          }
          continue; // Try next key
        }

        const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) {
          sess.history.push({ role: 'user', parts: [{ text: userMessage }] });
          sess.history.push({ role: 'model', parts: [{ text: replyText }] });
          console.log(`[Gemini Text] Success using model: ${model}`);
          return replyText;
        }
      } catch (err) {
        lastError = err.message;
        markKeyCooldown(key, 5 * 60 * 1000);
      }
    }
  }

  // Smart fallback from dataset if all Gemini models exhaust daily quota
  console.warn('[Gemini Text] All text models hit quota or failed. Using smart dataset fallback.');
  const store = sess.storeName || 'Wedding Arts';
  const fallbackReply = `ස්තූතියි! ${store} වෙතින් ෆොටෝ එඩිටිං, 12x18 UV Frames (රු. 4800) සහ 16x24 UV Frames (රු. 7800 නොමිලේ ඩිලිවරි සහිතව) ලබාගත හැක. ඔබට අවශ්‍ය විස්තරය හෝ ඇණවුම ලබා දෙන්න.`;
  sess.history.push({ role: 'user', parts: [{ text: userMessage }] });
  sess.history.push({ role: 'model', parts: [{ text: fallbackReply }] });
  return fallbackReply;
}

// ─── Dual-Engine High-Definition Audio Synthesis (Gemini Leda + Safety Fallback) ──
function sanitizeForSpeech(text) {
  let s = (text || '')
    .replace(/\[\[ORDER:.*?\]\]/g, '')
    .replace(/[*#_~`>]/g, '')
    .replace(/["“”'‘]/g, '');

  const hasSinhala = /[\u0D80-\u0DFF]/.test(s);

  if (hasSinhala) {
    s = s
      .replace(/Rs\.?\s*([0-9,]+)/gi, 'රුපියල් $1 ')
      .replace(/\bLKR\b/gi, 'රුපියල් ')
      .replace(/\bCOD\b/gi, 'කෑෂ් ඔන් ඩිලිවරි ');
  } else {
    s = s
      .replace(/Rs\.?\s*([0-9,]+)/gi, '$1 Rupees ')
      .replace(/\bLKR\b/gi, 'Rupees ')
      .replace(/\bCOD\b/gi, 'Cash on Delivery ');
  }

  // Strip emojis & symbols so Gemini TTS doesn't vocalize emoji names
  const emojiPattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u26FF]|[\u2700-\u27BF]|[\u2300-\u23FF]|[\u25A0-\u25FF]|[\u2B00-\u2BFF]|[\u2190-\u21FF]|[\u3030\u303D\u3297\u3299]|[•▪▫◦⁃●○★☆✦✧✓✔🤖⚠️📦👋🎙️🔊✨💬🎨🖼️🚚💳]/g;
  s = s.replace(emojiPattern, ' ');

  // Spoken Sinhala Conversions (matching FemaleVoiceEngine.kt)
  if (hasSinhala) {
    s = s
      .replace(/\bහැකියාව ඇත\b/g, 'පුළුවන්')
      .replace(/\bහැකියාව තියෙනවා\b/g, 'පුළුවන්')
      .replace(/\bඇත\b/g, 'තියෙනවා')
      .replace(/\bනැත\b/g, 'නෑ')
      .replace(/\bවේ\b/g, 'වෙනවා')
      .replace(/\bකෙරේ\b/g, 'කරනවා')
      .replace(/\bලැබේ\b/g, 'ලැබෙනවා')
      .replace(/\bපිළිබඳව?\b/g, 'ගැන')
      .replace(/\bසඳහා\b/g, 'වෙනුවෙන්')
      .replace(/\bඔබට\b/g, 'ඔයාට')
      .replace(/\bඔබගේ\b/g, 'ඔයාගේ')
      .replace(/\bඔබේ\b/g, 'ඔයාගේ')
      .replace(/\bඔබව\b/g, 'ඔයාව')
      .replace(/\bඔබ\b/g, 'ඔයා')
      .replace(/\bඅපගේ\b/g, 'අපේ')
      .replace(/\bඅපට\b/g, 'අපිට')
      .replace(/\bFrame\b/gi, 'ෆ්‍රේම්')
      .replace(/\bFrames\b/gi, 'ෆ්‍රේම්ස්')
      .replace(/\bPhoto\b/gi, 'ෆොටෝ')
      .replace(/\bPhotos\b/gi, 'ෆොටෝ')
      .replace(/\bEditing\b/gi, 'එඩිටින්')
      .replace(/\bEdits\b/gi, 'එඩිට්ස්')
      .replace(/\bEdit\b/gi, 'එඩිට්')
      .replace(/\bShoot\b/gi, 'ෂූට්')
      .replace(/\bShoots\b/gi, 'ෂූට්ස්')
      .replace(/\bWedding\b/gi, 'වෙඩින්')
      .replace(/\bDelivery\b/gi, 'ඩිලිවරි')
      .replace(/\bFree\b/gi, 'නොමිලේ')
      .replace(/\bWhatsApp\b/gi, 'වට්ස්ඇප්')
      .replace(/\b12x18\b/gi, 'දොළහයි දහඅට')
      .replace(/\b16x24\b/gi, 'දහසයයි විසිහතර')
      .replace(/\b20x30\b/gi, 'විස්සයි තිහ')
      .replace(/\b8x12\b/gi, 'අටයි දොළහ')
      .replace(/\b10x15\b/gi, 'දහයයි පහළොව');
  }

  return s.replace(/\s+/g, ' ').trim();
}

async function synthesizeVoiceAudio(text, preferredVoice, sessionKey) {
  const speechText = sanitizeForSpeech(text);
  if (!speechText) return { audioBase64: null, mimeType: 'audio/wav', isGemini: false };

  const voice = preferredVoice || VOICE_NAME;
  const keysToTry = getOrderedKeys(sessionKey);

  // 1. Exclusive Engine: Official Google Gemini Live Voice AI (Leda HD)
  for (const model of GEMINI_TTS_MODELS) {
    for (const key of keysToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const payload = {
        contents: [{ parts: [{ text: speechText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        }
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        });
        const data = await res.json();
        if (data.error) {
          if (data.error.code === 429 || data.error.code === 401) {
            markKeyCooldown(key, 15 * 60 * 1000);
          }
          continue; // Try next key/model in pool!
        }
        const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          console.log(`[Gemini TTS] ✅ Successfully generated genuine Gemini ${voice} Voice (${audioData.length} chars) via ${model}`);
          return { audioBase64: audioData, mimeType: 'audio/wav', isGemini: true };
        }
      } catch (err) {
        markKeyCooldown(key, 5 * 60 * 1000);
      }
    }
  }

  // Normal / Robotic TTS has been completely removed per user instruction.
  console.warn('[Gemini TTS] All Gemini Voice keys temporarily busy.');
  return { audioBase64: null, mimeType: 'audio/wav', isGemini: false };
}

function buildSystemPrompt(sess, datasetText, userLang, userMessage) {
  const activeBiz = db.getActiveBusiness();
  const settings = db.getSettings();
  const storeName = sess.storeName || activeBiz.name || 'WEDDING ARTS';
  const customerName = sess.customerName || 'Customer';
  const dataset = (datasetText && datasetText.length > 50) ? datasetText : (activeBiz.dataset || BUILTIN_DATASET);

  // 1. Classify Customer Psychological Archetype
  const archetypeResult = CustomerArchetypeEngine.classify(userMessage || '');
  if (sess.customerPhone && archetypeResult.archetype !== 'GENERAL') {
    db.setChatArchetype(sess.customerPhone, archetypeResult.archetype);
  }

  // 2. Dynamic Upsell Directive
  const upsellDirective = SmartUpsellEngine.detectUpsellOpportunity(userMessage || '', db.getProducts(activeBiz.id));

  // 3. Dynamic Negotiation Directive
  const isNegotiating = SmartNegotiationEngine.isBargaining(userMessage || '');
  const negotiationDirective = isNegotiating ? SmartNegotiationEngine.getNegotiationDirective(1) : '';

  // 4. Persona Tone
  let personaInstruction = 'friendly, warm, respectful Sri Lankan customer care agent';
  if (settings.aiPersona === 'LUXURY_EXECUTIVE') {
    personaInstruction = 'sophisticated, prestigious luxury concierge agent with polite elite tone';
  } else if (settings.aiPersona === 'ENERGETIC_SALES') {
    personaInstruction = 'highly enthusiastic, proactive sales rep highlighting special limited-time offers';
  } else if (settings.aiPersona === 'DIRECT_CRISP') {
    personaInstruction = 'efficient, fast, direct and crystal-clear business representative';
  }

  return `You are "${settings.aiName || 'Nethmi'}", a ${personaInstruction} for "${storeName}".
Customer Name: "${customerName}".

=== LANGUAGE COMPREHENSION & RULES (100% MULTILINGUAL) ===
You must effortlessly understand the customer regardless of which language or format they speak:
1. PURE SINHALA (සිංහල අකුරින්): e.g. "මට ගණන් කියන්න", "ඩිලිවරි නොමිලේද?", "order එකක් දාන්නේ කොහොමද?"
2. SINGLISH (Sinhala written with Latin letters): e.g. "mata mila kiyanna", "delivery free da", "bank details ewanna", "order ekak danna puluwanda"
3. PURE ENGLISH: e.g. "What are the sizes and prices?", "Do you provide cash on delivery?", "Can I place an order?"
4. MIXED GREETINGS: e.g. "ආයි good morning", "Good morning machan", "Hello gana kiyanna"

CRITICAL OUTPUT RULES FOR VOICE SYNTHESIS (GEMINI LEDA VOICE):
- IF THE CUSTOMER SPEAKS IN ENGLISH: Reply in fluent, friendly, natural English.
- IF THE CUSTOMER SPEAKS IN SINHALA, SINGLISH, OR MIXED: Reply in NATURAL CONVERSATIONAL SPOKEN SINHALA SCRIPT (සිංහල අකුරින්).
  * CRITICAL REASON: The voice synthesizer reads English letters with an American English accent. If you reply in Latin Singlish, the voice sounds broken and unintelligible. When you reply in authentic Sinhala script (සිංහල අකුරින්), the Gemini Leda voice engine speaks with an authentic, sweet, crystal-clear Sri Lankan female voice! Therefore: NEVER output Latin Singlish — ALWAYS translate user Singlish intent into natural spoken Sinhala script!

--- OFFICIAL MASTER DATASET (PRODUCTS, SERVICES & EXACT PRICES) ---
${dataset}
--- END OFFICIAL MASTER DATASET ---

${archetypeResult.promptDirective}
${upsellDirective}
${negotiationDirective}

KEY RULES FOR CONVERSATION & SALES:
1. STRICT DATASET ACCURACY: Always quote ONLY the exact products, services, delivery policies, bank accounts, and prices given in the OFFICIAL MASTER DATASET above.
2. CONVERSATIONAL BREVITY: Keep answers to 1 to 2 natural spoken sentences (around 20-35 words maximum). Customers are listening on a live phone call or chat.
3. CONVERSATIONAL WARMTH: Speak warmly and respectfully like an authentic Sri Lankan customer service agent.
4. If order is confirmed, add this tag at the end:
   [[ORDER: name=${customerName}|item=ITEM_NAME|amount=TOTAL_RS]]`;
}

function checkForOrderTag(text, sess, sessionId) {
  const match = text.match(/\[\[ORDER:\s*([^\]]+)\]\]/);
  if (!match) return;

  const rawPairs = match[1];
  const fields = {};
  rawPairs.split('|').forEach(pair => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > -1) {
      fields[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
    }
  });

  console.log(`[order] Confirmed — session: ${sessionId}`, fields);

  // Automatically record order in Multi-Business Database
  const activeBiz = db.getActiveBusiness();
  const newOrder = db.addOrder({
    businessId: activeBiz.id,
    customerName: fields.name || sess.customerName || 'Customer',
    customerPhone: sess.customerPhone || '076 210 7801',
    item: fields.item || 'Custom Order',
    amount: fields.amount || '0',
    source: 'Live Voice Call',
    status: 'Pending Payment'
  });

  safeSend(sess.browserWs, JSON.stringify({ type: 'order_confirmed', order: fields, orderId: newOrder.id }));

  const token = WHATSAPP_TOKEN || sess.whatsappToken;
  const phoneId = WHATSAPP_PHONE_NUMBER_ID || sess.whatsappPhoneId;
  const customerPhone = sess.customerPhone;

  if (token && phoneId && customerPhone) {
    sendWhatsAppOrderConfirmation(token, phoneId, customerPhone, fields, activeBiz.name);
  }
}

async function sendWhatsAppOrderConfirmation(token, phoneId, toPhone, order, storeName) {
  const phone = toPhone.replace(/\D/g, '');
  const msg = `✅ *Order Confirmed!*\n\n🏪 *${storeName}*\n\n📦 *Item:* ${order.item || '-'}\n💰 *Total:* Rs. ${order.amount || '-'}\n👤 *Name:* ${order.name || '-'}\n\n_Thank you! Your live call order has been recorded._`;

  try {
    await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: msg },
      }),
    });
    console.log(`[whatsapp] Order confirmation sent to ${phone}`);
  } catch (e) {
    console.error(`[whatsapp] Failed to send order confirmation:`, e.message);
  }
}

function safeSend(ws, data) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
  } catch {}
}

// ─── Attach Handlers to WhatsApp Multi-Device Engine ────────────────────────
waEngine.setHandlers({
  aiReplyHandler: async (text, sess) => {
    return await getGeminiReply(text, sess);
  },
  orderCheckHandler: (text, sess, id) => {
    checkForOrderTag(text, sess, id);
  }
});

server.listen(PORT, () => {
  console.log(`\n🎙️  OmniSix Live Call Server running on port ${PORT}`);
  console.log(`📡  Call URL: ${CALL_SERVER_URL}/call?s=SESSION_ID`);
  console.log(`💚  Health:  ${CALL_SERVER_URL}/health\n`);

  // Start WhatsApp Multi-Device Web Engine
  waEngine.start();

  // Keep-alive self-ping to prevent cloud container sleep
  const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || (CALL_SERVER_URL.startsWith('http') && !CALL_SERVER_URL.includes('localhost') ? CALL_SERVER_URL : 'https://weddingarts-live-call.onrender.com');
  if (keepAliveUrl.startsWith('https://')) {
    const httpsModule = require('https');
    setInterval(() => {
      httpsModule.get(`${keepAliveUrl}/health`, () => {}).on('error', () => {});
    }, 10 * 60 * 1000); // Ping every 10 minutes
    console.log(`⏱️ Keep-alive self-ping configured for: ${keepAliveUrl}/health`);
  }
});
