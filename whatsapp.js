// ─── Real WhatsApp Multi-Account Engine (Multi-Device Protocol) ──────────────
// Powered by @whiskeysockets/baileys — Supports Multiple Accounts Simultaneously
// Each account has independent QR scan, 8-digit Pairing Code, and Bot On/Off switch.

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay,
  Browsers,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const db = require('./db.js');
const { LanguageDetectionEngine } = require('./ai_engines.js');

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
  constructor(id, label, authDir, manager, businessId = null) {
    this.id = id;
    this.label = label || `Account (${id})`;
    this.authDir = authDir;
    this.manager = manager;
    this.businessId = businessId;

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
          if (this.isDestroyed) return;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isReplaced = statusCode === DisconnectReason.connectionReplaced;
          const shouldReconnect = !isLoggedOut && !isReplaced;
          console.warn(`[whatsapp-acc:${this.id}] Connection closed (${statusCode}). Reconnecting: ${shouldReconnect}`);

          if (isReplaced) {
            this.statusText = 'Session replaced by another device. Scan QR to reconnect.';
            this.syncDb();
            return;
          }

          this.statusText = shouldReconnect
            ? 'Reconnecting to WhatsApp...'
            : 'Logged out. Please scan new QR code.';

          this.syncDb();

          if (shouldReconnect) {
            const waitMs = Math.min(10000, 2000 * Math.pow(1.5, this.reconnectAttempts++));
            setTimeout(() => {
              if (this.isDestroyed) return;
              this.isStarting = false;
              this.start();
            }, waitMs);
          } else {
            this.clearAuth();
            setTimeout(() => {
              if (this.isDestroyed) return;
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

            const audioMsg = msg.message?.audioMessage;
            const isVoiceNote = !!audioMsg;

            let text = msg.message?.conversation ||
                         msg.message?.extendedTextMessage?.text ||
                         msg.message?.imageMessage?.caption ||
                         msg.message?.buttonsResponseMessage?.selectedButtonId ||
                         msg.message?.buttonsResponseMessage?.selectedDisplayText ||
                         msg.message?.templateButtonReplyMessage?.selectedId ||
                         msg.message?.templateButtonReplyMessage?.selectedDisplayText ||
                         msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                         msg.message?.listResponseMessage?.title ||
                         msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
                         '';

            // Download and transcribe audio if voice note received
            if (isVoiceNote) {
              console.log(`[whatsapp-acc:${this.id}] 🎙️ Received WhatsApp Voice Note (${audioMsg.seconds || 0}s) from ${remoteJid}`);
              try {
                const buffer = await downloadMediaMessage(
                  msg,
                  'buffer',
                  {},
                  { logger: pino({ level: 'silent' }), reuploadRequest: this.sock.updateMediaMessage }
                );
                if (buffer && this.manager.audioTranscribeHandler) {
                  const transcribed = await this.manager.audioTranscribeHandler(buffer, audioMsg.mimetype || 'audio/ogg; codecs=opus');
                  if (transcribed && transcribed.trim().length > 0) {
                    text = transcribed.trim();
                    console.log(`[whatsapp-acc:${this.id}] 📝 Transcribed Voice Note: "${text}"`);
                  }
                }
              } catch (audioErr) {
                console.error(`[whatsapp-acc:${this.id}] Voice note transcribe error:`, audioErr.message);
              }

              if (!text || text.trim().length === 0) {
                text = 'හෙලෝ (Customer Voice Message)';
              }
            }

            if (!text || text.trim().length === 0) continue;

            const senderPhone = remoteJid.split('@')[0];
            const senderName = msg.pushName || 'Customer';
            const accountTag = this.phoneNumber ? `Line: +${this.phoneNumber}` : this.label;

            console.log(`[whatsapp-acc:${this.id}] 📩 Incoming from ${senderPhone} (${senderName}) [${isVoiceNote ? 'Voice Note' : 'Text'}]: "${text}"`);

            // Resolve store / business scoped to this specific WhatsApp account
            const activeBiz = (this.businessId && (db.getBusiness(this.businessId) || db.getAllBusinesses().find(b => b.id === this.businessId))) || db.getActiveBusiness();
            const settings = (this.businessId && db.getTenantSettings(this.businessId)) || db.getSettings();

            // Store message in unified database with receiving account tag & businessId
            const storedText = isVoiceNote ? `🎤 ${text.trim()}` : text.trim();
            db.addChatMessage(senderPhone, 'customer', storedText, senderName, senderPhone, activeBiz.id);

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

            let aiReply = '';
            let isQuickActionHandled = false;
            const cleanText = text.trim();
            const lowerText = cleanText.toLowerCase();

            // 🔘 Fast-Track Interactive Quick Actions (Buttons & Number Replies)
            if (cleanText === '1' || lowerText === 'action_catalog' || lowerText === 'catalog' || lowerText === 'menu' || lowerText === 'භාණ්ඩ' || lowerText === 'මිල ගණන්') {
              const storeProds = db.getProducts(activeBiz.id) || [];
              if (storeProds.length > 0) {
                let catMsg = `📦 *${activeBiz.name} — Products & Pricing Catalog:*\n\n`;
                storeProds.slice(0, 8).forEach((p, idx) => {
                  catMsg += `${idx + 1}. *${p.name}* — Rs. ${(p.price || 0).toLocaleString()}\n`;
                  if (p.description) catMsg += `   _${p.description}_\n`;
                });
                catMsg += `\n🚚 *Delivery:* ${activeBiz.deliveryPolicy || 'දිවයින පුරා බෙදාහැරීම දින 2-3ක් ඇතුළත'}\n`;
                catMsg += `\n💬 *ඕනෑම භාණ්ඩයක Photo එකක් බැලීමට* භාණ්ඩයේ නම එවන්න (උදා: "Photo")\n🛒 *ඇණවුම් කිරීමට* "2" හෝ "Order" ලෙස එවන්න!`;
                aiReply = catMsg;
                isQuickActionHandled = true;
              }
            } else if (cleanText === '2' || lowerText === 'action_order' || lowerText === 'order' || lowerText === 'order now' || lowerText === 'ඇණවුම්' || lowerText === 'buy') {
              aiReply = `🛒 *${activeBiz.name} — Fast Order Placement:*\n\nඔබගේ ඇණවුම අදම තහවුරු කිරීමට කරුණාකර පහත විස්තර 4 එවන්න:\n\n1️⃣ *ඔබගේ නම (Full Name):*\n2️⃣ *අවශ්‍ය භාණ්ඩය සහ ප්‍රමාණය (Item & Qty):*\n3️⃣ *ලැබිය යුතු ලිපිනය (Delivery Address):*\n4️⃣ *දුරකථන අංක 1 හෝ 2ක් (Phone Numbers):*\n\n🏦 *බැංකු ගිණුම් විස්තර:*\n${activeBiz.bankDetails || 'ගිණුම් විස්තර සඳහා විමසන්න'}\n\n_ස්ලිප් පතක් හෝ Cash on Delivery (COD) මගින් ලබාගත හැක. විස්තර ලැබුණු සැණින් අපගේ Dispatch කණ්ඩායම පැකේජය සූදානම් කරනු ඇත!_ 🚚✨`;
              isQuickActionHandled = true;
            } else if (cleanText === '3' || lowerText === 'action_agent' || lowerText === 'agent' || lowerText === 'human' || lowerText === 'talk to agent' || lowerText === 'මිනිසෙකු') {
              aiReply = `👤 *Human Agent Connection:*\n\nඅපගේ පාරිභෝගික සේවා නිලධාරියෙකු (Human Support Agent) සුළු මොහොතකින් ඔබ හා සෘජුව සම්බන්ධ වනු ඇත. කරුණාකර රැඳී සිටින්න. 🙏`;
              db.setChatAiMute(senderPhone, true, 30);
              if (settings.isOwnerAlertEnabled && settings.ownerAlertPhone) {
                const alertText = `🚨 *Human Agent Requested!*\n\nCustomer: *${senderName}* (+${senderPhone})\nStore: *${activeBiz.name}*\nStatus: AI Muted for 30m. Please take over this chat now.`;
                this.manager.sendTextMessage(settings.ownerAlertPhone, alertText, this.id).catch(() => {});
              }
              isQuickActionHandled = true;
            }

            if (!isQuickActionHandled) {
              if (this.manager.aiReplyHandler) {
                const tempSess = {
                  storeName: activeBiz.name,
                  businessId: activeBiz.id,
                  business: activeBiz,
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
            }

            // Check if any store product photo should be sent (via tag or photo inquiry match)
            const storeProducts = db.getProducts(activeBiz.id);
            const prodsWithImage = (storeProducts || []).filter(p => !!(p.imageUrl && p.imageUrl.length > 20));

            let matchedProductToSend = null;
            if (prodsWithImage.length > 0) {
              // 1. Tag match from Gemini: [[SEND_PHOTO: ProductName]] or [[SEND_PRODUCT_IMAGE: ID]]
              const photoTagMatch = aiReply.match(/\[\[(?:SEND_PHOTO|SEND_PRODUCT_IMAGE):\s*([^\]]+)\]\]/i);
              if (photoTagMatch) {
                const targetNameOrId = photoTagMatch[1].trim().toLowerCase();
                matchedProductToSend = prodsWithImage.find(p =>
                  (p.id && p.id.toLowerCase() === targetNameOrId) ||
                  (p.name && p.name.toLowerCase().includes(targetNameOrId)) ||
                  targetNameOrId.includes((p.name || '').toLowerCase())
                );
                aiReply = aiReply.replace(photoTagMatch[0], '').trim();
              }

              // 2. Keyword / Photo Inquiry Match
              if (!matchedProductToSend) {
                const isPhotoReq = /photo|image|picture|pic|ෆොටෝ|පින්තූර|පින්තුර|බලන්න|sample|දක්වන්න/i.test(text);
                const textLower = text.toLowerCase();
                const replyLower = aiReply.toLowerCase();
                for (const prod of prodsWithImage) {
                  const pNameLower = (prod.name || '').toLowerCase();
                  if (!pNameLower || pNameLower.length < 3) continue;
                  if (textLower.includes(pNameLower) || (isPhotoReq && replyLower.includes(pNameLower))) {
                    matchedProductToSend = prod;
                    break;
                  }
                }
              }
            }

            // If a product with photo was requested or matched, send the genuine photo first!
            if (matchedProductToSend && matchedProductToSend.imageUrl) {
              const photoCaption = `📸 *${matchedProductToSend.name}*\n💰 මිල: Rs. ${(matchedProductToSend.price || 0).toLocaleString()}\n${matchedProductToSend.description ? matchedProductToSend.description + '\n' : ''}📦 ඇණවුම් කිරීමට ඔබගේ නම සහ ලිපිනය එවන්න.`;
              await this.sendImageMessage(senderPhone, matchedProductToSend.imageUrl, photoCaption);
              db.addChatMessage(senderPhone, 'ai', `📷 [Product Photo: ${matchedProductToSend.name}]`, senderName, senderPhone, activeBiz.id);
              await delay(800);
            }

            if (aiReply) {
              const detectedL = LanguageDetectionEngine.detectLanguage(text, chat?.messages || []);
              const langMode = settings.languageReplyMode || 'smart_match';
              let effectiveLang = detectedL;
              if (langMode === 'english_only') effectiveLang = 'English';
              else if (langMode === 'sinhala_script_only') effectiveLang = 'Sinhala';
              else if (langMode === 'tamil_only') effectiveLang = 'Tamil';
              else if (langMode === 'singlish_only') effectiveLang = 'Singlish';

              // 🔘 Interactive Quick Action Buttons & Menus (Feature 8)
              if (settings.isInteractiveButtonsEnabled !== false && !isQuickActionHandled) {
                let quickMenu = '';
                if (effectiveLang === 'English') {
                  quickMenu = '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Quick Actions (Reply Number):*\n1️⃣ *View Full Catalog & Prices*\n2️⃣ *Confirm Order & Delivery*\n3️⃣ *Connect with Human Agent*';
                } else if (effectiveLang === 'Tamil' || effectiveLang === 'Tanglish') {
                  quickMenu = '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *விரைவு தேர்வுகள் (எண்ணை அனுப்பவும்):*\n1️⃣ *தயாரிப்பு பட்டியல் & விலை*\n2️⃣ *ஆர்டரை உறுதிப்படுத்தவும்*\n3️⃣ *மனித சேவையாளருடன் பேசவும்*';
                } else if (effectiveLang === 'Singlish') {
                  quickMenu = '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Quick Actions (Number eka reply karanna):*\n1️⃣ *Catalog & Price List balanna*\n2️⃣ *Order eka Confirm karanna*\n3️⃣ *Agent kenek ekka katha karanna*';
                } else {
                  quickMenu = '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *ක්ෂණික ක්‍රියාකාරකම් (අංකය එවන්න):*\n1️⃣ *භාණ්ඩ නාමාවලිය සහ මිල ගණන්*\n2️⃣ *ඇණවුම තහවුරු කිරීම (Order Now)*\n3️⃣ *පාරිභෝගික සේවා නිලධාරියෙකු ඇමතීම*';
                }
                if (!aiReply.includes('1️⃣') && !aiReply.includes('Quick Actions') && !aiReply.includes('ක්‍රියාකාරකම්')) {
                  aiReply += quickMenu;
                }
              }

              const planId = (activeBiz && activeBiz.subscriptionPlan) || 'enterprise';
              const activePlanObj = (db.SUBSCRIPTION_PLANS && db.SUBSCRIPTION_PLANS[planId]) || db.SUBSCRIPTION_PLANS?.enterprise;
              const isVoiceAllowedByPlan = !activePlanObj || (activePlanObj.limits && activePlanObj.limits.voiceNotes !== false);

              const voiceMode = settings.voiceReplyMode || 'auto';
              const shouldReplyVoice = isVoiceAllowedByPlan && (
                                       (voiceMode === 'always') ||
                                       (voiceMode === 'both') ||
                                       (voiceMode === 'auto' && isVoiceNote));

              let voiceAudioBase64 = null;
              if (shouldReplyVoice && this.manager.voiceSynthesizeHandler) {
                try {
                  const preferredVoice = settings.voiceProfile || activeBiz.voice || 'Leda';
                  const customKey = settings.geminiApiKey || activeBiz.geminiApiKey;
                  const voiceRes = await this.manager.voiceSynthesizeHandler(aiReply, preferredVoice, customKey);
                  if (voiceRes && voiceRes.audioBase64) {
                    voiceAudioBase64 = voiceRes.audioBase64;
                  }
                } catch (ttsErr) {
                  console.warn(`[whatsapp-acc:${this.id}] Voice synthesis error:`, ttsErr.message);
                }
              }

              if (voiceAudioBase64) {
                await this.sock.sendPresenceUpdate('recording', remoteJid);
                await delay(1200);
                await this.sock.sendPresenceUpdate('paused', remoteJid);

                const voiceBuf = Buffer.from(voiceAudioBase64, 'base64');
                await this.sock.sendMessage(remoteJid, {
                  audio: voiceBuf,
                  mimetype: 'audio/mp4',
                  ptt: true
                });
                console.log(`[whatsapp-acc:${this.id}] 🎙️ Sent Gemini Voice Note to ${senderPhone}!`);

                if (voiceMode === 'both' || !isVoiceNote) {
                  await delay(800);
                  await this.sendInteractiveMessage(remoteJid, aiReply, effectiveLang);
                }

                db.addChatMessage(senderPhone, 'ai', `🎙️ ${aiReply}`, senderName, senderPhone, activeBiz.id);
              } else {
                await this.sock.sendPresenceUpdate('composing', remoteJid);
                await delay(1200);
                await this.sock.sendPresenceUpdate('paused', remoteJid);

                await this.sendInteractiveMessage(remoteJid, aiReply, effectiveLang);
                console.log(`[whatsapp-acc:${this.id}] 🤖 Replied [${detectedL}] to ${senderPhone}: "${aiReply.slice(0, 50)}..."`);

                db.addChatMessage(senderPhone, 'ai', aiReply, senderName, senderPhone, activeBiz.id);
              }
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

  async sendInteractiveMessage(remoteJid, text, detectedLang = 'Sinhala') {
    if (!this.sock || !this.connected) return { ok: false, error: 'Not connected' };
    const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid.replace(/\D/g, '')}@s.whatsapp.net`;

    try {
      const btn1 = detectedLang === 'English' ? '📦 View Catalog' : (detectedLang === 'Singlish' ? '📦 Catalog' : (detectedLang === 'Tamil' ? '📦 பட்டியல்' : '📦 භාණ්ඩ ලැයිස්තුව'));
      const btn2 = detectedLang === 'English' ? '🛒 Order Now' : (detectedLang === 'Singlish' ? '🛒 Order Now' : (detectedLang === 'Tamil' ? '🛒 ஆர்டர்' : '🛒 ඇණවුම් කරන්න'));
      const btn3 = detectedLang === 'English' ? '👤 Human Agent' : (detectedLang === 'Singlish' ? '👤 Agent' : (detectedLang === 'Tamil' ? '👤 வாடிக்கையாளர் சேவை' : '👤 සේවා නිලධාරී'));

      const buttons = [
        { buttonId: 'ACTION_CATALOG', buttonText: { displayText: btn1 }, type: 1 },
        { buttonId: 'ACTION_ORDER', buttonText: { displayText: btn2 }, type: 1 },
        { buttonId: 'ACTION_AGENT', buttonText: { displayText: btn3 }, type: 1 }
      ];

      await this.sock.sendMessage(jid, {
        text,
        footer: 'OmniSix AI Cloud 24/7',
        buttons,
        headerType: 1
      });
      return { ok: true };
    } catch (e) {
      // Clean fallback directly to text message
      await this.sock.sendMessage(jid, { text });
      return { ok: true };
    }
  }

  async sendTextMessage(toPhone, text) {
    if (!this.sock || !this.connected) {
      return { ok: false, error: `Account ${this.id} not connected` };
    }
    let clean = String(toPhone || '').replace(/\D/g, '');
    if (clean.startsWith('0') && clean.length === 10) {
      clean = '94' + clean.slice(1);
    } else if (clean.length === 9 && !clean.startsWith('94')) {
      clean = '94' + clean;
    }
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

  async sendVoiceMessage(toPhone, audioBuffer, ptt = true) {
    if (!this.sock || !this.connected) {
      return { ok: false, error: `Account ${this.id} not connected` };
    }
    let clean = String(toPhone || '').replace(/\D/g, '');
    if (clean.startsWith('0') && clean.length === 10) {
      clean = '94' + clean.slice(1);
    } else if (clean.length === 9 && !clean.startsWith('94')) {
      clean = '94' + clean;
    }
    const jid = clean.includes('@s.whatsapp.net') ? clean : `${clean}@s.whatsapp.net`;

    try {
      await this.sock.sendPresenceUpdate('recording', jid);
      await delay(1200);
      await this.sock.sendPresenceUpdate('paused', jid);

      const buf = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer, 'base64');
      await this.sock.sendMessage(jid, {
        audio: buf,
        mimetype: 'audio/mp4',
        ptt: !!ptt
      });
      console.log(`[whatsapp-acc:${this.id}] Sent voice message to ${clean}`);
      return { ok: true };
    } catch (e) {
      console.error(`[whatsapp-acc:${this.id}] Send voice failed to ${clean}:`, e.message);
      return { ok: false, error: e.message };
    }
  }

  async sendImageMessage(toPhone, imageInput, caption = '') {
    if (!this.sock || !this.connected) {
      return { ok: false, error: `Account ${this.id} not connected` };
    }
    let clean = String(toPhone || '').replace(/\D/g, '');
    if (clean.startsWith('0') && clean.length === 10) {
      clean = '94' + clean.slice(1);
    } else if (clean.length === 9 && !clean.startsWith('94')) {
      clean = '94' + clean;
    }
    const jid = clean.includes('@s.whatsapp.net') ? clean : `${clean}@s.whatsapp.net`;

    try {
      let imageBuffer;
      if (Buffer.isBuffer(imageInput)) {
        imageBuffer = imageInput;
      } else if (typeof imageInput === 'string') {
        if (imageInput.startsWith('data:')) {
          const parts = imageInput.split(',');
          imageBuffer = Buffer.from(parts[1], 'base64');
        } else if (imageInput.startsWith('http')) {
          imageBuffer = { url: imageInput };
        } else {
          imageBuffer = Buffer.from(imageInput, 'base64');
        }
      }

      await this.sock.sendPresenceUpdate('composing', jid);
      await delay(800);
      await this.sock.sendMessage(jid, {
        image: imageBuffer,
        caption: caption || ''
      });
      console.log(`[whatsapp-acc:${this.id}] 📷 Sent product image to ${clean} with caption: "${(caption || '').slice(0, 40)}"`);
      return { ok: true };
    } catch (e) {
      console.error(`[whatsapp-acc:${this.id}] Send image failed to ${clean}:`, e.message);
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
    if (!this.isDestroyed) {
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.isStarting = false;
          this.start();
        }
      }, 2000);
    }
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
      businessId: this.businessId,
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
      businessId: this.businessId,
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
    this.audioTranscribeHandler = null;
    this.voiceSynthesizeHandler = null;
  }

  setHandlers({ aiReplyHandler, orderCheckHandler, audioTranscribeHandler, voiceSynthesizeHandler }) {
    this.aiReplyHandler = aiReplyHandler;
    this.orderCheckHandler = orderCheckHandler;
    this.audioTranscribeHandler = audioTranscribeHandler;
    this.voiceSynthesizeHandler = voiceSynthesizeHandler;
  }

  async start() {
    console.log('[whatsapp-manager] Starting Multi-Account WhatsApp Engine...');

    // 1. Primary Account (default) — Super Admin line
    if (!this.sessions.has('default')) {
      const primaryBiz = db.getActiveBusiness();
      const primarySession = new WhatsAppAccountSession('default', 'Primary Business Line', DEFAULT_AUTH_DIR, this, primaryBiz.id);
      this.sessions.set('default', primarySession);
      await primarySession.start();
    }

    // 2. Load any extra registered accounts from DB
    const savedAccounts = db.getWhatsAppAccounts();
    for (const acc of savedAccounts) {
      if (acc.id !== 'default' && !this.sessions.has(acc.id)) {
        const accDir = path.join(MULTI_AUTH_DIR, acc.id);
        const session = new WhatsAppAccountSession(acc.id, acc.label, accDir, this, acc.businessId);
        session.phoneNumber = acc.phoneNumber || null;
        session.botActive = acc.botActive !== false;
        this.sessions.set(acc.id, session);
        session.start();
      }
    }
  }

  async addAccount(label, businessId = null, customId = null) {
    const id = customId || ('acc_' + Date.now());
    const accDir = path.join(MULTI_AUTH_DIR, id);
    if (!fs.existsSync(accDir)) fs.mkdirSync(accDir, { recursive: true });

    const bizId = businessId || db.getActiveBusiness().id;
    const session = new WhatsAppAccountSession(id, label || `WhatsApp Account`, accDir, this, bizId);
    this.sessions.set(id, session);

    db.saveWhatsAppAccount({
      id: id,
      label: session.label,
      phoneNumber: null,
      connected: false,
      botActive: true,
      businessId: bizId,
      createdAt: new Date().toISOString()
    });

    await session.start();
    return session;
  }

  // Ensure SaaS Tenant has their own isolated WhatsApp session
  async getOrCreateTenantAccount(businessId, businessName) {
    if (!businessId) return this.getSession('default');
    const tenantAccId = 'wa_' + businessId;
    let session = this.sessions.get(tenantAccId);
    if (!session) {
      const accDir = path.join(MULTI_AUTH_DIR, tenantAccId);
      if (!fs.existsSync(accDir)) fs.mkdirSync(accDir, { recursive: true });
      const label = `${businessName || 'Store'} WhatsApp`;
      session = new WhatsAppAccountSession(tenantAccId, label, accDir, this, businessId);
      this.sessions.set(tenantAccId, session);

      db.saveWhatsAppAccount({
        id: tenantAccId,
        label: label,
        phoneNumber: null,
        connected: false,
        botActive: true,
        businessId: businessId,
        createdAt: new Date().toISOString()
      });

      // Start socket session in background without blocking API call
      session.start().catch(err => console.error(`[whatsapp-acc:${tenantAccId}] Start error:`, err.message));
    }
    return session;
  }

  getAccounts(businessId = null) {
    const list = [];
    for (const [, session] of this.sessions.entries()) {
      if (businessId) {
        // Strict SaaS Tenant check: NEVER include 'default' (Super Admin line) in tenant accounts!
        if (session.id !== 'default' && session.businessId === businessId) {
          list.push(session.getStatus());
        }
      } else {
        list.push(session.getStatus());
      }
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

  // Send voice message (with optional accountId target or round-robin)
  async sendVoiceMessage(toPhone, audioBuffer, accountId, ptt = true) {
    let session = accountId ? this.sessions.get(accountId) : null;
    if (!session) {
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
    return await session.sendVoiceMessage(toPhone, audioBuffer, ptt);
  }

  // Send image message (with optional accountId target or round-robin)
  async sendImageMessage(toPhone, imageInput, accountId = null, caption = '') {
    let session = accountId ? this.sessions.get(accountId) : null;
    if (!session) {
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
    return await session.sendImageMessage(toPhone, imageInput, caption);
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
      session.isDestroyed = true;
      try {
        if (session.sock) await session.sock.logout();
      } catch (e) {}
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
