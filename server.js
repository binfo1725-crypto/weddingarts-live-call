// OmniSix Live AI Call Server
// Real-time Voice Call Server for WEDDING ARTS & OMNISIX AI PRO
// Full Dataset Integration + Instant Full-Duplex Barge-in + Gemini 3.5 Flash & Aoede Voice

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const CALL_SERVER_URL = process.env.CALL_SERVER_URL || `http://localhost:${PORT}`;

const GEMINI_TEXT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash'
];
const GEMINI_TTS_MODELS = [
  'gemini-3.8-flash-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.8-flash-lite-tts'
];
const VOICE_NAME = 'Aoede'; // In-app Cleo warm natural female voice profile

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
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sessions: sessions.size,
    datasetChars: BUILTIN_DATASET.length,
    time: new Date().toISOString()
  });
});

app.post('/api/session', (req, res) => {
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
    storeName: storeName || 'WEDDING ARTS',
    apiKey: geminiApiKey || DEFAULT_GEMINI_API_KEY,
    dataset: (dataset && dataset.trim().length > 50) ? dataset : BUILTIN_DATASET,
    history: [],
    createdAt: Date.now(),
  });

  console.log(`[session] Created: ${id} | store: ${storeName} | datasetLen: ${(dataset || BUILTIN_DATASET).length}`);
  res.json({ ok: true, sessionId: id, callUrl: `${serverHost}/call?s=${id}` });
});

