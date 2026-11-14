// OmniSix Live AI Call Server
// WebSocket bridge: Browser mic audio <-> Gemini Live API
// (c) 2026 OmniSix / WEDDING ARTS

require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const CALL_SERVER_URL = process.env.CALL_SERVER_URL || `http://localhost:${PORT}`;

const GEMINI_LIVE_WSS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const GEMINI_MODEL = 'models/gemini-2.0-flash-live-001';

// ─── Session Store ───────────────────────────────────────────────────────────
// sessionId -> { geminiWs, browserWs, customerPhone, customerName, storeName, apiKey, orderBuffer, dataset, createdAt }
const sessions = new Map();

// Clean expired sessions every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.createdAt > 60 * 60 * 1000) { // 1 hour TTL
      try { s.geminiWs && s.geminiWs.close(); } catch {}
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

  // Use Render external URL if available, else configured URL
  const serverHost = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
    ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
    : CALL_SERVER_URL;

  const id = sessionId;
  sessions.set(id, {
    geminiWs: null,
    browserWs: null,
    customerName: customerName || 'Customer',
    customerPhone: customerPhone || '',
    storeName: storeName || 'WEDDING ARTS',
    apiKey: geminiApiKey || DEFAULT_GEMINI_API_KEY,
    dataset: dataset || '',
    orderBuffer: '',
    createdAt: Date.now(),
  });

  console.log(`[session] Created: ${id} | store: ${storeName} | customer: ${customerName}`);
  res.json({ ok: true, sessionId: id, callUrl: `${serverHost}/call?s=${id}` });
});

// Serve call page — also allows GET /call?s=SESSION_ID
app.get('/call', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── HTTP Server ─────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── WebSocket Server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (browserWs, req) => {
  const url = new URL(req.url, `http://localhost`);
  const sessionId = url.searchParams.get('s');

  if (!sessionId || !sessions.has(sessionId)) {
    console.warn(`[ws] Unknown session: ${sessionId}`);
    browserWs.send(JSON.stringify({ type: 'error', message: 'Invalid or expired session.' }));
    browserWs.close();
    return;
  }

  const sess = sessions.get(sessionId);

  // If browser already connected (reconnect), close old
  if (sess.browserWs && sess.browserWs.readyState === WebSocket.OPEN) {
    sess.browserWs.close();
  }
  sess.browserWs = browserWs;

  console.log(`[ws] Browser connected — session: ${sessionId}`);

  // ── Open Gemini Live API WebSocket ─────────────────────────────────────────
  const geminiUrl = `${GEMINI_LIVE_WSS}?key=${sess.apiKey}`;
  const geminiWs = new WebSocket(geminiUrl);
  sess.geminiWs = geminiWs;

  // Build system prompt
  const systemPrompt = buildSystemPrompt(sess);

  geminiWs.on('open', () => {
    console.log(`[gemini] Connected — session: ${sessionId}`);

    // Send BidiGenerateContent setup message
    const setupMsg = {
      setup: {
        model: GEMINI_MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      }
    };
    geminiWs.send(JSON.stringify(setupMsg));
    console.log(`[gemini] Setup sent — session: ${sessionId}`);

    // Notify browser that call is ready
    safeSend(browserWs, JSON.stringify({ type: 'ready', message: 'AI connected. Start speaking!' }));
  });

  geminiWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // ── Audio output from Gemini → send binary to browser ──────────────
      const parts = msg?.serverContent?.modelTurn?.parts;
      if (parts) {
        for (const part of parts) {
          if (part?.inlineData?.mimeType?.startsWith('audio/pcm') && part.inlineData.data) {
            // Send raw binary PCM 24kHz to browser
            const pcmBuf = Buffer.from(part.inlineData.data, 'base64');
            if (browserWs.readyState === WebSocket.OPEN) {
              browserWs.send(pcmBuf);
            }
          }
          if (part?.text) {
            // Forward transcript text to browser
            safeSend(browserWs, JSON.stringify({ type: 'transcript', text: part.text }));
            // Check for order confirmation tag
            checkForOrderTag(part.text, sess, sessionId);
          }
        }
      }

      // Turn complete
      if (msg?.serverContent?.turnComplete) {
        safeSend(browserWs, JSON.stringify({ type: 'turn_complete' }));
      }

      // Setup complete ack
      if (msg?.setupComplete) {
        console.log(`[gemini] Setup complete — session: ${sessionId}`);
      }

      // Tool call (function call) from Gemini
      if (msg?.toolCall) {
        handleGeminiToolCall(msg.toolCall, sess, sessionId, geminiWs);
      }

    } catch (e) {
      console.error(`[gemini] Parse error — session: ${sessionId}:`, e.message);
    }
  });

  geminiWs.on('close', (code, reason) => {
    const reasonStr = reason ? reason.toString() : '';
    console.log(`[gemini] Disconnected — session: ${sessionId} | code: ${code} | reason: ${reasonStr}`);
    
    let errorMsg = 'Call ended.';
    if (code === 1007 || reasonStr.toLowerCase().includes('api key') || reasonStr.toLowerCase().includes('quota')) {
      errorMsg = '⚠️ Gemini API Key invalid or expired. Check server settings.';
    }
    safeSend(browserWs, JSON.stringify({ type: 'ended', message: errorMsg, reason: reasonStr }));
  });

  geminiWs.on('error', (err) => {
    console.error(`[gemini] Error — session: ${sessionId}:`, err.message);
    safeSend(browserWs, JSON.stringify({ type: 'error', message: 'AI connection error. Please try again.' }));
  });

  // ── Browser → Gemini audio forwarding ─────────────────────────────────────
  browserWs.on('message', (data, isBinary) => {
    if (!isBinary) {
      // Text control messages from browser
      try {
        const ctrl = JSON.parse(data.toString());
        if (ctrl.type === 'end_call') {
          console.log(`[ws] Browser ended call — session: ${sessionId}`);
          geminiWs.close();
        }
      } catch {}
      return;
    }

    // Binary = PCM 16kHz audio from browser mic
    if (geminiWs.readyState === WebSocket.OPEN) {
      const b64 = data.toString('base64');
      const audioMsg = {
        realtimeInput: {
          mediaChunks: [{
            mimeType: 'audio/pcm;rate=16000',
            data: b64
          }]
        }
      };
      geminiWs.send(JSON.stringify(audioMsg));
    }
  });

  browserWs.on('close', () => {
    console.log(`[ws] Browser disconnected — session: ${sessionId}`);
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close();
    }
  });

  browserWs.on('error', (err) => {
    console.error(`[ws] Browser WS error — session: ${sessionId}:`, err.message);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeSend(ws, data) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
  } catch {}
}

