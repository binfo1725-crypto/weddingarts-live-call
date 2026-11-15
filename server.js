// OmniSix Live AI Call Server
// Real-time Voice Call Server for WEDDING ARTS
// Browser Mic (SpeechRecognition) <-> Node.js <-> Gemini 3.5 Flash <-> Browser TTS (Audio Speech Synthesis)

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

const GEMINI_MODEL = 'gemini-3.5-flash';

// ─── Session Store ───────────────────────────────────────────────────────────
// sessionId -> { browserWs, customerPhone, customerName, storeName, apiKey, history, dataset, createdAt }
const sessions = new Map();

// Clean expired sessions every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.createdAt > 60 * 60 * 1000) { // 1 hour TTL
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size, time: new Date().toISOString() });
});

// Android app pre-creates session
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

// Serve call page
app.get('/call', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Direct HTTP Chat API fallback
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
    const cleanSpeech = cleanTextForSpeech(aiReply);
    res.json({ ok: true, reply: aiReply, speechText: cleanSpeech });
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
    // Auto-create ad-hoc session so direct link testing works
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

  // Send initial ready & welcome greeting
  safeSend(browserWs, JSON.stringify({
    type: 'ready',
    message: 'AI Connected! Call සූදානම්.'
  }));

  // Trigger natural voice welcome from AI
  (async () => {
    try {
      const welcomePrompt = `The customer named "${sess.customerName}" just connected to the live call. Give a brief, warm 1-sentence greeting in natural spoken Sinhala welcoming them to ${sess.storeName} and asking how you can help. Keep it under 15 words.`;
      const welcomeText = await getGeminiReply(welcomePrompt, sess, true);
      const cleanSpeech = cleanTextForSpeech(welcomeText);
      safeSend(browserWs, JSON.stringify({
        type: 'ai_speech',
        text: welcomeText,
        speechText: cleanSpeech
      }));
    } catch (e) {
      console.warn('[welcome] greeting failed:', e.message);
    }
  })();

  // Handle message from browser
  browserWs.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'user_speech' && msg.text) {
        console.log(`[ws] User said (${sessionId}): "${msg.text}"`);

        // Send thinking state
        safeSend(browserWs, JSON.stringify({ type: 'ai_thinking' }));

        // Call Gemini
        const aiReply = await getGeminiReply(msg.text, sess);
        console.log(`[ws] AI reply (${sessionId}): "${aiReply}"`);

        // Check for order tag
        checkForOrderTag(aiReply, sess, sessionId);

        // Prepare clean text for browser voice synthesis (remove asterisks, brackets, formatting)
        const cleanSpeech = cleanTextForSpeech(aiReply);

        safeSend(browserWs, JSON.stringify({
          type: 'ai_speech',
          text: aiReply,
          speechText: cleanSpeech
        }));
      } else if (msg.type === 'end_call') {
        console.log(`[ws] User ended call — session: ${sessionId}`);
      }
    } catch (err) {
      console.error(`[ws] Message processing error:`, err.message);
      safeSend(browserWs, JSON.stringify({
        type: 'error',
        message: 'ප්‍රතිචාරය ලබාගැනීමේදී දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.'
      }));
    }
  });

  browserWs.on('close', () => {
    console.log(`[ws] Browser disconnected — session: ${sessionId}`);
  });

  browserWs.on('error', (err) => {
    console.error(`[ws] Browser WS error:`, err.message);
  });
});

// ─── Gemini AI Engine ────────────────────────────────────────────────────────
async function getGeminiReply(userMessage, sess, isInternal = false) {
  const apiKey = sess.apiKey || DEFAULT_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const systemInstruction = buildSystemPrompt(sess);

  // Maintain conversation history (last 8 turns for context)
  if (!isInternal) {
    sess.history.push({ role: 'user', parts: [{ text: userMessage }] });
  }

  const contents = [
    { role: 'user', parts: [{ text: `[SYSTEM CONTEXT & KNOWLEDGE]\n${systemInstruction}\n[END SYSTEM CONTEXT]` }] },
    { role: 'model', parts: [{ text: `හරි, මම ${sess.storeName} වෙනුවෙන් ඉතාම සුහදශීලීව, ස්වභාවික සිංහලෙන් කෙටි පැහැදිලි උත්තර ලබා දෙන්නම්.` }] },
    ...sess.history.slice(-8)
  ];

  if (isInternal) {
    contents.push({ role: 'user', parts: [{ text: userMessage }] });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 250
      }
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Gemini API Error');
  }

  const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'කණගාටුයි, මට පැහැදිලි වුණේ නෑ. නැවත කියන්න පුළුවන්ද?';

  if (!isInternal) {
    sess.history.push({ role: 'model', parts: [{ text: replyText }] });
  }

  return replyText;
}

function cleanTextForSpeech(text) {
  return text
    .replace(/\[\[ORDER:.*?\]\]/g, '') // Remove order tags
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove markdown bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italics
    .replace(/#+\s*/g, '') // Remove headings
    .replace(/[\(\)\[\]_~`>]/g, '') // Remove punctuation brackets
    .replace(/Rs\.?\s*(\d+)/gi, 'රුපියල් $1') // Speak 'Rs.' as 'රුපියල්'
    .replace(/\n+/g, ' ')
    .trim();
}

function buildSystemPrompt(sess) {
  const datasetSection = sess.dataset
    ? `\n\n--- Store Information & Price List ---\n${sess.dataset}\n--- End of Store Information ---`
    : `
Store: WEDDING ARTS
Owner: D T Rajapaksha (Tharindu)
BOC Bank: 92949122
Contact: 076 210 7801
Services & Prices:
- Single Photo Edit: Rs. 1,500
- 10-Photo Shoot Retouch: Rs. 12,000
- UV Frame Sets: Rs. 4,500 - Rs. 18,500
- 3-Panel Wall Sets: Rs. 14,000 - Rs. 34,000
- Island-wide Courier Delivery: Rs. 450
`;

  return `You are a live voice AI assistant on a live phone call for "${sess.storeName}".
Customer Name: "${sess.customerName}".
Your primary language is Sinhala (සිංහල). If the customer speaks English or Singlish, answer naturally in that language.

KEY RULES FOR LIVE VOICE CALL:
1. Speak warmly and naturally, like a friendly Sri Lankan customer service agent.
2. Keep answers SHORT and punchy (1 to 2 sentences maximum) because this is being spoken out loud to the customer.
3. If they ask about prices, state the exact price clearly from the price list.
4. If they agree to order, confirm the total price and ask for their address.
5. Once an order is agreed, add this silent tag at the end of your response:
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

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🎙️  OmniSix Live Call Server running on port ${PORT}`);
  console.log(`📡  Call URL: ${CALL_SERVER_URL}/call?s=SESSION_ID`);
  console.log(`💚  Health:  ${CALL_SERVER_URL}/health\n`);
});
