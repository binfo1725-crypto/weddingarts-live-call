
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
const { AgentFleetManager } = require('./agentTeam.js');
const agentFleet = new AgentFleetManager(db);
const waEngine = require('./whatsapp.js');
const { generateInvoicePdf } = require('./invoiceGenerator.js');
const categoryProfiles = require('./categoryProfiles.js');
const pdfParse = require('pdf-parse');
const {
  CustomerArchetypeEngine,
  AngryCustomerEscalationEngine,
  SmartNegotiationEngine,
  SmartUpsellEngine,
  SlipDetectionEngine,
  LanguageDetectionEngine
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token, x-license-key, x-business-id, x-api-key');
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
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipHits.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) ipHits.delete(ip);
      else ipHits.set(ip, valid);
    }
  }, windowMs);

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

app.use(express.json({ limit: '10mb' }));

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

app.get('/free', (req, res) => {
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
  const { clientName, clientPhone } = req.body;
  if (!clientName || !clientPhone) {
    return res.status(400).json({ ok: false, error: 'Store Name and Phone number are required (නම සහ දුරකථන අංකය අවශ්‍යයි).' });
  }

  const cleanPhone = clientPhone.replace(/\D/g, '');
  const normPhone = cleanPhone.length >= 9 ? cleanPhone.slice(-9) : cleanPhone;
  const existing = (db.data.licenses || []).find(l => {
    const p = (l.clientPhone || '').replace(/\D/g, '');
    return (p.length >= 9 ? p.slice(-9) : p) === normPhone;
  });
  if (existing) {
    return res.status(409).json({
      ok: false,
      alreadyRegistered: true,
      error: 'මෙම දුරකථන අංකයෙන් දැනටමත් ගිණුමක් ලියාපදිංචි වී ඇත. කරුණාකර ඔබගේ License Key එකෙන් Login වන්න.'
    });
  }

  const newLic = db.generateLicense({
    plan: 'TRIAL',
    clientName,
    clientPhone,
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
const activeAdminSessions = new Map(); // token -> expiresAt
const ADMIN_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function pruneAdminSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of activeAdminSessions.entries()) {
    if (now > expiresAt) activeAdminSessions.delete(token);
  }
}
setInterval(pruneAdminSessions, 30 * 60 * 1000);

function requireAdminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || (req.query && req.query.adminToken);
  const now = Date.now();
  if (!token || !activeAdminSessions.has(token) || activeAdminSessions.get(token) < now) {
    if (token && activeAdminSessions.has(token)) activeAdminSessions.delete(token);
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
  activeAdminSessions.set(token, Date.now() + ADMIN_SESSION_DURATION);

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
  const now = Date.now();
  if (token && activeAdminSessions.has(token) && activeAdminSessions.get(token) > now) {
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

// Unified Role-Based Access Control (Admin or Valid Tenant Session)
function requireSessionAuth(req, res, next) {
  if (isAdminReq(req) || isTenantReq(req)) {
    return next();
  }
  const apiKey = req.headers['x-api-key'] || (req.query && req.query.apiKey);
  if (apiKey && typeof db.validateApiKey === 'function' && db.validateApiKey(apiKey)) {
    return next();
  }
  return res.status(401).json({
    ok: false,
    error: 'ආරක්ෂිත ප්‍රවේශය අවශ්‍යයි (Authentication Required). කරුණාකර Admin PIN හෝ License Key මඟින් පිවිසෙන්න.'
  });
}

function isAdminReq(req) {
  const token = req.headers['x-admin-token'] || (req.query && req.query.adminToken);
  const now = Date.now();
  return !!(token && activeAdminSessions.has(token) && activeAdminSessions.get(token) > now);
}

function isTenantReq(req) {
  if (isAdminReq(req)) return false;
  return !!(req.headers['x-license-key'] || (req.query && req.query.licenseKey) || (req.query && req.query.key));
}

function resolveReqBusinessId(req) {
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

  // Multi-Tab isolation: Check tab-scoped header
  const headerBizId = req.headers['x-business-id'];
  if (headerBizId && db.getBusiness(headerBizId)) {
    return headerBizId;
  }

  // Check URL query parameters (store, biz, businessId)
  if (req.query) {
    const qb = req.query.store || req.query.biz || req.query.businessId;
    if (qb && db.getBusiness(qb)) {
      return qb;
    }
  }

  // Check request body
  if (req.body && req.body.businessId && db.getBusiness(req.body.businessId)) {
    return req.body.businessId;
  }

  const active = db.getActiveBusiness();
  return active ? active.id : 'default';
}

app.get('/api/portal/store', (req, res) => {
  const key = req.headers['x-license-key'] || req.query.key;
  const requestedBizId = req.headers['x-business-id'] || req.query.biz || req.query.store;

  let lic = key ? db.getLicenseByKey(key) : null;
  let biz = null;

  if (lic && lic.status === 'Active') {
    biz = db.getAllBusinesses().find(b => b.id === lic.businessId) || db.getActiveBusiness();
  } else if (requestedBizId && db.getBusiness(requestedBizId)) {
    biz = db.getBusiness(requestedBizId);
    lic = (db.data.licenses || []).find(l => l.businessId === requestedBizId && l.status === 'Active') || {
      key: 'PORTAL-DIRECT-' + biz.id.toUpperCase(),
      clientName: biz.name,
      planTier: biz.subscriptionPlan || 'enterprise',
      status: 'Active',
      expiresAt: '2099-12-31T23:59:59.999Z',
      daysLeft: 9999
    };
  } else {
    return res.status(401).json({ ok: false, error: 'Missing or invalid license key header.' });
  }

  const orders = db.getOrders(biz.id);
  const products = db.getProducts(biz.id);
  const flows = db.getCustomFlows(biz.id);
  const chats = (db.data.chats || []).filter(c => !c.businessId || c.businessId === biz.id);

  res.json({
    ok: true,
    license: lic,
    business: biz,
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

  // Unauthenticated public visitor: ONLY return safe public active store metadata
  const publicActive = db.getActiveBusiness();
  res.json({
    ok: true,
    active: {
      id: publicActive.id,
      name: publicActive.name,
      category: publicActive.category,
      phone: publicActive.phone,
      whatsappPhone: publicActive.whatsappPhone,
      currency: publicActive.currency || 'Rs.',
      welcomeMessage: publicActive.welcomeMessage,
      deliveryPolicy: publicActive.deliveryPolicy
    },
    businesses: [] // Strictly empty for unauthenticated public requests!
  });
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
app.get('/api/analytics', (req, res) => {
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

app.post('/api/subscription/select-plan', (req, res) => {
  const { planId } = req.body || {};
  if (!db.SUBSCRIPTION_PLANS[planId]) {
    return res.status(400).json({ ok: false, error: 'Invalid subscription plan' });
  }
  const bId = resolveReqBusinessId(req);
  db.updateBusinessPlan(bId, planId);
  res.json({
    ok: true,
    message: `Plan upgraded successfully to ${db.SUBSCRIPTION_PLANS[planId].name}!`,
    plan: db.SUBSCRIPTION_PLANS[planId]
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

app.post(['/api/orders/status', '/api/orders/update-status'], async (req, res) => {
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

app.post('/api/orders/create', (req, res) => {
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

// ─── 🧾 Invoice Dispatch via WhatsApp ─────────────────────────────────────────
app.get('/api/orders/invoice/:orderId', (req, res) => {
  const { orderId } = req.params;
  const bId = resolveReqBusinessId(req);
  const order = db.getOrders(bId).find(o => o.id === orderId);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
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

app.post('/api/orders/send-invoice', async (req, res) => {
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
app.get('/api/orders/:orderId/invoice.pdf', async (req, res) => {
  try {
    const { orderId } = req.params;
    const bId = resolveReqBusinessId(req);
    const order = db.getOrders(bId).find(o => o.id === orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
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
app.get('/api/export/orders.csv', (req, res) => {
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
app.get('/api/export/contacts.vcf', (req, res) => {
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
app.get('/api/export/backup.json', (req, res) => {
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
app.get('/api/blacklist', (req, res) => {
  res.json({ ok: true, blacklist: db.getBlacklist() });
});

app.post('/api/blacklist/toggle', (req, res) => {
  const { phone, reason } = req.body;
  if (!phone) return res.status(400).json({ ok: false, error: 'Phone is required' });
  const result = db.toggleBlacklist(phone, reason);
  res.json({ ok: true, ...result });
});

// ─── 📝 Private Staff Notes (Feature 10) ─────────────────────────────────────
app.get('/api/notes/:phone', (req, res) => {
  const notes = db.getCustomerNotes(req.params.phone);
  res.json({ ok: true, notes });
});

app.post('/api/notes/:phone', (req, res) => {
  const { text, author } = req.body;
  if (!text) return res.status(400).json({ ok: false, error: 'Note text required' });
  const note = db.addCustomerNote(req.params.phone, text, author);
  res.json({ ok: true, note });
});

app.delete('/api/notes/:phone/:noteId', (req, res) => {
  const success = db.deleteCustomerNote(req.params.phone, req.params.noteId);
  res.json({ ok: success });
});

// ─── 📊 Daily End-of-Day (EOD) Operations Summary (Feature 12) ───────────────
app.get('/api/eod-report', (req, res) => {
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

app.get('/api/export/courier-waybill.csv', (req, res) => {
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
    const { orderId, status, trackingNumber, secret } = req.body;
    const settings = db.getSettings();
    if (settings.googleSheets && settings.googleSheets.secret) {
      if (secret !== settings.googleSheets.secret) {
        return res.status(403).json({ ok: false, error: 'Unauthorized secret token' });
      }
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

app.post('/api/google-sheets/test-sync', async (req, res) => {
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
app.get('/api/agents', (req, res) => {
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

app.post('/api/agents/:id/toggle', (req, res) => {
  const { active } = req.body;
  const updated = agentFleet.toggleAgent(req.params.id, active);
  if (!updated) return res.status(404).json({ ok: false, error: 'Agent not found' });
  res.json({ ok: true, agent: updated });
});

app.post('/api/agents/mode', (req, res) => {
  const { mode } = req.body;
  const currentMode = agentFleet.setOperatingMode(mode);
  res.json({ ok: true, mode: currentMode });
});

app.get('/api/agents/decisions', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  res.json({ ok: true, decisions: agentFleet.getRecentDecisions(limit) });
});

app.post(['/api/agents/dispatch-test', '/api/agents/test-route'], (req, res) => {
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



app.get('/api/export/contacts.csv', (req, res) => {
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
app.get('/api/categories', (req, res) => {
  res.json({ ok: true, categories: categoryProfiles.getAllCategories() });
});

app.get('/api/categories/:id', (req, res) => {
  const cat = categoryProfiles.getCategoryById(req.params.id);
  res.json({ ok: true, category: cat });
});

app.post('/api/categories/apply', (req, res) => {
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
app.get('/api/leads/candidates', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, candidates: db.getFollowUpCandidates(bId) });
});

app.post('/api/leads/follow-up', async (req, res) => {
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
app.get('/api/products', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, products: db.getProducts(bId) });
});

app.post('/api/products', (req, res) => {
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

app.post('/api/products/send-photo', async (req, res) => {
  try {
    const { phone, productId, accountId, customCaption } = req.body;
    if (!phone || !productId) {
      return res.status(400).json({ ok: false, error: 'phone and productId are required' });
    }
    const bId = resolveReqBusinessId(req);
    const products = db.getProducts(bId);
    const prod = products.find(p => p.id === productId);
    if (!prod || !prod.imageUrl) {
      return res.status(404).json({ ok: false, error: 'Product or product image not found' });
    }
    const caption = customCaption || `📸 *${prod.name}*\n💰 මිල: Rs. ${(prod.price || 0).toLocaleString()}\n${prod.description ? prod.description + '\n' : ''}📦 ඇණවුම් කිරීමට ඔබගේ නම සහ ලිපිනය එවන්න.`;

    // Choose session for this business
    let targetAccId = accountId;
    if (!targetAccId && req.tenantBusinessId) {
      targetAccId = 'wa_' + req.tenantBusinessId;
    }
    const result = await waEngine.sendImageMessage(phone, prod.imageUrl, targetAccId, caption);
    if (result.ok) {
      db.addChatMessage(phone, 'agent', `📷 [Sent Product Photo: ${prod.name}]`, 'Agent', phone, bId);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Custom Keyword Flows CRUD (From APK) ──────────────────────────────────────
app.get('/api/flows', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, flows: db.getCustomFlows(bId) });
});

app.post('/api/flows', (req, res) => {
  const bId = req.body.businessId || resolveReqBusinessId(req);
  const flow = db.addCustomFlow({ ...req.body, businessId: bId });
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

// ─── Store & AI Persona Settings (From APK & Scoped Multi-Tenant) ─────────────
app.get('/api/settings', requireSessionAuth, (req, res) => {
  if (isTenantReq(req)) {
    const bId = resolveReqBusinessId(req);
    return res.json({ ok: true, settings: db.getTenantSettings(bId) });
  }
  res.json({ ok: true, settings: db.getSettings() });
});

app.post('/api/settings', requireSessionAuth, (req, res) => {
  if (isTenantReq(req)) {
    const bId = resolveReqBusinessId(req);
    const settings = db.updateTenantSettings(bId, req.body);
    return res.json({ ok: true, settings });
  }
  const settings = db.updateSettings(req.body);
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
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite'
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
        })
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

// Live Chat Inbox & Human Takeover (Strict Multi-Tenant Scoped)
app.get('/api/chats', requireSessionAuth, (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({
    ok: true,
    chats: db.getChats(isTenantReq(req) ? bId : null)
  });
});

app.post('/api/chats/reply', requireSessionAuth, async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) return res.status(400).json({ error: 'chatId and text required' });

  const isTenant = isTenantReq(req);
  const bId = resolveReqBusinessId(req);
  const targetAccId = isTenant ? ('wa_' + bId) : 'default';

  const result = db.addChatMessage(chatId, 'agent', text, 'Customer', chatId, bId);
  if (waEngine) {
    try {
      await waEngine.sendTextMessage(chatId, text, targetAccId);
    } catch (e) {
      console.warn('[chats/reply] WhatsApp send failed:', e.message);
    }
  }
  res.json({ ok: true, ...result });
});

app.post('/api/chats/mute', requireSessionAuth, (req, res) => {
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

// ─── Safe Broadcast Campaigns with Anti-Ban Spintax & Human Delays ───────────
app.get('/api/broadcasts', (req, res) => {
  res.json({
    ok: true,
    broadcasts: db.getBroadcasts()
  });
});

app.post('/api/broadcasts', async (req, res) => {
  const activeBiz = db.getActiveBusiness();
  const { title, message, contacts, minDelay = 8, maxDelay = 22 } = req.body;

  // Determine recipients list (custom CSV upload or existing customer database)
  let targetContacts = [];
  if (Array.isArray(contacts) && contacts.length > 0) {
    targetContacts = contacts.map(c => ({
      name: c.name || 'Customer',
      phone: String(c.phone || c.mobile || '').replace(/\D/g, ''),
      city: c.city || c.address || '',
      var1: c.var1 || ''
    })).filter(c => c.phone.length >= 9);
  } else {
    const chats = db.getChats();
    const seen = new Set();
    for (const c of chats) {
      const clean = String(c.customerPhone || '').replace(/\D/g, '');
      if (clean.length >= 9 && !seen.has(clean)) {
        seen.add(clean);
        targetContacts.push({ name: c.customerName || 'Customer', phone: clean, city: '' });
      }
    }
  }

  const broadcast = db.addBroadcast({
    title: title || 'Marketing Campaign',
    message: message || '',
    targetAudience: req.body.targetAudience || (Array.isArray(contacts) ? 'Custom Upload List' : 'All Customers'),
    targetCount: targetContacts.length,
    status: 'In Progress',
    sentCount: 0,
    failedCount: 0,
    businessId: activeBiz.id
  });

  // Background Anti-Ban Drip Queue with Human Jitter
  if (message && targetContacts.length > 0) {
    (async () => {
      let sent = 0;
      let failed = 0;
      for (const recipient of targetContacts) {
        try {
          const personalizedText = interpolateBroadcastTemplate(message, recipient);
          const sendRes = await waEngine.sendTextMessage(recipient.phone, personalizedText);
          if (sendRes.ok) {
            sent++;
            db.addChatMessage(recipient.phone, 'ai', personalizedText, recipient.name, recipient.phone, activeBiz.id);
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
        }

        // Anti-ban human jitter delay (random between minDelay and maxDelay seconds)
        const delaySec = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(r => setTimeout(r, delaySec * 1000));
      }
      broadcast.status = 'Completed';
      broadcast.sentCount = sent;
      broadcast.failedCount = failed;
      db.save();
      console.log(`[broadcast] 📢 Completed campaign "${broadcast.title}": ${sent} sent, ${failed} failed.`);
    })();
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
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (message && message.type === 'text') {
        const from = message.from;
        const customerName = value?.contacts?.[0]?.profile?.name || 'Customer';
        const text = message.text?.body || '';
        const activeBiz = db.getActiveBusiness();

        console.log(`[meta-webhook] 📩 Incoming Meta WhatsApp from +${from}: "${text}"`);
        db.addChatMessage(from, 'customer', text, customerName, from, activeBiz.id);

        const tempSess = {
          storeName: activeBiz.name,
          businessId: activeBiz.id,
          business: activeBiz,
          customerName,
          customerPhone: from,
          dataset: activeBiz.dataset,
          isWhatsApp: true,
          isVoiceCall: false,
          history: []
        };

        const aiReply = await getGeminiReply(text, tempSess);
        if (aiReply) {
          const settings = db.getSettings();
          if (settings.metaCloudApi && settings.metaCloudApi.enabled) {
            await waEngine.sendMetaCloudMessage(from, aiReply, settings.metaCloudApi);
          } else {
            await waEngine.sendTextMessage(from, aiReply);
          }
          db.addChatMessage(from, 'ai', aiReply, customerName, from, activeBiz.id);
        }
      }
    }
  } catch (err) {
    console.error('[meta-webhook] Processing error:', err.message);
  }
  res.sendStatus(200);
});

// ─── 👥 Multi-User Staff & Role-Based Access Control (RBAC) ─────────────────
app.get('/api/staff', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, staff: db.getStaff(bId) });
});

app.post('/api/staff/create', (req, res) => {
  try {
    const bId = resolveReqBusinessId(req);
    const member = db.addStaff({ ...req.body, businessId: bId });
    res.json({ ok: true, member });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/staff/delete', (req, res) => {
  try {
    const { id } = req.body;
    db.deleteStaff(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/staff/login', (req, res) => {
  const { username, password } = req.body;
  const staff = db.authenticateStaff(username, password);
  if (staff) {
    res.json({
      ok: true,
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
app.get('/api/whatsapp/status', (req, res) => {
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

app.get('/api/whatsapp/accounts', async (req, res) => {
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

app.post('/api/whatsapp/accounts/add', async (req, res) => {
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

app.post('/api/whatsapp/accounts/:id/pairing-code', async (req, res) => {
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

app.post('/api/whatsapp/accounts/:id/restart', async (req, res) => {
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

app.post('/api/whatsapp/accounts/:id/toggle-bot', async (req, res) => {
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

app.post('/api/whatsapp/accounts/:id/logout', async (req, res) => {
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

app.post('/api/whatsapp/accounts/:id/delete', async (req, res) => {
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

app.post('/api/whatsapp/pairing-code', async (req, res) => {
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

app.post('/api/whatsapp/logout', async (req, res) => {
  let accountId = req.body.accountId || 'default';
  if (isTenantReq(req)) {
    const bId = resolveReqBusinessId(req);
    accountId = 'wa_' + bId;
  }
  await waEngine.logout(accountId);
  res.json({ ok: true });
});

app.post('/api/whatsapp/restart', async (req, res) => {
  try {
    const targetId = req.body && req.body.accountId;
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
app.get('/api/warmer', (req, res) => {
  res.json({ ok: true, warmer: db.getWarmer() });
});

app.post('/api/warmer/toggle', (req, res) => {
  const { running } = req.body;
  const warmer = db.updateWarmer({ running: !!running });
  res.json({ ok: true, warmer });
});

app.post('/api/warmer/settings', (req, res) => {
  const { minDelay, maxDelay, intervalSeconds } = req.body;
  const warmer = db.updateWarmer({
    minDelay: Number(minDelay) || 20,
    maxDelay: Number(maxDelay) || 60,
    intervalSeconds: Number(intervalSeconds) || 45
  });
  res.json({ ok: true, warmer });
});

app.post('/api/warmer/scripts/add', (req, res) => {
  const { question, answer } = req.body;
  const scripts = db.addWarmerScript(question, answer);
  res.json({ ok: true, scripts });
});

app.delete('/api/warmer/scripts/:id', (req, res) => {
  const scripts = db.deleteWarmerScript(req.params.id);
  res.json({ ok: true, scripts });
});

app.post('/api/warmer/logs/clear', (req, res) => {
  res.json(db.clearWarmerLogs());
});

// ─── 2. Contact Management & Advanced Phonebook API ──────────────────────────
app.get('/api/contacts', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({
    ok: true,
    contacts: db.getContacts(bId),
    groups: db.getContactGroups(bId)
  });
});

app.post('/api/contacts', (req, res) => {
  const bId = resolveReqBusinessId(req);
  const contact = db.saveContact({ ...req.body, businessId: bId });
  res.json({ ok: true, contact });
});

app.post('/api/contacts/bulk', (req, res) => {
  const bId = resolveReqBusinessId(req);
  const { contacts } = req.body;
  if (!Array.isArray(contacts)) {
    return res.status(400).json({ ok: false, error: 'contacts array is required.' });
  }
  const result = db.bulkImportContacts(bId, contacts);
  res.json(result);
});

app.delete('/api/contacts/:id', (req, res) => {
  res.json(db.deleteContact(req.params.id));
});

app.get('/api/contacts/groups', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, groups: db.getContactGroups(bId) });
});

// ─── 3. Kanban CRM & Deal Pipeline API ───────────────────────────────────────
app.get('/api/kanban/deals', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, deals: db.getKanbanDeals(bId) });
});

app.post('/api/kanban/deals', (req, res) => {
  const bId = resolveReqBusinessId(req);
  const deal = db.saveKanbanDeal({ ...req.body, businessId: bId });
  res.json({ ok: true, deal });
});

app.post('/api/kanban/deals/:id/stage', (req, res) => {
  const { stage } = req.body;
  const deal = db.updateDealStage(req.params.id, stage);
  if (deal) res.json({ ok: true, deal });
  else res.status(404).json({ ok: false, error: 'Deal not found.' });
});

app.delete('/api/kanban/deals/:id', (req, res) => {
  res.json(db.deleteKanbanDeal(req.params.id));
});

// ─── 4. WhatsApp Interactive Forms & Flows API ──────────────────────────────
app.get('/api/forms', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, forms: db.getForms(bId) });
});

app.post('/api/forms', (req, res) => {
  const bId = resolveReqBusinessId(req);
  const form = db.saveForm({ ...req.body, businessId: bId });
  res.json({ ok: true, form });
});

app.delete('/api/forms/:id', (req, res) => {
  res.json(db.deleteForm(req.params.id));
});

// ─── 5. Developer REST API & Webhooks ────────────────────────────────────────
app.get('/api/developer/keys', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, keys: db.getApiKeys(bId) });
});

app.post('/api/developer/keys', (req, res) => {
  const bId = resolveReqBusinessId(req);
  const { label } = req.body;
  const key = db.createApiKey(bId, label || 'Production Key');
  res.json({ ok: true, key });
});

app.delete('/api/developer/keys/:id', (req, res) => {
  res.json(db.revokeApiKey(req.params.id));
});

app.get('/api/developer/webhooks', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({
    ok: true,
    webhooks: db.getWebhooks(bId),
    logs: db.getWebhookLogs(bId)
  });
});

app.post('/api/developer/webhooks', (req, res) => {
  const bId = resolveReqBusinessId(req);
  const webhook = db.saveWebhook({ ...req.body, businessId: bId });
  res.json({ ok: true, webhook });
});

app.delete('/api/developer/webhooks/:id', (req, res) => {
  res.json(db.deleteWebhook(req.params.id));
});

app.get('/api/developer/webhook-logs', (req, res) => {
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
app.get('/api/team/agents', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, agents: db.getAgents(bId) });
});

app.post('/api/team/agents', (req, res) => {
  const bId = resolveReqBusinessId(req);
  const agent = db.saveAgent({ ...req.body, businessId: bId });
  res.json({ ok: true, agent });
});

app.delete('/api/team/agents/:id', (req, res) => {
  res.json(db.deleteAgent(req.params.id));
});

// ─── 7. Chat Metadata & Quick Replies ────────────────────────────────────────
app.get('/api/chats/:id/metadata', (req, res) => {
  res.json({ ok: true, metadata: db.getChatMetadata(req.params.id) });
});

app.post('/api/chats/:id/notes', (req, res) => {
  const { text, author } = req.body;
  const note = db.saveChatNote(req.params.id, text, author || 'Agent');
  res.json({ ok: true, note });
});

app.post('/api/chats/:id/status', (req, res) => {
  const { status } = req.body;
  const meta = db.updateChatStatus(req.params.id, status || 'open');
  res.json({ ok: true, metadata: meta });
});

app.post('/api/chats/:id/tags', (req, res) => {
  const { tags } = req.body;
  const meta = db.updateChatTags(req.params.id, tags || []);
  res.json({ ok: true, metadata: meta });
});

app.get('/api/quick-replies', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, quickReplies: db.getQuickReplies(bId) });
});

app.post('/api/quick-replies', (req, res) => {
  const bId = resolveReqBusinessId(req);
  const reply = db.saveQuickReply(req.body);
  res.json({ ok: true, reply });
});

app.delete('/api/quick-replies/:id', (req, res) => {
  res.json(db.deleteQuickReply(req.params.id));
});

// ─── 8. Voice Call Logs API ──────────────────────────────────────────────────
app.get('/api/calls/logs', (req, res) => {
  const bId = resolveReqBusinessId(req);
  res.json({ ok: true, logs: db.getCallLogs(bId) });
});

app.post('/api/calls/logs', (req, res) => {
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
app.post('/api/dataset/upload', datasetUploadLimiter, async (req, res) => {
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

// Direct HTTP Chat API
app.post('/api/chat', async (req, res) => {
  const activeBiz = db.getActiveBusiness();
  const { sessionId, message } = req.body;
  const sess = sessions.get(sessionId) || {
    customerName: 'Customer',
    storeName: activeBiz.name,
    voice: VOICE_NAME,
    apiKey: DEFAULT_GEMINI_API_KEY,
    isVoiceCall: false,
    isWhatsApp: true,
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
server.on('error', (err) => {
  console.error('[server] HTTP Server error:', err && err.message ? err.message : err);
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('error', (err) => {
  console.error('[wss] WebSocket Server error:', err && err.message ? err.message : err);
});

wss.on('connection', (browserWs, req) => {
  browserWs.on('error', (err) => {
    console.warn(`[ws] Client socket error:`, err && err.message ? err.message : err);
  });
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
  const settings = (sess && sess.businessId && db.getTenantSettings(sess.businessId)) || db.getSettings();
  const storeName = sess.storeName || activeBiz.name || 'WEDDING ARTS';
  if (!sess.apiKey && (settings.geminiApiKey || activeBiz.geminiApiKey)) {
    sess.apiKey = settings.geminiApiKey || activeBiz.geminiApiKey;
  }

  // Detect customer's actual contextual language with history memory
  const detectedLang = (userLang === 'en-US')
    ? 'English'
    : LanguageDetectionEngine.detectLanguage(userMessage, sess.history || []);

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
      turnInstruction = `\n[WHATSAPP MESSAGE: The customer sent this message in Singlish (Sinhala written in Latin letters, e.g. "mewaye price eka kiyada"). Reply strictly in natural, friendly, polite Sri Lankan Singlish using Latin letters (e.g. "Mewaye mila Rs. 4,800 wenawa. Islandwide delivery thiyenawa. Oya kamathi size eka kiyanna!"). Do NOT use Sinhala script characters and do NOT reply in formal English. Use clean WhatsApp formatting (*bold*, • bullets) with exact prices from dataset.]`;
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
        markKeyCooldown(key, 5 * 60 * 1000);
      }
    }
  }

  // Smart fallback from dataset if all Gemini models exhaust daily quota
  console.warn('[Gemini Text] All text models hit quota or failed. Using smart dataset fallback.');
  const store = sess.storeName || 'OmniSix AI';
  let fallbackReply = '';
  if (detectedLang === 'English') {
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

function buildSystemPrompt(sess, datasetText, userLang, userMessage, detectedLang = 'Sinhala') {
  const activeBiz = (sess && sess.businessId && (db.getBusiness(sess.businessId) || db.getAllBusinesses().find(b => b.id === sess.businessId))) || db.getActiveBusiness();
  const settings = (sess && sess.businessId && db.getTenantSettings(sess.businessId)) || db.getSettings();
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

  // 3.1 Products with Photos for Instant Dispatch
  const storeProducts = db.getProducts(activeBiz.id);
  let catalogPhotoContext = '';
  if (storeProducts && storeProducts.length > 0) {
    const prodsWithImg = storeProducts.filter(p => !!(p.imageUrl && p.imageUrl.length > 20));
    if (prodsWithImg.length > 0) {
      catalogPhotoContext = `\n--- 📸 PRODUCTS WITH GENUINE PHOTOS AVAILABLE IN SYSTEM ---\n` +
        prodsWithImg.map(p => `• Product: "${p.name}" | Price: Rs. ${(p.price || 0).toLocaleString()} [PHOTO AVAILABLE]`).join('\n') +
        `\n👉 WHEN A CUSTOMER ASKS TO SEE PHOTOS / SAMPLES / PICS of any product above (e.g. "photos ewanna", "photo thiyenawada", "balanna puluwanda", "sample balanna puluwanda", "pics please"), reply politely and APPEND THIS EXACT TAG AT THE END of your reply: [[SEND_PHOTO: ProductName]]\nThe WhatsApp engine will automatically deliver the genuine product photo with details directly to the customer!\n--- END PRODUCTS WITH PHOTOS ---\n`;
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
- Regardless of what language the customer speaks or writes, you MUST ALWAYS reply in natural, polite Sri Lankan Singlish using Latin letters (e.g. "Ow meka Rs. [Price] wenawa. Delivery puluwan...").
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
2. 🇱🇰 SINGLISH (when customer writes in Singlish using Latin letters, e.g. "mewaye price eka kiyada?", "deliver karanna puluwanda?", "size thiyenawada?", "bank details ewanna"):
   * When mode is smart_match, reply in smooth, natural, polite, friendly Sri Lankan Singlish using Latin letters (e.g. "Mewaye mila Rs. 4,800 wenawa. Islandwide delivery thiyenawa. Oya kamathi size eka kiyanna!").
   * Do NOT use Sinhala script characters and do NOT reply in pure formal English.
3. 🇱🇰 SINHALA SCRIPT (when customer writes in Sinhala letters, e.g. "මිල කීයද?", "විස්තර එවන්න"):
   * You MUST reply strictly in natural, polite Sinhala script (සිංහල අකුරින් පමණි)!
   * Address customer respectfully in warm, natural colloquial Sri Lankan Sinhala (අපේ, ඔබට/ඔයාට, ලබාගන්න පුළුවන්, ස්තූතියි).
4. 🇬🇧 ENGLISH (when customer writes in English, e.g. "What are the available sizes?"):
   * Reply strictly in clear, professional, warm English (e.g. "Hello! The price is Rs. 4,800 with free delivery...").
   * NEVER reply in Sinhala or Singlish when customer asks in English!
5. 🇮🇳 TAMIL SCRIPT (when customer writes in Tamil letters, தமிழ் எழுத்துகளில், e.g. "இதன் விலை என்ன?"):
   * Reply strictly in warm, polite Tamil script (தமிழ்). Never output English or Tanglish!
6. 🔤 TANGLISH (when customer writes in Tanglish, Tamil in Latin letters):
   * Reply strictly in conversational Tanglish using Latin letters.
7. 🌍 OTHER FOREIGN LANGUAGES (Italian, French, German, Spanish, Arabic, Hindi, etc.):
   * Reply strictly, fluently, and politely in that customer's EXACT MATCHING FOREIGN LANGUAGE!
8. 🔄 CONVERSATIONAL CONTINUITY FOR SHORT / AMBIGUOUS INPUTS:
   * If customer sends short answers ("ok", "yes", "1", "size M", "red", phone number, or delivery address), seamlessly preserve the ongoing conversation's language.`;
  }

  return `You are "${settings.aiName || 'Nethmi'}", a ${personaInstruction} representing "${storeName}".
Customer Name: "${customerName}".

=== 🌐 🗣️ QUAD-LANGUAGE SMART ADAPTATION MANDATE (සිංහල, Singlish, English, தமிழ்) ===
Customer Input Contextual Language: "${detectedLang}"
Required Output Script: "${scriptRequirement}"

CRITICAL DYNAMIC LANGUAGE MATCHING RULES:
1. 🔄 DYNAMIC LANGUAGE ADAPTATION:
   - If the customer writes or switches language (English, Sinhala, Singlish, Tamil, Tanglish, Italian, French, German, Spanish, etc.), you MUST IMMEDIATELY ADAPT and reply in that customer's MATCHING language!
2. 🇱🇰 SINGLISH (when customer writes in Singlish using Latin letters, e.g. "mewaye price eka kiyada?", "deliver karanna puluwanda?", "size thiyenawada?", "bank details ewanna"):
   * When mode is smart_match, reply in smooth, natural, polite, friendly Sri Lankan Singlish using Latin letters (e.g. "Mewaye mila Rs. 4,800 wenawa. Islandwide delivery thiyenawa. Oya kamathi size eka kiyanna!").
   * Do NOT use Sinhala script characters and do NOT reply in pure formal English.
3. 🇱🇰 SINHALA SCRIPT (when customer writes in Sinhala letters, e.g. "මිල කීයද?", "විස්තර එවන්න"):
   * You MUST reply strictly in natural, polite Sinhala script (සිංහල අකුරින් පමණි)!
   * Address customer respectfully in warm, natural colloquial Sri Lankan Sinhala (අපේ, ඔබට/ඔයාට, ලබාගන්න පුළුවන්, ස්තූතියි).
4. 🇬🇧 ENGLISH (when customer writes in English, e.g. "What are the available sizes?"):
   * Reply strictly in clear, professional, warm English (e.g. "Hello! The price is Rs. 4,800 with free delivery...").
   * NEVER reply in Sinhala or Singlish when customer asks in English!
5. 🇮🇳 TAMIL SCRIPT (when customer writes in Tamil letters, தமிழ் எழுத்துகளில், e.g. "இதன் விலை என்ன?"):
   * Reply strictly in warm, polite Tamil script (தமிழ்). Never output English or Tanglish!
6. 🔤 TANGLISH (when customer writes in Tanglish, Tamil in Latin letters):
   * Reply strictly in conversational Tanglish using Latin letters.
7. 🌍 OTHER FOREIGN LANGUAGES (Italian, French, German, Spanish, Arabic, Hindi, etc.):
   * Reply strictly, fluently, and politely in that customer's EXACT MATCHING FOREIGN LANGUAGE!
8. 🔄 CONVERSATIONAL CONTINUITY FOR SHORT / AMBIGUOUS INPUTS:
   * If customer sends short answers ("ok", "yes", "1", "size M", "red", phone number, or delivery address), seamlessly preserve the ongoing conversation's language.

--- OFFICIAL MASTER DATASET (PRODUCTS, SERVICES & EXACT PRICES) ---
${dataset}
--- END OFFICIAL MASTER DATASET ---
${catalogPhotoContext}
${archetypeResult.promptDirective}
${upsellDirective}
${negotiationDirective}

KEY RULES FOR CONVERSATION & SALES:
1. STRICT DATASET ACCURACY: Always quote ONLY the exact products, services, delivery policies, bank accounts, and prices given in the OFFICIAL MASTER DATASET above.
2. ${sess.isVoiceCall ? 'CONVERSATIONAL BREVITY FOR VOICE CALL: Keep answers to 1 to 2 natural spoken sentences (around 20-35 words maximum) since the customer is listening on a live phone call.' : 'ELEGANT WHATSAPP FORMATTING: Use clean WhatsApp formatting with *bold* headers, • bullets for packages/features, and clear line spacing. Do NOT use markdown # headings or **double asterisks**.'}
3. CONVERSATIONAL WARMTH: Speak warmly and respectfully like an authentic customer service agent with friendly emojis (😊, 🙏, ✨, 📦).
4. If order is confirmed, add this tag at the end:
   [[ORDER: name=${customerName}|item=ITEM_NAME|amount=TOTAL_RS]]
5. If the customer asks for photos, images, samples or pictures of any product listed under [PHOTO AVAILABLE], append this tag at the very end of your response:
   [[SEND_PHOTO: ProductName]]`;
}

function checkForOrderTag(text, sess, sessionId) {
  let cleanText = text || '';
  const match = cleanText.match(/\[\[(?:ORDER|CONFIRM_ORDER):\s*([^\]]+)\]\]/i);
  if (!match) return cleanText;

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
  const activeBiz = (sess && sess.businessId && (db.getBusiness(sess.businessId) || db.getAllBusinesses().find(b => b.id === sess.businessId))) || db.getActiveBusiness();
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
    const confirmMsg = `✅ *Order Confirmed!*\n\n🏪 *${activeBiz.name}*\n📦 *Item:* ${newOrder.item}\n💰 *Total:* Rs. ${parseFloat(newOrder.amount).toLocaleString()}\n👤 *Name:* ${newOrder.customerName}\n\n_Thank you! Your order has been recorded._ 🙏`;
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
            { text: "Accurately transcribe this WhatsApp voice note sent by a Sri Lankan customer in Sinhala (සිංහල), Singlish, or English. Return ONLY the transcribed text, nothing else. If there is speech in Sinhala, transcribe it in natural Sinhala script." },
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

// ─── Attach Handlers to WhatsApp Multi-Device Engine ────────────────────────
// ─── 🔔 Store Owner Instant WhatsApp Alert ─────────────────────────────────────
async function notifyOwnerOfNewOrder(order, biz) {
  try {
    const settings = db.getTenantSettings(biz.id) || db.getSettings();
    const ownerPhone = (settings.ownerAlertPhone || '').replace(/\D/g, '');
    if (!settings.isOwnerAlertEnabled || !ownerPhone || ownerPhone.length < 9) return;

    const alertMsg = `🚨 *NEW ORDER NOTIFICATION!*\n\n` +
      `🏪 *Store:* ${biz.name}\n` +
      `📦 *Item:* ${order.item}\n` +
      `💰 *Amount:* Rs. ${parseFloat(String(order.amount).replace(/[^0-9.]/g, '') || 0).toLocaleString()}\n` +
      `👤 *Customer:* ${order.customerName} (${order.customerPhone || 'N/A'})\n` +
      `📍 *Address:* ${order.address || 'Standard Delivery'}\n` +
      `💳 *Status:* ${order.status}\n` +
      `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
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
setInterval(async () => {
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
  voiceSynthesizeHandler: async (text, preferredVoice, customKey) => {
    return await synthesizeVoiceAudio(text, preferredVoice, customKey);
  }
});

server.listen(PORT, () => {
  console.log(`\n🎙️  OmniSix Live Call Server running on port ${PORT}`);
  console.log(`📡  Call URL: ${CALL_SERVER_URL}/call?s=SESSION_ID`);
  console.log(`💚  Health:  ${CALL_SERVER_URL}/health\n`);

  // Start WhatsApp Multi-Device Web Engine
  waEngine.start();

  // Keep-alive self-ping to prevent cloud container sleep (Render Free Tier 15-min idle sleep prevention)
  const defaultKeepAlive = 'https://omnisix-ai.onrender.com';
  const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || (CALL_SERVER_URL.startsWith('http') && !CALL_SERVER_URL.includes('localhost') ? CALL_SERVER_URL : defaultKeepAlive);
  if (keepAliveUrl.startsWith('https://')) {
    const httpsModule = require('https');
    setInterval(() => {
      httpsModule.get(`${keepAliveUrl}/health`, (res) => {
        // Drain response data so socket returns to agent pool
        res.resume();
      }).on('error', (err) => {
        // Suppress transient DNS / network errors
      });
    }, 5 * 60 * 1000); // Ping every 5 minutes (Render sleep threshold is 15 minutes)
    console.log(`⏱️ Keep-alive 24/7 self-ping configured for: ${keepAliveUrl}/health (5m interval)`);
  }
});
