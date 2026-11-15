// ─── Real WhatsApp Multi-Account Engine (Multi-Device Protocol) ──────────────
// Powered by @whiskeysockets/baileys — Supports Multiple Accounts Simultaneously
// Each account has independent QR scan, 8-digit Pairing Code, and Bot On/Off switch.

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const db = require('./db.js');

const AUTH_BASE = path.join(__dirname, 'data');
const DEFAULT_AUTH_DIR = path.join(AUTH_BASE, 'baileys_auth');
const MULTI_AUTH_DIR = path.join(AUTH_BASE, 'baileys_auth_multi');

if (!fs.existsSync(DEFAULT_AUTH_DIR)) {
  try { fs.mkdirSync(DEFAULT_AUTH_DIR, { recursive: true }); } catch (e) {}
}
if (!fs.existsSync(MULTI_AUTH_DIR)) {
  try { fs.mkdirSync(MULTI_AUTH_DIR, { recursive: true }); } catch (e) {}
}

// ─── Individual WhatsApp Account Session ─────────────────────────────────────
class WhatsAppAccountSession {
  constructor(id, label, authDir, manager) {
    this.id = id;
    this.label = label || `Account (${id})`;
    this.authDir = authDir;
    this.manager = manager;

    this.sock = null;
    this.state = null;
    this.saveCreds = null;
    this.qrDataUrl = null;
    this.rawQr = null;
    this.pairingCode = null;
    this.connected = false;
    this.phoneNumber = null;
    this.botActive = true;
    this.statusText = 'Initializing account session...';
    this.reconnectAttempts = 0;
    this.isStarting = false;
  }

  async start() {
    if (this.isStarting) return;
    this.isStarting = true;

    try {
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      console.log(`[whatsapp-acc:${this.id}] Initializing session in: ${this.authDir}`);
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      this.state = state;
      this.saveCreds = saveCreds;

      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: this.state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: false
      });

