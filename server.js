
function renderFollowUpTemplate(template, lead, biz) {
  const hasRealName = lead.customerName && lead.customerName !== 'Customer' && !/^\d+$/.test(lead.customerName);
  const customerGreeting = hasRealName ? lead.customerName : 'ඔබ';
  const prodName = lead.productName || 'භාණ්ඩය';

  let rendered = template
    .replace(/{customer}/gi, customerGreeting)
    .replace(/{name}/gi, customerGreeting)
    .replace(/{store}/gi, biz.name || 'OmniSix Store')
    .replace(/{product}/gi, prodName)
    .replace(/{inquiry}/gi, (lead.lastInquiryText || '').replace(/^[\u{1F300}-\u{1F9FF}]\s*/u, '').slice(0, 50));

  rendered = rendered.replace(/\*\s*\*|\*\*/g, '').replace(/Hi\s*!\s*👋/i, 'Hi! 👋');
  return rendered;
}

// OmniSix Live AI Call Server
// Real-time Voice Call Server for WEDDING ARTS & OMNISIX AI PRO
// Full Dataset Integration + Instant Full-Duplex Barge-in + Gemini 3.5 Flash & Aoede Voice

require('dotenv').config();

// ─── Top-Level Crash Resilience & Process Guards ─────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL-GUARD] Uncaught Exception caught by top-level handler:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL-GUARD] Unhandled Promise Rejection at:', promise, 'reason:', reason && reason.stack ? reason.stack : reason);
});

let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 [SYSTEM] ${signal} signal received. Initiating enterprise graceful shutdown...`);

  const forceTimer = setTimeout(() => {
    console.error('⚠️ [SYSTEM] Graceful shutdown timeout (10s). Forcing process exit.');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    if (typeof server !== 'undefined' && server && server.close) {
      server.close(() => console.log('✅ [SYSTEM] HTTP & WebSocket servers stopped accepting new connections.'));
    }
  } catch (_) {}

  try {
    for (const [id, s] of sessions.entries()) {
      try {
        if (s.browserWs && s.browserWs.readyState === WebSocket.OPEN) {
          s.browserWs.close(1001, 'Server shutting down');
        }
      } catch (_) {}
    }
  } catch (_) {}

  try {
    console.log('💾 [SYSTEM] Flushing state to MongoDB Atlas...');
    await db.syncToMongo();
    if (waEngine && waEngine.manager) {
      for (const acc of waEngine.manager.sessions.values()) {
        try {
          await db.backupBaileysAuthToMongo(acc.id, acc.authDir);
        } catch (_) {}
      }
    }
    console.log('✅ [SYSTEM] All database state and credentials flushed.');
  } catch (err) {
    console.error('⚠️ [SYSTEM] Error flushing state on shutdown:', err.message);
  }

  if (db.mongoClient) {
    try {
      await db.mongoClient.close();
      console.log('✅ [SYSTEM] MongoDB connection closed cleanly.');
    } catch (_) {}
  }

  console.log('🏁 [SYSTEM] Enterprise Graceful Shutdown completed. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db.js');
const mediaStore = require('./mediaStore.js');
const commerce = require('./commerceIntegrations.js');
const { AgentFleetManager } = require('./agentTeam.js');
const agentFleet = new AgentFleetManager(db);
const waEngine = require('./whatsapp.js');
const { generateInvoicePdf } = require('./invoiceGenerator.js');
const categoryProfiles = require('./categoryProfiles.js');
const { analyzeImageWithGeminiVision } = require('./slipVerifier.js');
const pdfParse = require('pdf-parse');
const {
  CustomerArchetypeEngine,
  AngryCustomerEscalationEngine,
  SmartNegotiationEngine,
  SmartUpsellEngine,
  SlipDetectionEngine,
  LanguageDetectionEngine,
  HybridFastCacheEngine
} = require('./ai_engines.js');
const {
  isDeliveryEnabled,
  stripDeliveryDetailsFromDataset,
  buildOwnerOrderReferralReply,
  buildProductPhotoCaption,
  buildDeliveryDisabledPromptBlock
} = require('./deliveryPolicyHelper.js');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const DEFAULT_GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const CALL_SERVER_URL = process.env.CALL_SERVER_URL || `http://localhost:${PORT}`;

const GEMINI_TEXT_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
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
const ENV_POOLED_KEYS = (process.env.GEMINI_API_KEYS || '')
  .split(/[\s,]+/)
  .map(k => k.trim())
  .filter(k => k.length >= 15);
const POOLED_GEMINI_API_KEYS = [...new Set([
  ...ENV_POOLED_KEYS,
  ...ENCODED_KEYS.map(k => Buffer.from(k, 'base64').toString('utf8'))
])];
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

const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.createdAt > 60 * 60 * 1000) {
      try { s.browserWs && s.browserWs.close(); } catch {}
      sessions.delete(id);
      console.log(`[session] Expired & removed: ${id}`);
    }
  }
}, 10 * 60 * 1000);
if (sessionCleanupTimer.unref) sessionCleanupTimer.unref();

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();

// ─── 🛡️ Enterprise Production Security Headers & Protection Suite ─────────────
app.disable('x-powered-by');

// 1. HTTP Security Headers (OWASP Top 10 Hardened)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval' wss:; font-src 'self' https: data:; img-src 'self' https: data: blob:; connect-src 'self' https: wss:; media-src 'self' https: data: blob:; frame-ancestors 'self';");
  next();
});

// 2. Strict Origin & CORS Guard
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  const allowed = !origin || origin.includes(host) || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('onrender.com') || origin.includes('github.io');
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token, x-license-key, x-staff-token, x-business-id, x-api-key');
  }
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});


// ─── HTTP Security Headers & Browser Caching Control ──────────────────────────
app.use((req, res, next) => {
  // OWASP Recommended Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');

  // Disable aggressive browser caching for dynamic HTML & data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ─── In-Memory Rate Limiting Engine (Anti-Brute Force & Anti-DDoS) ───────────
function createRateLimiter({ windowMs, maxRequests, message }) {
  const ipHits = new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipHits.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) ipHits.delete(ip);
      else ipHits.set(ip, valid);
    }
  }, windowMs);
  if (cleanupTimer.unref) cleanupTimer.unref();

  return (req, res, next) => {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ip = String(rawIp).split(',')[0].trim();
    const now = Date.now();
    const history = ipHits.get(ip) || [];
    const recent = history.filter(t => now - t < windowMs);

    if (recent.length >= maxRequests) {
      return res.status(429).json({
        ok: false,
        error: message || 'Too many requests. Please slow down.'
      });
    }

    recent.push(now);
    ipHits.set(ip, recent);
    next();
  };
}

const adminLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15-minute anti-brute force window
  maxRequests: 5,           // Strict 5-attempt limit
  message: '🚨 ආරක්ෂක අවවාදයයි: වැඩි වාර ගණනක් වැරදි Password ඇතුළත් කර ඇත. ඔබගේ IP ලිපිනය විනාඩි 15 කට තාවකාලිකව Block කර ඇත.'
});

const geminiAiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'AI Rate limit reached. Please wait a few seconds before generating again.'
});

const orderMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 25,
  message: 'Order operations rate limit exceeded. Please wait a moment.'
});

const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300,
  message: 'API rate limit reached. Please wait a moment.'
});

const licenseLoginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many license login attempts. Please wait 1 minute.'
});

const freeTrialLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  maxRequests: 5,
  message: 'Daily trial license registration limit reached for this IP.'
});

const datasetUploadLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
  message: 'Upload rate limit reached. Please wait a few minutes before uploading again.'
});

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── 🛡️ Deep NoSQL Injection & MongoDB Operator Sanitizer ────────────────────
function sanitizeNoSql(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map(sanitizeNoSql);
  const clean = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    clean[key] = sanitizeNoSql(value);
  }
  return clean;
}

app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = sanitizeNoSql(req.body);
  if (req.query && typeof req.query === 'object') req.query = sanitizeNoSql(req.query);
  if (req.params && typeof req.params === 'object') req.params = sanitizeNoSql(req.params);
  next();
});

// SaaS URL & Route Security Guard: Prevent bypassing access controls
app.use((req, res, next) => {
  const p = (req.path || '').toLowerCase();
  if (p === '/admin.html') {
    return res.redirect('/admin');
  }
  if (p === '/portal.html') {
    return res.redirect('/portal');
  }
  next();
});

// Production Static Asset Caching vs Dynamic Route No-Cache
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // 24h client-side caching for assets (JS, CSS, SVGs, PNGs)
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    }
  }
}));

// ─── 📊 Production Observability & Health Probes ─────────────────────────────
// Ultra-fast, zero-overhead 24/7 keep-alive endpoint for external uptime monitors (UptimeRobot, Cron-Job, etc.)
app.all(['/ping', '/keepalive'], (req, res) => {
  res.status(200).type('text/plain').send('PONG');
});

app.get('/health', (req, res) => {
  if (!db.isMongoConnected) {
    db.initMongo().catch(() => {});
  }
  const activeBiz = db.getActiveBusiness();
  res.json({
    status: 'ok',
    database: db.isMongoConnected ? 'MongoDB Atlas (Connected)' : (db.mongoError ? `Local JSON (Atlas Error: ${db.mongoError})` : 'MongoDB Atlas (Connecting...)'),
    activeBusiness: activeBiz.name,
    sessions: sessions.size,
    datasetChars: (activeBiz.dataset || BUILTIN_DATASET).length,
    time: new Date().toISOString()
  });
});

// Kubernetes / Render Readiness Probe
app.get('/health/ready', (req, res) => {
  res.status(200).json({
    ready: true,
    database: db.isMongoConnected ? 'MongoDB Atlas Connected' : 'Local JSON Fallback',
    stores: (db.data.businesses || []).length
  });
});

// Kubernetes / Render Liveness Probe
app.get('/health/live', (req, res) => {
  res.status(200).json({ live: true, uptime: Math.floor(process.uptime()) });
});

// Production System Metrics Endpoint
app.get('/api/metrics', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024)
    },
    database: {
      connected: db.isMongoConnected,
      ordersCount: (db.data.orders || []).length,
      productsCount: (db.data.products || []).length,
      storesCount: (db.data.businesses || []).length
    },
    whatsapp: {
      totalAccounts: waEngine && waEngine.manager ? waEngine.manager.sessions.size : 0,
      connectedAccounts: waEngine && waEngine.manager ? Array.from(waEngine.manager.sessions.values()).filter(s => s.connected).length : 0
    },
    activeVoiceSessions: sessions.size,
    timestamp: new Date().toISOString()
  });
});

// Enterprise Audit Trail Log Endpoint
app.get('/api/audit-logs', requireSessionAuth, (req, res) => {
  const bizId = req.query.businessId || null;
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
  const logs = db.getAuditLogs(bizId, limit);
  res.json({ ok: true, logs });
});

// ─── SaaS Multi-Tenant Routes & Omnichannel UI ─────────────────────────────
app.get(['/admin', '/super-admin', '/dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

app.get(['/free', '/free.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'free.html'));
});

// ─── Multi-Tenant License Authentication APIs ────────────────────────────────
app.post('/api/auth/license-login', licenseLoginLimiter, (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ ok: false, error: 'Please enter your License Key (කරුණාකර License Key ඇතුළත් කරන්න).' });
  }

  const lic = db.getLicenseByKey(licenseKey);
  if (!lic) {
    return res.status(401).json({ ok: false, error: 'Invalid License Key. Please check your code or contact support (වලංගු නොවන License Key එකකි).' });
  }

  if (lic.status === 'Revoked') {
    return res.status(403).json({ ok: false, error: 'This License Key has been suspended or revoked. Please contact support (මෙම License පත අත්හිටුවා ඇත).' });
  }

  if (lic.status === 'Expired') {
    return res.status(403).json({ ok: false, error: `This License Key expired on ${new Date(lic.expiresAt).toLocaleDateString()}. Please contact support to renew (මෙම License පත කල් ඉකුත් වී ඇත).` });
  }

  // Find linked business or assign first business
  let biz = db.getAllBusinesses().find(b => b.id === lic.businessId);
  if (!biz) {
    biz = db.getActiveBusiness();
  }

  // Ensure store subscription plan strictly adheres to license tier
  if (biz && lic.planTier && biz.subscriptionPlan !== lic.planTier) {
    db.updateBusinessPlan(biz.id, lic.planTier);
  }

  res.json({
    ok: true,
    license: lic,
    business: biz
  });
});

app.post('/api/auth/free-trial', freeTrialLimiter, (req, res) => {
  const { clientName, clientPhone } = req.body || {};
  if (!clientName || !clientPhone) {
    return res.status(400).json({ ok: false, error: 'Store Name and Phone number are required (නම සහ දුරකථන අංකය අවශ්‍යයි).' });
  }

  const cleanPhone = String(clientPhone).replace(/\D/g, '');
  if (cleanPhone.length < 9) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid WhatsApp phone number (වලංගු WhatsApp අංකයක් ඇතුළත් කරන්න).' });
  }

  // Prevent multiple active trial keys for the same phone number
  const existingTrials = (db.data.licenses || []).filter(l => 
    (l.clientPhone || '').replace(/\D/g, '') === cleanPhone && l.plan === 'TRIAL'
  );

  if (existingTrials.length > 0) {
    const latestTrial = existingTrials[existingTrials.length - 1];
    return res.json({
      ok: true,
      license: latestTrial,
      message: 'ඔබගේ පවතින 3-Day Free Trial License Key එක සාර්ථකව ලබා ගන්නා ලදී!'
    });
  }

  const cleanSlug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'store_' + Date.now();
  
  // Register newly created store with createdAt timestamp so trial countdown starts now
  const newBiz = {
    id: cleanSlug,
    name: clientName,
    category: 'other',
    subscriptionPlan: 'starter',
    ownerName: clientName,
    phone: clientPhone,
    whatsappPhone: cleanPhone,
    bankDetails: '',
    deliveryPolicy: 'Islandwide delivery available.',
    currency: 'Rs.',
    welcomeMessage: `ආයුබෝවන්! ${clientName} වෙත සාදරයෙන් පිළිගන්නවා. මම ඔබට අද කොහොමද උදව් කරන්න පුළුවන්?`,
    dataset: `Store: ${clientName}\nContact: ${clientPhone}\nServices: Inquiries & Orders\nDelivery: Islandwide Delivery`,
    createdAt: new Date().toISOString(),
    isActive: false
  };

  if (!db.data.businesses) db.data.businesses = [];
  if (db.data.businesses.some(b => b.id === cleanSlug)) {
    newBiz.id = cleanSlug + '_' + Math.random().toString(36).slice(2, 6);
  }
  db.data.businesses.push(newBiz);

  // Create real active 3-Day Trial License Key
  const newLic = db.generateLicense({
    plan: 'TRIAL',
    clientName,
    clientPhone,
    businessId: newBiz.id,
    notes: 'Free 3-Day Trial Self-Registered'
  });

  res.json({
    ok: true,
    license: newLic,
    message: '🎉 Free 3-Day Trial License Activated!'
  });
});

// ─── Super Admin Master Password & Token Management ──────────────────────────
const ADMIN_MASTER_PASSWORD = process.env.ADMIN_PASSWORD || '486485';
const activeAdminSessions = new Map(); // in-memory cache
const ADMIN_SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days persistent

function isAdminTokenValid(token) {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  const now = Date.now();
  if (clean.length === ADMIN_MASTER_PASSWORD.length) {
    try {
      if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(ADMIN_MASTER_PASSWORD))) return true;
    } catch (_) {}
  }
  if (activeAdminSessions.has(clean) && activeAdminSessions.get(clean) > now) return true;
  if (db.data && db.data.adminSessions && db.data.adminSessions[clean] && db.data.adminSessions[clean] > now) {
    activeAdminSessions.set(clean, db.data.adminSessions[clean]);
    return true;
  }
  return false;
}

function pruneAdminSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of activeAdminSessions.entries()) {
    if (now > expiresAt) activeAdminSessions.delete(token);
  }
  if (db.data && db.data.adminSessions) {
    for (const [t, exp] of Object.entries(db.data.adminSessions)) {
      if (now > exp) delete db.data.adminSessions[t];
    }
  }
}
const adminPruneTimer = setInterval(pruneAdminSessions, 30 * 60 * 1000);
if (adminPruneTimer.unref) adminPruneTimer.unref();

function requireAdminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || (req.query && req.query.adminToken);
  if (!isAdminTokenValid(token)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Master Admin Security PIN required.' });
  }
  next();
}

app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  const { password } = req.body || {};
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const clientIp = String(rawIp).split(',')[0].trim();

  if (!password) {
    db.logAuditEvent({
      type: 'ADMIN_LOGIN_EMPTY_ATTEMPT',
      actor: 'Unknown',
      ip: clientIp,
      status: 'FAILED',
      details: { reason: 'No password provided' }
    });
    return res.status(401).json({ ok: false, error: 'Security Password is required.' });
  }

  const inputBuf = Buffer.from(String(password).trim());
  const masterBuf = Buffer.from(ADMIN_MASTER_PASSWORD);
  const isValid = inputBuf.length === masterBuf.length && crypto.timingSafeEqual(inputBuf, masterBuf);
  if (!isValid) {
    db.logAuditEvent({
      type: 'ADMIN_LOGIN_FAILED',
      actor: 'Unknown',
      ip: clientIp,
      status: 'FAILED',
      details: { reason: 'Incorrect Master Security PIN' }
    });
    return res.status(401).json({ ok: false, error: 'වැරදි Master Security Password එකක්. නැවත උත්සාහ කරන්න.' });
  }

  const token = 'adm_' + crypto.randomBytes(32).toString('hex');
  const exp = Date.now() + ADMIN_SESSION_DURATION;
  activeAdminSessions.set(token, exp);
  if (!db.data.adminSessions) db.data.adminSessions = {};
  db.data.adminSessions[token] = exp;
  db.save();

  db.logAuditEvent({
    type: 'ADMIN_LOGIN_SUCCESS',
    actor: 'Super Admin',
    ip: clientIp,
    status: 'SUCCESS',
    details: { authMethod: 'Master PIN' }
  });

  res.json({ ok: true, token, message: 'Super Admin Security Access Granted' });
});

app.get('/api/admin/verify', (req, res) => {
  const token = req.headers['x-admin-token'] || (req.query && req.query.adminToken);
  if (isAdminTokenValid(token)) {
    return res.json({ ok: true, authenticated: true });
  }
  res.status(401).json({ ok: false, authenticated: false });
});

app.post('/api/admin/logout', (req, res) => {
  const token = req.headers['x-admin-token'] || (req.query && req.query.adminToken);
  if (token) activeAdminSessions.delete(token);
  res.json({ ok: true });
});

// ─── Super Admin License Management APIs ─────────────────────────────────────
app.get(['/api/admin/licenses', '/api/licenses'], requireAdminAuth, (req, res) => {
  res.json({
    ok: true,
    licenses: db.getLicenses()
  });
});

