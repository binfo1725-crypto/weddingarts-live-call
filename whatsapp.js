// ─── Real WhatsApp Multi-Device (WhatsApp Web) Engine ────────────────────────
// Powered by @whiskeysockets/baileys — Genuine Multi-Device Protocol
// Supports Live QR Code Scan, 8-Digit Phone Pairing Code, Auto-Reply & Live Sync

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

const AUTH_DIR = path.join(__dirname, 'data', 'baileys_auth');
if (!fs.existsSync(AUTH_DIR)) {
  try { fs.mkdirSync(AUTH_DIR, { recursive: true }); } catch (e) {}
}

class WhatsAppEngine {
  constructor() {
    this.sock = null;
    this.state = null;
    this.saveCreds = null;
    this.qrDataUrl = null;
    this.rawQr = null;
    this.pairingCode = null;
    this.connected = false;
    this.phoneNumber = null;
    this.statusText = 'Initializing WhatsApp Multi-Device...';
    this.reconnectAttempts = 0;
    this.aiReplyHandler = null; // Injected from server.js
    this.orderCheckHandler = null; // Injected from server.js
  }

  setHandlers({ aiReplyHandler, orderCheckHandler }) {
    this.aiReplyHandler = aiReplyHandler;
    this.orderCheckHandler = orderCheckHandler;
  }

  async start() {
    try {
      console.log('[whatsapp-md] Initializing Multi-Device Auth in:', AUTH_DIR);
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      this.state = state;
      this.saveCreds = saveCreds;

      const { version } = await fetchLatestBaileysVersion();
      console.log(`[whatsapp-md] Using WhatsApp Web version: v${version.join('.')}`);

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
            console.log('[whatsapp-md] ✅ New genuine WhatsApp Web QR Code generated!');
            db.updateWhatsAppStatus({
              connected: false,
              qrData: this.qrDataUrl,
              lastSeen: new Date().toISOString()
            });
          } catch (qrErr) {
            console.error('[whatsapp-md] Failed to convert QR to Data URL:', qrErr.message);
          }
        }

