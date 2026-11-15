// OmniSix Live AI Call Server
// Real-time Voice Call Server for WEDDING ARTS
// Browser Mic <-> Node.js <-> Gemini 3.5 Flash (Complete Details) <-> Gemini Voice AI (Aoede/Cleo Audio Stream)

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const CALL_SERVER_URL = process.env.CALL_SERVER_URL || `http://localhost:${PORT}`;

const GEMINI_TEXT_MODEL = 'gemini-3.5-flash';
const GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const VOICE_NAME = 'Aoede'; // Natural warm Sri Lankan female voice profile (Cleo)

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
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size, time: new Date().toISOString() });
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
    dataset: dataset || '',
    history: [],
    createdAt: Date.now(),
  });

  console.log(`[session] Created: ${id} | store: ${storeName} | customer: ${customerName}`);
  res.json({ ok: true, sessionId: id, callUrl: `${serverHost}/call?s=${id}` });
});

app.get('/call', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Direct HTTP Chat API with Gemini Audio Generation
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  const sess = sessions.get(sessionId) || {
    customerName: 'Customer',
    storeName: 'WEDDING ARTS',
    apiKey: DEFAULT_GEMINI_API_KEY,
    history: [],
    dataset: ''
  };

  try {
    const aiReply = await getGeminiReply(message, sess);
    checkForOrderTag(aiReply, sess, sessionId);

    // Generate Natural Human Voice via Gemini TTS Engine (App Audio Engine)
    const audioBase64 = await synthesizeGeminiAudio(aiReply, sess.apiKey);

    res.json({
      ok: true,
      reply: aiReply,
      audioBase64: audioBase64 // Base64 WAV audio stream
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

  let sess = sessions.get(sessionId);
  if (!sess) {
    sess = {
      browserWs: null,
      customerName: 'Customer',
      customerPhone: '',
      storeName: 'WEDDING ARTS',
      apiKey: DEFAULT_GEMINI_API_KEY,
      dataset: '',
      history: [],
      createdAt: Date.now()
    };
    if (sessionId) sessions.set(sessionId, sess);
  }

  sess.browserWs = browserWs;
  console.log(`[ws] Browser connected — session: ${sessionId}`);

  safeSend(browserWs, JSON.stringify({
    type: 'ready',
    message: 'AI Connected! Call සූදානම්.'
  }));

  // Initial welcome greeting with natural audio
  (async () => {
    try {
      const welcomeText = `ආයුබෝවන්! Wedding Arts වෙත සාදරයෙන් පිළිගන්නවා. මම කොහොමද ඔබට උදව් කරන්න පුළුවන්?`;
      const audioBase64 = await synthesizeGeminiAudio(welcomeText, sess.apiKey);
      safeSend(browserWs, JSON.stringify({
        type: 'ai_speech',
        text: welcomeText,
        audioBase64: audioBase64
      }));
    } catch (e) {
      console.warn('[welcome] greeting failed:', e.message);
    }
  })();

  browserWs.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'user_speech' && msg.text) {
        console.log(`[ws] User said (${sessionId}): "${msg.text}"`);

        safeSend(browserWs, JSON.stringify({ type: 'ai_thinking' }));

        // 1. Get FULL complete response from Gemini Text Model
        const aiReply = await getGeminiReply(msg.text, sess);
        console.log(`[ws] AI reply (${sessionId}): "${aiReply}"`);

        checkForOrderTag(aiReply, sess, sessionId);

        // 2. Synthesize with natural female voice (Aoede)
        const audioBase64 = await synthesizeGeminiAudio(aiReply, sess.apiKey);

        safeSend(browserWs, JSON.stringify({
          type: 'ai_speech',
          text: aiReply,
          audioBase64: audioBase64
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

// ─── Gemini AI Engine (Full Uncut Details) ────────────────────────────────────
async function getGeminiReply(userMessage, sess) {
  const apiKey = sess.apiKey || DEFAULT_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`;

  const systemInstruction = buildSystemPrompt(sess);

  sess.history.push({ role: 'user', parts: [{ text: userMessage }] });

  const contents = [
    { role: 'user', parts: [{ text: `[SYSTEM CONTEXT & KNOWLEDGE]\n${systemInstruction}\n[END SYSTEM CONTEXT]` }] },
    { role: 'model', parts: [{ text: `හරි, මම ${sess.storeName} වෙනුවෙන් සියලු විස්තර සහ මිල ගණන් ඉතාම පැහැදිලිව, මැදින් නොකැඩෙන පරිදි සම්පූර්ණ වාක්‍ය වලින් ස්වභාවික සිංහලෙන් කියන්නම්.` }] },
    ...sess.history.slice(-8)
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: contents,
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 1000 // FULL details without cutting in the middle
      }
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Gemini API Error');

  const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'කණගාටුයි, මට පැහැදිලි වුණේ නෑ. කරුණාකර නැවත කියන්න.';
  sess.history.push({ role: 'model', parts: [{ text: replyText }] });

  return replyText;
}

// ─── Gemini Voice Audio Synthesis (Natural Sri Lankan Female Voice) ──────────
async function synthesizeGeminiAudio(text, apiKey) {
  const key = apiKey || DEFAULT_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${key}`;

  // Clean text for speech pronunciation
  const speechText = text
    .replace(/\[\[ORDER:.*?\]\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/[\(\)\[\]_~`>]/g, '')
    .replace(/Rs\.?\s*(\d+)/gi, 'රුපියල් $1')
    .trim();

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
    return data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (err) {
    console.error('[Gemini TTS] Error:', err.message);
    return null;
  }
}

function buildSystemPrompt(sess) {
  const datasetSection = sess.dataset
    ? `\n\n--- Store Information & Price List ---\n${sess.dataset}\n--- End of Store Information ---`
    : `
Store: WEDDING ARTS
Owner: D T Rajapaksha (Tharindu)
BOC Bank: 92949122
Contact: 076 210 7801

SERVICES & COMPLETE PRICE DIRECTORY:
- Single Photo Retouch / Edit: Rs. 1,500
- 10-Photo Complete Wedding / Function Shoot Retouch: Rs. 12,000
- UV Frame Sets:
  * 8x12 UV Frame: Rs. 4,500
  * 12x18 UV Frame: Rs. 7,500
  * 16x24 UV Frame: Rs. 12,500
  * 20x30 UV Frame: Rs. 18,500
- 3-Panel Wall Frame Sets: Rs. 14,000 සිට Rs. 34,000 දක්වා (විශාල Wall Decor)
- Island-wide Safe Courier Delivery: Rs. 450
- Bank Account: BOC (Bank of Ceylon) - 92949122 (D T Rajapaksha)
`;

  return `You are speaking directly with a customer named "${sess.customerName}" on a live voice phone call for "${sess.storeName}".
LANGUAGE: Conversational natural Sinhala (සිංහල). If the customer speaks English or Singlish, reply naturally in that language.

CRITICAL INSTRUCTIONS FOR VOICE CALL:
1. GIVE COMPLETE INFORMATION: Always answer customer questions with COMPLETE details. Never cut off thoughts midway. Complete every sentence clearly and properly.
2. PRICE QUESTIONS: Clearly state exact prices, frame dimensions, and delivery charges. Do not leave prices vague.
3. CONVERSATIONAL TONE: Speak warmly, professionally, and respectfully like a friendly Sri Lankan sales manager (e.g., "ඔව් සහෝදරයා/සහෝදරිය", "අපේ UV Frame එක ගැන විස්තර මෙහෙමයි...").
4. CLOSING SALES: If the customer is satisfied, explain how to send photos via WhatsApp and confirm the order.
5. If order is confirmed, add this tag at the end:
   [[ORDER: name=${sess.customerName}|item=ITEM_NAME|amount=TOTAL_RS]]
${datasetSection}`;
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