app.post('/api/admin/generate-key', requireAdminAuth, (req, res) => {
  try {
    const { plan, clientName, clientPhone, notes } = req.body;
    const lic = db.generateLicense({ plan, clientName, clientPhone, notes });
    res.json({ ok: true, license: lic });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/extend-key', requireAdminAuth, (req, res) => {
  try {
    const { key, days } = req.body;
    const lic = db.extendLicense(key, parseInt(days) || 30);
    if (!lic) return res.status(404).json({ ok: false, error: 'License key not found' });
    res.json({ ok: true, license: lic });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/toggle-key', requireAdminAuth, (req, res) => {
  try {
    const { key } = req.body;
    const lic = db.toggleLicenseActive(key);
    if (!lic) return res.status(404).json({ ok: false, error: 'License key not found' });
    res.json({ ok: true, license: lic });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/admin/delete-key', requireAdminAuth, (req, res) => {
  try {
    const { key } = req.body;
    const ok = db.deleteLicense(key);
    res.json({ ok });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Super Admin Database Backup & Restore APIs ──────────────────────────────
app.get('/api/admin/db/export', requireAdminAuth, (req, res) => {
  const data = db.exportDatabase();
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="omnisix_database_backup_${dateStr}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

app.post('/api/admin/db/import', requireAdminAuth, (req, res) => {
  try {
    const { databaseJson } = req.body;
    if (!databaseJson) {
      return res.status(400).json({ ok: false, error: 'Database JSON payload is required.' });
    }
    const parsed = typeof databaseJson === 'string' ? JSON.parse(databaseJson) : databaseJson;
    const result = db.importDatabase(parsed);
    res.json({
      ok: true,
      message: 'Database backup imported and merged successfully!',
      stats: result
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid backup file: ' + err.message });
  }
});

// ─── Client Portal Scoped Store API & SaaS Multi-Tenant Isolation ─────────────

// ─── 🔒 Sensitive Credential Sanitizer & Data Shield ─────────────────────────
function sanitizeBusinessData(b, isAdmin = false) {
  if (!b) return null;
  const clone = JSON.parse(JSON.stringify(b));
  if (clone.settings) {
    if (clone.settings.geminiApiKey) {
      if (isAdmin) {
        const k = clone.settings.geminiApiKey;
        clone.settings.geminiApiKey = k.length > 10 ? (k.slice(0, 6) + '••••••••' + k.slice(-4)) : '••••••••';
      } else {
        delete clone.settings.geminiApiKey;
        clone.settings.hasConfiguredApiKey = true;
      }
    }
  }
  return clone;
}

function getStaffSessionFromReq(req) {
  const rawTok = req.headers['x-staff-token']
    || (req.query && req.query.staffToken)
    || ((typeof req.headers['x-admin-token'] === 'string' && req.headers['x-admin-token'].startsWith('stf_')) ? req.headers['x-admin-token'] : null);
  if (!rawTok || typeof db.validateStaffSession !== 'function') return null;
  return db.validateStaffSession(rawTok);
}

// Unified Role-Based Access Control (Admin, Active Tenant, Scoped Staff, or API Key)
function requireSessionAuth(req, res, next) {
  if (isAdminReq(req)) {
    return next();
  }

  const key = req.headers['x-license-key'] || (req.query && (req.query.licenseKey || req.query.key));
  if (key && typeof key === 'string') {
    const cleanKey = key.trim();
    const lic = db.getLicenseByKey(cleanKey);
    if (lic && lic.status === 'Active' && lic.businessId) {
      const sub = db.isBusinessSubscriptionActive(lic.businessId);
      if (sub && sub.active && !sub.isExpired) {
        req.tenantBusinessId = lic.businessId;
        return next();
      }
      return res.status(402).json({
        ok: false,
        error: 'Subscription expired: නොමිලේ අත්හදා බැලීමේ කාලය (Trial) අවසන් වී ඇත. කරුණාකර Paid Plan එකක් මිලදී ගන්න.',
        subscription: sub
      });
    }
  }

  const staffSess = getStaffSessionFromReq(req);
  if (staffSess) {
    req.staffUser = staffSess;
    if (staffSess.businessId && staffSess.businessId !== 'all') {
      req.tenantBusinessId = staffSess.businessId;
    }
    return next();
  }

  const apiKey = req.headers['x-api-key'] || (req.query && req.query.apiKey);
  if (apiKey && typeof db.validateApiKey === 'function' && db.validateApiKey(apiKey)) {
    return next();
  }

  return res.status(401).json({
    ok: false,
    error: 'ආරක්ෂිත ප්‍රවේශය අවශ්‍යයි (Authentication Required). කරුණාකර වලංගු License Key එකක් හෝ Admin PIN මඟින් පිවිසෙන්න.'
  });
}

function isAdminReq(req) {
  const token = req.headers['x-admin-token'] || (req.query && req.query.adminToken);
  return isAdminTokenValid(token);
}

function isTenantReq(req) {
  if (isAdminReq(req)) return false;
  const staffSess = getStaffSessionFromReq(req);
  if (staffSess) {
    return !!(staffSess.businessId && staffSess.businessId !== 'all');
  }
  const key = req.headers['x-license-key'] || (req.query && (req.query.licenseKey || req.query.key));
  if (!key || typeof key !== 'string') return false;
  const cleanKey = key.trim();
  const lic = db.getLicenseByKey(cleanKey);
  if (!lic || lic.status !== 'Active' || !lic.businessId) return false;
  const sub = db.isBusinessSubscriptionActive(lic.businessId);
  return !!(sub && sub.active && !sub.isExpired);
}

function isOwnedByCaller(req, record) {
  if (!record) return false;
  if (!isTenantReq(req)) return true;
  const bId = resolveReqBusinessId(req);
  return !record.businessId || record.businessId === bId;
}

function resolveReqBusinessId(req) {
  const staffSess = getStaffSessionFromReq(req);
  if (staffSess && staffSess.businessId && staffSess.businessId !== 'all') {
    return staffSess.businessId;
  }
  const key = req.headers['x-license-key'] || (req.query && req.query.licenseKey) || (req.query && req.query.key);
  if (key) {
    const lic = db.getLicenseByKey(key);
    if (lic && lic.status === 'Active') {
      if (lic.businessId) {
        const b = db.getBusiness(lic.businessId);
        if (b && b.subscriptionPlan && lic.planTier !== b.subscriptionPlan) {
          lic.planTier = b.subscriptionPlan;
          db.save();
        }
        return lic.businessId;
      }
      const bizName = lic.clientName || 'Store';
      const cleanSlug = bizName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'store_' + Date.now();
      const newBiz = {
        id: cleanSlug,
        name: bizName,
        category: 'other',
        subscriptionPlan: lic.planTier || 'starter',
        ownerName: bizName,
        phone: lic.clientPhone || '',
        whatsappPhone: (lic.clientPhone || '').replace(/\D/g, ''),
        bankDetails: '',
        deliveryPolicy: 'Islandwide delivery available.',
        currency: 'Rs.',
        welcomeMessage: `ආයුබෝවන්! ${bizName} වෙත සාදරයෙන් පිළිගන්නවා. මම ඔබට අද කොහොමද උදව් කරන්න පුළුවන්?`,
        dataset: `Store: ${bizName}\nContact: ${lic.clientPhone || '-'}\nServices: Inquiries & Orders\nDelivery: Islandwide Delivery`,
        isActive: false
      };
      if (!db.data.businesses) db.data.businesses = [];
      db.data.businesses.push(newBiz);
      lic.businessId = cleanSlug;
      db.save();
      return cleanSlug;
    }
  }

  // Admin Multi-Tab or Global Staff requests: Allow custom store switching
  if (isAdminReq(req) || (staffSess && staffSess.businessId === 'all')) {
    const headerBizId = req.headers['x-business-id'];
    if (headerBizId && db.getBusiness(headerBizId)) {
      return headerBizId;
    }

    if (req.query) {
      const qb = req.query.store || req.query.biz || req.query.businessId;
      if (qb && db.getBusiness(qb)) {
        return qb;
      }
    }

    if (req.body && req.body.businessId && db.getBusiness(req.body.businessId)) {
      return req.body.businessId;
    }
  }

  // Unauthenticated requests MUST NOT access any private store
  return null;
}

app.get('/api/portal/store', (req, res) => {
  const key = req.headers['x-license-key'] || (req.query && req.query.key);
  const staffSess = getStaffSessionFromReq(req);

  let tenantBizId = null;
  let lic = null;

  if (key) {
    lic = db.getLicenseByKey(key);
    if (!lic || lic.status !== 'Active') {
      return res.status(401).json({ ok: false, error: 'Access Denied: License Key is invalid, expired or revoked.' });
    }
    tenantBizId = lic.businessId;
    if (!tenantBizId) {
      return res.status(403).json({ ok: false, error: 'Tenant Error: No store linked to this license key.' });
    }
    const requestedBizId = req.headers['x-business-id'] || (req.query && (req.query.biz || req.query.store));
    if (requestedBizId && requestedBizId !== tenantBizId) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant store access prohibited. Strict multi-tenant isolation enforced.' });
    }
  } else if (staffSess) {
    if (staffSess.businessId === 'all') {
      const reqBiz = req.headers['x-business-id'] || (req.query && (req.query.biz || req.query.store));
      tenantBizId = (reqBiz && db.getBusiness(reqBiz)) ? reqBiz : db.getActiveBusiness().id;
    } else {
      tenantBizId = staffSess.businessId;
      const requestedBizId = req.headers['x-business-id'] || (req.query && (req.query.biz || req.query.store));
      if (requestedBizId && requestedBizId !== tenantBizId) {
        return res.status(403).json({ ok: false, error: 'Forbidden: Staff account cannot access another store.' });
      }
    }
  } else {
    return res.status(401).json({ ok: false, error: 'Access Denied: Valid License Key or Staff Login required.' });
  }

  const biz = db.getBusiness(tenantBizId);
  if (!biz) {
    return res.status(404).json({ ok: false, error: 'Business store not found.' });
  }

  const subStatus = db.isBusinessSubscriptionActive(biz.id);
  const orders = db.getOrders(biz.id);
  const products = db.getProducts(biz.id);
  const flows = db.getCustomFlows(biz.id);
  const chats = (db.data.chats || []).filter(c => c.businessId === biz.id);

  res.json({
    ok: true,
    isStaff: !!staffSess,
    staffUser: staffSess ? {
      id: staffSess.id,
      name: staffSess.name,
      username: staffSess.username,
      role: staffSess.role,
      businessId: staffSess.businessId
    } : null,
    license: lic || {
      key: 'STAFF-SESSION',
      plan: (subStatus && subStatus.planLabel) || biz.subscriptionPlan || 'enterprise',
      clientName: staffSess ? staffSess.name : biz.name,
      daysLeft: subStatus && subStatus.daysLeft !== undefined ? subStatus.daysLeft : 365,
      status: 'Active'
    },
    business: sanitizeBusinessData(biz),
    subscription: subStatus,
    products,
    flows,
    orders,
    chats,
    stats: {
      totalOrders: orders.length,
      revenueLKR: orders.reduce((s, o) => s + (parseInt(String(o.amount || '0').replace(/\D/g, '')) || 0), 0).toLocaleString(),
      totalChats: chats.length,
      productsCount: products.length
    }
  });
});

// Secure Super Admin Master PIN endpoint (Admin Panel only, requires active admin token)
app.get('/api/admin/master-info', requireAdminAuth, (req, res) => {
  res.json({
    ok: true,
    masterPin: ADMIN_MASTER_PASSWORD
  });
});

// Business Profile & Preset Management
app.get('/api/business', (req, res) => {
  const isAdmin = isAdminReq(req);
  const isTenant = isTenantReq(req);
  const requestedBizId = req.headers['x-business-id'] || (req.query && (req.query.store || req.query.biz || req.query.businessId));

  if (isTenant) {
    const key = req.headers['x-license-key'] || (req.query && (req.query.licenseKey || req.query.key));
    const lic = key ? db.getLicenseByKey(key) : null;
    const tenantBizId = lic ? lic.businessId : resolveReqBusinessId(req);
    const tenantBiz = db.getBusiness(tenantBizId) || db.getActiveBusiness();
    const sanitized = sanitizeBusinessData(tenantBiz, false);
    return res.json({
      ok: true,
      active: sanitized,
      businesses: [sanitized] // Multi-tenant isolation: Tenants CANNOT see other stores!
    });
  }

  if (isAdmin) {
    const scopedActive = (requestedBizId && db.getBusiness(requestedBizId)) ? db.getBusiness(requestedBizId) : db.getActiveBusiness();
    return res.json({
      ok: true,
      active: sanitizeBusinessData(scopedActive, true),
      businesses: db.getAllBusinesses().map(b => sanitizeBusinessData(b, true))
    });
  }

  // Unauthenticated public visitor: ONLY return safe public store metadata (optionally scoped by businessId)
  const publicActive = (requestedBizId && db.getBusiness(requestedBizId)) || db.getActiveBusiness();
  const publicSettings = db.getTenantSettings(publicActive.id) || db.getSettings();
  res.json({
    ok: true,
    active: {
      id: publicActive.id,
      name: publicActive.name,
      category: publicActive.category,
      phone: publicActive.phone,
      whatsappPhone: publicActive.whatsappPhone,
      currency: publicActive.currency || 'Rs.',
      brandColor: publicActive.brandColor || '#2563EB',
      logoUrl: publicActive.logoUrl || '',
      welcomeMessage: publicActive.welcomeMessage,
      deliveryPolicy: publicActive.deliveryPolicy,
      isDeliveryDetailsEnabled: isDeliveryEnabled(publicSettings)
    },
    businesses: [] // Strictly empty for unauthenticated public requests!
  });
});

// ─── ☁️ Cloud Media Offload Storage (MongoDB GridFS / Disk / Cloudinary) ─────
app.get('/api/media/:id', async (req, res) => {
  try {
    const item = await mediaStore.getMedia(req.params.id);
    if (!item || !item.buffer) {
      return res.status(404).json({ ok: false, error: 'Media not found' });
    }
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(item.buffer);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/media/upload', requireSessionAuth, async (req, res) => {
  try {
    const { base64Data, dataUrl, mimeType, purpose, source } = req.body || {};
    const payload = base64Data || dataUrl;
    if (!payload) {
      return res.status(400).json({ ok: false, error: 'base64Data or dataUrl required' });
    }
    const bId = resolveReqBusinessId(req);
    const saved = await mediaStore.saveMedia(payload, mimeType || 'image/jpeg', {
      businessId: bId,
      purpose: purpose || source || 'general'
    });
    if (!saved.ok) {
      return res.status(400).json(saved);
    }
    res.json(saved);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post(['/api/business/select', '/api/business/switch'], requireSessionAuth, (req, res) => {
  const { id } = req.body;
  const active = db.setActiveBusiness(id);
  res.json({ ok: true, active });
});

app.post('/api/business/save', requireSessionAuth, (req, res) => {
  const bId = req.body.id || resolveReqBusinessId(req);
  const updatedData = { ...req.body, id: bId };
  const business = db.saveBusiness(updatedData);
  res.json({ ok: true, business });
});

app.post('/api/business/update', requireAdminAuth, (req, res) => {
  try {
    const { id, name, category, ownerName, phone, bankDetails, deliveryPolicy, welcomeMessage, dataset, subscriptionPlan } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: 'Store ID is required' });
    const existing = db.getBusiness(id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Store not found' });
    if (name) existing.name = name.trim();
    if (category) existing.category = category;
    if (ownerName !== undefined) existing.ownerName = ownerName.trim();
    if (phone !== undefined) {
      existing.phone = phone.trim();
      existing.whatsappPhone = phone.replace(/\D/g, '');
    }
    if (bankDetails !== undefined) existing.bankDetails = bankDetails;
    if (deliveryPolicy !== undefined) existing.deliveryPolicy = deliveryPolicy;
    if (welcomeMessage !== undefined) existing.welcomeMessage = welcomeMessage;
    if (dataset !== undefined) existing.dataset = dataset;
    if (req.body.brandColor !== undefined && /^#[0-9A-Fa-f]{6}$/.test(req.body.brandColor)) {
      existing.brandColor = req.body.brandColor;
    }
    if (req.body.logoUrl !== undefined) {
      existing.logoUrl = String(req.body.logoUrl || '').trim();
    }
    if (subscriptionPlan) {
      existing.subscriptionPlan = subscriptionPlan;
      db.updateBusinessPlan(id, subscriptionPlan);
    }
    const updated = db.saveBusiness(existing);
    res.json({
      ok: true,
      business: updated,
      active: db.getActiveBusiness(),
      businesses: db.getAllBusinesses()
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/business/create', requireAdminAuth, (req, res) => {
  try {
    const newBiz = db.createBusiness(req.body);
    if (req.body.setActive) {
      db.setActiveBusiness(newBiz.id);
    }
    res.json({
      ok: true,
      business: newBiz,
      active: db.getActiveBusiness(),
      businesses: db.getAllBusinesses()
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/business/delete', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.body;
    const active = db.deleteBusiness(id);
    res.json({
      ok: true,
      active,
      businesses: db.getAllBusinesses()
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Real-time Business & ROI Analytics
app.get('/api/analytics', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({
    ok: true,
    analytics: db.getAnalytics(bId),
    roi: db.getRoiAnalytics(bId)
  });
});

// Tiered Subscription Plans (SaaS Pricing)
app.get('/api/subscription/plans', (req, res) => {
  const bId = resolveReqBusinessId(req);
  const biz = db.getBusiness(bId);
  const currentPlanId = biz?.subscriptionPlan || 'enterprise';
  res.json({
    ok: true,
    plans: db.SUBSCRIPTION_PLANS,
    activePlan: db.SUBSCRIPTION_PLANS[currentPlanId] || db.SUBSCRIPTION_PLANS.enterprise
  });
});

// Super Admin Only: Direct Plan Update
app.post('/api/subscription/select-plan', requireSessionAuth, (req, res) => {
  const { planId, businessId } = req.body || {};
  if (!db.SUBSCRIPTION_PLANS[planId]) {
    return res.status(400).json({ ok: false, error: 'Invalid subscription plan' });
  }
  const bId = businessId || resolveReqBusinessId(req);
  db.updateBusinessPlan(bId, planId);
  res.json({
    ok: true,
    message: `Plan updated successfully to ${db.SUBSCRIPTION_PLANS[planId].name} by Administrator!`,
    plan: db.SUBSCRIPTION_PLANS[planId]
  });
});

// Client Portal Plan Upgrade Request (Requires Authenticated Session)
app.post('/api/subscription/request-upgrade', requireSessionAuth, (req, res) => {
  const { planId, clientPhone, clientName, notes } = req.body || {};
  if (!db.SUBSCRIPTION_PLANS[planId]) {
    return res.status(400).json({ ok: false, error: 'Invalid subscription plan selected' });
  }
  const bId = resolveReqBusinessId(req);
  const biz = db.getBusiness(bId) || db.getActiveBusiness();
  const reqEntry = db.addSubscriptionRequest({
    businessId: biz.id,
    storeName: biz.name,
    planId,
    clientPhone: clientPhone || biz.phone || '',
    clientName: clientName || biz.ownerName || '',
    notes
  });
  res.json({
    ok: true,
    message: `ඔබගේ ${db.SUBSCRIPTION_PLANS[planId].name} Upgrade ඉල්ලීම ලැබිණි. කරුණාකර බැංකු රිසිට්පත 076 210 7601 WhatsApp කරන්න. පරිපාලක තහවුරු කළ වහාම සක්‍රීය වේ.`,
    request: reqEntry
  });
});

// Orders Pipeline & Slips
app.get('/api/orders', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({
    ok: true,
    orders: db.getOrders(bId)
  });
});

app.post(['/api/orders/status', '/api/orders/update-status'], requireSessionAuth, async (req, res) => {
  const { id, status, trackingNumber } = req.body;
  const order = db.updateOrderStatus(id, status, trackingNumber);

  // Auto-Dispatch Customer WhatsApp Tracking Notification
  if (order && status === 'Dispatched' && order.customerPhone && waEngine) {
    const trackMsg = `🚚 *ඇණවුම බෙදාහැරීම සඳහා භාර දෙන ලදී (Order Dispatched)!*\n\n` +
      `👤 පාරිභෝගික නම: *${order.customerName || 'Customer'}*\n` +
      `📦 ඇණවුම් අංකය: *#${order.id}*\n` +
      (trackingNumber ? `🚚 කුරියර් Tracking අංකය: *${trackingNumber}*\n` : '') +
      `📍 ලැබිය යුතු ලිපිනය: ${order.address || 'Standard Delivery'}\n\n` +
      `_දින 2-3ක් ඇතුළත කුරියර් නිලධාරියා ඔබව අමතා පාර්සලය භාරදෙනු ඇත. අප හා සම්බන්ධ වූවාට ස්තූතියි!_ 🙏✨`;
    waEngine.sendTextMessage(order.customerPhone, trackMsg).catch(() => {});
  }

  // Real-Time Google Sheets Auto-Sync
  try {
    const settings = db.getSettings();
    if (settings.googleSheets && settings.googleSheets.enabled && settings.googleSheets.webhookUrl) {
      fetch(settings.googleSheets.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'order_status_update', order }),
        signal: AbortSignal.timeout(5000)
      }).catch(() => {});
    }
  } catch (e) {}

  res.json({ ok: true, order });
});

app.post('/api/orders/create', requireSessionAuth, (req, res) => {
  const bId = req.body.businessId || resolveReqBusinessId(req);
  const order = db.addOrder({
    ...req.body,
    businessId: bId,
    source: 'Manual Dashboard'
  });
  const biz = db.getBusiness(bId) || db.getActiveBusiness();
  notifyOwnerOfNewOrder(order, biz);

  // Real-Time Google Sheets Auto-Sync for New Orders
  try {
    const settings = db.getSettings();
    if (settings.googleSheets && settings.googleSheets.enabled && settings.googleSheets.webhookUrl) {
      fetch(settings.googleSheets.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'order_created', order, store: biz.name }),
        signal: AbortSignal.timeout(5000)
      }).catch(() => {});
    }
  } catch (e) {}

  res.json({ ok: true, order });
});

app.post('/api/orders/delete', requireSessionAuth, (req, res) => {
  const { id } = req.body;
  db.deleteOrder(id);
  res.json({ ok: true });
});

// ─── 🛒 Multi-Item Cart Order Endpoint ───────────────────────────────────────
app.post('/api/orders/cart', requireSessionAuth, (req, res) => {
  try {
    const bId = req.body.businessId || resolveReqBusinessId(req);
    const biz = db.getBusiness(bId) || db.getActiveBusiness();
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ ok: false, error: 'Cart items array is required' });
    }
    const storeProds = db.getProducts(bId) || [];
    let totalAmount = 0;
    const normalizedItems = rawItems.map(it => {
      const prod = (it.productId && storeProds.find(p => p.id === it.productId)) ||
        (it.name && storeProds.find(p => p.name.toLowerCase() === String(it.name).toLowerCase())) || null;
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      const unitPrice = it.price !== undefined ? (parseFloat(it.price) || 0) : (prod ? (parseFloat(prod.price) || 0) : 0);
      totalAmount += unitPrice * qty;
      return {
        productId: prod ? prod.id : (it.productId || null),
        name: prod ? prod.name : String(it.name || 'Item').trim(),
        qty,
        unitPrice
      };
    });
    const itemSummary = normalizedItems.map(i => `${i.qty}x ${i.name}`).join(', ');
    const finalAmount = req.body.amount !== undefined ? req.body.amount : totalAmount;
    const order = db.addOrder({
      businessId: biz.id,
      customerName: req.body.customerName || 'Customer',
      customerPhone: req.body.customerPhone || '',
      address: req.body.address || 'To be confirmed',
      item: itemSummary,
      items: normalizedItems,
      amount: finalAmount,
      source: req.body.source || 'Multi-Item Cart'
    });
    notifyOwnerOfNewOrder(order, biz);
    const settings = db.getTenantSettings(biz.id) || db.getSettings();
    const gwCfg = (settings && settings.paymentGateway) || {};
    const baseUrl = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
      ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
      : CALL_SERVER_URL;
    const trackUrl = commerce.buildCustomerTrackingUrl(order.id, baseUrl, gwCfg.merchantSecret);
    res.json({ ok: true, order, trackUrl });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 🔍 Customer Public Order Tracking Portal & Signed Link ──────────────────
app.get('/api/orders/:orderId/track-link', requireSessionAuth, (req, res) => {
  const { orderId } = req.params;
  const order = (db.data.orders || []).find(o => o.id === orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  if (!isOwnedByCaller(req, order)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant tracking access denied.' });
  }
  const biz = db.getBusiness(order.businessId) || db.getActiveBusiness();
  const settings = db.getTenantSettings(biz.id) || db.getSettings();
  const gwCfg = (settings && settings.paymentGateway) || {};
  const baseUrl = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
    ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
    : CALL_SERVER_URL;
  const trackUrl = commerce.buildCustomerTrackingUrl(order.id, baseUrl, gwCfg.merchantSecret);
  res.json({ ok: true, orderId: order.id, trackUrl });
});

app.get('/track/:orderId', (req, res) => {
  const { orderId } = req.params;
  const sig = req.query.sig;
  const order = (db.data.orders || []).find(o => o.id === orderId);
  if (!order) return res.status(404).send('<h2>Order not found</h2>');
  const biz = db.getBusiness(order.businessId) || db.getActiveBusiness();
  const settings = db.getTenantSettings(biz.id) || db.getSettings();
  const gwCfg = (settings && settings.paymentGateway) || {};
  if (!commerce.verifyOrderSignToken(orderId, sig, gwCfg.merchantSecret)) {
    return res.status(403).send('<h2>Invalid or expired tracking link</h2>');
  }

  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(biz.brandColor || '') ? biz.brandColor : '#2563EB';
  const statusStr = String(order.status || 'Pending Payment');
  const stepIdx = /delivered/i.test(statusStr) ? 3
    : (/dispatched/i.test(statusStr) ? 2
      : (/(paid|confirmed|production|verified)/i.test(statusStr) ? 1 : 0));
  const steps = ['Order Placed', 'Confirmed / Paid', 'Courier Dispatched', 'Delivered'];
  const baseUrl = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
    ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
    : CALL_SERVER_URL;
  const isPaid = /paid|delivered|cancelled/i.test(statusStr);
  const payUrl = !isPaid && (gwCfg.enabled || gwCfg.kokoEnabled || gwCfg.mintpayEnabled)
    ? commerce.buildCustomerPaymentUrl(order.id, baseUrl, gwCfg.merchantSecret, gwCfg.customPayUrl)
    : '';
  const waNum = String(biz.whatsappPhone || biz.phone || '').replace(/\D/g, '');
  const cleanWa = waNum.startsWith('0') ? '94' + waNum.slice(1) : waNum;

  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Track #${esc(order.id)} — ${esc(biz.name)}</title></head>
  <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#07080c;color:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:20px auto;background:#10121b;border:1px solid rgba(255,255,255,0.1);border-radius:18px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);">
      <div style="background:${esc(brandColor)};padding:20px 24px;display:flex;align-items:center;gap:12px;">
        ${biz.logoUrl ? `<img src="${esc(biz.logoUrl)}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,0.2);">` : ''}
        <div>
          <div style="font-size:1.15rem;font-weight:800;">${esc(biz.name)}</div>
          <div style="font-size:0.82rem;opacity:0.9;">Live Order Tracking • #${esc(order.id)}</div>
        </div>
      </div>
      <div style="padding:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px;">
          <span style="font-size:0.85rem;color:#94a3b8;">Current Status</span>
          <span style="background:rgba(16,185,129,0.16);color:#34d399;border:1px solid rgba(16,185,129,0.35);padding:5px 12px;border-radius:999px;font-weight:700;font-size:0.82rem;">${esc(statusStr)}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:24px;">
          ${steps.map((label, i) => `
            <div style="text-align:center;">
              <div style="height:6px;border-radius:4px;background:${i <= stepIdx ? esc(brandColor) : 'rgba(255,255,255,0.1)'};margin-bottom:6px;"></div>
              <div style="font-size:0.72rem;font-weight:${i <= stepIdx ? '700' : '500'};color:${i <= stepIdx ? '#f8fafc' : '#64748b'};">${esc(label)}</div>
            </div>
          `).join('')}
        </div>
        <div style="background:#07080c;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;font-size:0.88rem;line-height:1.7;">
          <div><strong>Item(s):</strong> ${esc(order.item)}</div>
          <div><strong>Total:</strong> Rs. ${commerce.parseLkrAmount(order.amount).toLocaleString()}</div>
          <div><strong>Customer:</strong> ${esc(order.customerName)}</div>
          <div><strong>Courier Tracking #:</strong> <code style="color:#38bdf8;">${esc(order.trackingNumber || 'Pending Dispatch')}</code></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
          ${payUrl ? `<a href="${esc(payUrl)}" style="flex:1;text-align:center;background:${esc(brandColor)};color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.88rem;">💳 Pay Online Now</a>` : ''}
          ${cleanWa ? `<a href="https://wa.me/${esc(cleanWa)}?text=${encodeURIComponent('Hi, checking order #' + order.id)}" target="_blank" style="flex:1;text-align:center;background:#25D366;color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.88rem;">💬 Contact Store</a>` : ''}
        </div>
      </div>
    </div>
  </body></html>`);
});

// ─── 💳 Sri Lankan Payment Gateways (PayHere / Koko / Custom Payment Link) ───
app.post('/api/orders/payment-link', requireSessionAuth, async (req, res) => {
  try {
    const { orderId, sendToWhatsApp } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, error: 'orderId required' });
    const bId = resolveReqBusinessId(req);
    const order = (db.data.orders || []).find(o => o.id === orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    if (!isOwnedByCaller(req, order)) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant order access denied.' });
    }
    const biz = db.getBusiness(order.businessId || bId) || db.getActiveBusiness();
    const settings = db.getTenantSettings(biz.id) || db.getSettings();
    const gwCfg = (settings && settings.paymentGateway) || {};
    const baseUrl = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
      ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
      : CALL_SERVER_URL;
    const payUrl = commerce.buildCustomerPaymentUrl(order.id, baseUrl, gwCfg.merchantSecret, gwCfg.customPayUrl);

    if (sendToWhatsApp && order.customerPhone && waEngine) {
      const msg = `💳 *Online Payment Link — ${biz.name}*\n\n📦 *Order:* #${order.id} (${order.item})\n💰 *Amount:* Rs. ${commerce.parseLkrAmount(order.amount).toLocaleString()}\n\n👉 *පහත Link එක ඔබා Card / Visa / MasterCard / Koko මගින් ක්ෂණිකව ගෙවන්න:*\n${payUrl}\n\n_ගෙවීම තහවුරු වූ වහාම Digital Invoice එක WhatsApp වෙත ලැබෙනු ඇත._ 🙏✨`;
      await waEngine.sendTextMessage(order.customerPhone, msg, `wa_${biz.id}`);
      db.addChatMessage(order.customerPhone, 'agent', msg, order.customerName || 'Customer', order.customerPhone, biz.id);
    }

    res.json({ ok: true, paymentUrl: payUrl, orderId: order.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/payments/checkout/:orderId', (req, res) => {
  const { orderId } = req.params;
  const sig = req.query.sig;
  const order = (db.data.orders || []).find(o => o.id === orderId);
  if (!order) return res.status(404).send('<h2>Order not found</h2>');
  const biz = db.getBusiness(order.businessId) || db.getActiveBusiness();
  const settings = db.getTenantSettings(biz.id) || db.getSettings();
  const gwCfg = (settings && settings.paymentGateway) || {};

  if (!commerce.verifyOrderSignToken(orderId, sig, gwCfg.merchantSecret)) {
    return res.status(403).send('<h2>Invalid or expired payment link</h2>');
  }

  const baseUrl = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
    ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
    : CALL_SERVER_URL;
  const checkout = commerce.buildPayHereCheckoutParams(order, biz, gwCfg, baseUrl);
  const bnpl = commerce.buildBnplInstallmentBreakdown(order.amount);
  const hasBnpl = !!(gwCfg.kokoEnabled || gwCfg.mintpayEnabled);
  const koko = gwCfg.kokoEnabled ? commerce.buildKokoCheckoutParams(order, biz, gwCfg, baseUrl) : null;
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  if (gwCfg.enabled && checkout.fields.merchant_id && checkout.fields.hash && !hasBnpl) {
    const inputs = Object.entries(checkout.fields)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
      .join('\n');
    return res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:48px;background:#0b0d14;color:#f8fafc;">
      <h2>Redirecting to Secure PayHere Checkout...</h2>
      <p>${esc(biz.name)} • Order #${esc(order.id)} • Rs. ${esc(checkout.fields.amount)}</p>
      <form id="ph" method="post" action="${esc(checkout.actionUrl)}">${inputs}</form>
      <script>document.getElementById('ph').submit();</script>
    </body></html>`);
  }

  const phInputs = (gwCfg.enabled && checkout.fields.merchant_id && checkout.fields.hash)
    ? Object.entries(checkout.fields).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('\n')
    : '';
  const kokoInputs = (koko && koko.fields._mId)
    ? Object.entries(koko.fields).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('\n')
    : '';

  return res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:500px;margin:40px auto;padding:28px;background:#0f172a;color:#f8fafc;border-radius:16px;border:1px solid #334155;">
    <h2 style="margin-top:0;color:#38bdf8;">${esc(biz.name)} — Checkout</h2>
    <p><strong>Order:</strong> #${esc(order.id)}</p>
    <p><strong>Item:</strong> ${esc(order.item)}</p>
    <p><strong>Total:</strong> Rs. ${bnpl.total.toLocaleString()}</p>
    ${phInputs ? `<form method="post" action="${esc(checkout.actionUrl)}" style="margin:14px 0;">${phInputs}<button type="submit" style="width:100%;padding:12px;border:none;border-radius:10px;background:#2563EB;color:#fff;font-weight:700;cursor:pointer;">💳 Pay Full Amount with PayHere (Visa / Master)</button></form>` : ''}
    ${hasBnpl ? `<div style="background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.35);border-radius:12px;padding:14px;margin:14px 0;">
      <div style="font-weight:700;color:#d8b4fe;margin-bottom:6px;">🛍️ Pay in 3 Interest-Free Installments (Koko / Mintpay)</div>
      <div style="font-size:0.88rem;color:#e2e8f0;">3 x <strong>Rs. ${bnpl.installment.toLocaleString()}</strong> (0% Interest)</div>
      ${kokoInputs ? `<form method="post" action="${esc(koko.actionUrl)}" style="margin-top:10px;">${kokoInputs}<button type="submit" style="width:100%;padding:10px;border:none;border-radius:8px;background:#9333ea;color:#fff;font-weight:700;cursor:pointer;">⚡ Pay 3x Rs. ${bnpl.installment.toLocaleString()} with Koko</button></form>` : ''}
      ${gwCfg.mintpayEnabled ? `<div style="margin-top:8px;font-size:0.8rem;color:#cbd5e1;">Mintpay Merchant ID: <strong>${esc(gwCfg.mintpayMerchantId || 'Configured')}</strong></div>` : ''}
    </div>` : ''}
    <hr style="border-color:#334155;">
    <p style="font-size:0.9rem;color:#cbd5e1;"><strong>Bank Transfer Details:</strong><br>${esc(biz.bankDetails || 'Contact Store Owner via WhatsApp')}</p>
    <p style="font-size:0.8rem;color:#94a3b8;">ගෙවීම සිදුකළ පසු Slip පත WhatsApp වෙත එවන්න.</p>
  </body></html>`);
});

app.post('/api/webhook/koko', async (req, res) => {
  try {
    const body = req.body || {};
    const orderId = body.orderId || body._orderId || body.order_id;
    const status = String(body.status || '').toUpperCase();
    if (!orderId) return res.sendStatus(400);
    const order = (db.data.orders || []).find(o => o.id === orderId);
    if (!order) return res.sendStatus(404);
    const biz = db.getBusiness(order.businessId) || db.getActiveBusiness();
    const settings = db.getTenantSettings(biz.id) || db.getSettings();
    const gwCfg = (settings && settings.paymentGateway) || {};

    if (gwCfg.kokoApiKey) {
      const providedSig = String(body.signature || req.headers['x-koko-signature'] || '');
      const expected = commerce.buildKokoCheckoutParams(order, biz, gwCfg, CALL_SERVER_URL).fields.signature;
      const a = Buffer.from(providedSig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(403).json({ ok: false, error: 'Invalid Koko signature' });
      }
    } else if (!isAdminReq(req) && !isTenantReq(req)) {
      return res.status(401).json({ ok: false, error: 'Configure Koko API Key or authenticate.' });
    }

    if (status === 'SUCCESS' || status === 'PAID' || status === '2') {
      order.status = 'Paid';
      order.paymentMethod = 'Koko BNPL (3x)';
      db.save();
      if (order.customerPhone && waEngine) {
        const msg = `✅ *Koko 3x Installment Confirmed!*\n\n🏪 *${biz.name}*\n📦 *Order:* #${order.id}\n💰 *Total:* Rs. ${commerce.parseLkrAmount(order.amount).toLocaleString()}\n\n_ස්තූතියි! ඔබගේ ඇණවුම සූදානම් කර Dispatch කෙරේ._ 🙏`;
        waEngine.sendTextMessage(order.customerPhone, msg, `wa_${biz.id}`).catch(() => {});
      }
    }
    res.json({ ok: true, order });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get(['/api/payments/payhere/return', '/api/payments/payhere/cancel'], (req, res) => {
  const isCancel = req.path.includes('cancel');
  const oid = String(req.query.order_id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:56px;background:#0b0d14;color:#f8fafc;">
    <h1 style="color:${isCancel ? '#f59e0b' : '#10b981'};">${isCancel ? 'Payment Cancelled' : '✅ Payment Submitted!'}</h1>
    <p>Order #${oid} — You can return to WhatsApp now.</p>
  </body></html>`);
});

app.post('/api/webhook/payhere', async (req, res) => {
  try {
    const body = req.body || {};
    const { order_id, status_code } = body;
    if (!order_id) return res.sendStatus(400);
    const order = (db.data.orders || []).find(o => o.id === order_id);
    if (!order) return res.sendStatus(404);
    const biz = db.getBusiness(order.businessId) || db.getActiveBusiness();
    const settings = db.getTenantSettings(biz.id) || db.getSettings();
    const gwCfg = (settings && settings.paymentGateway) || {};

    if (!commerce.verifyPayHereNotifySignature(body, gwCfg.merchantSecret)) {
      return res.status(403).json({ ok: false, error: 'Invalid PayHere MD5 signature' });
    }

    if (String(status_code) === '2') {
      order.status = 'Paid';
      order.paymentMethod = 'PayHere Online';
      db.save();
      if (order.customerPhone && waEngine) {
        const msg = `✅ *Payment Confirmed (PayHere Online)!*\n\n🏪 *${biz.name}*\n📦 *Order:* #${order.id}\n💰 *Paid:* Rs. ${commerce.parseLkrAmount(order.amount).toLocaleString()}\n\n_ස්තූතියි! ඔබගේ ඇණවුම සූදානම් කර Dispatch කෙරේ._ 🙏`;
        waEngine.sendTextMessage(order.customerPhone, msg, `wa_${biz.id}`).catch(() => {});
        try {
          const pdfBuf = await generateInvoicePdf(order, biz);
          await waEngine.sendDocumentMessage(order.customerPhone, pdfBuf, `Invoice-${order.id}.pdf`, `Official Receipt #${order.id}`, `wa_${biz.id}`);
        } catch (_) {}
      }
      db.logAuditEvent({ type: 'PAYMENT_CONFIRMED', businessId: biz.id, status: 'SUCCESS', details: { orderId: order.id, provider: 'payhere' } });
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('[payhere-webhook] Error:', e.message);
    res.sendStatus(500);
  }
});

// ─── 🚚 Live Courier REST Dispatch & Tracking Status Webhooks ────────────────
app.post('/api/orders/courier-dispatch', requireSessionAuth, async (req, res) => {
  try {
    const { orderId, provider } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, error: 'orderId required' });
    const bId = resolveReqBusinessId(req);
    const order = (db.data.orders || []).find(o => o.id === orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    if (!isOwnedByCaller(req, order)) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant order dispatch denied.' });
    }
    const biz = db.getBusiness(order.businessId || bId) || db.getActiveBusiness();
    const settings = db.getTenantSettings(biz.id) || db.getSettings();
    const courierCfg = {
      ...(settings.courierApi || {}),
      ...(provider ? { provider } : {})
    };
    const result = await commerce.dispatchOrderToCourier(order, biz, courierCfg);
    if (!result.ok) {
      return res.status(400).json(result);
    }

    const updated = db.updateOrderStatus(order.id, 'Dispatched', result.trackingNumber);
    if (order.customerPhone && waEngine) {
      const msg = `🚚 *ඇණවුම Courier (${result.providerName}) වෙත භාර දෙන ලදී!*\n\n📦 *Order:* #${order.id}\n🔢 *Waybill / Tracking:* *${result.trackingNumber}*\n📍 *Address:* ${order.address || 'Sri Lanka'}\n\n_ඉක්මනින් ඔබ අතට ලැබෙනු ඇත!_ 🙏`;
      waEngine.sendTextMessage(order.customerPhone, msg, `wa_${biz.id}`).catch(() => {});
    }
    res.json({ ok: true, order: updated, trackingNumber: result.trackingNumber, provider: result.providerName });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/webhook/courier', async (req, res) => {
  try {
    const { orderId, status, trackingNumber, secret } = req.body || {};
    if (!orderId) return res.status(400).json({ ok: false, error: 'orderId required' });
    const order = (db.data.orders || []).find(o => o.id === orderId || (trackingNumber && o.trackingNumber === trackingNumber));
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    const settings = db.getTenantSettings(order.businessId) || db.getSettings();
    const expectedSecret = (settings.courierApi && settings.courierApi.webhookSecret) || process.env.COURIER_WEBHOOK_SECRET || '';
    if (expectedSecret) {
      const a = Buffer.from(String(secret || req.headers['x-courier-secret'] || ''));
      const b = Buffer.from(String(expectedSecret));
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(403).json({ ok: false, error: 'Invalid courier webhook secret' });
      }
    } else if (!isAdminReq(req) && !isTenantReq(req)) {
      return res.status(401).json({ ok: false, error: 'Configure Courier Webhook Secret or authenticate.' });
    }

    const updated = db.updateOrderStatus(order.id, status || 'Dispatched', trackingNumber || order.trackingNumber);
    if (updated && updated.customerPhone && waEngine) {
      const msg = `📦 *Courier Tracking Update — Order #${updated.id}*\n\n🔄 *Status:* ${updated.status}\n${updated.trackingNumber ? `🔢 *Tracking:* ${updated.trackingNumber}\n` : ''}_ස්තූතියි!_`;
      waEngine.sendTextMessage(updated.customerPhone, msg, `wa_${updated.businessId}`).catch(() => {});
    }
    res.json({ ok: true, order: updated });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 🧾 Invoice Dispatch via WhatsApp ─────────────────────────────────────────
app.get('/api/orders/invoice/:orderId', requireSessionAuth, (req, res) => {
  const { orderId } = req.params;
  const bId = resolveReqBusinessId(req);
  const order = db.getOrders(bId).find(o => o.id === orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  if (!isOwnedByCaller(req, order)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant invoice access denied.' });
  }
  const biz = db.getBusiness(bId) || db.getActiveBusiness();

  const parsedAmount = parseFloat(String(order.amount).replace(/[^0-9.]/g, '')) || 0;
  const deliveryFee = order.deliveryFee !== undefined ? parseFloat(order.deliveryFee) : (parsedAmount >= 7800 ? 0 : 450);
  const subtotal = Math.max(0, parsedAmount - deliveryFee);

  res.json({
    ok: true,
    invoice: {
      invoiceNumber: `INV-${String(order.id).replace(/\D/g, '').slice(-4) || '1001'}`,
      orderId: order.id,
      date: order.createdAt,
      store: { name: biz.name, phone: biz.phone, bankDetails: biz.bankDetails },
      customer: { name: order.customerName, phone: order.customerPhone, address: order.address },
      items: [{ description: order.item, qty: 1, unitPrice: subtotal, total: subtotal }],
      subtotal,
      deliveryFee,
      grandTotal: parsedAmount,
      status: order.status,
      trackingNumber: order.trackingNumber || null
    }
  });
});

app.post('/api/orders/send-invoice', requireSessionAuth, async (req, res) => {
  try {
    const { orderId, customNote } = req.body;
    if (!orderId) return res.status(400).json({ ok: false, error: 'orderId is required' });
    const bId = resolveReqBusinessId(req);
    const biz = db.getBusiness(bId) || db.getActiveBusiness();

    const plan = db.SUBSCRIPTION_PLANS[biz.subscriptionPlan] || db.SUBSCRIPTION_PLANS.enterprise;
    if (plan.limits && plan.limits.digitalInvoices === false) {
      return res.status(403).json({ ok: false, error: 'Digital Invoices feature is only available on Pro & Enterprise plans. Please upgrade.' });
    }

    const orders = db.getOrders(bId);
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return res.status(404).json({ ok: false, error: 'Order not found' });

    const customerPhone = ord.customerPhone;
    if (!customerPhone) return res.status(400).json({ ok: false, error: 'Customer phone missing on order' });

    const invoiceText = `🧾 *OFFICIAL INVOICE / RECEIPT*\n` +
      `🏪 *${biz.name}*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📄 *Invoice No:* #${ord.id}\n` +
      `📅 *Date:* ${new Date(ord.createdAt || Date.now()).toLocaleDateString()}\n` +
      `👤 *Customer:* ${ord.customerName}\n` +
      `📍 *Address:* ${ord.address || 'Standard Delivery'}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📦 *Item:* ${ord.item}\n` +
      `💰 *Total Amount:* Rs. ${parseFloat(String(ord.amount).replace(/[^0-9.]/g, '') || 0).toLocaleString()}\n` +
      `💳 *Status:* ${ord.status.toUpperCase()}\n` +
      (ord.trackingNumber ? `🚚 *Tracking No:* ${ord.trackingNumber}\n` : '') +
      `━━━━━━━━━━━━━━━━━━\n` +
      (biz.bankDetails ? `🏦 *Bank Info:*\n${biz.bankDetails}\n━━━━━━━━━━━━━━━━━━\n` : '') +
      (customNote ? `${customNote}\n\n` : '') +
      `_Thank you for your business!_ 🙏✨`;

    const tenantAccounts = waEngine.getAccounts(bId);
    let targetAccId = (tenantAccounts.find(a => a.connected) || tenantAccounts[0])?.id || null;

    const result = await waEngine.sendTextMessage(customerPhone, invoiceText, targetAccId);
    if (result.ok) {
      db.addChatMessage(customerPhone, 'agent', `🧾 [Sent Official Invoice #${ord.id}]`, 'Agent', customerPhone, bId);
      // Attempt to send genuine PDF invoice attachment
      try {
        const pdfBuf = await generateInvoicePdf(ord, biz);
        await waEngine.sendDocumentMessage(customerPhone, pdfBuf, `Invoice-${ord.id}.pdf`, `Official Invoice #${ord.id}`, targetAccId);
      } catch (pdfErr) {
        console.warn('[invoice-pdf] Failed to dispatch PDF document to WhatsApp:', pdfErr.message);
      }
    }
    res.json({ ...result, customerPhone, orderId: ord.id });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── 📄 Download High-Resolution Vector PDF Invoice ─────────────────────────
app.get('/api/orders/:orderId/invoice.pdf', requireSessionAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const bId = resolveReqBusinessId(req);
    const order = db.getOrders(bId).find(o => o.id === orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    if (!isOwnedByCaller(req, order)) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant PDF invoice denied.' });
    }
    const biz = db.getBusiness(bId) || db.getActiveBusiness();

    const pdfBuffer = await generateInvoicePdf(order, biz);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${order.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('[invoice-pdf] Generation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── 📥 Export Orders & Contacts to CSV (Excel / Courier format) ─────────────
app.get('/api/export/orders.csv', requireAdminAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const orders = db.getOrders(bId);
  const biz = db.getBusiness(bId) || db.getActiveBusiness();

  const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Item', 'Amount (LKR)', 'Status', 'Address', 'Tracking Number', 'Source'];
  const rows = orders.map(o => [
    `"${(o.id || '').replace(/"/g, '""')}"`,
    `"${new Date(o.createdAt || Date.now()).toISOString().split('T')[0]}"`,
    `"${(o.customerName || '').replace(/"/g, '""')}"`,
    `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
    `"${(o.item || '').replace(/"/g, '""')}"`,
    `"${(o.amount || '0').replace(/"/g, '""')}"`,
    `"${(o.status || '').replace(/"/g, '""')}"`,
    `"${(o.address || '').replace(/"/g, '""')}"`,
    `"${(o.trackingNumber || '').replace(/"/g, '""')}"`,
    `"${(o.source || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `${(biz.name || 'Store').replace(/[^a-zA-Z0-9]/g, '_')}_Orders_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// ─── 🚚 Automated Courier Waybill Bulk Export (Koombiyo, Domex, Prompt X, Fardar) ──

// ─── 📱 vCard (.vcf) Phonebook Export (Feature 20) ──────────────────────────
app.get('/api/export/contacts.vcf', requireAdminAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const chats = db.getChats(bId);
  const biz = db.getBusiness(bId) || db.getActiveBusiness();

  let vcfLines = [];
  chats.forEach(c => {
    let rawPhone = c.customerPhone || c.id || '';
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.length >= 9) {
      if (!digits.startsWith('94') && digits.startsWith('0')) digits = '94' + digits.slice(1);
      if (!digits.startsWith('+') && !digits.startsWith('94')) digits = '94' + digits;
      const formattedPhone = '+' + digits.replace(/^\+/, '');
      const name = c.customerName || 'Customer ' + digits.slice(-4);

      vcfLines.push('BEGIN:VCARD');
      vcfLines.push('VERSION:3.0');
      vcfLines.push(`FN:${name}`);
      vcfLines.push(`TEL;TYPE=CELL:${formattedPhone}`);
      vcfLines.push(`NOTE:OmniSix AI Customer | Store: ${biz.name} | Archetype: ${c.archetype || 'General'}`);
      vcfLines.push('END:VCARD');
    }
  });

  const vcfContent = vcfLines.join('\r\n');
  const filename = `${(biz.name || 'OmniSix').replace(/[^a-zA-Z0-9]/g, '_')}_Contacts_${new Date().toISOString().split('T')[0]}.vcf`;
  res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(vcfContent);
});

// ─── 💾 Full Database Backup Export (.json) (Feature 16) ─────────────────────
app.get('/api/export/backup.json', requireAdminAuth, (req, res) => {
  try {
    const backupData = {
      exportDate: new Date().toISOString(),
      platform: 'OmniSix AI Enterprise Cloud',
      version: '6.3.0',
      businesses: db.getAllBusinesses(),
      products: db.data.products || [],
      orders: db.data.orders || [],
      chats: db.data.chats || [],
      licenses: db.data.licenses || [],
      broadcasts: db.data.broadcasts || [],
      customFlows: db.data.customFlows || [],
      settings: db.getSettings(),
      agentFleet: db.getAgentFleet()
    };
    const filename = `OmniSix_Backup_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── 🛡️ Customer Blacklist Engine (Feature 6) ─────────────────────────────────
app.get('/api/blacklist', requireSessionAuth, (req, res) => {
  res.json({ ok: true, blacklist: db.getBlacklist() });
});

app.post('/api/blacklist/toggle', requireSessionAuth, (req, res) => {
  const { phone, reason } = req.body;
  if (!phone) return res.status(400).json({ ok: false, error: 'Phone is required' });
  const result = db.toggleBlacklist(phone, reason);
  res.json({ ok: true, ...result });
});

// ─── 📝 Private Staff Notes (Feature 10) ─────────────────────────────────────
app.get('/api/notes/:phone', requireSessionAuth, (req, res) => {
  const notes = db.getCustomerNotes(req.params.phone);
  res.json({ ok: true, notes });
});

app.post('/api/notes/:phone', requireSessionAuth, (req, res) => {
  const { text, author } = req.body;
  if (!text) return res.status(400).json({ ok: false, error: 'Note text required' });
  const note = db.addCustomerNote(req.params.phone, text, author);
  res.json({ ok: true, note });
});

app.delete('/api/notes/:phone/:noteId', requireSessionAuth, (req, res) => {
  const success = db.deleteCustomerNote(req.params.phone, req.params.noteId);
  res.json({ ok: success });
});

// ─── 📊 Daily End-of-Day (EOD) Operations Summary (Feature 12) ───────────────
app.get('/api/eod-report', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const biz = db.getBusiness(bId) || db.getActiveBusiness();
  const allOrders = db.getOrders(bId);
  const todayStr = new Date().toISOString().split('T')[0];

  const todayOrders = allOrders.filter(o => (o.createdAt || '').startsWith(todayStr));
  const confirmed = todayOrders.filter(o => ['Confirmed', 'Slip Verified', 'In Production', 'Dispatched', 'Delivered'].includes(o.status));
  const totalRevenue = confirmed.reduce((sum, o) => sum + (parseFloat(String(o.amount || '0').replace(/[^0-9.]/g, '')) || 0), 0);
  const slipsCount = todayOrders.filter(o => o.status === 'Slip Verified').length;
  const dispatchedCount = todayOrders.filter(o => o.status === 'Dispatched').length;

  res.json({
    ok: true,
    store: biz.name,
    date: todayStr,
    todayOrdersCount: todayOrders.length,
    confirmedCount: confirmed.length,
    totalRevenueLKR: totalRevenue,
    slipsVerified: slipsCount,
    dispatchedCount: dispatchedCount,
    pendingAction: todayOrders.filter(o => o.status === 'Pending').length
  });
});

// ─── 🚚 Sri Lankan Delivery Rate Calculator (Feature 3) ──────────────────────
app.post('/api/calculator/shipping', (req, res) => {
  const { city, orderTotal } = req.body;
  const c = String(city || '').toLowerCase().trim();
  const total = parseFloat(orderTotal) || 0;

  // Free delivery rule: Orders over Rs. 7,500 get Free Delivery
  if (total >= 7500) {
    return res.json({ ok: true, city, shippingFee: 0, isFree: true, note: 'Free Delivery (Order over Rs. 7,500)' });
  }

  // Colombo 1-15: Rs. 350 | Western Province: Rs. 400 | Outstation: Rs. 450
  let fee = 450;
  let zone = 'Outstation / Islandwide';

  if (/colombos*(1[0-5]|[1-9])|dehiwala|mount lavinia|moratuwa|kotte|nugegoda|maharagama|rajagiriya/i.test(c)) {
    fee = 350;
    zone = 'Colombo Greater Suburbs';
  } else if (/gampaha|kalutara|negombo|ja-ela|wattala|kelaniya|kadawatha|panadura|horana/i.test(c)) {
    fee = 400;
    zone = 'Western Province';
  } else if (/kandy|kurunegala|galle|matara|ratnapura|badulla|anuradhapura|jaffna/i.test(c)) {
    fee = 450;
    zone = 'Major Provincial City';
  }

  res.json({ ok: true, city, shippingFee: fee, zone, isFree: false });
});

app.get('/api/export/courier-waybill.csv', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const orders = db.getOrders(bId);
  const biz = db.getBusiness(bId) || db.getActiveBusiness();
  const provider = (req.query.provider || 'koombiyo').toLowerCase().trim();

  let headers = [];
  let rows = [];

  const sanitize = (val) => String(val || "").replace(/"/g, '""').replace(/\r?\n/g, " ").trim();

  // Helper to extract clean phone
  const cleanPhone = (phone) => {
    let p = String(phone || '').replace(/\D/g, '');
    if (p.startsWith('94')) p = '0' + p.slice(2);
    return p;
  };

  // Helper to extract city from address
  const extractCity = (addr) => {
    if (!addr) return 'Colombo';
    const parts = addr.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : 'Colombo';
  };

  if (provider === 'domex') {
    // Domex Bulk Waybill Format
    headers = ['WaybillNumber', 'Name', 'Address', 'City', 'PhoneNo1', 'PhoneNo2', 'COD', 'ItemType', 'Weight', 'Remark'];
    rows = orders.map(o => [
      `"${sanitize(o.trackingNumber || o.id)}"`,
      `"${sanitize(o.customerName || 'Customer')}"`,
      `"${sanitize(o.address || 'Sri Lanka')}"`,
      `"${sanitize(extractCity(o.address))}"`,
      `"${cleanPhone(o.customerPhone)}"`,
      `""`,
      `"${parseFloat(o.amount) || 0}"`,
      `"${sanitize(o.item || 'Goods')}"`,
      `"1.0"`,
      `"Order #${o.id} - Handle with care"`
    ]);
  } else if (provider === 'promptx') {
    // Prompt X Logistics Bulk CSV Format
    headers = ['TrackingNumber', 'RecipientName', 'DeliveryAddress', 'Town', 'ContactNo', 'COD_Amount', 'OrderReference', 'Remarks'];
    rows = orders.map(o => [
      `"${sanitize(o.trackingNumber || '')}"`,
      `"${sanitize(o.customerName || 'Customer')}"`,
      `"${sanitize(o.address || 'Sri Lanka')}"`,
      `"${sanitize(extractCity(o.address))}"`,
      `"${cleanPhone(o.customerPhone)}"`,
      `"${parseFloat(o.amount) || 0}"`,
      `"${sanitize(o.id)}"`,
      `"Call before delivery"`
    ]);
  } else if (provider === 'fardar') {
    // Fardar Express Format
    headers = ['WaybillNo', 'ReceiverName', 'ReceiverAddress', 'Destination', 'Phone', 'COD', 'Pieces', 'Weight', 'Description'];
    rows = orders.map(o => [
      `"${sanitize(o.trackingNumber || o.id)}"`,
      `"${sanitize(o.customerName || 'Customer')}"`,
      `"${sanitize(o.address || 'Sri Lanka')}"`,
      `"${sanitize(extractCity(o.address))}"`,
      `"${cleanPhone(o.customerPhone)}"`,
      `"${parseFloat(o.amount) || 0}"`,
      `"1"`,
      `"1.0"`,
      `"${sanitize(o.item || 'Parcel')}"`
    ]);
  } else {
    // Koombiyo Delivery Format (Default Sri Lanka favorite)
    headers = ['Waybill_No', 'Consignee_Name', 'Consignee_Address', 'Consignee_City', 'Consignee_Phone', 'COD_Amount', 'Description', 'Special_Notes'];
    rows = orders.map(o => [
      `"${sanitize(o.trackingNumber || o.id)}"`,
      `"${sanitize(o.customerName || 'Customer')}"`,
      `"${sanitize(o.address || 'Sri Lanka')}"`,
      `"${sanitize(extractCity(o.address))}"`,
      `"${cleanPhone(o.customerPhone)}"`,
      `"${parseFloat(o.amount) || 0}"`,
      `"${sanitize(o.item || 'OmniSix Store Package')}"`,
      `"Order #${o.id} - Call customer before delivery"`
    ]);
  }

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `${provider.toUpperCase()}_Waybills_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// ─── 📊 Google Sheets Real-Time 2-Way Sync Webhook Receiver ──────────────────
app.post('/api/webhook/google-sheets', async (req, res) => {
  try {
    const { orderId, status, trackingNumber, secret } = req.body || {};
    const settings = db.getSettings();
    const expectedSecret = (settings.googleSheets && settings.googleSheets.secret) || process.env.GOOGLE_SHEETS_SECRET || '';
    if (expectedSecret) {
      const a = Buffer.from(String(secret || ''));
      const b = Buffer.from(String(expectedSecret));
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(403).json({ ok: false, error: 'Unauthorized secret token' });
      }
    } else if (!isAdminReq(req) && !isTenantReq(req)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: Configure Google Sheets webhook secret or authenticate.' });
    }
    if (!orderId) {
      return res.status(400).json({ ok: false, error: 'orderId is required' });
    }
    const order = db.updateOrderStatus(orderId, status || 'Confirmed', trackingNumber);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found in database' });
    }

    // Auto-dispatch customer WhatsApp notification if status changed to Dispatched
    if (status === 'Dispatched' && order.customerPhone && waEngine) {
      const trackMsg = `🚚 *ඇණවුම බෙදාහැරීම සඳහා භාර දෙන ලදී (Order Dispatched)!*\n\n` +
        `👤 පාරිභෝගික නම: *${order.customerName || 'Customer'}*\n` +
        `📦 ඇණවුම් අංකය: *#${order.id}*\n` +
        (trackingNumber ? `🚚 කුරියර් Tracking අංකය: *${trackingNumber}*\n` : '') +
        `📍 ලැබිය යුතු ලිපිනය: ${order.address || 'Standard Delivery'}\n\n` +
        `_දින 2-3ක් ඇතුළත කුරියර් නිලධාරියා ඔබව අමතා පාර්සලය භාරදෙනු ඇත. අප හා සම්බන්ධ වූවාට ස්තූතියි!_ 🙏✨`;
      waEngine.sendTextMessage(order.customerPhone, trackMsg).catch(() => {});
    }

    console.log(`[google-sheets-sync] ✅ Updated Order #${orderId} -> ${status} (Tracking: ${trackingNumber || 'N/A'})`);
    res.json({ ok: true, order });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/google-sheets/test-sync', requireSessionAuth, async (req, res) => {
  try {
    const settings = db.getSettings();
    const webhookUrl = req.body.webhookUrl || settings.googleSheets?.webhookUrl;
    if (!webhookUrl) {
      return res.status(400).json({ ok: false, error: 'Webhook URL not configured' });
    }
    const testPayload = {
      event: 'test_connection',
      timestamp: new Date().toISOString(),
      store: db.getActiveBusiness().name,
      message: 'OmniSix AI 2-Way Google Sheets Sync Connected Successfully!'
    };
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(8000)
    });
    res.json({ ok: true, status: response.status, statusText: response.statusText });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── 🤖 Autonomous 20-Agent Enterprise Fleet Endpoints ───────────────────────
app.get('/api/agents', requireSessionAuth, (req, res) => {
  const fleet = agentFleet.getFleet();
  const mode = agentFleet.getOperatingMode();
  const departments = {};
  fleet.forEach(a => {
    departments[a.dept] = (departments[a.dept] || 0) + 1;
  });
  const activeCount = fleet.filter(a => a.active).length;
  res.json({
    ok: true,
    totalAgents: fleet.length,
    activeAgents: activeCount,
    mode,
    departments,
    agents: fleet
  });
});

app.post('/api/agents/:id/toggle', requireAdminAuth, (req, res) => {
  const { active } = req.body;
  const updated = agentFleet.toggleAgent(req.params.id, active);
  if (!updated) return res.status(404).json({ ok: false, error: 'Agent not found' });
  res.json({ ok: true, agent: updated });
});

app.post('/api/agents/mode', requireAdminAuth, (req, res) => {
  const { mode } = req.body;
  const currentMode = agentFleet.setOperatingMode(mode);
  res.json({ ok: true, mode: currentMode });
});

app.get('/api/agents/decisions', requireSessionAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  res.json({ ok: true, decisions: agentFleet.getRecentDecisions(limit) });
});

app.post(['/api/agents/dispatch-test', '/api/agents/test-route'], requireSessionAuth, (req, res) => {
  const { text, phone } = req.body;
  const agent = agentFleet.resolveBestAgent(text, { phone });
  const decision = agentFleet.recordDecision(
    agent.id,
    phone || 'Preview Test',
    `Dispatched to ${agent.name} (${agent.title})`,
    `Intent detected for ${agent.dept}. Action directive activated: ${agent.directive.slice(0, 80)}...`
  );
  res.json({ ok: true, agent, decision });
});



app.get('/api/export/contacts.csv', requireAdminAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const chats = db.getChats(bId);
  const biz = db.getBusiness(bId) || db.getActiveBusiness();

  const headers = ['Customer Name', 'Phone Number', 'Last Active Date', 'Total Messages', 'Archetype'];
  const rows = chats.map(c => [
    `"${(c.customerName || 'Customer').replace(/"/g, '""')}"`,
    `"${(c.customerPhone || c.id || '').replace(/"/g, '""')}"`,
    `"${new Date(c.lastTime || Date.now()).toISOString().split('T')[0]}"`,
    `"${(c.messages || []).length}"`,
    `"${c.archetype || 'GENERAL'}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `${(biz.name || 'Store').replace(/[^a-zA-Z0-9]/g, '_')}_Contacts_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// ─── 🏪 17 Pre-Built Business Category Templates ─────────────────────────────
app.get('/api/categories', requireSessionAuth, (req, res) => {
  res.json({ ok: true, categories: categoryProfiles.getAllCategories() });
});

app.get('/api/categories/:id', requireSessionAuth, (req, res) => {
  const cat = categoryProfiles.getCategoryById(req.params.id);
  res.json({ ok: true, category: cat });
});

app.post('/api/categories/apply', requireSessionAuth, (req, res) => {
  const { categoryId, loadProducts } = req.body;
  const cat = categoryProfiles.getCategoryById(categoryId);
  if (!cat) return res.status(404).json({ ok: false, error: 'Category not found' });

  const bId = resolveReqBusinessId(req);
  const biz = db.getBusiness(bId) || db.getActiveBusiness();

  // Update business dataset and category
  biz.category = cat.name;
  biz.dataset = cat.starterDataset;
  db.saveBusiness(biz);

  // Seed starter products if requested (respecting plan limits)
  if (loadProducts && cat.starterProducts && cat.starterProducts.length > 0) {
    const planId = (biz && biz.subscriptionPlan) || 'enterprise';
    const plan = (db.SUBSCRIPTION_PLANS && db.SUBSCRIPTION_PLANS[planId]) || db.SUBSCRIPTION_PLANS?.enterprise;
    const currentProds = db.getProducts(bId) || [];
    const maxAllowed = (plan && plan.limits && plan.limits.products) || 999;
    const availableSlots = Math.max(0, maxAllowed - currentProds.length);

    cat.starterProducts.slice(0, availableSlots).forEach(p => {
      db.addProduct({
        ...p,
        businessId: bId
      });
    });
  }

  res.json({
    ok: true,
    message: `✨ ${cat.emoji} ${cat.name} (${cat.sinhalaName}) template applied successfully!`,
    category: cat,
    business: biz
  });
});

// ─── ⏰ Automated Follow-Up Engine APIs ───────────────────────────────────────
app.get('/api/leads/candidates', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, candidates: db.getFollowUpCandidates(bId) });
});

app.post('/api/leads/follow-up', requireSessionAuth, async (req, res) => {
  try {
    const { leadId, customMessage } = req.body;
    if (!leadId) return res.status(400).json({ ok: false, error: 'leadId is required' });
    const bId = resolveReqBusinessId(req);
    const candidates = db.getFollowUpCandidates(bId);
    const lead = candidates.find(l => l.id === leadId);
    if (!lead) return res.status(404).json({ ok: false, error: 'Lead not found or already confirmed' });

    const settings = db.getTenantSettings(bId) || db.getSettings();
    const store = db.getBusiness(bId) || db.getActiveBusiness();

    let text = customMessage;
    if (!text) {
      const template = lead.isFollowUpSent ? (settings.followUpStage2Message || settings.followUpMessage) : settings.followUpMessage;
      text = template
        .replace(/{customer}/gi, lead.customerName || 'Customer')
        .replace(/{name}/gi, lead.customerName || 'Customer')
        .replace(/{store}/gi, store.name || 'Store')
        .replace(/{inquiry}/gi, (lead.lastInquiryText || '').slice(0, 50));
    }

    let targetAccId = req.tenantBusinessId ? ('wa_' + req.tenantBusinessId) : null;
    const result = await waEngine.sendTextMessage(lead.customerPhone, text, targetAccId);
    if (result.ok) {
      db.markFollowUpSent(lead.id, lead.isFollowUpSent ? 2 : 1);
      db.addChatMessage(lead.customerPhone, 'ai', text, lead.customerName, lead.customerPhone, bId);
    }
    res.json(result);
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Products Catalog CRUD (From APK) ─────────────────────────────────────────
app.get('/api/products', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, products: db.getProducts(bId) });
});

app.post('/api/products', requireSessionAuth, (req, res) => {
  const bId = req.body.businessId || resolveReqBusinessId(req);
  const biz = db.getBusiness(bId) || db.getActiveBusiness();
  const planId = (biz && biz.subscriptionPlan) || 'enterprise';
  const plan = (db.SUBSCRIPTION_PLANS && db.SUBSCRIPTION_PLANS[planId]) || db.SUBSCRIPTION_PLANS?.enterprise;
  const currentProds = db.getProducts(bId) || [];
  if (plan && plan.limits && currentProds.length >= plan.limits.products) {
    return res.status(403).json({
      ok: false,
      error: `Product catalog limit reached for ${plan.name} (Max ${plan.limits.products} products). Upgrade your subscription plan to add more products.`
    });
  }
  const product = db.addProduct({ ...req.body, businessId: bId });
  res.json({ ok: true, product });
});

app.post('/api/products/update', requireSessionAuth, (req, res) => {
  const { id, ...updates } = req.body;
  const existing = (db.data.products || []).find(p => p.id === id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Product not found' });
  if (!isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant product update denied.' });
  }
  const product = db.updateProduct(id, updates);
  res.json({ ok: true, product });
});

app.post('/api/products/delete', requireSessionAuth, (req, res) => {
  const { id } = req.body;
  const existing = (db.data.products || []).find(p => p.id === id);
  if (existing && !isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant product delete denied.' });
  }
  const success = db.deleteProduct(id);
  res.json({ ok: success });
});

app.post('/api/products/send-photo', requireSessionAuth, async (req, res) => {
  try {
    const { phone, productId, accountId, customCaption } = req.body;
    if (!phone || !productId) {
      return res.status(400).json({ ok: false, error: 'phone and productId are required' });
    }
    const bId = resolveReqBusinessId(req);
    const products = db.getProducts(bId);
    const prod = products.find(p => p.id === productId);
    if (!prod || (!prod.imageUrl && (!prod.images || prod.images.length === 0))) {
      return res.status(404).json({ ok: false, error: 'Product or product image not found' });
    }
    const allImgs = (Array.isArray(prod.images) && prod.images.length > 0)
      ? prod.images.filter(Boolean)
      : [prod.imageUrl].filter(Boolean);

    const existingChat = db.getChat(phone);
    const sendTarget = (existingChat && existingChat.remoteJid) ? existingChat.remoteJid : phone;
    let targetAccId = accountId || (existingChat && existingChat.accountId) || null;
    if (!targetAccId && req.tenantBusinessId) {
      targetAccId = 'wa_' + req.tenantBusinessId;
    }

    const bizSettings = db.getTenantSettings(bId) || db.getSettings();
    const activeBiz = db.getBusiness(bId) || db.getActiveBusiness();
    let sentCount = 0;
    let lastResult = { ok: false, error: 'Failed to send' };
    for (let i = 0; i < allImgs.length; i++) {
      const caption = (i === 0)
        ? (customCaption || buildProductPhotoCaption(prod, i, allImgs.length, activeBiz, bizSettings, 'Sinhala'))
        : `📸 *${prod.name}* (${i + 1}/${allImgs.length})`;
      lastResult = await waEngine.sendImageMessage(sendTarget, allImgs[i], targetAccId, caption);
      if (lastResult && lastResult.ok) sentCount++;
      if (i < allImgs.length - 1) await new Promise(r => setTimeout(r, 600));
    }

    if (sentCount === 0) {
      return res.status(502).json({ ok: false, error: lastResult?.error || 'WhatsApp image delivery failed' });
    }

    const chatKey = (existingChat && existingChat.id) || String(phone).split('@')[0];
    db.addChatMessage(chatKey, 'agent', `📷 [Sent ${sentCount} Product Photos: ${prod.name}]`, existingChat?.customerName || 'Agent', existingChat?.customerPhone || chatKey, bId, {
      productId: prod.id,
      accountId: targetAccId || undefined
    });
    res.json({ ok: true, sentCount });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Custom Keyword Flows CRUD (From APK) ──────────────────────────────────────
app.get('/api/flows', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, flows: db.getCustomFlows(bId) });
});

app.post('/api/flows', requireSessionAuth, (req, res) => {
  const bId = req.body.businessId || resolveReqBusinessId(req);
  const flow = db.addCustomFlow({ ...req.body, businessId: bId });
  res.json({ ok: true, flow });
});

app.post('/api/flows/update', requireSessionAuth, (req, res) => {
  const { id, ...updates } = req.body;
  const existing = (db.data.customFlows || []).find(f => f.id === id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Flow not found' });
  if (!isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant flow update denied.' });
  }
  const flow = db.updateCustomFlow(id, updates);
  res.json({ ok: true, flow });
});

app.post('/api/flows/delete', requireSessionAuth, (req, res) => {
  const { id } = req.body;
  const existing = (db.data.customFlows || []).find(f => f.id === id);
  if (existing && !isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant flow delete denied.' });
  }
  const success = db.deleteCustomFlow(id);
  res.json({ ok: success });
});

// ─── Store & AI Persona Settings (From APK & Scoped Multi-Tenant) ─────────────
app.get('/api/settings', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  if (bId) {
    return res.json({ ok: true, settings: db.getTenantSettings(bId) });
  }
  res.json({ ok: true, settings: db.getSettings() });
});

app.post('/api/settings', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const activeBiz = db.getActiveBusiness();
  if (bId) {
    const settings = db.updateTenantSettings(bId, req.body);
    if (activeBiz && activeBiz.id === bId) {
      db.updateSettings(req.body);
    }
    return res.json({ ok: true, settings });
  }
  const settings = db.updateSettings(req.body);
  if (activeBiz && activeBiz.id) {
    db.updateTenantSettings(activeBiz.id, req.body);
  }
  res.json({ ok: true, settings });
});

// Customer Self-Service Gemini API Key Verification
app.post('/api/gemini/verify-key', async (req, res) => {
  const { apiKey } = req.body || {};
  const keyToTest = (apiKey || '').trim();
  if (!keyToTest || keyToTest.length < 15) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid Gemini API key (starts with AIza...)' });
  }

  const modelsToTry = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite'
  ];

  let lastErrMsg = '';
  let verifiedModel = null;

  for (const model of modelsToTry) {
    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToTest}`;
      const testRes = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with "OK"' }] }],
          generationConfig: { maxOutputTokens: 5 }
        }),
        signal: AbortSignal.timeout(8000)
      });

      const data = await testRes.json();
      if (testRes.ok && !data.error && data.candidates) {
        verifiedModel = model;
        break;
      } else {
        lastErrMsg = data.error?.message || `HTTP ${testRes.status}: Failed to authenticate`;
      }
    } catch (err) {
      lastErrMsg = err.message;
    }
  }

  if (!verifiedModel) {
    return res.status(400).json({ ok: false, error: lastErrMsg || 'Failed to verify key with Google AI Studio' });
  }

  // Key is verified and has live quota!
  const bId = resolveReqBusinessId(req);
  if (bId) {
    db.updateTenantSettings(bId, { geminiApiKey: keyToTest });
  } else {
    db.updateSettings({ geminiApiKey: keyToTest });
  }

  res.json({
    ok: true,
    message: 'Google Gemini API Key verified successfully!',
    model: verifiedModel,
    keyPrefix: keyToTest.slice(0, 8) + '...'
  });
});

// Live Chat Inbox & Human Takeover (Strict Multi-Tenant Scoped with Multi-Account WhatsApp Routing)
app.get('/api/chats', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const isTenant = isTenantReq(req);
  const targetBizId = isTenant ? bId : null;
  const accounts = db.getWhatsAppAccounts(targetBizId) || [];
  const chats = db.getChats(targetBizId) || [];

  // Match and enrich chats with WhatsApp account details
  chats.forEach(c => {
    let matchedAcc = null;
    if (c.accountId) {
      matchedAcc = accounts.find(a => a.id === c.accountId);
    }
    if (!matchedAcc && c.businessId) {
      matchedAcc = accounts.find(a => a.businessId === c.businessId);
    }
    if (!matchedAcc) {
      matchedAcc = accounts.find(a => a.id === 'default') || accounts[0] || { id: 'default', label: 'Primary Line', phoneNumber: '' };
    }
    c.accountId = (matchedAcc && matchedAcc.id) || c.accountId || 'default';
    c.accountLabel = (matchedAcc && matchedAcc.label) || c.accountLabel || 'WhatsApp Line';
    c.accountPhone = (matchedAcc && matchedAcc.phoneNumber) || c.accountPhone || '';
  });

  res.json({
    ok: true,
    chats,
    accounts
  });
});

app.post('/api/chats/reply', requireSessionAuth, async (req, res) => {
  const { chatId, text, accountId, customerName } = req.body;
  if (!chatId || !text) return res.status(400).json({ error: 'chatId and text required' });

  const isTenant = isTenantReq(req);
  const bId = resolveReqBusinessId(req);
  const chat = db.getChat(chatId);
  if (chat && !isOwnedByCaller(req, chat)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant chat access denied.' });
  }
  const targetAccId = accountId || (chat && chat.accountId) || (isTenant ? ('wa_' + bId) : 'default');

  const targetJid = (chat && chat.remoteJid) || (chatId.includes('@') ? chatId : (chatId.length > 13 ? (chatId + '@lid') : chatId));
  const result = db.addChatMessage(chatId, 'agent', text, customerName || (chat && chat.customerName) || 'Customer', chatId, bId, {
    accountId: targetAccId,
    remoteJid: targetJid
  });
  if (waEngine) {
    try {
      const sendRes = await waEngine.sendTextMessage(targetJid, text, targetAccId);
      console.log('[chats/reply] Sent via', targetAccId, 'to', targetJid, 'result:', sendRes);
    } catch (e) {
      console.warn('[chats/reply] WhatsApp send failed:', e.message);
    }
  }
  res.json({ ok: true, ...result });
});

app.post('/api/chats/read', requireSessionAuth, (req, res) => {
  const { chatId } = req.body || {};
  if (!chatId) return res.status(400).json({ ok: false, error: 'chatId required' });
  const existing = db.getChat(chatId);
  if (!existing) return res.status(404).json({ ok: false, error: 'Chat not found' });
  if (!isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant chat access denied.' });
  }
  const chat = db.markChatRead(chatId);
  res.json({ ok: true, chat });
});

app.post('/api/chats/delete', requireSessionAuth, (req, res) => {
  const { chatId } = req.body || {};
  if (!chatId) return res.status(400).json({ ok: false, error: 'chatId required' });
  const existing = db.getChat(chatId);
  if (!existing) return res.status(404).json({ ok: false, error: 'Chat not found' });
  if (!isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant chat access denied.' });
  }
  const deleted = db.deleteChat(chatId);
  res.json({ ok: deleted });
});

app.post('/api/chats/send-media', requireSessionAuth, async (req, res) => {
  try {
    const { chatId, accountId, mediaType, base64Data, mimeType, caption } = req.body || {};
    if (!chatId || !mediaType || !base64Data) {
      return res.status(400).json({ ok: false, error: 'chatId, mediaType, and base64Data are required' });
    }
    const existing = db.getChat(chatId);
    if (existing && !isOwnedByCaller(req, existing)) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant chat access denied.' });
    }
    const isTenant = isTenantReq(req);
    const bId = resolveReqBusinessId(req);
    const targetAccId = accountId || (existing && existing.accountId) || (isTenant ? ('wa_' + bId) : 'default');
    const targetJid = (existing && existing.remoteJid) || (chatId.includes('@') ? chatId : (chatId.length > 13 ? (chatId + '@lid') : chatId));

    const match = /^data:([^;]+);base64,(.+)$/s.exec(String(base64Data));
    const cleanMime = (mimeType || (match && match[1]) || (mediaType === 'audio' ? 'audio/ogg; codecs=opus' : 'image/jpeg')).trim();
    const rawB64 = match ? match[2] : String(base64Data);
    const mediaBuf = Buffer.from(rawB64, 'base64');
    if (!mediaBuf || mediaBuf.length === 0 || mediaBuf.length > 6 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: 'Media payload must be between 1 byte and 6MB.' });
    }

    let sendRes = { ok: false, error: 'WhatsApp engine unavailable' };
    if (waEngine) {
      if (mediaType === 'image') {
        sendRes = await waEngine.sendImageMessage(targetJid, mediaBuf, targetAccId, caption || '');
      } else if (mediaType === 'audio') {
        sendRes = await waEngine.sendVoiceMessage(targetJid, mediaBuf, targetAccId, true, cleanMime);
      } else {
        return res.status(400).json({ ok: false, error: 'Unsupported mediaType' });
      }
    }

    const savedCloud = await mediaStore.saveMedia(mediaBuf, cleanMime, {
      businessId: bId,
      chatId,
      mediaType,
      sender: 'agent'
    });

    const displayMsg = mediaType === 'image'
      ? (caption ? `📷 ${caption}` : '📷 [Agent Sent Image]')
      : '🎤 [Agent Sent Voice Note]';
    const result = db.addChatMessage(
      chatId,
      'agent',
      displayMsg,
      (existing && existing.customerName) || 'Customer',
      (existing && existing.customerPhone) || chatId,
      bId,
      mediaType === 'image'
        ? {
            accountId: targetAccId,
            remoteJid: targetJid,
            mediaUrl: savedCloud.ok ? savedCloud.url : null,
            imageBase64: rawB64.length <= 250000 ? rawB64 : null,
            imageMimeType: cleanMime
          }
        : {
            accountId: targetAccId,
            remoteJid: targetJid,
            mediaUrl: savedCloud.ok ? savedCloud.url : null,
            audioBase64: rawB64.length <= 250000 ? rawB64 : null,
            mimeType: cleanMime
          }
    );

    res.json({
      ok: true,
      delivered: !!(sendRes && sendRes.ok),
      deliveryError: (sendRes && !sendRes.ok) ? sendRes.error : null,
      ...result
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/chats/mute', requireSessionAuth, (req, res) => {
  const { chatId, isMuted } = req.body;
  const existing = db.getChat(chatId);
  if (existing && !isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant chat access denied.' });
  }
  const chat = db.setChatAiMute(chatId, !!isMuted);
  res.json({ ok: true, chat });
});

// WhatsApp Simulated / Webhook Incoming Message
app.post('/api/whatsapp/incoming', requireSessionAuth, async (req, res) => {
  const { chatId, customerName, text } = req.body;
  const id = chatId || ('9477' + Math.floor(1000000 + Math.random() * 9000000));
  const name = customerName || 'Customer';
  const incomingText = text || '';

  const bId = resolveReqBusinessId(req);
  const activeBiz = (bId && db.getBusiness(bId)) || db.getActiveBusiness();
  db.addChatMessage(id, 'customer', incomingText, name, id, activeBiz.id);

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
    isWhatsApp: true,
    isVoiceCall: false,
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

// ─── 📢 Spintax Parser & Dynamic Variable Interpolation ─────────────────────
function parseSpintax(text) {
  if (!text || typeof text !== 'string') return text || '';
  const spintaxRegex = /\{([^{}]+)\}/g;
  let matches;
  while ((matches = spintaxRegex.exec(text)) !== null) {
    const choices = matches[1].split('|');
    const randomChoice = choices[Math.floor(Math.random() * choices.length)];
    text = text.replace(matches[0], randomChoice);
    spintaxRegex.lastIndex = 0;
  }
  return text;
}

function interpolateBroadcastTemplate(template, contact = {}) {
  let res = parseSpintax(template || '');
  for (const [key, val] of Object.entries(contact)) {
    const reg = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    res = res.replace(reg, val || '');
  }
  return res;
}

function resolveBroadcastTargets(bId, contacts) {
  if (Array.isArray(contacts) && contacts.length > 0) {
    return contacts.map(c => ({
      name: c.name || 'Customer',
      phone: String(c.phone || c.mobile || '').replace(/\D/g, ''),
      city: c.city || c.address || '',
      var1: c.var1 || ''
    })).filter(c => c.phone.length >= 9);
  }
  const chats = db.getChats(bId);
  const seen = new Set();
  const list = [];
  for (const c of chats) {
    const clean = String(c.customerPhone || '').replace(/\D/g, '');
    if (clean.length >= 9 && !seen.has(clean)) {
      seen.add(clean);
      list.push({ name: c.customerName || 'Customer', phone: clean, city: '' });
    }
  }
  return list;
}

async function executeBroadcastCampaign(broadcast) {
  const bId = broadcast.businessId || db.getActiveBusiness().id;
  const targetContacts = resolveBroadcastTargets(bId, broadcast.contacts);
  const targetAccId = broadcast.accountId || null;
  const minS = Math.max(1, Number(broadcast.minDelay) || 8);
  const maxS = Math.max(minS, Number(broadcast.maxDelay) || 22);

  broadcast.status = 'In Progress';
  broadcast.targetCount = targetContacts.length;
  db.save();

  if ((!broadcast.message && !broadcast.imageUrl) || targetContacts.length === 0) {
    broadcast.status = 'Completed';
    db.save();
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const recipient of targetContacts) {
    try {
      const personalizedText = interpolateBroadcastTemplate(broadcast.message || '', recipient);
      const sendRes = broadcast.imageUrl
        ? await waEngine.sendImageMessage(recipient.phone, broadcast.imageUrl, targetAccId, personalizedText)
        : await waEngine.sendTextMessage(recipient.phone, personalizedText, targetAccId);
      if (sendRes.ok) {
        sent++;
        db.addChatMessage(recipient.phone, 'ai', personalizedText || '📷 [Broadcast Image]', recipient.name, recipient.phone, bId, {
          accountId: targetAccId || undefined
        });
      } else {
        failed++;
      }
    } catch (_) {
      failed++;
    }
    const delaySec = Math.floor(Math.random() * (maxS - minS + 1)) + minS;
    await new Promise(r => setTimeout(r, delaySec * 1000));
  }

  broadcast.status = 'Completed';
  broadcast.sentCount = sent;
  broadcast.failedCount = failed;
  db.save();
  console.log(`[broadcast] 📢 Completed campaign "${broadcast.title}" (${bId}): ${sent} sent, ${failed} failed.`);
}

const broadcastSchedulerTimer = setInterval(() => {
  try {
    const due = db.getDueScheduledBroadcasts(Date.now());
    for (const bc of due) {
      executeBroadcastCampaign(bc).catch(() => {});
    }
  } catch (_) {}
}, 30 * 1000);
if (broadcastSchedulerTimer.unref) broadcastSchedulerTimer.unref();

// ─── Safe Broadcast Campaigns with Anti-Ban Spintax, Scheduling & Human Delays ─
app.get('/api/broadcasts', requireSessionAuth, (req, res) => {
  const isTenant = isTenantReq(req);
  const bId = resolveReqBusinessId(req);
  res.json({
    ok: true,
    broadcasts: db.getBroadcasts(isTenant ? bId : null)
  });
});

app.post('/api/broadcasts', requireSessionAuth, async (req, res) => {
  const isTenant = isTenantReq(req);
  const bId = resolveReqBusinessId(req) || db.getActiveBusiness().id;
  const targetBiz = db.getBusiness(bId) || db.getActiveBusiness();
  const targetAccId = isTenant ? ('wa_' + bId) : (req.body.accountId || null);
  const { title, message, contacts, imageUrl, scheduledAt, minDelay = 8, maxDelay = 22 } = req.body || {};

  const targetContacts = resolveBroadcastTargets(bId, contacts);
  const schedTs = scheduledAt ? new Date(scheduledAt).getTime() : NaN;
  const isFutureScheduled = !isNaN(schedTs) && schedTs > Date.now() + 15000;

  const broadcast = db.addBroadcast({
    title: title || 'Marketing Campaign',
    message: message || '',
    imageUrl: imageUrl || null,
    accountId: targetAccId,
    contacts: Array.isArray(contacts) ? targetContacts : null,
    minDelay,
    maxDelay,
    scheduledAt: isFutureScheduled ? new Date(schedTs).toISOString() : null,
    targetAudience: req.body?.targetAudience || (Array.isArray(contacts) ? 'Custom Upload List' : 'All Customers'),
    targetCount: targetContacts.length,
    status: isFutureScheduled ? 'Scheduled' : 'In Progress',
    sentCount: 0,
    failedCount: 0,
    businessId: targetBiz.id
  });

  if (!isFutureScheduled && (message || imageUrl) && targetContacts.length > 0) {
    executeBroadcastCampaign(broadcast).catch(() => {});
  }

  res.json({ ok: true, broadcast });
});

// ─── 🌐 Meta Official WhatsApp Cloud API Webhooks ─────────────────────────────
app.get('/api/webhook/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const settings = db.getSettings();
  const configuredToken = (settings.metaCloudApi && settings.metaCloudApi.verifyToken) || process.env.META_VERIFY_TOKEN || 'omnisix_meta_verify_2026';

  if (mode === 'subscribe' && token === configuredToken) {
    console.log('[meta-webhook] ✅ Meta Webhook verified successfully!');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/api/webhook/meta', async (req, res) => {
  try {
    const body = req.body;
    if (body && body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message) {
        const from = message.from;
        const customerName = value?.contacts?.[0]?.profile?.name || 'Customer';
        const displayNum = String(value?.metadata?.display_phone_number || '').replace(/\D/g, '');
        const allBiz = db.getAllBusinesses();
        const targetBiz = (displayNum && allBiz.find(b => {
          const bp = String(b.whatsappPhone || b.phone || '').replace(/\D/g, '');
          return bp && displayNum.slice(-9) === bp.slice(-9);
        })) || db.getActiveBusiness();

        const existingChat = db.getChat(from);
        const settings = db.getTenantSettings(targetBiz.id) || db.getSettings();
        const metaCfg = (settings && settings.metaCloudApi) || db.getSettings()?.metaCloudApi;
        const appSecret = (metaCfg && metaCfg.appSecret) || process.env.META_APP_SECRET;
        if (appSecret) {
          const sigHeader = String(req.headers['x-hub-signature-256'] || '');
          const expectedSig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody || '').digest('hex');
          const sigA = Buffer.from(sigHeader);
          const sigB = Buffer.from(expectedSig);
          if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
            return res.status(403).json({ ok: false, error: 'Invalid Meta webhook signature' });
          }
        }

        const accId = 'wa_' + targetBiz.id;
        let extractedText =
          message?.text?.body ||
          message?.interactive?.button_reply?.title ||
          message?.interactive?.list_reply?.title ||
          message?.button?.text ||
          message?.image?.caption ||
          '';

        const extraMsgData = { accountId: accId, channel: 'meta_cloud' };
        const rawCaption = message?.image?.caption || '';

        if (message.type === 'image' && message.image?.id && metaCfg?.token) {
          const dl = await waEngine.downloadMetaCloudMedia(message.image.id, metaCfg);
          if (dl.ok && dl.buffer) {
            extraMsgData.imageBase64 = dl.buffer.toString('base64');
            extraMsgData.imageMimeType = dl.mimeType || 'image/jpeg';
            const vis = await analyzeImageBuffer(dl.buffer, dl.mimeType, rawCaption, targetBiz.name, settings.geminiApiKey);
            if (vis && vis.imageDescription) {
              extraMsgData.visionSummary = vis.isBankSlip
                ? `Bank Slip Verified (${vis.amount || 'Amount N/A'})`
                : vis.imageDescription;
              extractedText = `[📷 Image Content: ${vis.imageDescription}]${rawCaption ? `\nCustomer Caption: ${rawCaption}` : ''}`;
            } else if (!extractedText) {
              extractedText = '[📷 Customer Sent Image]';
            }
          }
        } else if (message.type === 'audio' && message.audio?.id && metaCfg?.token) {
          const dl = await waEngine.downloadMetaCloudMedia(message.audio.id, metaCfg);
          if (dl.ok && dl.buffer) {
            extraMsgData.audioBase64 = dl.buffer.toString('base64');
            extraMsgData.mimeType = dl.mimeType || 'audio/ogg';
            const transcript = await transcribeAudioBuffer(dl.buffer, dl.mimeType);
            if (transcript) {
              extractedText = transcript;
            }
          }
        }

        if (extractedText) {
          console.log(`[meta-webhook] 📩 Incoming Meta WhatsApp (${targetBiz.name}) from +${from}: "${extractedText.slice(0, 80)}"`);
          const savedIn = db.addChatMessage(from, 'customer', extractedText, customerName, from, targetBiz.id, extraMsgData);

          const isMuted = existingChat && existingChat.aiMuted && Date.now() < (existingChat.aiMuteUntil || 0);
          if (!isMuted) {
            const history = ((savedIn && savedIn.chat && savedIn.chat.messages) || [])
              .slice(0, -1)
              .slice(-8)
              .map(m => ({
                role: m.sender === 'customer' ? 'user' : 'model',
                parts: [{ text: m.text }]
              }));

            const tempSess = {
              storeName: targetBiz.name,
              businessId: targetBiz.id,
              business: targetBiz,
              customerName,
              customerPhone: from,
              dataset: targetBiz.dataset,
              isWhatsApp: true,
              isVoiceCall: false,
              isCustomerImage: message.type === 'image',
              rawCaption,
              history
            };

            const rawReply = await getGeminiReply(extractedText, tempSess);
            if (rawReply) {
              checkForOrderTag(rawReply, tempSess, from);
              const photoMatch = waEngine.matchProductsForMessage({
                businessId: targetBiz.id,
                customerText: extractedText,
                aiReply: rawReply,
                isImage: message.type === 'image',
                rawCaption
              });
              const aiReply = photoMatch.cleanedReply;

              for (const prod of photoMatch.matchedProducts) {
                const allImages = (Array.isArray(prod.images) && prod.images.length > 0)
                  ? prod.images.filter(Boolean)
                  : [prod.imageUrl].filter(Boolean);
                for (let i = 0; i < allImages.length; i++) {
                  const cap = i === 0 ? `📸 *${prod.name}* - Rs. ${Number(prod.price || 0).toLocaleString()}` : `📸 *${prod.name}* (${i + 1}/${allImages.length})`;
                  await waEngine.sendImageMessage(from, allImages[i], accId, cap);
                }
                db.addChatMessage(from, 'ai', `📷 [Product Photos (${allImages.length}): ${prod.name}]`, customerName, from, targetBiz.id, {
                  accountId: accId,
                  productId: prod.id
                });
              }

              if (aiReply) {
                if (metaCfg && metaCfg.enabled && metaCfg.phoneNumberId && metaCfg.token) {
                  await waEngine.sendMetaCloudMessage(from, aiReply, metaCfg);
                } else {
                  await waEngine.sendTextMessage(from, aiReply, accId);
                }
                db.addChatMessage(from, 'ai', aiReply, customerName, from, targetBiz.id, {
                  accountId: accId,
                  channel: 'meta_cloud'
                });
              }
            }
          }
        }
      }
    } else if (body && (body.object === 'page' || body.object === 'instagram')) {
      const channelName = body.object === 'instagram' ? 'instagram' : 'messenger';
      const entry = body.entry?.[0];
      const msgEvt = entry?.messaging?.[0];
      const senderId = msgEvt?.sender?.id;
      const recipientId = msgEvt?.recipient?.id;
      const attachments = Array.isArray(msgEvt?.message?.attachments) ? msgEvt.message.attachments : [];
      let incomingText = msgEvt?.message?.text || '';
      if (senderId && (incomingText || attachments.length > 0) && !msgEvt?.message?.is_echo) {
        const allBiz = db.getAllBusinesses();
        const matchedBiz = allBiz.find(b => {
          const ts = db.getTenantSettings(b.id) || {};
          const mo = ts.metaOmnichannel || {};
          return recipientId && (mo.pageId === recipientId || mo.igAccountId === recipientId);
        }) || db.getActiveBusiness();
        const settings = db.getTenantSettings(matchedBiz.id) || db.getSettings();
        const moCfg = settings.metaOmnichannel || {};
        const chatKey = `${channelName}_${senderId}`;
        const extraMsgData = { accountId: 'wa_' + matchedBiz.id, channel: channelName };
        let hasImageAttachment = false;
        const rawCaption = incomingText;

        for (const att of attachments) {
          const attUrl = att?.payload?.url;
          if (!attUrl || !/^https?:\/\//i.test(attUrl)) continue;
          try {
            const dlRes = await fetch(attUrl, { signal: AbortSignal.timeout(10000) });
            if (!dlRes.ok) continue;
            const buf = Buffer.from(await dlRes.arrayBuffer());
            const mime = (dlRes.headers.get('content-type') || (att.type === 'audio' ? 'audio/mp4' : 'image/jpeg')).split(';')[0].trim();
            const savedMedia = await mediaStore.saveMedia(buf, mime, { source: `${channelName}_in`, businessId: matchedBiz.id, senderId }).catch(() => null);
            if (savedMedia && savedMedia.url) extraMsgData.mediaUrl = savedMedia.url;
            if (att.type === 'image') {
              hasImageAttachment = true;
              extraMsgData.imageMimeType = mime;
              const vis = await analyzeImageBuffer(buf, mime, rawCaption, matchedBiz.name, settings.geminiApiKey);
              if (vis && vis.imageDescription) {
                extraMsgData.visionSummary = vis.imageDescription;
                incomingText = `[📷 Image Content: ${vis.imageDescription}]${rawCaption ? `\nCustomer Caption: ${rawCaption}` : ''}`;
              } else if (!incomingText) {
                incomingText = '📷 [Customer Sent an Image]';
              }
            } else if (att.type === 'audio') {
              extraMsgData.mimeType = mime;
              const transcript = await transcribeAudioBuffer(buf, mime);
              if (transcript) {
                incomingText = `🎤 ${transcript}`;
              } else if (!incomingText) {
                incomingText = '🎤 [Customer Voice Message]';
              }
            }
          } catch (_) {}
        }

        if (incomingText) {
          const savedIn = db.addChatMessage(chatKey, 'customer', incomingText, `${channelName === 'instagram' ? 'IG' : 'FB'} User ${String(senderId).slice(-4)}`, senderId, matchedBiz.id, extraMsgData);
          const isMuted = savedIn?.chat?.aiMuted && Date.now() < (savedIn.chat.aiMuteUntil || 0);
          if (!isMuted) {
            const history = (savedIn?.chat?.messages || []).slice(0, -1).slice(-8).map(m => ({
              role: m.sender === 'customer' ? 'user' : 'model',
              parts: [{ text: m.text }]
            }));
            const rawReply = await getGeminiReply(incomingText, {
              storeName: matchedBiz.name,
              businessId: matchedBiz.id,
              business: matchedBiz,
              customerName: 'Customer',
              customerPhone: chatKey,
              dataset: matchedBiz.dataset,
              isWhatsApp: false,
              isVoiceCall: false,
              isCustomerImage: hasImageAttachment,
              rawCaption,
              history
            });
            if (rawReply) {
              const photoMatch = waEngine.matchProductsForMessage({
                businessId: matchedBiz.id,
                customerText: incomingText,
                aiReply: rawReply,
                isImage: hasImageAttachment,
                rawCaption
              });
              const aiReply = photoMatch.cleanedReply;
              for (const prod of photoMatch.matchedProducts) {
                const imgs = (Array.isArray(prod.images) && prod.images.length > 0) ? prod.images.filter(Boolean) : [prod.imageUrl].filter(Boolean);
                for (const imgSrc of imgs.slice(0, 3)) {
                  let pubUrl = imgSrc;
                  if (imgSrc.startsWith('/api/media/')) {
                    pubUrl = `${CALL_SERVER_URL.replace(/\/+$/, '')}${imgSrc}`;
                  } else if (imgSrc.startsWith('data:')) {
                    const up = await mediaStore.saveMedia(imgSrc, 'image/jpeg', { source: `${channelName}_prod`, businessId: matchedBiz.id }).catch(() => null);
                    if (up && up.url) pubUrl = up.url.startsWith('http') ? up.url : `${CALL_SERVER_URL.replace(/\/+$/, '')}${up.url}`;
                  }
                  if (moCfg.enabled && moCfg.pageAccessToken && /^https?:\/\//i.test(pubUrl)) {
                    await commerce.sendMetaSocialImage(senderId, pubUrl, moCfg.pageAccessToken);
                  }
                }
                db.addChatMessage(chatKey, 'ai', `📷 [Product Photos (${imgs.length}): ${prod.name}]`, 'Customer', senderId, matchedBiz.id, {
                  accountId: 'wa_' + matchedBiz.id,
                  channel: channelName,
                  productId: prod.id
                });
              }
              if (aiReply) {
                if (moCfg.enabled && moCfg.pageAccessToken) {
                  await commerce.sendMetaSocialMessage(senderId, aiReply, moCfg.pageAccessToken);
                }
                db.addChatMessage(chatKey, 'ai', aiReply, 'Customer', senderId, matchedBiz.id, {
                  accountId: 'wa_' + matchedBiz.id,
                  channel: channelName
                });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[meta-webhook] Processing error:', err.message);
  }
  res.sendStatus(200);
});

// ─── 👥 Multi-User Staff & Role-Based Access Control (RBAC) ─────────────────
app.get('/api/staff', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const list = (db.getStaff(bId) || []).map(({ password, ...safeMember }) => safeMember);
  res.json({ ok: true, staff: list });
});

app.post('/api/staff/create', requireSessionAuth, (req, res) => {
  try {
    const bId = resolveReqBusinessId(req);
    const member = db.addStaff({ ...req.body, businessId: bId });
    const { password, ...safeMember } = member;
    res.json({ ok: true, member: safeMember });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/staff/delete', requireSessionAuth, (req, res) => {
  try {
    const { id } = req.body;
    const bId = resolveReqBusinessId(req);
    const existing = (db.data.staff || []).find(s => s.id === id);
    if (existing && isTenantReq(req) && existing.businessId !== bId) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant staff deletion denied.' });
    }
    db.deleteStaff(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/staff/login', (req, res) => {
  const { username, password } = req.body || {};
  const staff = db.authenticateStaff(username, password);
  if (staff) {
    const token = db.createStaffSession(staff);
    res.json({
      ok: true,
      token,
      user: {
        id: staff.id,
        name: staff.name,
        username: staff.username,
        role: staff.role,
        businessId: staff.businessId
      }
    });
  } else {
    res.status(401).json({ ok: false, error: 'Invalid staff username or password' });
  }
});

// ─── Multi-Account WhatsApp (Baileys Multi-Device) Endpoints ───────────────
app.get('/api/whatsapp/status', requireSessionAuth, (req, res) => {
  if (isTenantReq(req)) {
    const bId = resolveReqBusinessId(req);
    const tenantAccounts = waEngine.getAccounts(bId);
    const primary = tenantAccounts[0] || {
      id: 'wa_' + bId,
      label: 'Store WhatsApp',
      connected: false,
      phoneNumber: null,
      statusText: 'No account linked yet',
      qrDataUrl: null,
      pairingCode: null,
      hasQr: false
    };
    return res.json({
      ok: true,
      isTenant: true,
      ...primary,
      totalAccounts: tenantAccounts.length,
      accounts: tenantAccounts
    });
  }
  res.json({
    ok: true,
    ...waEngine.getStatus()
  });
});

app.get('/api/whatsapp/accounts', requireSessionAuth, async (req, res) => {
  if (isTenantReq(req)) {
    const bId = resolveReqBusinessId(req);
    const biz = db.getBusiness(bId) || db.getAllBusinesses().find(b => b.id === bId);
    const bizName = biz ? biz.name : 'Store';

    // Auto-provision tenant WhatsApp primary account if not already created
    await waEngine.getOrCreateTenantAccount(bId, bizName);
    const tenantAccounts = waEngine.getAccounts(bId);

    return res.json({
      ok: true,
      isTenant: true,
      accounts: tenantAccounts.filter(a => a.id !== 'default')
    });
  }

  // Super Admin view:
  const filterBizId = req.headers['x-business-id'];
  let allAccounts = waEngine.getAccounts();
  if (filterBizId && filterBizId !== 'all') {
    allAccounts = allAccounts.filter(a => a.id === 'default' || a.businessId === filterBizId || !a.businessId);
  }

  res.json({
    ok: true,
    accounts: allAccounts
  });
});

app.post('/api/whatsapp/accounts/add', requireSessionAuth, async (req, res) => {
  try {
    const { label } = req.body;
    let targetBizId = null;

    if (isTenantReq(req)) {
      targetBizId = resolveReqBusinessId(req);
      const biz = db.getBusiness(targetBizId) || db.getAllBusinesses().find(b => b.id === targetBizId);
      const plan = (biz && biz.subscriptionPlan) || 'starter';
      const maxLines = (plan === 'enterprise') ? 5 : ((plan === 'pro') ? 2 : 1);
      const currentAccounts = waEngine.getAccounts(targetBizId);

      if (currentAccounts.length >= maxLines) {
        return res.status(403).json({
          ok: false,
          error: `Your ${plan.toUpperCase()} plan limit is ${maxLines} WhatsApp line(s). Please upgrade your subscription to add additional lines.`
        });
      }
    } else {
      targetBizId = req.headers['x-business-id'] || (db.getActiveBusiness() ? db.getActiveBusiness().id : 'default');
    }

    const session = await waEngine.addAccount(label, targetBizId);
    res.json({
      ok: true,
      account: session.getStatus()
    });
  } catch (err) {
    console.error('Error adding WhatsApp account:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/accounts/:id/pairing-code', requireSessionAuth, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    let targetId = req.params.id;
    if (isTenantReq(req)) {
      const bId = resolveReqBusinessId(req);
      const tenantAccounts = waEngine.getAccounts(bId);
      const belongs = tenantAccounts.find(a => a.id === targetId);
      if (!belongs && (!targetId || targetId === 'store' || targetId === 'default')) {
        targetId = 'wa_' + bId;
      }
    }
    const code = await waEngine.requestPhonePairingCode(phoneNumber, targetId);
    res.json({ ok: true, pairingCode: code, accountId: targetId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/accounts/:id/restart', requireSessionAuth, async (req, res) => {
  try {
    let targetId = req.params.id;
    if (isTenantReq(req)) {
      const bId = resolveReqBusinessId(req);
      const tenantAccounts = waEngine.getAccounts(bId);
      const belongs = tenantAccounts.find(a => a.id === targetId);
      if (!belongs && (!targetId || targetId === 'store' || targetId === 'default')) {
        targetId = 'wa_' + bId;
      }
    }
    const result = await waEngine.restartAccount(targetId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/accounts/:id/toggle-bot', requireSessionAuth, async (req, res) => {
  try {
    const { botActive } = req.body;
    let targetId = req.params.id;
    if (isTenantReq(req)) {
      const bId = resolveReqBusinessId(req);
      const tenantAccounts = waEngine.getAccounts(bId);
      const belongs = tenantAccounts.find(a => a.id === targetId);
      if (!belongs && (!targetId || targetId === 'store' || targetId === 'default')) {
        targetId = 'wa_' + bId;
      }
    }
    const result = await waEngine.toggleBot(targetId, botActive);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/accounts/:id/logout', requireSessionAuth, async (req, res) => {
  try {
    let targetId = req.params.id;
    if (isTenantReq(req)) {
      const bId = resolveReqBusinessId(req);
      const tenantAccounts = waEngine.getAccounts(bId);
      const belongs = tenantAccounts.find(a => a.id === targetId);
      if (!belongs && (!targetId || targetId === 'store' || targetId === 'default')) {
        targetId = 'wa_' + bId;
      }
    }
    const result = await waEngine.logout(targetId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/accounts/:id/delete', requireSessionAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === 'default') {
      return res.status(403).json({ ok: false, error: 'Cannot delete primary master account. Use Disconnect instead.' });
    }
    if (isTenantReq(req)) {
      const bId = resolveReqBusinessId(req);
      if (targetId === 'wa_' + bId) {
        return res.status(403).json({ ok: false, error: 'Cannot delete primary store account. Use Disconnect instead.' });
      }
    }
    const result = await waEngine.deleteAccount(targetId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/pairing-code', requireSessionAuth, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    let accountId = req.body.accountId || 'default';
    if (isTenantReq(req)) {
      const bId = resolveReqBusinessId(req);
      accountId = 'wa_' + bId;
      const biz = db.getBusiness(bId) || db.getAllBusinesses().find(b => b.id === bId);
      await waEngine.getOrCreateTenantAccount(bId, biz ? biz.name : 'Store');
    }
    const code = await waEngine.requestPhonePairingCode(phoneNumber, accountId);
    res.json({ ok: true, pairingCode: code, accountId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/whatsapp/logout', requireSessionAuth, async (req, res) => {
  let accountId = req.body.accountId || 'default';
  if (isTenantReq(req)) {
    const bId = resolveReqBusinessId(req);
    accountId = 'wa_' + bId;
  }
  await waEngine.logout(accountId);
  res.json({ ok: true });
});

app.post('/api/whatsapp/restart', requireSessionAuth, async (req, res) => {
  try {
    let targetId = req.body && req.body.accountId;
    if (isTenantReq(req)) {
      const bId = resolveReqBusinessId(req);
      targetId = 'wa_' + bId;
    }
    if (targetId) {
      const result = await waEngine.restartAccount(targetId);
      return res.json(result);
    }
    await waEngine.start();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── 1. WhatsApp Number Warmer API ───────────────────────────────────────────
app.get('/api/warmer', requireSessionAuth, (req, res) => {
  res.json({ ok: true, warmer: db.getWarmer() });
});

app.post('/api/warmer/toggle', requireAdminAuth, (req, res) => {
  const { running } = req.body;
  const warmer = db.updateWarmer({ running: !!running });
  res.json({ ok: true, warmer });
});

app.post('/api/warmer/settings', requireAdminAuth, (req, res) => {
  const { minDelay, maxDelay, intervalSeconds } = req.body;
  const warmer = db.updateWarmer({
    minDelay: Number(minDelay) || 20,
    maxDelay: Number(maxDelay) || 60,
    intervalSeconds: Number(intervalSeconds) || 45
  });
  res.json({ ok: true, warmer });
});

app.post('/api/warmer/scripts/add', requireAdminAuth, (req, res) => {
  const { question, answer } = req.body;
  const scripts = db.addWarmerScript(question, answer);
  res.json({ ok: true, scripts });
});

app.delete('/api/warmer/scripts/:id', requireAdminAuth, (req, res) => {
  const scripts = db.deleteWarmerScript(req.params.id);
  res.json({ ok: true, scripts });
});

app.post('/api/warmer/logs/clear', requireAdminAuth, (req, res) => {
  res.json(db.clearWarmerLogs());
});

// ─── 2. Contact Management & Advanced Phonebook API ──────────────────────────
app.get('/api/contacts', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({
    ok: true,
    contacts: db.getContacts(bId),
    groups: db.getContactGroups(bId)
  });
});

app.post('/api/contacts', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const contact = db.saveContact({ ...req.body, businessId: bId });
  res.json({ ok: true, contact });
});

app.post('/api/contacts/bulk', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const { contacts } = req.body;
  if (!Array.isArray(contacts)) {
    return res.status(400).json({ ok: false, error: 'contacts array is required.' });
  }
  const result = db.bulkImportContacts(bId, contacts);
  res.json(result);
});

app.delete('/api/contacts/:id', requireSessionAuth, (req, res) => {
  res.json(db.deleteContact(req.params.id));
});

app.get('/api/contacts/groups', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, groups: db.getContactGroups(bId) });
});

// ─── 3. Kanban CRM & Deal Pipeline API ───────────────────────────────────────
app.get('/api/kanban/deals', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, deals: db.getKanbanDeals(bId) });
});

app.post('/api/kanban/deals', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const deal = db.saveKanbanDeal({ ...req.body, businessId: bId });
  res.json({ ok: true, deal });
});

app.post('/api/kanban/deals/:id/stage', requireSessionAuth, (req, res) => {
  const { stage } = req.body;
  const deal = db.updateDealStage(req.params.id, stage);
  if (deal) res.json({ ok: true, deal });
  else res.status(404).json({ ok: false, error: 'Deal not found.' });
});

app.delete('/api/kanban/deals/:id', requireSessionAuth, (req, res) => {
  res.json(db.deleteKanbanDeal(req.params.id));
});

// ─── 4. WhatsApp Interactive Forms & Flows API ──────────────────────────────
app.get('/api/forms', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, forms: db.getForms(bId) });
});

app.post('/api/forms', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const form = db.saveForm({ ...req.body, businessId: bId });
  res.json({ ok: true, form });
});

app.delete('/api/forms/:id', requireSessionAuth, (req, res) => {
  res.json(db.deleteForm(req.params.id));
});

// ─── 5. Developer REST API & Webhooks ────────────────────────────────────────
app.get('/api/developer/keys', requireAdminAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, keys: db.getApiKeys(bId) });
});

app.post('/api/developer/keys', requireAdminAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const { label } = req.body;
  const key = db.createApiKey(bId, label || 'Production Key');
  res.json({ ok: true, key });
});

app.delete('/api/developer/keys/:id', requireAdminAuth, (req, res) => {
  res.json(db.revokeApiKey(req.params.id));
});

app.get('/api/developer/webhooks', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({
    ok: true,
    webhooks: db.getWebhooks(bId),
    logs: db.getWebhookLogs(bId)
  });
});

app.post('/api/developer/webhooks', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const webhook = db.saveWebhook({ ...req.body, businessId: bId });
  res.json({ ok: true, webhook });
});

app.delete('/api/developer/webhooks/:id', requireSessionAuth, (req, res) => {
  const existing = (db.data.webhooks || []).find(w => w.id === req.params.id);
  if (existing && !isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant webhook delete denied.' });
  }
  res.json(db.deleteWebhook(req.params.id));
});

app.get('/api/developer/webhook-logs', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, logs: db.getWebhookLogs(bId) });
});

// ─── Public Developer Message Sending REST API (Whatzi REST Compatible) ──────
app.all('/api/qr/rest/send_message', async (req, res) => {
  const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || (req.query && req.query.token);
  const apiKey = db.validateApiKey(authHeader);

  // If not validated via API Key, allow if Admin Session or Tenant Key is valid
  if (!apiKey && !isAdminReq(req) && !isTenantReq(req)) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: Valid Bearer API Token or X-API-KEY required.'
    });
  }

  const payload = req.method === 'GET' ? req.query : req.body;
  const result = await waEngine.sendRestMessage(payload);
  if (result.ok) {
    res.json({ ok: true, result });
  } else {
    res.status(400).json({ ok: false, error: result.error || 'Failed to dispatch WhatsApp message.' });
  }
});

// ─── 6. Team Collaboration & Agents API ──────────────────────────────────────
app.get('/api/team/agents', requireAdminAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, agents: db.getAgents(bId) });
});

app.post('/api/team/agents', requireAdminAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const agent = db.saveAgent({ ...req.body, businessId: bId });
  res.json({ ok: true, agent });
});

app.delete('/api/team/agents/:id', requireAdminAuth, (req, res) => {
  res.json(db.deleteAgent(req.params.id));
});

// ─── 7. Chat Metadata & Quick Replies ────────────────────────────────────────
app.get('/api/chats/:id/metadata', requireSessionAuth, (req, res) => {
  const existing = db.getChat(req.params.id);
  if (existing && !isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant chat metadata denied.' });
  }
  res.json({ ok: true, metadata: db.getChatMetadata(req.params.id) });
});

app.post('/api/chats/:id/notes', requireSessionAuth, (req, res) => {
  const existing = db.getChat(req.params.id);
  if (existing && !isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant chat note denied.' });
  }
  const { text, author } = req.body;
  const note = db.saveChatNote(req.params.id, text, author || 'Agent');
  res.json({ ok: true, note });
});

app.post('/api/chats/:id/status', requireSessionAuth, (req, res) => {
  const existing = db.getChat(req.params.id);
  if (existing && !isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant chat status update denied.' });
  }
  const { status } = req.body;
  const meta = db.updateChatStatus(req.params.id, status || 'open');
  res.json({ ok: true, metadata: meta });
});

app.post('/api/chats/:id/tags', requireSessionAuth, (req, res) => {
  const existing = db.getChat(req.params.id);
  if (existing && !isOwnedByCaller(req, existing)) {
    return res.status(403).json({ ok: false, error: 'Forbidden: Cross-tenant chat tag update denied.' });
  }
  const { tags } = req.body;
  const meta = db.updateChatTags(req.params.id, tags || []);
  res.json({ ok: true, metadata: meta });
});

app.get('/api/quick-replies', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, quickReplies: db.getQuickReplies(bId) });
});

app.post('/api/quick-replies', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const reply = db.saveQuickReply({ ...req.body, businessId: bId });
  res.json({ ok: true, reply });
});

app.delete('/api/quick-replies/:id', requireSessionAuth, (req, res) => {
  res.json(db.deleteQuickReply(req.params.id));
});

// ─── 8. Voice Call Logs API ──────────────────────────────────────────────────
app.get('/api/calls/logs', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, logs: db.getCallLogs(bId) });
});

app.post('/api/calls/logs', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  const log = db.recordCallLog({ ...req.body, businessId: bId });
  res.json({ ok: true, log });
});

// ─── 9. Website Embeddable Floating Chat Widget Script ───────────────────────
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'widget.js'));
});

// ─── Master Dataset Upload (.TXT & .PDF) ─────────────────────────────────────
app.post('/api/dataset/upload', requireSessionAuth, datasetUploadLimiter, async (req, res) => {
  try {
    const { fileName, fileType, fileBase64, mode } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ ok: false, error: 'fileBase64 data is required' });
    }

    if (fileBase64.length > 35 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: 'File size exceeds 25MB limit.' });
    }

    const safeFileName = path.basename(fileName || 'Document.txt').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const buffer = Buffer.from(fileBase64, 'base64');
    let extractedText = '';

    const isPdf = (fileType && fileType.includes('pdf')) || safeFileName.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      console.log(`[dataset-upload] Parsing PDF document: "${safeFileName}" (${buffer.length} bytes)...`);
      const parsedPdf = await pdfParse(buffer);
      extractedText = (parsedPdf.text || '').trim();
    } else {
      console.log(`[dataset-upload] Reading text document: "${safeFileName}" (${buffer.length} bytes)...`);
      extractedText = buffer.toString('utf8').trim();
    }

    // Clean up excessive whitespace while preserving structure
    extractedText = extractedText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    if (!extractedText || extractedText.length < 5) {
      return res.status(400).json({ ok: false, error: 'The uploaded file is empty or no text could be extracted.' });
    }

    const bId = req.body.businessId || resolveReqBusinessId(req);
    const activeBiz = db.getAllBusinesses().find(b => b.id === bId) || db.getActiveBusiness();
    const isAppend = mode === 'append';
    const header = `=== UPLOADED KNOWLEDGE [${safeFileName}] ===\n`;

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
      fileName: safeFileName,
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
  const bId = resolveReqBusinessId(req);
  const activeBiz = db.getBusiness(bId) || db.getActiveBusiness();
  const plan = db.SUBSCRIPTION_PLANS[activeBiz.subscriptionPlan] || db.SUBSCRIPTION_PLANS.enterprise;
  if (plan.limits && plan.limits.liveCalls === false) {
    return res.status(403).json({ ok: false, error: 'Live Voice Calls are exclusive to Enterprise Plan. Please upgrade.' });
  }
  const { sessionId, customerName, customerPhone, storeName, geminiApiKey, dataset } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  // Limit memory growth by pruning old sessions if map exceeds 200
  if (sessions.size > 200) {
    const oldestKey = sessions.keys().next().value;
    if (oldestKey) {
      try { sessions.get(oldestKey)?.browserWs?.close(); } catch {}
      sessions.delete(oldestKey);
    }
  }

  const serverHost = req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host']
    ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
    : CALL_SERVER_URL;

  const id = String(sessionId).slice(0, 100);
  sessions.set(id, {
    browserWs: null,
    customerName: customerName ? String(customerName).slice(0, 100) : 'Customer',
    customerPhone: customerPhone ? String(customerPhone).slice(0, 30) : '',
    storeName: storeName ? String(storeName).slice(0, 100) : activeBiz.name,
    apiKey: geminiApiKey || DEFAULT_GEMINI_API_KEY,
    dataset: (dataset && dataset.trim().length > 50) ? dataset.slice(0, 50000) : (activeBiz.dataset || BUILTIN_DATASET),
    history: [],
    createdAt: Date.now(),
  });

  console.log(`[session] Created: ${id} | store: ${storeName || activeBiz.name}`);
  res.json({ ok: true, sessionId: id, callUrl: `${serverHost}/call?s=${id}` });
});

app.get('/call', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Direct HTTP Chat API (supports Website Embedded Widget & /call screen)
app.post('/api/chat', async (req, res) => {
  const { sessionId, message, businessId, storeName, skipAudio } = req.body || {};
  const targetBiz = (businessId && db.getBusiness(businessId)) || db.getActiveBusiness();
  const sid = sessionId || ('web_' + Date.now());
  let sess = sessions.get(sid);
  if (!sess) {
    sess = {
      businessId: targetBiz.id,
      customerName: 'Customer',
      storeName: storeName || targetBiz.name,
      voice: VOICE_NAME,
      apiKey: DEFAULT_GEMINI_API_KEY,
      isVoiceCall: false,
      isWhatsApp: true,
      history: [],
      dataset: targetBiz.dataset || BUILTIN_DATASET,
      createdAt: Date.now()
    };
    sessions.set(sid, sess);
  }

  try {
    const aiReply = await getGeminiReply(message, sess);
    checkForOrderTag(aiReply, sess, sid);
    const audioResult = skipAudio ? { audioBase64: null, mimeType: null, isGemini: false } : await synthesizeVoiceAudio(aiReply, sess.voice, sess.apiKey);

    res.json({
      ok: true,
      sessionId: sid,
      storeName: targetBiz.name,
      brandColor: targetBiz.brandColor || '#2563EB',
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
server.on('error', (err) => {
  console.error('[server] HTTP Server error:', err && err.message ? err.message : err);
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('error', (err) => {
  console.error('[wss] WebSocket Server error:', err && err.message ? err.message : err);
});

db.onChatUpdate((evt) => {
  if (!evt) return;
  const payload = JSON.stringify({
    type: 'inbox_update',
    businessId: evt.businessId || null,
    chatId: evt.chatId || null,
    sender: evt.sender || null,
    unreadReset: !!evt.unreadReset,
    deleted: !!evt.deleted
  });
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN || !client.inboxSub) continue;
    if (client.inboxSub.isAdmin || client.inboxSub.businessId === 'all' || (evt.businessId && client.inboxSub.businessId === evt.businessId)) {
      safeSend(client, payload);
    }
  }
});

wss.on('connection', (browserWs, req) => {
  browserWs.on('error', (err) => {
    console.warn(`[ws] Client socket error:`, err && err.message ? err.message : err);
  });
  const url = new URL(req.url, `http://localhost`);
  if (url.searchParams.get('channel') === 'inbox') {
    browserWs.on('message', (data) => {
      try {
        if (!data || data.length > 16384) return;
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe_inbox') {
          if (msg.adminToken && isAdminTokenValid(msg.adminToken)) {
            browserWs.inboxSub = { isAdmin: true, businessId: msg.businessId || 'all' };
            return safeSend(browserWs, JSON.stringify({ type: 'inbox_subscribed', ok: true, isAdmin: true }));
          }
          if (msg.licenseKey && typeof msg.licenseKey === 'string') {
            const lic = db.getLicenseByKey(msg.licenseKey.trim());
            const sub = lic && lic.businessId ? db.isBusinessSubscriptionActive(lic.businessId) : null;
            if (lic && lic.status === 'Active' && sub && sub.active && !sub.isExpired) {
              browserWs.inboxSub = { isAdmin: false, businessId: lic.businessId };
              return safeSend(browserWs, JSON.stringify({ type: 'inbox_subscribed', ok: true, businessId: lic.businessId }));
            }
          }
          if (msg.staffToken && typeof db.validateStaffSession === 'function') {
            const stf = db.validateStaffSession(msg.staffToken);
            if (stf) {
              browserWs.inboxSub = { isAdmin: stf.businessId === 'all', businessId: stf.businessId };
              return safeSend(browserWs, JSON.stringify({ type: 'inbox_subscribed', ok: true, businessId: stf.businessId }));
            }
          }
          safeSend(browserWs, JSON.stringify({ type: 'inbox_error', ok: false, error: 'Unauthorized inbox subscription' }));
        }
      } catch (_) {}
    });
    return;
  }

  db.recordLiveCall();
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
  sess.isVoiceCall = true;
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
      if (!data || data.length > 500000) {
        console.warn('[ws] Payload exceeds safe size limit (500KB), dropping.');
        return;
      }
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
    try {
      const durationSec = Math.max(1, Math.round((Date.now() - (sess.createdAt || Date.now())) / 1000));
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      const durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      // Build readable conversation transcript
      const transcriptLines = (sess.history || []).map(h => {
        const speaker = (h.role === 'user' ? (sess.customerName || 'Customer') : 'OmniSix AI');
        const text = (h.parts?.[0]?.text || '').trim();
        return `${speaker}: ${text}`;
      });
      const transcript = transcriptLines.join('\n');

      // Intelligent Sentiment Analysis
      let sentiment = 'Product Inquiry';
      const userText = transcript.toLowerCase();
      if (userText.includes('angry') || userText.includes('bad') || userText.includes('horrible') || userText.includes('wrong') || userText.includes('police') || userText.includes('nodakin') || userText.includes('boruda')) {
        sentiment = 'Critical Escalation';
      } else if (userText.includes('order') || userText.includes('buy') || userText.includes('ganna') || userText.includes('price') || userText.includes('deliver') || userText.includes('slip') || userText.includes('cash')) {
        sentiment = 'High Buying Intent';
      } else if (userText.includes('thank') || userText.includes('sthuthi') || userText.includes('good') || userText.includes('ela') || userText.includes('super') || userText.includes('great')) {
        sentiment = 'Satisfied';
      } else if (userText.includes('discount') || userText.includes('adu') || userText.includes('wedi') || userText.includes('ganan') || userText.includes('expensive')) {
        sentiment = 'Price Concern';
      }

      if (transcriptLines.length > 0) {
        db.recordCallLog({
          sessionId,
          number: sess.customerPhone || 'Web Voice Call',
          customerName: sess.customerName || 'Customer',
          status: 'completed',
          duration: durationStr,
          sentiment: sentiment,
          transcription: transcript,
          businessId: sess.businessId || activeBiz.id
        });
        console.log(`[ws] 📞 Recorded call (${durationStr}) with sentiment "${sentiment}" for ${sess.customerName}`);
      }
    } catch (logErr) {
      console.warn('[ws] Failed to record call log:', logErr.message);
    }
  });
});

// ─── Gemini AI Engine with Smart Dataset Query ────────────────────────────────
async function getGeminiReply(userMessage, sess, userLang) {
  const activeBiz = (sess && sess.businessId && (db.getBusiness(sess.businessId) || db.getAllBusinesses().find(b => b.id === sess.businessId))) || db.getActiveBusiness();
  const subStatus = db.isBusinessSubscriptionActive(activeBiz.id);
  if (!subStatus.active) {
    console.warn(`[TRIAL-GUARD] AI reply stopped for ${activeBiz.name} (${activeBiz.id}): ${subStatus.reason}`);
    return `🔒 *OmniSix AI — Subscription Notice*\nඔබගේ නොමිලේ අත්හදා බැලීමේ කාලසීමාව (Free 3-Day Trial) අවසන් වී ඇත. සේවාව අඛණ්ඩව පවත්වා ගැනීමට කරුණාකර Paid Plan එකක් (Starter රු. 1,900 / Pro රු. 2,900 / Enterprise රු. 3,500) සක්‍රීය කරගන්න.\n📞 විස්තර සහ සහය සඳහා WhatsApp අමතන්න: 076 210 7601`;
  }
  const quotaStatus = db.checkAiQuota(activeBiz.id);
  if (!quotaStatus.allowed) {
    console.warn(`[QUOTA-GUARD] Monthly AI reply quota exhausted for ${activeBiz.name} (${quotaStatus.used}/${quotaStatus.limit})`);
    return `⚡ *${activeBiz.name} — Plan Limit Reached*\nමෙම මස (${quotaStatus.month}) ඔබගේ ${quotaStatus.planName} AI පිළිතුරු සීමාව (${quotaStatus.limit.toLocaleString()}) අවසන් වී ඇත. අඛණ්ඩව සේවාව ලබා ගැනීමට Dashboard හරහා Plan එක Upgrade කරන්න. 🙏`;
  }
  db.recordAiReplyUsage(activeBiz.id, 1);
  const settings = (sess && sess.businessId && db.getTenantSettings(sess.businessId)) || db.getSettings();
  const storeName = sess.storeName || activeBiz.name || 'WEDDING ARTS';
  if (!sess.apiKey && (settings.geminiApiKey || activeBiz.geminiApiKey)) {
    sess.apiKey = settings.geminiApiKey || activeBiz.geminiApiKey;
  }

  // Detect customer's actual contextual language using raw caption when an image was uploaded (so English AI Vision description doesn't force English!)
  const langProbeText = sess.isCustomerImage
    ? (sess.rawCaption || LanguageDetectionEngine.resolveLanguageFromHistory(sess.history || []) ? (sess.rawCaption || '') : '')
    : userMessage;
  const detectedLang = (userLang === 'en-US')
    ? 'English'
    : LanguageDetectionEngine.detectLanguage(langProbeText, sess.history || []);

  console.log(`[ai-engine] Detected Language: "${detectedLang}" (session mode: ${sess.isVoiceCall ? 'Voice' : 'WhatsApp/Text'}) for: "${(userMessage || '').substring(0, 50)}"`);

  // 1. Angry Customer Escalation Engine
  const angryCheck = AngryCustomerEscalationEngine.check(userMessage, detectedLang, storeName);
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

  // 4. Ultra-Fast Zero-Latency Hybrid Fast-Cache Engine (skip for image inputs so Vision context goes to Gemini)
  const storeProducts = db.getProducts(activeBiz.id);
  const fastReply = sess.isCustomerImage ? null : HybridFastCacheEngine.resolve(userMessage, activeBiz, storeProducts, detectedLang, settings);
  const deliveryEnabled = isDeliveryEnabled(settings);
  if (fastReply) {
    console.log(`[ai-engine] ⚡ Hybrid Fast-Cache instant reply (0ms API latency) for: "${(userMessage || '').substring(0, 40)}"`);
    sess.history.push({ role: 'user', parts: [{ text: userMessage }] });
    sess.history.push({ role: 'model', parts: [{ text: fastReply }] });
    return fastReply;
  }

  const datasetContext = (sess.dataset && sess.dataset.length > 50) ? sess.dataset : (activeBiz.dataset || BUILTIN_DATASET);
  const systemInstruction = buildSystemPrompt(sess, datasetContext, userLang, userMessage, detectedLang);

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
  if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
    cleanHistory.pop();
  }

  let turnInstruction = '';
  let initialModelAck = '';

  if (sess.isVoiceCall) {
    if (detectedLang === 'English') {
      turnInstruction = `\n[VOICE CALL: The customer is speaking in English. Reply in fluent, natural English in 1 to 2 concise spoken sentences using exact dataset prices.]`;
      initialModelAck = `Understood. I represent ${storeName} and will provide concise answers in English with 100% accurate prices and details from the official dataset.`;
    } else {
      turnInstruction = `\n[VOICE CALL: The customer is speaking in Sinhala/Singlish. You MUST reply in natural spoken Sinhala script (සිංහල අකුරින්). NEVER output Latin Singlish. 1 to 2 concise spoken sentences using exact dataset prices.]`;
      initialModelAck = `තේරුණා. මම ${storeName} වෙනුවෙන් නිල Dataset එකේ ඇති නිවැරදිම මිල ගණන් සහ විස්තර මත පමණක් පදනම්ව, කිසිවක් මගනොහැර ස්වභාවික සිංහලෙන් පැහැදිලිව කතා කරන්නම්.`;
    }
  } else {
    // WhatsApp & Text Chat Dynamic Matching (Quad-Language: Sinhala, Singlish, English, Tamil)
    const langMode = settings.languageReplyMode || 'smart_match';

    if (langMode === 'sinhala_script_only') {
      turnInstruction = `\n[WHATSAPP MESSAGE: Configuration is strictly ONLY SINHALA. Reply strictly in natural, polite Sinhala script (සිංහල අකුරින් පමණි). NEVER reply in English and NEVER reply in Latin Singlish. Use clean WhatsApp formatting (*bold*, • bullets) with exact prices from dataset.]`;
      initialModelAck = `තේරුණා. මම ${storeName} වෙනුවෙන් නිල Dataset එක මත පදනම්ව ගෞරවනීය සිංහල අකුරින් පමණක් පිළිතුරු සපයන්නම්.`;
    } else if (langMode === 'english_only') {
      turnInstruction = `\n[WHATSAPP MESSAGE: Configuration is strictly ONLY ENGLISH. Reply strictly in clear, professional English. NEVER reply in Sinhala or Tamil. Use clean WhatsApp formatting (*bold*, • bullets) with exact prices from dataset.]`;
      initialModelAck = `Understood. I will reply strictly in English for ${storeName}.`;
    } else if (langMode === 'tamil_only') {
      turnInstruction = `\n[WHATSAPP MESSAGE: Configuration is strictly ONLY TAMIL. Reply strictly in polite, warm Tamil script (தமிழ் எழுத்துகளில் மட்டும்). NEVER reply in English, Sinhala, or Tanglish. Use clean WhatsApp formatting with exact prices from dataset.]`;
      initialModelAck = `புரிந்தது. உத்தியோகபூர்வ Dataset விபரங்களின்படி சரியான தகவல்களை தமிழில் மட்டுமே வழங்குவேன்.`;
    } else if (langMode === 'singlish_only') {
      turnInstruction = `\n[WHATSAPP MESSAGE: Configuration is strictly ONLY SINGLISH. Reply strictly in natural, friendly Sri Lankan Singlish using Latin letters. Do NOT use Sinhala script characters and do NOT reply in formal English. Use clean WhatsApp formatting (*bold*, • bullets) with exact prices from dataset.]`;
      initialModelAck = `Understood. Mama ${storeName} wenuwen natural Singlish walin ma reply karannam.`;
    } else if (detectedLang === 'English') {
      turnInstruction = `\n[WHATSAPP MESSAGE: The customer sent this message in English. Reply strictly in clear, professional, warm English. NEVER reply in Sinhala or Tamil. Use clean WhatsApp formatting (*bold*, • bullets) with exact prices from dataset.]`;
      initialModelAck = `Understood. I represent ${storeName} and will reply to the customer in clear, friendly English with accurate details from the master dataset.`;
    } else if (detectedLang === 'Tamil') {
      turnInstruction = `\n[WHATSAPP MESSAGE: The customer sent this message in Tamil script (தமிழ்). Reply strictly in polite, warm Tamil script (தமிழ் எழுத்துகளில்). NEVER reply in English, Sinhala, or Tanglish. Use clean WhatsApp formatting with exact prices from dataset.]`;
      initialModelAck = `புரிந்தது. உத்தியோகபூர்வ Dataset விபரங்களின்படி சரியான தகவல்களை தமிழில் வழங்குகிறேன்.`;
    } else if (detectedLang === 'Tanglish') {
      turnInstruction = `\n[WHATSAPP MESSAGE: The customer sent this message in Tanglish (Tamil in Latin letters). Reply strictly in conversational Tanglish using Latin letters. NEVER reply in Tamil script and NEVER reply in English. Use clean WhatsApp formatting with exact prices from dataset.]`;
      initialModelAck = `Purinjithu. Official dataset padi sariyana details Tanglish la solren.`;
    } else if (detectedLang === 'Singlish') {
      // 🗣️ Quad-Language Smart Detection: Colloquial Singlish Matching
      const singlishDeliverySample = deliveryEnabled ? ' Islandwide delivery thiyenawa. Oya kamathi size eka kiyanna!' : '';
      turnInstruction = `\n[WHATSAPP MESSAGE: The customer sent this message in Singlish (Sinhala written in Latin letters, e.g. "mewaye price eka kiyada"). Reply strictly in natural, friendly, polite Sri Lankan Singlish using Latin letters (e.g. "Mewaye mila Rs. 4,800 wenawa.${singlishDeliverySample}"). Do NOT use Sinhala script characters and do NOT reply in formal English. Use clean WhatsApp formatting (*bold*, • bullets) with exact prices from dataset.]`;
      initialModelAck = `Understood. Mama ${storeName} wenuwen customer ta natural Singlish walin ma clear details and prices ekka reply karannam.`;
    } else if (detectedLang === 'Sinhala') {
      // 🗣️ Quad-Language Smart Detection: Sinhala Script Matching
      turnInstruction = `\n[WHATSAPP MESSAGE: The customer sent this message in Sinhala script (සිංහල අකුරින්). You MUST reply strictly in natural, polite Sinhala script (සිංහල අකුරින් පමණි). NEVER reply in English and NEVER reply in Latin Singlish. Use clean WhatsApp formatting (*bold*, • bullets) with exact prices from dataset.]`;
      initialModelAck = `තේරුණා. මම ${storeName} වෙනුවෙන් නිල Dataset එකේ ඇති නිවැරදිම මිල ගණන් සහ විස්තර මත පදනම්ව, පාරිභෝගිකයාට ස්වභාවික ගෞරවනීය සිංහල අකුරින් පමණක් පිළිතුරු සපයන්නම්.`;
    } else if (['Italian', 'French', 'German', 'Spanish', 'Arabic', 'Hindi', 'Russian', 'Chinese', 'Japanese'].includes(detectedLang)) {
      turnInstruction = `\n[WHATSAPP MESSAGE: The customer sent this message in ${detectedLang}. Reply strictly and fluently in ${detectedLang} matching the customer. Use clean WhatsApp formatting with exact prices from dataset.]`;
      initialModelAck = `Understood. I represent ${storeName} and will reply fluently in ${detectedLang} matching the customer's inquiry.`;
    } else {
      turnInstruction = `\n[WHATSAPP MESSAGE: The customer sent this message in Sinhala/Singlish. Reply strictly in natural, polite Sinhala script (සිංහල අකුරින් පමණි). Use clean WhatsApp formatting (*bold*, • bullets) with exact prices from dataset.]`;
      initialModelAck = `තේරුණා. මම ${storeName} වෙනුවෙන් නිල Dataset එකේ ඇති නිවැරදිම මිල ගණන් සහ විස්තර මත පදනම්ව, පාරිභෝගිකයාට ස්වභාවික ගෞරවනීය සිංහල අකුරින් පමණක් පිළිතුරු සපයන්නම්.`;
    }
  }

  // Append user message with per-turn steering prompt for the API call
  cleanHistory.push({ role: 'user', parts: [{ text: userMessage + turnInstruction }] });

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
              maxOutputTokens: sess.isVoiceCall ? 250 : 800
            }
          }),
          signal: AbortSignal.timeout(6000)
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
          console.log(`[Gemini Text] Success using model: ${model} (language: ${detectedLang})`);
          return replyText;
        }
      } catch (err) {
        lastError = err.message;
        // Do not poison key pool on transient network / timeout hiccups
      }
    }
  }

  // Smart fallback from dataset if all Gemini models exhaust daily quota
  console.warn('[Gemini Text] All text models hit quota or failed. Using smart dataset fallback.');
  const store = sess.storeName || 'OmniSix AI';
  let fallbackReply = '';
  if (!deliveryEnabled && /(order|buy|purchase|ganna|gannada|cod|cash on delivery|delivery|deliver|courier)/i.test(userMessage || '')) {
    fallbackReply = buildOwnerOrderReferralReply(activeBiz, settings, detectedLang);
  } else if (detectedLang === 'English') {
    fallbackReply = `Thank you for reaching out to ${store}! We offer 24/7 autonomous AI assistant, CRM, and omnichannel messaging solutions. How can we help you today? 😊`;
  } else if (detectedLang === 'Tamil') {
    fallbackReply = `நன்றி! ${store} உங்களுக்கு 24/7 AI உதவியாளர் மற்றும் CRM சேவைகளை வழங்குகிறது. உங்களுக்கு எவ்வாறு உதவ முடியும்? 😊`;
  } else {
    fallbackReply = `ස්තූතියි! ${store} වෙතින් ස්වයංක්‍රීය 24/7 AI Sales Assistant සහ Omnichannel CRM සේවාවන් ලබාගත හැක. ඔබට අවශ්‍ය සහය කුමක්දැයි අපට දන්වන්න. 😊`;
  }
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

  // Spoken Sinhala Conversions (Unicode boundary safe)
  if (hasSinhala) {
    const sinhalaReplacements = [
      [/හැකියාව ඇත|හැකියාව තියෙනවා/g, 'පුළුවන්'],
      [/(?<=^|[\s,.:;!?])ඇත(?=$|[\s,.:;!?])/g, 'තියෙනවා'],
      [/(?<=^|[\s,.:;!?])නැත(?=$|[\s,.:;!?])/g, 'නෑ'],
      [/(?<=^|[\s,.:;!?])වේ(?=$|[\s,.:;!?])/g, 'වෙනවා'],
      [/(?<=^|[\s,.:;!?])කෙරේ(?=$|[\s,.:;!?])/g, 'කරනවා'],
      [/(?<=^|[\s,.:;!?])ලැබේ(?=$|[\s,.:;!?])/g, 'ලැබෙනවා'],
      [/(?<=^|[\s,.:;!?])පිළිබඳව?(?=$|[\s,.:;!?])/g, 'ගැන'],
      [/(?<=^|[\s,.:;!?])සඳහා(?=$|[\s,.:;!?])/g, 'වෙනුවෙන්'],
      [/(?<=^|[\s,.:;!?])ඔබට(?=$|[\s,.:;!?])/g, 'ඔයාට'],
      [/(?<=^|[\s,.:;!?])ඔබගේ|ඔබේ(?=$|[\s,.:;!?])/g, 'ඔයාගේ'],
      [/(?<=^|[\s,.:;!?])ඔබව(?=$|[\s,.:;!?])/g, 'ඔයාව'],
      [/(?<=^|[\s,.:;!?])ඔබ(?=$|[\s,.:;!?])/g, 'ඔයා'],
      [/(?<=^|[\s,.:;!?])අපගේ(?=$|[\s,.:;!?])/g, 'අපේ'],
      [/(?<=^|[\s,.:;!?])අපට(?=$|[\s,.:;!?])/g, 'අපිට']
    ];
    for (const [pattern, replacement] of sinhalaReplacements) {
      s = s.replace(pattern, replacement);
    }
    s = s
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
        const inlinePart = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        const rawAudioData = inlinePart?.data;
        if (rawAudioData) {
          let finalBase64 = rawAudioData;
          let finalMime = (inlinePart.mimeType || 'audio/wav').split(';')[0].trim();
          const rawBuf = Buffer.from(rawAudioData, 'base64');
          const isAlreadyRiff = rawBuf.length > 4 && rawBuf.slice(0, 4).toString('ascii') === 'RIFF';
          if (!isAlreadyRiff && (finalMime.includes('l16') || finalMime.includes('pcm') || finalMime === 'audio/wav')) {
            const rateMatch = String(inlinePart.mimeType || '').match(/rate=(\d+)/i);
            const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
            const wavHeader = Buffer.alloc(44);
            wavHeader.write('RIFF', 0);
            wavHeader.writeUInt32LE(36 + rawBuf.length, 4);
            wavHeader.write('WAVE', 8);
            wavHeader.write('fmt ', 12);
            wavHeader.writeUInt32LE(16, 16);
            wavHeader.writeUInt16LE(1, 20);
            wavHeader.writeUInt16LE(1, 22);
            wavHeader.writeUInt32LE(sampleRate, 24);
            wavHeader.writeUInt32LE(sampleRate * 2, 28);
            wavHeader.writeUInt16LE(2, 32);
            wavHeader.writeUInt16LE(16, 34);
            wavHeader.write('data', 36);
            wavHeader.writeUInt32LE(rawBuf.length, 40);
            finalBase64 = Buffer.concat([wavHeader, rawBuf]).toString('base64');
            finalMime = 'audio/wav';
          }
          console.log(`[Gemini TTS] ✅ Successfully generated genuine Gemini ${voice} Voice (${finalBase64.length} chars, ${finalMime}) via ${model}`);
          return { audioBase64: finalBase64, mimeType: finalMime, isGemini: true };
        }
      } catch (err) {
        // Transient TTS timeout - proceed to next model/key without poisoning key pool
      }
    }
  }

  // Normal / Robotic TTS has been completely removed per user instruction.
  console.warn('[Gemini TTS] All Gemini Voice keys temporarily busy.');
  return { audioBase64: null, mimeType: 'audio/wav', isGemini: false };
}

function buildSystemPrompt(sess, datasetText, userLang, userMessage, detectedLang = 'Sinhala') {
  const activeBiz = (sess && sess.businessId && (db.getBusiness(sess.businessId) || db.getAllBusinesses().find(b => b.id === sess.businessId))) || db.getActiveBusiness();
  const settings = (sess && sess.businessId && db.getTenantSettings(sess.businessId)) || db.getSettings();
  const storeName = sess.storeName || activeBiz.name || 'WEDDING ARTS';
  const customerName = sess.customerName || 'Customer';
  const deliveryEnabled = isDeliveryEnabled(settings);
  const rawDataset = (datasetText && datasetText.length > 50) ? datasetText : (activeBiz.dataset || BUILTIN_DATASET);
  const dataset = deliveryEnabled ? rawDataset : stripDeliveryDetailsFromDataset(rawDataset);
  const deliveryDisabledDirective = deliveryEnabled ? '' : buildDeliveryDisabledPromptBlock(activeBiz, settings);

  // 1. Classify Customer Psychological Archetype
  const archetypeResult = CustomerArchetypeEngine.classify(userMessage || '', deliveryEnabled);
  if (sess.customerPhone && archetypeResult.archetype !== 'GENERAL') {
    db.setChatArchetype(sess.customerPhone, archetypeResult.archetype);
  }

  // 2. Dynamic Upsell Directive
  const upsellDirective = SmartUpsellEngine.detectUpsellOpportunity(userMessage || '', db.getProducts(activeBiz.id));

  // 3. Dynamic Negotiation Directive
  const isNegotiating = SmartNegotiationEngine.isBargaining(userMessage || '');
  const negotiationDirective = isNegotiating ? SmartNegotiationEngine.getNegotiationDirective(1) : '';

  // 3.1 Live Stock Inventory & Products with Photos
  const storeProducts = db.getProducts(activeBiz.id);
  let catalogPhotoContext = '';
  if (storeProducts && storeProducts.length > 0) {
    const trackedStockProds = storeProducts.filter(p => typeof p.stockQty === 'number' || p.inStock === false);
    if (trackedStockProds.length > 0) {
      catalogPhotoContext += `\n--- 📦 LIVE STOCK INVENTORY ---\n` +
        trackedStockProds.map(p => {
          const stockTag = typeof p.stockQty === 'number'
            ? (p.stockQty === 0 ? '[OUT OF STOCK]' : `[Stock Left: ${p.stockQty}]`)
            : '[OUT OF STOCK]';
          return `• "${p.name}" (${p.category || 'General'}) — Rs. ${(p.price || 0).toLocaleString()} ${stockTag}`;
        }).join('\n') +
        `\n👉 If an item is marked [OUT OF STOCK], honestly tell the customer it is currently sold out and NEVER place an order for it.\n--- END LIVE STOCK INVENTORY ---\n`;
    }

    const prodsWithImg = storeProducts.filter(p =>
      !!((p.imageUrl && p.imageUrl.length > 10) || (Array.isArray(p.images) && p.images.some(img => img && img.length > 10)))
    );
    if (prodsWithImg.length > 0) {
      catalogPhotoContext += `\n--- 📸 PRODUCTS WITH GENUINE PHOTOS AVAILABLE IN SYSTEM ---\n` +
        prodsWithImg.map(p => {
          const cnt = (Array.isArray(p.images) && p.images.length > 0) ? p.images.length : 1;
          const stockTag = typeof p.stockQty === 'number'
            ? (p.stockQty === 0 ? ' [OUT OF STOCK]' : ` [Stock Left: ${p.stockQty}]`)
            : (p.inStock === false ? ' [OUT OF STOCK]' : '');
          return `• Product: "${p.name}" | Category: "${p.category || 'General'}" | Price: Rs. ${(p.price || 0).toLocaleString()} [${cnt} PHOTO(S) AVAILABLE]${stockTag}`;
        }).join('\n') +
        `\n👉 WHENEVER A CUSTOMER ASKS FOR PRODUCT PHOTOS / IMAGES / SAMPLES / DETAILS of any product (e.g. "photo ewanna", "prodact ewanna", "product balanna", "sample", "pics please", "monawada thiyenne"), reply warmly and APPEND THIS EXACT TAG AT THE END of your reply: [[SEND_PHOTO: ProductName]]\n👉 If any item has [OUT OF STOCK], inform the customer honestly and do NOT confirm an order for it.\nThe WhatsApp engine will automatically deliver ALL genuine photos of that product directly to the customer!\n--- END PRODUCTS WITH PHOTOS ---\n`;
    }
  }

  // 4. Persona Tone
  let personaInstruction = 'friendly, warm, respectful Sri Lankan customer care agent';
  if (settings.aiPersona === 'LUXURY_EXECUTIVE') {
    personaInstruction = 'sophisticated, prestigious luxury concierge agent with polite elite tone';
  } else if (settings.aiPersona === 'ENERGETIC_SALES') {
    personaInstruction = 'highly enthusiastic, proactive sales rep highlighting special limited-time offers';
  } else if (settings.aiPersona === 'DIRECT_CRISP') {
    personaInstruction = 'efficient, fast, direct and crystal-clear business representative';
  }

  const langMode = settings.languageReplyMode || 'smart_match';
  let scriptRequirement = 'Sinhala Script (සිංහල අකුරින් පමණි)';
  let languageDirective = '';

  if (langMode === 'english_only') {
    scriptRequirement = 'Strictly English (ඉංග්‍රීසි පමණි)';
    languageDirective = `CRITICAL LANGUAGE MODE: ONLY ENGLISH (ඉංග්‍රීසි පමණි)
The business owner has configured this AI to reply STRICTLY IN ENGLISH ONLY.
- Regardless of what language the customer speaks or writes (Sinhala, Singlish, Tamil, etc.), you MUST ALWAYS reply in fluent, polite, warm English.
- Do NOT output Sinhala script, Singlish, or Tamil. Output English only!`;
  } else if (langMode === 'sinhala_script_only') {
    scriptRequirement = 'Strictly Sinhala Script (සිංහල අකුරින් පමණි)';
    languageDirective = `CRITICAL LANGUAGE MODE: ONLY SINHALA SCRIPT (සිංහල අකුරින් පමණි)
The business owner has configured this AI to reply STRICTLY IN SINHALA SCRIPT ONLY.
- Regardless of what language the customer speaks or writes (English, Singlish, Tamil, etc.), you MUST ALWAYS reply in natural, polite Sinhala script (සිංහල අකුරින් පමණි).
- Do NOT output English sentences or Singlish Latin characters (except for universal brand codes / model names).`;
  } else if (langMode === 'tamil_only') {
    scriptRequirement = 'Strictly Tamil Script (தமிழ் எழுத்துகளில் மட்டும்)';
    languageDirective = `CRITICAL LANGUAGE MODE: ONLY TAMIL SCRIPT (தமிழ் எழுத்துகளில் மட்டும்)
The business owner has configured this AI to reply STRICTLY IN TAMIL SCRIPT ONLY.
- Regardless of what language the customer speaks or writes (English, Sinhala, Singlish, etc.), you MUST ALWAYS reply in fluent, polite Tamil script (தமிழ்).
- Do NOT output Sinhala or English sentences.`;
  } else if (langMode === 'singlish_only') {
    scriptRequirement = 'Strictly Singlish (Latin Letters Colloquial Sinhala)';
    languageDirective = `CRITICAL LANGUAGE MODE: ONLY SINGLISH (Singlish පමණි)
The business owner has configured this AI to reply STRICTLY IN SINGLISH (Sinhala in Latin letters).
- Regardless of what language the customer speaks or writes, you MUST ALWAYS reply in natural, polite Sri Lankan Singlish using Latin letters (e.g. "Ow meka Rs. [Price] wenawa.${deliveryEnabled ? ' Delivery puluwan...' : ''}").
- Do NOT output Sinhala Unicode script characters and do NOT reply in formal English.`;
  } else {
    // smart_match
    if (detectedLang === 'English') {
      scriptRequirement = 'English';
    } else if (detectedLang === 'Singlish') {
      scriptRequirement = 'Singlish (Colloquial Sinhala in Latin letters)';
    } else if (detectedLang === 'Tamil') {
      scriptRequirement = 'Tamil Script (தமிழ்)';
    } else if (detectedLang === 'Tanglish') {
      scriptRequirement = 'Tanglish (Tamil in Latin letters)';
    } else if (['Italian', 'French', 'German', 'Spanish', 'Arabic', 'Hindi', 'Russian', 'Chinese', 'Japanese'].includes(detectedLang)) {
      scriptRequirement = `${detectedLang} (Exact matching foreign language)`;
    }
    languageDirective = `CRITICAL DYNAMIC LANGUAGE MATCHING RULES:
1. 🔄 DYNAMIC LANGUAGE ADAPTATION:
   - If the customer writes or switches language (English, Sinhala, Singlish, Tamil, Tanglish, Italian, French, German, Spanish, etc.), you MUST IMMEDIATELY ADAPT and reply in that customer's MATCHING language!
2. 🇱🇰 SINGLISH (when customer writes in Singlish using Latin letters, e.g. "mewaye price eka kiyada?", "size thiyenawada?", "bank details ewanna"):
   * When mode is smart_match, reply in smooth, natural, polite, friendly Sri Lankan Singlish using Latin letters (e.g. "Mewaye mila Rs. 4,800 wenawa.${deliveryEnabled ? ' Islandwide delivery thiyenawa. Oya kamathi size eka kiyanna!' : ''}").
   * Do NOT use Sinhala script characters and do NOT reply in pure formal English.
3. 🇱🇰 SINHALA SCRIPT (when customer writes in Sinhala letters, e.g. "මිල කීයද?", "විස්තර එවන්න"):
   * You MUST reply strictly in natural, polite Sinhala script (සිංහල අකුරින් පමණි)!
   * Address customer respectfully in warm, natural colloquial Sri Lankan Sinhala (අපේ, ඔබට/ඔයාට, ලබාගන්න පුළුවන්, ස්තූතියි).
4. 🇬🇧 ENGLISH (when customer writes in English, e.g. "What are the available sizes?"):
   * Reply strictly in clear, professional, warm English (e.g. "Hello! The price is Rs. 4,800${deliveryEnabled ? ' with free delivery' : ''}...").
   * NEVER reply in Sinhala or Singlish when customer asks in English!
5. 🇮🇳 TAMIL SCRIPT (when customer writes in Tamil letters, தமிழ் எழுத்துகளில், e.g. "இதன் விலை என்ன?"):
   * Reply strictly in warm, polite Tamil script (தமிழ்). Never output English or Tanglish!
6. 🔤 TANGLISH (when customer writes in Tanglish, Tamil in Latin letters):
   * Reply strictly in conversational Tanglish using Latin letters.
7. 🌍 OTHER FOREIGN LANGUAGES (Italian, French, German, Spanish, Arabic, Hindi, etc.):
   * Reply strictly, fluently, and politely in that customer's EXACT MATCHING FOREIGN LANGUAGE!
8. 🔄 CONVERSATIONAL CONTINUITY FOR SHORT / AMBIGUOUS INPUTS:
   * If customer sends short answers ("ok", "yes", "1", "size M", "red",${deliveryEnabled ? ' phone number, or delivery address' : ' or package option'}), seamlessly preserve the ongoing conversation's language.`;
  }

  const imageUnderstandingDirective = sess.isCustomerImage
    ? `\n=== 👁️ CUSTOMER SENT AN IMAGE (READ VISION DESCRIPTION & ANSWER ACCURATELY) ===
The customer just sent a photo (described inside [📷 Image Content: ...] or [Image Sent: ...]) along with caption "${sess.rawCaption || 'No caption'}".
- Carefully examine what item/text/issue is shown in the customer's image and directly respond to THEIR photo and question.
- Compare the item in the customer's image against our OFFICIAL MASTER DATASET and Product Catalog above:
  * If the customer is asking about a third-party product we do NOT sell (e.g. earbuds cover, shoes, gadgets, etc. when our business does something else), warmly clarify in the customer's language that we do not carry that specific item, briefly mention what our business actually offers, and ask if they need help with our services.
  * NEVER output [[SEND_PHOTO: ...]] when replying to a customer's uploaded image UNLESS they specifically asked to see photos of OUR OWN catalog products!\n`
    : '';

  const isOngoingChat = Array.isArray(sess.history) && sess.history.length > 0;
  const ongoingDirective = isOngoingChat
    ? `\n=== ⚠️ ONGOING CONVERSATION MANDATE (DO NOT RE-GREET) ===\nThis is an ACTIVE, ONGOING conversation with ${customerName}. You have ALREADY greeted and welcomed them previously in the chat history.\n- NEVER say "Kohomada", "Hello", "Hi", "Welcome to...", "Mama Nethmi", or introduce yourself or the business name again.\n- NEVER act like the conversation just started.\n- Jump directly into addressing the customer's query (\"${userMessage}\") warmly, thoughtfully, and specifically, continuing naturally from previous messages!\n`
    : `\n=== 🌟 NEW CONVERSATION WELCOME ===\nThis is the FIRST message from ${customerName}. Greet them politely, warmly and introduce how you can help.\n`;

  return `You are "${settings.aiName || 'Nethmi'}", a ${personaInstruction} representing "${storeName}".
Customer Name: "${customerName}".
${ongoingDirective}${imageUnderstandingDirective}

=== 🌐 🗣️ QUAD-LANGUAGE SMART ADAPTATION MANDATE (සිංහල, Singlish, English, தமிழ்) ===
Customer Input Contextual Language: "${detectedLang}"
Required Output Script: "${scriptRequirement}"

${languageDirective}

--- OFFICIAL MASTER DATASET (PRODUCTS, SERVICES & EXACT PRICES) ---
${dataset}
--- END OFFICIAL MASTER DATASET ---
${deliveryDisabledDirective}${catalogPhotoContext}
${archetypeResult.promptDirective}
${upsellDirective}
${negotiationDirective}

CORE PRINCIPLES FOR CONSULTATIVE & INTELLIGENT SALES:
1. 🎯 100% FACTUAL & DATASET ACCURACY: Always quote ONLY the exact products, services, ${deliveryEnabled ? 'delivery policies, ' : ''}bank accounts, and prices stated in the OFFICIAL MASTER DATASET above. Never invent, approximate, or fabricate prices or discounts.
2. 🧠 THOUGHTFUL CONVERSATION (හිතලා බලලා කතා කිරීම): Carefully analyze the customer's intent, tone, and specific inquiry. Do NOT give robotic or generic replies. Specifically address what they asked, acknowledge their needs, and explain clearly and patiently.
3. 🤝 WARMTH, RESPECT & EMOTIONAL INTELLIGENCE (සුහදශීලී සහ ගෞරවනීය සේවාව): Treat every customer like a valued guest. Use polite, warm Sri Lankan hospitality phrases (e.g. "ස්තූතියි", "ඔබට මම පැහැදිලි කරන්නම්", "සාදරයෙන් පිළිගන්නවා", "ඔබට වඩාත් ගැළපෙන්නේ..."). Use gentle friendly emojis (😊, 🙏, ✨, 💼).
4. ${sess.isVoiceCall ? '🎙️ VOICE CONVERSATION: Keep answers to 1 to 2 natural spoken sentences (around 20-35 words) so customer hears crystal-clear information.' : '📱 ELEGANT WHATSAPP FORMATTING: Use clean WhatsApp formatting with *bold* headers, • bullet points, and neat paragraph breaks. Do NOT use markdown # or **double asterisks**.'}
5. 🚀 VALUE-DRIVEN SALES GUIDANCE: At the end of your answer, ${deliveryEnabled ? 'kindly ask a polite guiding question (e.g. ask if they would like to activate the 3-day free trial, view a demo, or have any questions) to help them move forward with confidence.' : 'if the customer is interested in ordering/buying, direct them straight to the Store Owner contact number listed above (never ask for their checkout details).'}
${deliveryEnabled ? `6. 🏷️ If order is confirmed, append: [[ORDER: name=${customerName}|item=ITEM_NAME|amount=TOTAL_RS]]` : `6. 🚫 ORDER CHECKOUT DISABLED: NEVER ask for customer details or output order tags — always refer ready buyers to the Store Owner number above!`}
7. 📸 If customer asks for photos of products with [PHOTO AVAILABLE], append: [[SEND_PHOTO: ProductName]]`;
}

function checkForOrderTag(text, sess, sessionId) {
  let cleanText = text || '';
  const match = cleanText.match(/\[\[(?:ORDER|CONFIRM_ORDER):\s*([^\]]+)\]\]/i);
  if (!match) return cleanText;

  const activeBiz = (sess && sess.businessId && (db.getBusiness(sess.businessId) || db.getAllBusinesses().find(b => b.id === sess.businessId))) || db.getActiveBusiness();
  const settings = (activeBiz && db.getTenantSettings(activeBiz.id)) || db.getSettings();
  if (!isDeliveryEnabled(settings)) {
    return cleanText.replace(match[0], '').replace(/\[\[(?:SEND_PHOTO|SEND_PRODUCT_IMAGE|SEND_IMAGE):?\s*[^\]]*\]\]/gi, '').trim();
  }

  const rawPairs = match[1];
  const fields = {};
  rawPairs.split(/[|\n,;]+/).forEach(pair => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > -1) {
      fields[pair.slice(0, eqIdx).trim().toLowerCase()] = pair.slice(eqIdx + 1).trim();
    }
  });

  console.log(`[order] Confirmed — session: ${sessionId}`, fields);

  // Automatically record order in Multi-Business Database
  const customerPhone = sess.customerPhone || (sessionId && !sessionId.startsWith('call_') ? sessionId : '');
  const newOrder = db.addOrder({
    businessId: activeBiz.id,
    customerName: fields.name || sess.customerName || 'Customer',
    customerPhone: customerPhone,
    item: fields.item || 'Custom Order',
    amount: fields.amount || fields.price || fields.total || '0',
    source: sess.isWhatsApp ? 'WhatsApp' : 'Live Voice Call',
    status: 'Pending Payment'
  });

  if (sess.browserWs) {
    safeSend(sess.browserWs, JSON.stringify({ type: 'order_confirmed', order: fields, orderId: newOrder.id }));
  }
  notifyOwnerOfNewOrder(newOrder, activeBiz);

  if (customerPhone && waEngine) {
    let paySection = '';
    const gwCfg = (settings && settings.paymentGateway) || {};
    if (gwCfg.enabled && gwCfg.autoSendLink) {
      const payUrl = commerce.buildCustomerPaymentUrl(newOrder.id, CALL_SERVER_URL, gwCfg.merchantSecret, gwCfg.customPayUrl);
      paySection = `\n\n💳 *Pay Online (Card / Visa / Master / Koko):*\n${payUrl}`;
    }
    const trackUrl = commerce.buildCustomerTrackingUrl(newOrder.id, CALL_SERVER_URL, gwCfg.merchantSecret);
    const confirmMsg = `✅ *Order Confirmed!*\n\n🏪 *${activeBiz.name}*\n📦 *Item:* ${newOrder.item}\n💰 *Total:* Rs. ${parseFloat(newOrder.amount).toLocaleString()}\n👤 *Name:* ${newOrder.customerName}${paySection}\n\n🔍 *Track Order Live:* ${trackUrl}\n\n_Thank you! Your order has been recorded._ 🙏`;
    waEngine.sendTextMessage(customerPhone, confirmMsg, sess.businessId ? `wa_${sess.businessId}` : null).catch(() => {});
  }

  cleanText = cleanText.replace(match[0], '').replace(/\[\[(?:SEND_PHOTO|SEND_PRODUCT_IMAGE|SEND_IMAGE):?\s*[^\]]*\]\]/gi, '').trim();
  return cleanText;
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

// ─── Gemini Audio Transcription for Incoming WhatsApp Voice Notes ───────────
async function transcribeAudioBuffer(audioBuffer, mimeType = 'audio/ogg; codecs=opus') {
  if (!audioBuffer || audioBuffer.length < 50) return '';
  const audioBase64 = audioBuffer.toString('base64');
  const cleanMime = (mimeType || 'audio/ogg').split(';')[0].trim();
  const keysToTry = getOrderedKeys();

  for (const model of GEMINI_TEXT_MODELS) {
    for (const key of keysToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const payload = {
        contents: [{
          parts: [
            { text: "Carefully listen to and accurately transcribe this WhatsApp voice note from a Sri Lankan customer speaking colloquial Sinhala (සිංහල), Singlish, or English (commonly asking about prices, discounts, offers, packages, products, free trials, or delivery). Pay close attention to Sinhala phonetics (e.g. ඔයාලගේ vs යාලුවගේ, ඩිස්කවුන්ට්/ඔෆර්ස්, ෆ්‍රී ට්‍රයල්). Return ONLY the exact transcribed text, nothing else." },
            { inlineData: { mimeType: cleanMime, data: audioBase64 } }
          ]
        }]
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000)
        });
        const data = await res.json();
        if (data?.error) {
          console.warn(`[voice-transcribe] ${model} API error (${data.error.code}): ${data.error.message}`);
          if (data.error.code === 429 || data.error.code === 401) {
            markKeyCooldown(key, 10 * 60 * 1000);
          }
          continue;
        }
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          console.log(`[voice-transcribe] 🎙️ Gemini (${model}) transcribed voice note: "${text}"`);
          return text;
        }
      } catch (err) {
        console.warn(`[voice-transcribe] ${model} attempt error:`, err.message);
      }
    }
  }
  return '';
}

// ─── Gemini Multimodal Vision Analyzer for Incoming WhatsApp Images ──────────
async function analyzeImageBuffer(imgBuffer, mimeType = 'image/jpeg', caption = '', storeName = 'OmniSix AI', sessionKey = null) {
  const keysToTry = getOrderedKeys(sessionKey);
  if (!imgBuffer || keysToTry.length === 0) {
    return { isBankSlip: false, imageDescription: '', customerIntent: '' };
  }
  const result = await analyzeImageWithGeminiVision(imgBuffer, mimeType, keysToTry, { caption, storeName });
  if (result && (result.isBankSlip || result.imageDescription)) {
    console.log(`[image-vision] 👁️ Image analyzed (isBankSlip=${result.isBankSlip}): "${(result.imageDescription || result.summary || '').slice(0, 80)}"`);
  }
  return result;
}

// ─── Attach Handlers to WhatsApp Multi-Device Engine ────────────────────────
// ─── 🔔 Store Owner Instant WhatsApp Alert ─────────────────────────────────────
async function notifyOwnerOfNewOrder(order, biz) {
  try {
    const settings = db.getTenantSettings(biz.id) || db.getSettings();
    const ownerPhone = (settings.ownerAlertPhone || '').replace(/\D/g, '');
    if (!settings.isOwnerAlertEnabled || !ownerPhone || ownerPhone.length < 9) return;

    const stockWarn = order.lowStockTriggered
      ? `\n\n⚠️ *LOW STOCK ALERT:* ${order.lowStockTriggered.name} (Remaining Qty: ${order.lowStockTriggered.remaining})`
      : '';
    const alertMsg = `🚨 *NEW ORDER NOTIFICATION!*\n\n` +
      `🏪 *Store:* ${biz.name}\n` +
      `📦 *Item:* ${order.item}\n` +
      `💰 *Amount:* Rs. ${parseFloat(String(order.amount).replace(/[^0-9.]/g, '') || 0).toLocaleString()}\n` +
      `👤 *Customer:* ${order.customerName} (${order.customerPhone || 'N/A'})\n` +
      `📍 *Address:* ${order.address || 'Standard Delivery'}\n` +
      `💳 *Status:* ${order.status}\n` +
      `⏰ *Time:* ${new Date().toLocaleTimeString()}${stockWarn}\n\n` +
      `_Check your OmniSix Dashboard to review and dispatch._ 📱`;

    let targetAccId = null;
    const accounts = waEngine.getAccounts(biz.id);
    if (accounts.length > 0 && accounts[0].connected) targetAccId = accounts[0].id;

    await waEngine.sendTextMessage(ownerPhone, alertMsg, targetAccId);
    console.log(`[owner-alert] Sent order alert for #${order.id} to owner ${ownerPhone}`);
  } catch(e) {
    console.error('[owner-alert] Failed to notify owner:', e.message);
  }
}

// ─── ⏰ Automated Follow-Up Background Engine (Runs every 5 minutes) ────────────
const followUpEngineTimer = setInterval(async () => {
  try {
    const businesses = db.getAllBusinesses();
    for (const biz of businesses) {
      const plan = db.SUBSCRIPTION_PLANS[biz.subscriptionPlan] || db.SUBSCRIPTION_PLANS.enterprise;
      if (plan.limits && plan.limits.followUpEngine === false) continue;

      const dueLeads = db.getDueFollowUps(biz.id);
      if (!dueLeads || dueLeads.length === 0) continue;

      const settings = db.getTenantSettings(biz.id) || db.getSettings();
      const accounts = waEngine.getAccounts(biz.id);
      const connectedAcc = accounts.find(a => a.connected);
      let targetAccId = connectedAcc ? connectedAcc.id : null;

      for (const lead of dueLeads.slice(0, 3)) {
        const isStage2 = lead.isFollowUpSent;
        const template = isStage2 ? (settings.followUpStage2Message || settings.followUpMessage) : settings.followUpMessage;
        const msg = renderFollowUpTemplate(template, lead, biz);

        const res = await waEngine.sendTextMessage(lead.customerPhone, msg, targetAccId);
        if (res.ok) {
          db.markFollowUpSent(lead.id, isStage2 ? 2 : 1);
          db.addChatMessage(lead.customerPhone, 'ai', msg, lead.customerName, lead.customerPhone, biz.id);
          console.log(`[followup-engine] Automated Stage ${isStage2 ? 2 : 1} sent to ${lead.customerPhone} for ${biz.name}`);
        } else {
          lead.retryCount = (lead.retryCount || 0) + 1;
          lead.lastAttemptTimestamp = Date.now();
          db.save();
          console.warn(`[followup-engine] Failed to send follow-up to ${lead.customerPhone} (Attempt ${lead.retryCount}): ${res.error}`);
        }
        await new Promise(r => setTimeout(r, 2000)); // 2-second anti-ban burst spacing
      }
    }
  } catch(e) {
    console.error('[followup-engine] Loop error:', e.message);
  }
}, 5 * 60 * 1000);
if (followUpEngineTimer.unref) followUpEngineTimer.unref();

waEngine.setHandlers({
  aiReplyHandler: async (text, sess) => {
    return await getGeminiReply(text, sess);
  },
  orderCheckHandler: (text, sess, id) => {
    return checkForOrderTag(text, sess, id);
  },
  audioTranscribeHandler: async (audioBuffer, mimeType) => {
    return await transcribeAudioBuffer(audioBuffer, mimeType);
  },
  imageAnalyzeHandler: async (imgBuffer, mimeType, caption, storeName, customKey) => {
    return await analyzeImageBuffer(imgBuffer, mimeType, caption, storeName, customKey);
  },
  voiceSynthesizeHandler: async (text, preferredVoice, customKey) => {
    return await synthesizeVoiceAudio(text, preferredVoice, customKey);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n🎙️  OmniSix Live Call Server running on port ${PORT}`);
    console.log(`📡  Call URL: ${CALL_SERVER_URL}/call?s=SESSION_ID`);
    console.log(`💚  Health:  ${CALL_SERVER_URL}/health\n`);

    // Start WhatsApp Multi-Device Web Engine
    waEngine.start();

    // ─── 24/7 Cloud Container Keep-Alive & Anti-Idle Heartbeat Daemon ─────────────
    // Render Free Tier services sleep after 15 minutes of inactivity.
    // This daemon fires external HTTP pings every 4 minutes (with jitter) to continuously keep the container awake.
    const defaultKeepAlive = 'https://omnisix-ai.onrender.com';
    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || (CALL_SERVER_URL.startsWith('http') && !CALL_SERVER_URL.includes('localhost') ? CALL_SERVER_URL : defaultKeepAlive);

    if (keepAliveUrl.startsWith('https://')) {
      const httpsModule = require('https');

      const sendKeepAlivePing = (label = 'Periodic') => {
        try {
          const pingReq = httpsModule.get(`${keepAliveUrl}/health`, {
            headers: {
              'User-Agent': 'OmniSix-24x7-KeepAlive-Daemon/2.0',
              'Cache-Control': 'no-cache, no-store',
              'Connection': 'close'
            },
            timeout: 15000
          }, (res) => {
            res.resume(); // Discard data to release socket
            const mem = process.memoryUsage();
            const rssMb = Math.round(mem.rss / (1024 * 1024));
            const uptimeHrs = (process.uptime() / 3600).toFixed(1);
            if (res.statusCode === 200) {
              console.log(`⏱️ [24/7 Keep-Alive] ${label} heartbeat OK (HTTP 200) | Uptime: ${uptimeHrs}h | RAM: ${rssMb}MB`);
            } else {
              console.warn(`⚠️ [24/7 Keep-Alive] Received status HTTP ${res.statusCode}`);
            }
          });

          pingReq.on('timeout', () => {
            pingReq.destroy();
          });

          pingReq.on('error', (err) => {
            // Suppress transient DNS / network hiccups
          });
        } catch (err) {
          // Guard against synchronous invocation errors
        }
      };

      // Initial warm-up ping after 15 seconds
      setTimeout(() => sendKeepAlivePing('Warm-Up'), 15000);

      // Schedule recursive heartbeat with randomized jitter (3.5 to 4.5 minutes)
      const scheduleNextPing = () => {
        const delayMs = (3.5 * 60 * 1000) + Math.floor(Math.random() * (60 * 1000)); // 210s - 270s
        setTimeout(() => {
          sendKeepAlivePing('Heartbeat');
          scheduleNextPing();
        }, delayMs);
      };
      scheduleNextPing();

      console.log(`⏱️ [24/7 Keep-Alive] Autonomous Heartbeat Daemon active for: ${keepAliveUrl}/health (~4 min cycle)`);
    }
  });
}

module.exports = { app, server, buildSystemPrompt, checkForOrderTag, getGeminiReply };