      this.sock.ev.on('creds.update', this.saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.rawQr = qr;
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: { dark: '#000000', light: '#ffffff' }
            });
            this.statusText = 'QR Code Ready — Please scan from WhatsApp > Linked Devices';
            console.log(`[whatsapp-acc:${this.id}] ✅ New genuine QR Code generated!`);
            this.syncDb();
          } catch (qrErr) {
            console.error(`[whatsapp-acc:${this.id}] QR generation error:`, qrErr.message);
          }
        }

        if (connection === 'close') {
          this.connected = false;
          this.qrDataUrl = null;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.warn(`[whatsapp-acc:${this.id}] Connection closed (${statusCode}). Reconnecting: ${shouldReconnect}`);

          this.statusText = shouldReconnect
            ? 'Reconnecting to WhatsApp...'
            : 'Logged out. Please scan new QR code.';

          this.syncDb();

          if (shouldReconnect) {
            const waitMs = Math.min(10000, 2000 * Math.pow(1.5, this.reconnectAttempts++));
            setTimeout(() => {
              this.isStarting = false;
              this.start();
            }, waitMs);
          } else {
            this.clearAuth();
            setTimeout(() => {
              this.isStarting = false;
              this.start();
            }, 3000);
          }
        } else if (connection === 'open') {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.qrDataUrl = null;
          this.rawQr = null;

          const userJid = this.sock.user?.id || '';
          this.phoneNumber = userJid.split(':')[0] || userJid.split('@')[0];
          this.statusText = `Connected as +${this.phoneNumber}`;

          console.log(`[whatsapp-acc:${this.id}] 🚀 Connected successfully as +${this.phoneNumber}!`);
          this.syncDb();
        }
      });

      // ─── Incoming Messages & Routing ─────────────────────────────────────────
      this.sock.ev.on('messages.upsert', async ({ messages }) => {
        if (!messages || messages.length === 0) return;

        for (const msg of messages) {
          try {
            if (msg.key.fromMe) continue;
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') continue;

            const text = msg.message?.conversation ||
                         msg.message?.extendedTextMessage?.text ||
                         msg.message?.imageMessage?.caption ||
                         '';

            if (!text || text.trim().length === 0) continue;

            const senderPhone = remoteJid.split('@')[0];
            const senderName = msg.pushName || 'Customer';
            const accountTag = this.phoneNumber ? `Line: +${this.phoneNumber}` : this.label;

            console.log(`[whatsapp-acc:${this.id}] 📩 Incoming from ${senderPhone} (${senderName}) on ${accountTag}: "${text}"`);

            // Store message in unified database with receiving account tag
            db.addChatMessage(senderPhone, 'customer', text.trim(), senderName, senderPhone);

            // Check if AI Bot is disabled for this specific account
            if (!this.botActive) {
              console.log(`[whatsapp-acc:${this.id}] ⏸️ Bot disabled on this line. Human manual mode active.`);
              continue;
            }

            // Check Human Takeover Mode
            const chat = db.getChat(senderPhone);
            if (chat && chat.aiMuted && Date.now() < (chat.aiMuteUntil || Infinity)) {
              console.log(`[whatsapp-acc:${this.id}] 🛑 Chat ${senderPhone} is Human-Takeover Muted. Skipping AI.`);
              continue;
            }

            // Generate AI reply using active business dataset
            const activeBiz = db.getActiveBusiness();
            let aiReply = '';

            if (this.manager.aiReplyHandler) {
              const tempSess = {
                storeName: activeBiz.name,
                customerName: senderName,
                customerPhone: senderPhone,
                dataset: activeBiz.dataset,
                isWhatsApp: true,
                isVoiceCall: false,
                history: (chat?.messages || []).slice(-6).map(m => ({
                  role: m.sender === 'customer' ? 'user' : 'model',
                  parts: [{ text: m.text }]
                }))
              };
              aiReply = await this.manager.aiReplyHandler(text.trim(), tempSess);
              if (this.manager.orderCheckHandler) {
                this.manager.orderCheckHandler(aiReply, tempSess, senderPhone);
              }
            } else {
              aiReply = `ස්තූතියි! ${activeBiz.name} වෙතින් සාදරයෙන් පිළිගන්නවා. ඔබට අවශ්‍ය ඕනෑම විස්තරයක් හෝ ඇණවුමක් ලබා දෙන්න.`;
            }

            if (aiReply) {
              await this.sock.sendPresenceUpdate('composing', remoteJid);
              await delay(1200);
              await this.sock.sendPresenceUpdate('paused', remoteJid);

              await this.sock.sendMessage(remoteJid, { text: aiReply });
              console.log(`[whatsapp-acc:${this.id}] 🤖 Replied to ${senderPhone}: "${aiReply}"`);

              db.addChatMessage(senderPhone, 'ai', aiReply, senderName, senderPhone);
            }
          } catch (msgErr) {
            console.error(`[whatsapp-acc:${this.id}] Message handling error:`, msgErr.message);
          }
        }
      });

    } catch (err) {
      console.error(`[whatsapp-acc:${this.id}] Failed to start session:`, err.message);
      this.statusText = 'Init error: ' + err.message;
    } finally {
      this.isStarting = false;
    }
  }

  // Request 8-Digit Pairing Code for this specific account
  async requestPhonePairingCode(phoneNumber) {
    if (!this.sock) throw new Error(`WhatsApp engine for account ${this.id} is not initialized.`);
    const cleanNumber = (phoneNumber || '').replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 9) {
      throw new Error('Valid phone number with country code is required (e.g. 94771234567)');
    }

    try {
      console.log(`[whatsapp-acc:${this.id}] Requesting pairing code for: ${cleanNumber}`);
      const code = await this.sock.requestPairingCode(cleanNumber);
      this.pairingCode = code;
      this.phoneNumber = cleanNumber;
      this.statusText = `Pairing Code: ${code} — Enter in WhatsApp > Linked Devices`;
      this.syncDb();
      return code;
    } catch (e) {
      console.error(`[whatsapp-acc:${this.id}] Failed to request pairing code:`, e.message);
      throw e;
    }
  }

  async sendTextMessage(toPhone, text) {
    if (!this.sock || !this.connected) {
      return { ok: false, error: `Account ${this.id} not connected` };
    }
    const clean = toPhone.replace(/\D/g, '');
    const jid = clean.includes('@s.whatsapp.net') ? clean : `${clean}@s.whatsapp.net`;

    try {
      await this.sock.sendMessage(jid, { text });
      console.log(`[whatsapp-acc:${this.id}] Sent text to ${clean}`);
      return { ok: true };
    } catch (e) {
      console.error(`[whatsapp-acc:${this.id}] Send failed to ${clean}:`, e.message);
      return { ok: false, error: e.message };
    }
  }

  async logout() {
    try {
      if (this.sock) await this.sock.logout();
    } catch (e) {}
    this.clearAuth();
    this.connected = false;
    this.qrDataUrl = null;
    this.rawQr = null;
    this.pairingCode = null;
    this.phoneNumber = null;
    this.statusText = 'Logged out. Ready to connect.';
    this.syncDb();
    setTimeout(() => {
      this.isStarting = false;
      this.start();
    }, 2000);
    return { ok: true };
  }

  clearAuth() {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
      }
    } catch (e) {}
  }

  syncDb() {
    db.saveWhatsAppAccount({
      id: this.id,
      label: this.label,
      phoneNumber: this.phoneNumber,
      connected: this.connected,
      botActive: this.botActive,
      statusText: this.statusText,
      qrDataUrl: this.qrDataUrl,
      pairingCode: this.pairingCode,
      hasQr: !!this.qrDataUrl,
      lastSeen: new Date().toISOString()
    });

    // Also update legacy single-account status if default
    if (this.id === 'default') {
      db.updateWhatsAppStatus({
        connected: this.connected,
        phoneNumber: this.phoneNumber,
        qrData: this.qrDataUrl,
        pairingCode: this.pairingCode,
        statusText: this.statusText,
        lastSeen: new Date().toISOString()
      });
    }
  }

  getStatus() {
    return {
      id: this.id,
      label: this.label,
      connected: this.connected,
      phoneNumber: this.phoneNumber,
      botActive: this.botActive,
      statusText: this.statusText,
      qrDataUrl: this.qrDataUrl,
      pairingCode: this.pairingCode,
      hasQr: !!this.qrDataUrl,
      lastSeen: new Date().toISOString()
    };
  }
}