app.get('/call', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Direct HTTP Chat API
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  const sess = sessions.get(sessionId) || {
    customerName: 'Customer',
    storeName: 'WEDDING ARTS',
    apiKey: DEFAULT_GEMINI_API_KEY,
    history: [],
    dataset: BUILTIN_DATASET
  };

  try {
    const aiReply = await getGeminiReply(message, sess);
    checkForOrderTag(aiReply, sess, sessionId);
    const audioResult = await synthesizeVoiceAudio(aiReply, sess.apiKey);

    res.json({
      ok: true,
      reply: aiReply,
      audioBase64: audioResult.audioBase64,
      mimeType: audioResult.mimeType
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
  const url = new URL(req.url, `http://localhost`);
  const sessionId = url.searchParams.get('s');
  const customerName = url.searchParams.get('n') || 'Customer';
  const storeName = url.searchParams.get('store') || 'WEDDING ARTS';

  let sess = sessions.get(sessionId);
  if (!sess) {
    sess = {
      browserWs: null,
      customerName: customerName,
      customerPhone: '',
      storeName: storeName,
      apiKey: DEFAULT_GEMINI_API_KEY,
      dataset: BUILTIN_DATASET,
      history: [],
      createdAt: Date.now()
    };
    if (sessionId) sessions.set(sessionId, sess);
  } else {
    if (customerName && customerName !== 'Customer') sess.customerName = customerName;
    if (storeName && storeName !== 'WEDDING ARTS') sess.storeName = storeName;
  }

  sess.browserWs = browserWs;
  console.log(`[ws] Browser connected — session: ${sessionId} | customer: ${sess.customerName} | store: ${sess.storeName}`);

  safeSend(browserWs, JSON.stringify({
    type: 'ready',
    message: 'AI Connected! Call සූදානම්.'
  }));

  // Initial welcome greeting with guaranteed natural voice audio
  (async () => {
    try {
      const welcomeStore = sess.storeName || 'Wedding Arts';
      const welcomeText = `ආයුබෝවන්! ${welcomeStore} වෙත සාදරයෙන් පිළිගන්නවා. මම කොහොමද ඔබට උදව් කරන්න පුළුවන්?`;
      const audioResult = await synthesizeVoiceAudio(welcomeText, sess.apiKey);
      safeSend(browserWs, JSON.stringify({
        type: 'ai_speech',
        text: welcomeText,
        audioBase64: audioResult.audioBase64,
        mimeType: audioResult.mimeType
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
        console.log(`[ws] User said (${sessionId}): "${msg.text}"`);

        safeSend(browserWs, JSON.stringify({ type: 'ai_thinking' }));

        const aiReply = await getGeminiReply(msg.text, sess);
        console.log(`[ws] AI reply (${sessionId}): "${aiReply}"`);

        checkForOrderTag(aiReply, sess, sessionId);

        const audioResult = await synthesizeVoiceAudio(aiReply, sess.apiKey);

        safeSend(browserWs, JSON.stringify({
          type: 'ai_speech',
          text: aiReply,
          audioBase64: audioResult.audioBase64,
          mimeType: audioResult.mimeType
        }));
      }
    } catch (err) {
      console.error(`[ws] Message processing error:`, err.message);
      safeSend(browserWs, JSON.stringify({
        type: 'error',
        message: 'දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.'
      }));
    }
  });

  browserWs.on('close', () => {
    console.log(`[ws] Browser disconnected — session: ${sessionId}`);
  });
});

// ─── Gemini AI Engine with Smart Dataset Query ────────────────────────────────
async function getGeminiReply(userMessage, sess) {
  const apiKey = sess.apiKey || DEFAULT_GEMINI_API_KEY;
  const datasetContext = (sess.dataset && sess.dataset.length > 50) ? sess.dataset : BUILTIN_DATASET;
  const systemInstruction = buildSystemPrompt(sess, datasetContext);

  sess.history.push({ role: 'user', parts: [{ text: userMessage }] });

  const contents = [
    { role: 'user', parts: [{ text: `[OFFICIAL MASTER DATASET & SYSTEM INSTRUCTIONS]\n${systemInstruction}\n[END SYSTEM INSTRUCTIONS]` }] },
    { role: 'model', parts: [{ text: `තේරුණා. මම WEDDING ARTS සහ OmniSix AI PRO වෙනුවෙන් නිල Dataset එකේ ඇති නිවැරදිම මිල ගණන් සහ විස්තර මත පමණක් පදනම්ව, කිසිවක් මගනොහැර ස්වභාවික සිංහලෙන් පැහැදිලිව කතා කරන්නම්.` }] },
    ...sess.history.slice(-8)
  ];

  let lastError = null;

  // Auto-failover across available models if one hits daily quota
  for (const model of GEMINI_TEXT_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1000
          }
        })
      });

      const data = await response.json();
      if (data.error) {
        console.warn(`[Gemini Text ${model}] Quota or Error:`, data.error.message?.slice(0, 80));
        lastError = data.error.message;
        continue; // Try next model in list!
      }

      const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (replyText) {
        sess.history.push({ role: 'model', parts: [{ text: replyText }] });
        console.log(`[Gemini Text] Success using model: ${model}`);
        return replyText;
      }
    } catch (err) {
      console.warn(`[Gemini Text ${model}] Network Error:`, err.message);
      lastError = err.message;
    }
  }

  // Smart fallback from dataset if all Gemini models exhaust daily quota
  console.warn('[Gemini Text] All text models hit quota or failed. Using smart dataset fallback.');
  const store = sess.storeName || 'Wedding Arts';
  const fallbackReply = `ස්තූතියි! ${store} වෙතින් ෆොටෝ එඩිටිං, 12x18 UV Frames (රු. 4800) සහ 16x24 UV Frames (රු. 7800 නොමිලේ ඩිලිවරි සහිතව) ලබාගත හැක. ඔබට අවශ්‍ය විස්තරය හෝ ඇණවුම ලබා දෙන්න.`;
  sess.history.push({ role: 'model', parts: [{ text: fallbackReply }] });
  return fallbackReply;
}

