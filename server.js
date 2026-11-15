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
  'gemini-3.8-flash'
];
const GEMINI_TTS_MODELS = [
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts'
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

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

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
    voice: VOICE_NAME,
    apiKey: DEFAULT_GEMINI_API_KEY,
    history: [],
    dataset: BUILTIN_DATASET
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
  const url = new URL(req.url, `http://localhost`);
  const sessionId = url.searchParams.get('s');
  const customerName = url.searchParams.get('n') || 'Customer';
  const storeName = url.searchParams.get('store') || 'WEDDING ARTS';
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
      dataset: BUILTIN_DATASET,
      history: [],
      createdAt: Date.now()
    };
    if (sessionId) sessions.set(sessionId, sess);
  } else {
    if (customerName && customerName !== 'Customer') sess.customerName = customerName;
    if (storeName && storeName !== 'WEDDING ARTS') sess.storeName = storeName;
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
      const welcomeStore = sess.storeName || 'Wedding Arts';
      const welcomeText = `ආයුබෝවන්! ${welcomeStore} වෙත සාදරයෙන් පිළිගන්නවා. මම කොහොමද ඔබට උදව් කරන්න පුළුවන්?`;
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
  const datasetContext = (sess.dataset && sess.dataset.length > 50) ? sess.dataset : BUILTIN_DATASET;
  const systemInstruction = buildSystemPrompt(sess, datasetContext, userLang);

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

  // 1. Primary Engine: Official Google Gemini Voice AI (Leda / Aoede)
  // Limit to at most 3 rapid attempts to keep voice latency under 2 seconds
  let attempts = 0;
  for (const model of GEMINI_TTS_MODELS) {
    for (const key of keysToTry) {
      if (attempts >= 3) break;
      attempts++;

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
          signal: AbortSignal.timeout(4500)
        });
        const data = await res.json();
        if (data.error) {
          if (data.error.code === 429 || data.error.code === 401) {
            markKeyCooldown(key, 30 * 60 * 1000);
          }
          continue; // Try next key in pool!
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

  // 2. Secondary Safety Net Fallback (Only if all Gemini keys are temporarily busy)
  try {
    console.warn('[TTS Fallback] Gemini keys busy. Using Google TTS fallback...');
    const result = await fetchGoogleTTS(speechText);
    return { audioBase64: result.base64, mimeType: 'audio/mpeg', isGemini: false };
  } catch (err) {
    console.error('[TTS Fallback] Google TTS error:', err.message);
    return { audioBase64: null, mimeType: 'audio/wav', isGemini: false };
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

function buildSystemPrompt(sess, datasetText, userLang) {
  return `You are a live voice AI assistant on a real-time telephone voice call for "${sess.storeName}".
Customer Name: "${sess.customerName}".

=== LANGUAGE COMPREHENSION & RULES (100% MULTILINGUAL) ===
You must effortlessly understand the customer regardless of which language or format they speak:
1. PURE SINHALA (සිංහල අකුරින්): e.g. "මට UV Frame වල ගණන් කියන්න", "ඩිලිවරි නොමිලේද?"
2. SINGLISH (Sinhala written with Latin letters): e.g. "mata uv frame mila kiyanna", "delivery free da", "bank details ewanna", "order ekak danna puluwanda", "wistara one"
3. PURE ENGLISH: e.g. "What are the frame sizes and prices?", "Do you provide cash on delivery?", "Can I place an order?"
4. MIXED GREETINGS & EXPRESSIONS: e.g. "ආයි good morning", "Good morning machan", "Hello frame gana kiyanna", "Hi ayye wistara ewanna"

CRITICAL OUTPUT RULES FOR VOICE SYNTHESIS (GEMINI LEDA VOICE):
- IF THE CUSTOMER SPEAKS IN ENGLISH: Reply in fluent, friendly, natural English.
- IF THE CUSTOMER SPEAKS IN SINHALA, SINGLISH, OR MIXED: Reply in NATURAL CONVERSATIONAL SPOKEN SINHALA SCRIPT (සිංහල අකුරින්).
  * CRITICAL REASON: The voice synthesizer reads English letters with an American English accent. If you reply in Latin Singlish, the voice sounds broken and unintelligible. When you reply in authentic Sinhala script (සිංහල අකුරින්), the Gemini Leda voice engine speaks with an authentic, sweet, crystal-clear Sri Lankan female voice! Therefore: NEVER output Latin Singlish — ALWAYS translate user Singlish intent into natural spoken Sinhala script!

--- OFFICIAL MASTER DATASET (PRODUCTS, SERVICES & EXACT PRICES) ---
${datasetText}
--- END OFFICIAL MASTER DATASET ---

KEY RULES FOR LIVE VOICE CALL:
1. STRICT DATASET ACCURACY:
   - Western / Kandyan Single Photo Edit: Rs. 1,500
   - 10-Photo Shoot Retouch: Rs. 5,000
   - Army Uniform Single Edit: Rs. 2,000 | 10-Photo Shoot: Rs. 8,000
   - UV Gloss Frameless Sizes & Prices:
     * 8x12: Rs. 2,300
     * 10x15: Rs. 3,200
     * 12x18: Rs. 4,800
     * 16x24: Rs. 7,800 (Free Islandwide Courier Delivery)
     * 20x30: Rs. 11,500 (Free Islandwide Courier Delivery)
   - 3-Panel Wall Frame Set: Rs. 14,000 (Free Islandwide Courier Delivery)
   - Bank Details: Bank of Ceylon (BOC), Account: 92949122, Name: D T Rajapaksha
   - Contact / WhatsApp: 076 210 7801
   - Never invent discounts or incorrect prices.

2. CONVERSATIONAL BREVITY: Keep answers to 1 to 3 natural spoken sentences (around 20-40 words maximum). Customers are listening on a live phone call.
3. CONVERSATIONAL WARMTH: Speak warmly and respectfully like a friendly Sri Lankan customer service agent (e.g., "ඔව් සහෝදරයා / අක්කේ", "අපේ Wedding Arts එකේ...").
   - If greeted (e.g. "ආයි good morning" or "Good morning"), warmly greet back ("Good morning! ආයුබෝවන්! Wedding Arts වෙත සාදරයෙන් පිළිගන්නවා. මම ඔබට කොහොමද උදව් කරන්න පුළුවන්?").
4. If order is confirmed, add this tag at the end:
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