// ─── Multi-Account WhatsApp Manager ──────────────────────────────────────────
class MultiAccountWhatsAppManager {
  constructor() {
    this.sessions = new Map();
    this.aiReplyHandler = null;
    this.orderCheckHandler = null;
  }

  setHandlers({ aiReplyHandler, orderCheckHandler }) {
    this.aiReplyHandler = aiReplyHandler;
    this.orderCheckHandler = orderCheckHandler;
  }

  async start() {
    console.log('[whatsapp-manager] Starting Multi-Account WhatsApp Engine...');

    // 1. Primary Account (default) — Uses DEFAULT_AUTH_DIR so existing 94724558042 session remains active!
    if (!this.sessions.has('default')) {
      const primarySession = new WhatsAppAccountSession('default', 'Primary Account (+94 72 455 8042)', DEFAULT_AUTH_DIR, this);
      this.sessions.set('default', primarySession);
      await primarySession.start();
    }

    // 2. Load any extra registered accounts from DB
    const savedAccounts = db.getWhatsAppAccounts();
    for (const acc of savedAccounts) {
      if (acc.id !== 'default' && !this.sessions.has(acc.id)) {
        const accDir = path.join(MULTI_AUTH_DIR, acc.id);
        const session = new WhatsAppAccountSession(acc.id, acc.label, accDir, this);
        session.botActive = acc.botActive !== false;
        this.sessions.set(acc.id, session);
        session.start();
      }
    }
  }

  async addAccount(label) {
    const id = 'acc_' + Date.now();
    const accDir = path.join(MULTI_AUTH_DIR, id);
    if (!fs.existsSync(accDir)) fs.mkdirSync(accDir, { recursive: true });

    const session = new WhatsAppAccountSession(id, label || `WhatsApp Account ${this.sessions.size + 1}`, accDir, this);
    this.sessions.set(id, session);

    db.saveWhatsAppAccount({
      id: id,
      label: session.label,
      phoneNumber: null,
      connected: false,
      botActive: true,
      businessId: db.getActiveBusiness().id,
      createdAt: new Date().toISOString()
    });

    await session.start();
    return session;
  }

  getAccounts() {
    const list = [];
    for (const [, session] of this.sessions.entries()) {
      list.push(session.getStatus());
    }
    return list;
  }

  getSession(id) {
    if (!id || id === 'default') return this.sessions.get('default');
    return this.sessions.get(id) || this.sessions.get('default');
  }

  // Request pairing code for specific account
  async requestPhonePairingCode(phoneNumber, accountId = 'default') {
    const session = this.getSession(accountId);
    if (!session) throw new Error(`WhatsApp account "${accountId}" not found`);
    return await session.requestPhonePairingCode(phoneNumber);
  }

  // Send text message (with optional accountId target or round-robin)
  async sendTextMessage(toPhone, text, accountId) {
    let session = accountId ? this.sessions.get(accountId) : null;
    if (!session) {
      // Find any connected session
      for (const [, s] of this.sessions.entries()) {
        if (s.connected) {
          session = s;
          break;
        }
      }
    }
    if (!session || !session.connected) {
      return { ok: false, error: 'No connected WhatsApp account available' };
    }
    return await session.sendTextMessage(toPhone, text);
  }

  async toggleBot(accountId, botActive) {
    const session = this.sessions.get(accountId);
    if (session) {
      session.botActive = !!botActive;
      session.syncDb();
      return { ok: true, accountId, botActive: session.botActive };
    }
    return { ok: false, error: 'Account not found' };
  }

  async logout(accountId = 'default') {
    const session = this.sessions.get(accountId);
    if (session) {
      return await session.logout();
    }
    return { ok: false, error: 'Account not found' };
  }

  async deleteAccount(accountId) {
    if (accountId === 'default') {
      return { ok: false, error: 'Cannot delete primary default account. Use Logout instead.' };
    }
    const session = this.sessions.get(accountId);
    if (session) {
      try { await session.logout(); } catch (e) {}
      session.clearAuth();
      this.sessions.delete(accountId);
      db.deleteWhatsAppAccount(accountId);
      return { ok: true, deleted: accountId };
    }
    return { ok: false, error: 'Account not found' };
  }

  // Backwards compatibility properties
  get connected() {
    const primary = this.getSession('default');
    return primary ? primary.connected : false;
  }

  getStatus() {
    const primary = this.getSession('default');
    const base = primary ? primary.getStatus() : {
      connected: false,
      phoneNumber: null,
      statusText: 'No primary session',
      qrDataUrl: null,
      pairingCode: null,
      hasQr: false
    };
    return {
      ...base,
      totalAccounts: this.sessions.size,
      accounts: this.getAccounts()
    };
  }
}

const waManager = new MultiAccountWhatsAppManager();
module.exports = waManager;