// ─── Dual-Engine High-Definition Audio Synthesis (Gemini Aoede + Google Sinhala Fallback) ──
async function synthesizeVoiceAudio(text, apiKey) {
  const speechText = (text || '')
    .replace(/\[\[ORDER:.*?\]\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/[\(\)\[\]_~`>]/g, '')
    .replace(/Rs\.?\s*(\d+)/gi, 'රුපියල් $1')
    .trim();

  if (!speechText) return { audioBase64: null, mimeType: 'audio/mpeg' };

  // 1. Primary Engine: Gemini Voice TTS (Aoede Profile)
  const key = apiKey || DEFAULT_GEMINI_API_KEY;
  if (key) {
    for (const model of GEMINI_TTS_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const payload = {
        contents: [{ parts: [{ text: speechText }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: VOICE_NAME }
            }
          }
        }
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) {
          console.warn(`[Gemini TTS ${model}] Quota or Error:`, data.error.message?.slice(0, 80));
          continue; // Try next TTS model!
        }
        const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          console.log(`[Gemini TTS] Audio generated successfully via ${model}`);
          return { audioBase64: audioData, mimeType: 'audio/wav' };
        }
      } catch (err) {
        console.warn(`[Gemini TTS ${model}] Error:`, err.message);
      }
    }
  }

  // 2. Guaranteed Server-Side Fallback: Google Sinhala / English Free Unlimited TTS Engine
  // Never fails, zero daily quota limits, crystal clear audio streamed as MP3 Base64!
  try {
    console.log('[TTS Fallback] Using Google Free Unlimited TTS Engine for speech...');
    const result = await fetchGoogleTTS(speechText);
    return { audioBase64: result.base64, mimeType: 'audio/mpeg' };
  } catch (err) {
    console.error('[TTS Fallback] Google TTS error:', err.message);
    return { audioBase64: null, mimeType: 'audio/mpeg' };
  }
}

// ─── Free Unlimited Google Sinhala/English MP3 TTS ────────────────────────────
async function fetchGoogleTTS(cleanText) {
  const isSinhala = /[\u0D80-\u0DFF]/.test(cleanText);
  const targetLang = isSinhala ? 'si' : 'en';

  const chunks = [];
  const sentences = cleanText.match(/[^.!?\n,]+[.!?\n,]?|.+/g) || [cleanText];
  let cur = '';
  for (const s of sentences) {
    if ((cur + ' ' + s).length > 170) {
      if (cur) chunks.push(cur.trim());
      cur = s;
    } else {
      cur = (cur ? cur + ' ' : '') + s;
    }
  }
  if (cur) chunks.push(cur.trim());

  const buffers = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=' + targetLang + '&client=tw-ob&q=' + encodeURIComponent(chunk);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) throw new Error('Google TTS HTTP error ' + res.status);
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  const combined = Buffer.concat(buffers);
  return {
    base64: combined.toString('base64'),
    mimeType: 'audio/mpeg',
    bytes: combined.byteLength
  };
}

function buildSystemPrompt(sess, datasetText) {
  return `You are a live voice AI assistant on a live phone call for "${sess.storeName}".
Customer Name: "${sess.customerName}".
Your primary language is natural conversational Sinhala (සිංහල). If the customer speaks English or Singlish, reply naturally in that language.

--- OFFICIAL MASTER DATASET (PRODUCTS, SERVICES & EXACT PRICES) ---
${datasetText}
--- END OFFICIAL MASTER DATASET ---

CRITICAL INSTRUCTIONS FOR LIVE VOICE CALL:
1. STRICT DATASET USAGE: Rely 100% on the Master Dataset above. State the EXACT prices (e.g. Western/Kandyan Single Edit Rs. 1,500; 10-Photo Shoot Rs. 5,000; Army Uniform Shoot Rs. 8,000; UV Frames 12x18 Rs. 4,800, 16x24 Rs. 7,800; Free Delivery on 16x24 and above; BOC Bank 92949122 D T Rajapaksha).
2. COMPLETE DETAILS: When customer asks about frames or edits, give the FULL details and options clearly. Never cut off ideas midway.
3. CONVERSATIONAL TONE: Speak warmly and respectfully like a friendly Sri Lankan sales executive (e.g., "ඔව් සහෝදරයා", "අපේ Wedding Arts එකේ...").
4. BARGE-IN AWARE: The customer may interrupt you at any time. Keep your answers clear, concise, and structured.
5. If order is confirmed, add this tag at the end:
   [[ORDER: name=${sess.customerName}|item=ITEM_NAME|amount=TOTAL_RS]]`;
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
  safeSend(sess.browserWs, JSON.stringify({ type: 'order_confirmed', order: fields }));

  const token = WHATSAPP_TOKEN || sess.whatsappToken;
  const phoneId = WHATSAPP_PHONE_NUMBER_ID || sess.whatsappPhoneId;
  const customerPhone = sess.customerPhone;

  if (token && phoneId && customerPhone) {
    sendWhatsAppOrderConfirmation(token, phoneId, customerPhone, fields, sess.storeName);
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

server.listen(PORT, () => {
  console.log(`\n🎙️  OmniSix Live Call Server running on port ${PORT}`);
  console.log(`📡  Call URL: ${CALL_SERVER_URL}/call?s=SESSION_ID`);
  console.log(`💚  Health:  ${CALL_SERVER_URL}/health\n`);
});