function buildSystemPrompt(sess) {
  const datasetSection = sess.dataset
    ? `\n\n--- Store Information & Price List ---\n${sess.dataset}\n--- End of Store Information ---`
    : '';

  return `You are a friendly, helpful AI voice assistant for "${sess.storeName}".
You are speaking with a customer named "${sess.customerName}" via a live voice call.
Your job is to answer their questions about products, services, and prices, help them place an order, and confirm order details.

LANGUAGE: Speak naturally in Sinhala (සිංහල) or English depending on what the customer uses. Mix both if needed.
TONE: Warm, professional, helpful. Keep answers concise and clear for voice.
${datasetSection}

ORDERING: When a customer confirms they want to place an order:
1. Confirm the order items and total price clearly
2. Ask for their name and delivery address if not known
3. Once all details are confirmed, output EXACTLY this tag on its own line:
   [[ORDER: name=${sess.customerName}|phone=${sess.customerPhone}|item=ITEM_NAME|amount=TOTAL_RS|note=ANY_NOTE]]
4. Then tell the customer their order is confirmed and they'll receive a WhatsApp confirmation.

IMPORTANT:
- Never make up prices — only use prices from the Store Information above
- If asked something you don't know, say you'll have the team follow up
- Keep each spoken response under 3 sentences for natural conversation flow
- Do not read out the [[ORDER:...]] tag aloud — it's a background signal only`;
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

  // Notify browser
  safeSend(sess.browserWs, JSON.stringify({ type: 'order_confirmed', order: fields }));

  // Send WhatsApp confirmation if token available
  const token = WHATSAPP_TOKEN || sess.whatsappToken;
  const phoneId = WHATSAPP_PHONE_NUMBER_ID || sess.whatsappPhoneId;
  const customerPhone = sess.customerPhone;

  if (token && phoneId && customerPhone) {
    sendWhatsAppOrderConfirmation(token, phoneId, customerPhone, fields, sess.storeName);
  }
}

function handleGeminiToolCall(toolCall, sess, sessionId, geminiWs) {
  // Reserved for future Gemini function-calling tools
  console.log(`[gemini] Tool call received — session: ${sessionId}`, toolCall);
}

async function sendWhatsAppOrderConfirmation(token, phoneId, toPhone, order, storeName) {
  const { fetch } = await import('node-fetch');
  const phone = toPhone.replace(/\D/g, '');
  const msg = `✅ *Order Confirmed!*\n\n🏪 *${storeName}*\n\n📦 *Item:* ${order.item || '-'}\n💰 *Total:* Rs. ${order.amount || '-'}\n👤 *Name:* ${order.name || '-'}\n📍 *Note:* ${order.note || '-'}\n\n_Thank you for your order! Our team will contact you shortly._`;

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
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
    const json = await res.json();
    console.log(`[whatsapp] Order confirmation sent to ${phone}:`, json);
  } catch (e) {
    console.error(`[whatsapp] Failed to send order confirmation:`, e.message);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🎙️  OmniSix Live Call Server running on port ${PORT}`);
  console.log(`📡  Call URL: ${CALL_SERVER_URL}/call?s=SESSION_ID`);
  console.log(`💚  Health:  ${CALL_SERVER_URL}/health\n`);
});