        if (connection === 'close') {
          this.connected = false;
          this.qrDataUrl = null;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.warn(`[whatsapp-md] Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);

          this.statusText = shouldReconnect
            ? 'Reconnecting to WhatsApp...'
            : 'Logged out. Please scan new QR code.';

          db.updateWhatsAppStatus({
            connected: false,
            lastSeen: new Date().toISOString()
          });

          if (shouldReconnect) {
            const waitMs = Math.min(10000, 2000 * Math.pow(1.5, this.reconnectAttempts++));
            setTimeout(() => this.start(), waitMs);
          } else {
            this.clearAuth();
            setTimeout(() => this.start(), 3000);
          }
        } else if (connection === 'open') {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.qrDataUrl = null;
          this.rawQr = null;

          const userJid = this.sock.user?.id || '';
          this.phoneNumber = userJid.split(':')[0] || userJid.split('@')[0];
          this.statusText = `Connected as ${this.phoneNumber}`;

          console.log(`[whatsapp-md] 🚀 Connected successfully as ${this.phoneNumber} (OmniSix Multi-Device)!`);

          db.updateWhatsAppStatus({
            connected: true,
            phoneNumber: this.phoneNumber,
            pairedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            qrData: null
          });
        }
      });

      // ─── Incoming Messages & Full AI Auto-Reply ────────────────────────────
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
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
            console.log(`[whatsapp-md] 📩 Incoming from ${senderPhone} (${senderName}): "${text}"`);

            // Store customer message in database
            db.addChatMessage(senderPhone, 'customer', text.trim(), senderName, senderPhone);

            // Check Human Takeover Mode
            const chat = db.getChat(senderPhone);
            if (chat && chat.aiMuted && Date.now() < (chat.aiMuteUntil || Infinity)) {
              console.log(`[whatsapp-md] 🛑 Chat ${senderPhone} is Human-Takeover Muted. Skipping AI auto-reply.`);
              continue;
            }

            // Generate AI reply using active business dataset
            const activeBiz = db.getActiveBusiness();
            let aiReply = '';

            if (this.aiReplyHandler) {
              const tempSess = {
                storeName: activeBiz.name,
                customerName: senderName,
                customerPhone: senderPhone,
                dataset: activeBiz.dataset,
                history: (chat?.messages || []).slice(-6).map(m => ({
                  role: m.sender === 'customer' ? 'user' : 'model',
                  parts: [{ text: m.text }]
                }))
              };
              aiReply = await this.aiReplyHandler(text.trim(), tempSess);
              if (this.orderCheckHandler) {
                this.orderCheckHandler(aiReply, tempSess, senderPhone);
              }
            } else {
              aiReply = `ස්තූතියි! ${activeBiz.name} වෙතින් සාදරයෙන් පිළිගන්නවා. ඔබට අවශ්‍ය ඕනෑම විස්තරයක් හෝ ඇණවුමක් ලබා දෙන්න.`;
            }

            if (aiReply) {
              // Show realistic typing indicator
              await this.sock.sendPresenceUpdate('composing', remoteJid);
              await delay(1200);
              await this.sock.sendPresenceUpdate('paused', remoteJid);

              // Send reply via Baileys Multi-Device
              await this.sock.sendMessage(remoteJid, { text: aiReply });
              console.log(`[whatsapp-md] 🤖 Sent AI Reply to ${senderPhone}: "${aiReply}"`);

              // Save AI response to DB
              db.addChatMessage(senderPhone, 'ai', aiReply, senderName, senderPhone);
            }
          } catch (msgErr) {
            console.error('[whatsapp-md] Error handling message:', msgErr.message);
          }
        }
      });

    } catch (err) {
      console.error('[whatsapp-md] Failed to start Baileys socket:', err.message);
      this.statusText = 'Initialization error: ' + err.message;
    }
  }

  // Request 8-Digit Pairing Code (Alternative to QR Code Scan)
  async requestPhonePairingCode(phoneNumber) {
    if (!this.sock) throw new Error('WhatsApp engine is not running');
    const cleanNumber = (phoneNumber || '').replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 9) {
      throw new Error('Valid phone number with country code is required (e.g. 94762107801)');
    }

    try {
      console.log(`[whatsapp-md] Requesting pairing code for: ${cleanNumber}`);
      const code = await this.sock.requestPairingCode(cleanNumber);
      this.pairingCode = code;
      this.phoneNumber = cleanNumber;
      this.statusText = `Pairing Code: ${code} — Enter in WhatsApp > Linked Devices > Link with phone number instead`;
      db.updateWhatsAppStatus({
        pairingCode: code,
        phoneNumber: cleanNumber,
        lastSeen: new Date().toISOString()
      });
      return code;
    } catch (e) {
      console.error('[whatsapp-md] Failed to request pairing code:', e.message);
      throw e;
    }
  }

  // Send Text Message (Agent reply or Broadcast)
  async sendTextMessage(toPhone, text) {
    if (!this.sock || !this.connected) {
      console.warn('[whatsapp-md] Cannot send message: WhatsApp is not connected');
      return { ok: false, error: 'WhatsApp not connected' };
    }

    const clean = toPhone.replace(/\D/g, '');
    const jid = clean.includes('@s.whatsapp.net') ? clean : `${clean}@s.whatsapp.net`;

    try {
      await this.sock.sendMessage(jid, { text: text });
      console.log(`[whatsapp-md] Message sent to ${clean}`);
      return { ok: true };
    } catch (e) {
      console.error(`[whatsapp-md] Failed to send message to ${clean}:`, e.message);
      return { ok: false, error: e.message };
    }
  }

  // Status for Admin Dashboard
  getStatus() {
    return {
      connected: this.connected,
      phoneNumber: this.phoneNumber || (this.connected ? 'Active Multi-Device' : null),
      statusText: this.statusText,
      qrDataUrl: this.qrDataUrl,
      pairingCode: this.pairingCode,
      hasQr: !!this.qrDataUrl,
      lastSeen: new Date().toISOString()
    };
  }

  // Clear Session & Logout
  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (e) {}
    this.clearAuth();
    this.connected = false;
    this.qrDataUrl = null;
    this.rawQr = null;
    this.pairingCode = null;
    this.statusText = 'Logged out. Starting fresh session...';
    setTimeout(() => this.start(), 2000);
    return { ok: true };
  }

  clearAuth() {
    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }
    } catch (e) {}
  }
}

const waEngine = new WhatsAppEngine();
module.exports = waEngine;
