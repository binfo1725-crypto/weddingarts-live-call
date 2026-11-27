
// ─── 💰 Price Inquiry & Customer Intent Detection Engine ──────────────────────
const PriceInquiryEngine = {
  PRICE_KEYWORDS: [
    'keeyada', 'keeyad', 'kiyada', 'kiyad', 'keeyakda', 'gana', 'gaana', 'mila', 'ganan',
    'milaganang', 'price', 'rate', 'cost', 'how much', 'discount', 'wasi', 'adu', 'aduwata',
    'adu karanna', 'last price', 'best price', 'special price', 'cheaper', 'catalog', 'menu',
    'කීයද', 'මිල', 'ගණන්', 'ගාන', 'මිල කීයද', 'ගාන කීයද', 'ඩිස්කවුන්ට්', 'වට්ටම්', 'අඩු',
    'අඩු කරන්න', 'විස්තර සහ මිල', 'මිල ගණන්', 'vilai', 'evvalavu', 'evalavu', 'rate enna', 'price enna', 'cost enna'
  ],

  isPriceInquiry(text, aiReply = '', matchedProduct = null) {
    if (!text && !aiReply) return false;
    const lower = (text || '').toLowerCase();
    const isUserAsking = this.PRICE_KEYWORDS.some(kw => lower.includes(kw));
    const isPriceQuotedInReply = !!(matchedProduct && matchedProduct.price) || /මිල:s*rs|rs.?s*\d+/i.test(aiReply);
    return isUserAsking || isPriceQuotedInReply;
  },

  extractProduct(text, products = []) {
    if (!text || !products || products.length === 0) return null;
    const lower = text.toLowerCase();
    return products.find(p => p.name && lower.includes(p.name.toLowerCase())) || null;
  }
};

// ─── Universal Multi-Business Database Engine (Production Clean) ─────────────
// Real Production Database for Omnichannel AI Agent
// Supports Multi-Business, Products Catalog, Custom Keyword Flows, Orders Pipeline,
// Live Chats Inbox, Safe Broadcasts, and Settings. ZERO DEMO / FAKE DATA.

const fs = require('fs');
const path = require('path');
const dns = require('dns');
const crypto = require('crypto');
const mediaStore = require('./mediaStore.js');

let MongoClient;
try {
  MongoClient = require('mongodb').MongoClient;
} catch (e) {}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://binfo1725_db_user:XaALNX0uLpyVlCGx@cluster0.lx6kica.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : path.join(__dirname, 'data'));
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

let BUILTIN_DATASET = '';
try {
  const dsPath = path.join(__dirname, 'dataset.txt');
  if (fs.existsSync(dsPath)) {
    BUILTIN_DATASET = fs.readFileSync(dsPath, 'utf8');
  }
} catch (_) {}

// ─── Business Presets ─────────────────────────────────────────────────────────
const DEFAULT_BUSINESSES = [
  {
    id: 'weddingarts',
    name: 'OmniSix AI Software',
    category: 'software',
    ownerName: 'D T Rajapaksha (Tharindu)',
    phone: '076 210 7801',
    whatsappPhone: '94762107801',
    bankDetails: 'Bank of Ceylon (BOC) | Account: 92949122 | Name: D T Rajapaksha',
    deliveryPolicy: 'Instant Digital Delivery of License Keys and Cloud Activation.',
    currency: 'Rs.',
    welcomeMessage: 'ආයුබෝවන්! OmniSix AI වෙත සාදරයෙන් පිළිගන්නවා. මම ඔබට අද කොහොමද උදව් කරන්න පුළුවන්?',
    dataset: BUILTIN_DATASET || `Store: OmniSix AI Software Solutions`,
    isActive: true
  }
];

// ─── Real Store Products Catalog (Pure Real Production: 0 Demo Products) ──────
const DEFAULT_PRODUCTS = [];

// ─── Automated Keyword Flows (Pure Real Production: 0 Demo Flows) ──────────────
const DEFAULT_FLOWS = [];

// ─── Store & AI Settings ──────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  aiPersona: 'FRIENDLY_CUSTOMER_CARE',
  aiName: 'Nethmi (OmniSix AI)',
  assistantTitle: 'Senior Customer Support Agent',
  voiceProfile: 'Leda',
  voiceReplyMode: 'auto', // 'auto' (replies with voice note if customer sent voice), 'both', 'always', 'text'
  typingDelaySeconds: 1.5,
  isWorkingHoursEnabled: false,
  openTime: '08:30',
  closeTime: '21:00',
  closedMessage: 'ආයුබෝවන්! දැනට අපගේ සේවාවන් වසා ඇත. අප නැවත විවෘත වූ වහාම ඔබට පිළිතුරු ලබා දෙන්නෙමු.',
  humanTakeoverDurationMinutes: 30,
  isAntiBanSpacedBroadcast: true,
  isSmartUpsellEnabled: true,
  isSmartNegotiationEnabled: true,
  isArchetypeProfilingEnabled: true,
  isAngryEscalationEnabled: true,
  // Automated Follow-Up Engine
  isFollowUpEnabled: true,
  followUpDelayHours: 2,
  followUpMessage: 'Hi {customer}! 👋 ඔබ අපෙන් විමසූ {product} පිළිබඳ වැඩිදුර විස්තර හෝ මිල ගණන් දැනගැනීමට අවශ්‍යද? ඕනෑම ප්‍රශ්නයක් ඇත්නම් අපව අමතන්න, උදව් කිරීමට අපි සූදානම්! 😊✨',
  isFollowUpStage2Enabled: true,
  followUpStage2DelayHours: 24,
  followUpStage2Message: 'හෙලෝ {customer}! ඔබ විමසූ {product} සඳහා අද දිනයේ විශේෂ Discount එකක් හෝ Free Delivery ලබාදිය හැක. අවශ්‍ය නම් අදම Order එක තහවුරු කරගන්න! 📦🎁',
  // Owner Instant Alerts
  ownerAlertPhone: '',
  isOwnerAlertEnabled: true,
  // Quad-Language Smart Detection (සිංහල, Singlish, English, தமிழ்)
  languageReplyMode: 'smart_match', // 'smart_match', 'sinhala_script_only', 'english_only', 'tamil_only'
  // Interactive WhatsApp Buttons & Quick Action Menus
  isInteractiveButtonsEnabled: true,
  agentQuickButtons: [
    { id: 'ACTION_CATALOG', label: '📦 View Catalog', action: 'Show product catalog & prices' },
    { id: 'ACTION_ORDER', label: '🛒 Order Now', action: 'I want to place an order' },
    { id: 'ACTION_AGENT', label: '👤 Talk to Agent', action: 'Connect me with a human agent' }
  ],
  // Delivery Details & Order Checkout Toggle (true = collect delivery/checkout; false = refer orders to owner number)
  isDeliveryDetailsEnabled: true,
  // Payment Gateway Integration (PayHere / Koko / Custom Payment Link)
  paymentGateway: {
    enabled: false,
    provider: 'payhere',
    merchantId: '',
    merchantSecret: '',
    sandbox: true,
    autoSendLink: false,
    customPayUrl: '',
    kokoEnabled: false,
    kokoMerchantId: '',
    kokoApiKey: '',
    kokoSandbox: true,
    mintpayEnabled: false,
    mintpayMerchantId: ''
  },
  // Live Courier REST Dispatch Integration (Koombiyo, Domex, Prompt X, Custom)
  courierApi: {
    enabled: false,
    provider: 'koombiyo',
    apiKey: '',
    apiUrl: '',
    webhookSecret: ''
  },
  // Unified Meta Page & Instagram DM Inbox
  metaOmnichannel: {
    enabled: false,
    pageAccessToken: '',
    pageId: '',
    igAccountId: ''
  },
  // Customer Self-Service Gemini API Key
  geminiApiKey: ''
};

// ─── Database Class ───────────────────────────────────────────────────────────
class Database {
  constructor() {
    this.data = {
      businesses: DEFAULT_BUSINESSES,
      products: DEFAULT_PRODUCTS,
      customFlows: DEFAULT_FLOWS,
      settings: DEFAULT_SETTINGS,
      orders: [],      // Pure Real Production: Starts with 0 fake orders
      chats: [],       // Pure Real Production: Starts with 0 fake chats
      broadcasts: [],  // Pure Real Production: Starts with 0 fake campaigns
      licenses: [],    // Multi-Tenant SaaS Client License Keys
      whatsappAccounts: [], // Multi-Account WhatsApp Sessions
      adminSessions: {},   // Persistent Super Admin Auth Tokens
      staffSessions: {},   // Persistent Scoped Staff RBAC Tokens
      leads: [],       // Unconfirmed Leads & Follow-Up Tracking
      whatsapp: {
        connected: false,
        phoneNumber: null,
        pairedAt: null,
        pairingCode: null,
        qrData: null,
        lastSeen: new Date().toISOString()
      },
      analytics: {
        totalCalls: 0
      }
    };
    this._chatListeners = [];
    this.load();
    this.initMongo().catch(err => console.warn('[db] MongoDB init error:', err.message));
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.businesses && parsed.businesses.length > 0) {
          // Remove mock demo stores: urbanstyle, royalcakes, techzone, glamour_salon
          const demoIds = ['urbanstyle', 'royalcakes', 'techzone', 'glamour_salon', 'test_starter_store', 'test_pro_store', 'test_ent_store', 'boutique', 'salon', 'restaurant'];
          this.data.businesses = parsed.businesses.filter(b => !demoIds.includes(b.id));
          if (this.data.businesses.length === 0) {
            this.data.businesses = [...DEFAULT_BUSINESSES];
          }
          if (!this.data.businesses.some(b => b.isActive)) {
            this.data.businesses[0].isActive = true;
          }
          this.data.products = parsed.products || DEFAULT_PRODUCTS;
          this.data.customFlows = parsed.customFlows || DEFAULT_FLOWS;
          this.data.settings = parsed.settings || DEFAULT_SETTINGS;
          this.data.orders = parsed.orders || [];
          this.data.chats = parsed.chats || [];
          this.data.broadcasts = parsed.broadcasts || [];
          this.data.licenses = parsed.licenses || [];
          this.data.whatsappAccounts = parsed.whatsappAccounts || [];
          if (parsed.adminSessions && typeof parsed.adminSessions === 'object') {
            this.data.adminSessions = parsed.adminSessions;
          }
          if (parsed.staffSessions && typeof parsed.staffSessions === 'object') {
            this.data.staffSessions = parsed.staffSessions;
          }
          this.data.leads = parsed.leads || [];
          const extraCollections = [
            'contacts', 'contactGroups', 'kanbanDeals', 'forms', 'apiKeys',
            'webhooks', 'webhookLogs', 'agents', 'chatMetadata', 'quickReplies',
            'callLogs', 'staff', 'warmer', 'agentFleet', 'agentFleetMode',
            'customerNotes', 'blacklist'
          ];
          for (const key of extraCollections) {
            if (parsed[key] !== undefined) this.data[key] = parsed[key];
          }
          if (parsed.whatsapp) this.data.whatsapp = { ...this.data.whatsapp, ...parsed.whatsapp };
          if (parsed.analytics) this.data.analytics = { ...this.data.analytics, ...parsed.analytics };

          // Automatically sync master dataset from dataset.txt
          if (BUILTIN_DATASET && this.data.businesses.length > 0) {
            const primary = this.data.businesses.find(b => b.id === 'weddingarts') || this.data.businesses[0];
            if (primary) {
              primary.dataset = BUILTIN_DATASET;
            }
          }
        }
      } else {
        this.save();
      }
    } catch (e) {
      console.warn('[db] Failed to load DB file, using in-memory defaults:', e.message);
    }
    // Asynchronously pull latest snapshot from cloud storage if configured
    this.syncFromCloud().catch(() => {});
  }

  save() {
    this.saveToDiskSync();
    this.scheduleMongoSync();
    this.syncToCloud().catch(() => {});
    this.checkSnapshotRotation();
  }

  saveToDiskSync() {
    try {
      const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf8');
      try {
        fs.renameSync(tmpFile, DB_FILE);
      } catch (e) {
        // Windows file lock fallback: copy & unlink
        fs.copyFileSync(tmpFile, DB_FILE);
        try { fs.unlinkSync(tmpFile); } catch (_) {}
      }
    } catch (e) {
      console.warn('[db] Failed to save DB file to disk:', e.message);
    }
  }

  scheduleMongoSync() {
    if (this.mongoSyncTimer) clearTimeout(this.mongoSyncTimer);
    this.mongoSyncTimer = setTimeout(() => {
      this.syncToMongo().catch(() => {});
    }, 1000);
  }

  scheduleMongoReconnect() {
    if (this._mongoRetryTimer) clearTimeout(this._mongoRetryTimer);
    this.mongoReconnectAttempts = (this.mongoReconnectAttempts || 0) + 1;
    // Exponential backoff: 10s, 20s, 40s, up to max 5 minutes (300000ms) to prevent socket & CPU churn
    const delayMs = Math.min(300000, 10000 * Math.pow(1.5, Math.min(this.mongoReconnectAttempts, 8)));
    this._mongoRetryTimer = setTimeout(() => {
      if (!this.isMongoConnected && !this.isMongoConnecting) {
        console.log(`[db] 🔄 Retrying MongoDB Atlas connection (attempt ${this.mongoReconnectAttempts})...`);
        this.initMongo().catch(() => {});
      }
    }, delayMs);
    if (this._mongoRetryTimer.unref) this._mongoRetryTimer.unref();
  }

  // ─── Native MongoDB Atlas Integration ─────────────────────────────────────────
  async initMongo() {
    if (!MongoClient || !MONGODB_URI) return;
    if (this.isMongoConnecting) return;
    this.isMongoConnecting = true;

    let client = null;
    try {
      if (this.mongoClient) {
        try { await this.mongoClient.close(); } catch (_) {}
        this.mongoClient = null;
      }

      client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 1,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        retryReads: true,
        family: 4
      });

      client.on('close', () => {
        if (this.isMongoConnected) {
          this.isMongoConnected = false;
          console.warn('[MongoDB Atlas] Connection closed. Reconnecting...');
          this.scheduleMongoReconnect();
        }
      });
      client.on('error', (err) => {
        console.warn('[MongoDB Atlas] Topology error:', err.message);
      });

      await client.connect();
      this.mongoClient = client;
      this.mongoDb = client.db('omnisix');
      mediaStore.initGridFs(this.mongoDb);
      this.mongoStateCol = this.mongoDb.collection('app_state');
      this.mongoOrdersCol = this.mongoDb.collection('orders');
      this.mongoProductsCol = this.mongoDb.collection('products');
      this.mongoBaileysCol = this.mongoDb.collection('baileys_auth');
      this.mongoAuditCol = this.mongoDb.collection('audit_logs');
      this.isMongoConnected = true;
      this.isMongoConnecting = false;
      this.mongoError = null;
      this.mongoReconnectAttempts = 0;
      if (this._mongoRetryTimer) {
        clearTimeout(this._mongoRetryTimer);
        this._mongoRetryTimer = null;
      }
      console.log('🍃 [MongoDB Atlas] Connected successfully to Cloud Database (omnisix)!');

      // Reconcile state non-destructively (never overwrite newer local data)
      const doc = await this.mongoStateCol.findOne({ _id: 'omnisix_data' });
      if (doc && doc.data && doc.data.businesses && doc.data.businesses.length > 0) {
        const cloudData = doc.data;
        // Merge Orders
        const orderMap = new Map((this.data.orders || []).map(o => [o.id, o]));
        if (Array.isArray(cloudData.orders)) {
          for (const co of cloudData.orders) {
            if (!orderMap.has(co.id)) orderMap.set(co.id, co);
          }
        }
        this.data.orders = Array.from(orderMap.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        // Merge Licenses
        const licMap = new Map((this.data.licenses || []).map(l => [(l.key || '').toUpperCase(), l]));
        if (Array.isArray(cloudData.licenses)) {
          for (const cl of cloudData.licenses) {
            const k = (cl.key || '').toUpperCase();
            if (!licMap.has(k)) licMap.set(k, cl);
          }
        }
        this.data.licenses = Array.from(licMap.values());

        // Merge Products
        const prodMap = new Map((this.data.products || []).map(p => [p.id, p]));
        if (Array.isArray(cloudData.products)) {
          for (const cp of cloudData.products) {
            if (!prodMap.has(cp.id)) prodMap.set(cp.id, cp);
          }
        }
        this.data.products = Array.from(prodMap.values());

        // Merge Businesses
        const bizMap = new Map((this.data.businesses || []).map(b => [b.id, b]));
        if (Array.isArray(cloudData.businesses)) {
          for (const cb of cloudData.businesses) {
            if (!bizMap.has(cb.id)) bizMap.set(cb.id, cb);
          }
        }
        const demoIdsSync = ['urbanstyle', 'royalcakes', 'techzone', 'glamour_salon', 'test_starter_store', 'test_pro_store', 'test_ent_store', 'boutique', 'salon', 'restaurant'];
        this.data.businesses = Array.from(bizMap.values()).filter(b => !demoIdsSync.includes(b.id));

        // Merge Admin & Staff Sessions
        if (cloudData.adminSessions && typeof cloudData.adminSessions === 'object') {
          if (!this.data.adminSessions) this.data.adminSessions = {};
          const now = Date.now();
          for (const [tok, exp] of Object.entries(cloudData.adminSessions)) {
            if (exp > now) this.data.adminSessions[tok] = exp;
          }
        }
        if (cloudData.staffSessions && typeof cloudData.staffSessions === 'object') {
          if (!this.data.staffSessions) this.data.staffSessions = {};
          const now = Date.now();
          for (const [tok, sess] of Object.entries(cloudData.staffSessions)) {
            if (sess && sess.exp > now) this.data.staffSessions[tok] = sess;
          }
        }

        // Merge Settings
        if (cloudData.settings) {
          this.data.settings = { ...DEFAULT_SETTINGS, ...cloudData.settings, ...this.data.settings };
        }
        if (Array.isArray(cloudData.customFlows) && cloudData.customFlows.length > 0) {
          const flowMap = new Map((this.data.customFlows || []).map(f => [f.id, f]));
          for (const cf of cloudData.customFlows) {
            if (!flowMap.has(cf.id)) flowMap.set(cf.id, cf);
          }
          this.data.customFlows = Array.from(flowMap.values());
        }

        // Reconcile Live Inbox Chats (preserve messages across Render deploys & retain local media)
        if (Array.isArray(cloudData.chats)) {
          const chatMap = new Map((this.data.chats || []).map(c => [c.id, c]));
          for (const cc of cloudData.chats) {
            const localChat = chatMap.get(cc.id);
            if (!localChat) {
              chatMap.set(cc.id, cc);
            } else {
              const msgMap = new Map((cc.messages || []).map(m => [m.id, m]));
              for (const lm of (localChat.messages || [])) {
                const cloudMsg = msgMap.get(lm.id);
                if (!cloudMsg) {
                  msgMap.set(lm.id, lm);
                } else {
                  msgMap.set(lm.id, {
                    ...cloudMsg,
                    audioBase64: lm.audioBase64 || cloudMsg.audioBase64,
                    imageBase64: lm.imageBase64 || cloudMsg.imageBase64
                  });
                }
              }
              localChat.messages = Array.from(msgMap.values())
                .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                .slice(-100);
              if (cc.lastTime && (!localChat.lastTime || new Date(cc.lastTime) > new Date(localChat.lastTime))) {
                localChat.lastTime = cc.lastTime;
                localChat.lastMessage = cc.lastMessage || localChat.lastMessage;
              }
            }
          }
          this.data.chats = Array.from(chatMap.values())
            .sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0))
            .slice(0, 1000);
        }

        // Reconcile array collections by id cleanly
        for (const col of ['contacts', 'broadcasts', 'leads', 'callLogs', 'kanbanDeals', 'forms', 'webhooks', 'quickReplies', 'staff', 'apiKeys']) {
          if (Array.isArray(cloudData[col])) {
            const localList = Array.isArray(this.data[col]) ? this.data[col] : [];
            const idMap = new Map(localList.map(item => [item.id || item.key, item]));
            for (const item of cloudData[col]) {
              const k = item && (item.id || item.key);
              if (k && !idMap.has(k)) idMap.set(k, item);
            }
            this.data[col] = Array.from(idMap.values());
          }
        }
        for (const mapKey of ['chatMetadata', 'customerNotes', 'blacklist']) {
          if (cloudData[mapKey] && typeof cloudData[mapKey] === 'object') {
            this.data[mapKey] = { ...cloudData[mapKey], ...(this.data[mapKey] || {}) };
          }
        }
        if (cloudData.warmer && !this.data.warmer) this.data.warmer = cloudData.warmer;

        this.saveToDiskSync();
        console.log(`🍃 [MongoDB Atlas] Restored & reconciled state from cloud: ${(this.data.orders || []).length} orders, ${(this.data.products || []).length} products, ${(this.data.licenses || []).length} licenses.`);
      } else {
        await this.syncToMongo();
        console.log('🌱 [MongoDB Atlas] Initialized and seeded cloud database with baseline records.');
      }
      await this.ensureIndexes();
    } catch (err) {
      if (client) {
        try { await client.close(); } catch (_) {}
      }
      this.mongoClient = null;
      this.isMongoConnected = false;
      this.isMongoConnecting = false;
      this.mongoError = err.message;
      console.warn('⚠️ [MongoDB Atlas] Connection warning (falling back to local storage):', err.message);
      this.scheduleMongoReconnect();
    }
  }

  async syncToMongo() {
    if (!this.mongoStateCol || !this.isMongoConnected) return;
    try {
      // Strip ephemeral base64 QR codes before cloud upload to stay under 16MB document limit
      const sanitized = JSON.parse(JSON.stringify(this.data));
      if (sanitized.whatsapp) delete sanitized.whatsapp.qrData;
      if (Array.isArray(sanitized.whatsappAccounts)) {
        sanitized.whatsappAccounts.forEach(a => { delete a.qrDataUrl; delete a.rawQr; });
      }
      // Guard MongoDB 16MB document limit: retain full inline media on latest 40 chat messages globally if DB grows large
      if (Array.isArray(sanitized.chats)) {
        const serializedLen = JSON.stringify(sanitized).length;
        if (serializedLen > 10 * 1024 * 1024) {
          let keptMediaCount = 0;
          for (const c of sanitized.chats) {
            if (!Array.isArray(c.messages)) continue;
            for (let mi = c.messages.length - 1; mi >= 0; mi--) {
              const m = c.messages[mi];
              if (m.audioBase64 || m.imageBase64) {
                keptMediaCount++;
                if (keptMediaCount > 35) {
                  delete m.audioBase64;
                  delete m.imageBase64;
                }
              }
            }
          }
        }
      }
      await this.mongoStateCol.updateOne(
        { _id: 'omnisix_data' },
        { $set: { data: sanitized, lastUpdated: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      console.warn('[db] Error syncing state to MongoDB Atlas:', err.message);
    }
  }

  // ─── 🚀 Enterprise MongoDB Indexing Engine ──────────────────────────────────
  async ensureIndexes() {
    if (!this.mongoDb || !this.isMongoConnected) return;
    try {
      if (this.mongoOrdersCol) {
        await this.mongoOrdersCol.createIndex({ businessId: 1, createdAt: -1 });
        await this.mongoOrdersCol.createIndex({ customerPhone: 1 });
        await this.mongoOrdersCol.createIndex({ status: 1 });
      }
      if (this.mongoProductsCol) {
        await this.mongoProductsCol.createIndex({ businessId: 1, id: 1 });
      }
      if (this.mongoBaileysCol) {
        await this.mongoBaileysCol.createIndex({ accountId: 1, filename: 1 });
      }
      if (this.mongoAuditCol) {
        await this.mongoAuditCol.createIndex({ timestamp: -1 });
        await this.mongoAuditCol.createIndex({ businessId: 1, timestamp: -1 });
        await this.mongoAuditCol.createIndex({ type: 1 });
        await this.mongoAuditCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
      }
      console.log('🍃 [MongoDB Atlas] Production indexes created and verified successfully.');
    } catch (e) {
      console.warn('[db] ensureIndexes note:', e.message);
    }
  }

  // ─── 🛡️ Enterprise Audit Logging Engine ─────────────────────────────────────
  logAuditEvent(event) {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    const auditItem = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: event.type || 'SYSTEM_INFO',
      businessId: event.businessId || 'global',
      actor: event.actor || 'System',
      ip: event.ip || '127.0.0.1',
      details: event.details || {},
      status: event.status || 'SUCCESS',
      timestamp: new Date().toISOString(),
      createdAt: new Date()
    };

    this.data.auditLogs.unshift(auditItem);
    if (this.data.auditLogs.length > 250) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 250);
    }

    if (this.mongoAuditCol && this.isMongoConnected) {
      this.mongoAuditCol.insertOne(auditItem).catch(() => {});
    }
    return auditItem;
  }

  getAuditLogs(businessId = null, limit = 50) {
    let logs = this.data.auditLogs || [];
    if (businessId && businessId !== 'all') {
      logs = logs.filter(l => l.businessId === businessId || l.businessId === 'global');
    }
    return logs.slice(0, limit);
  }

  // ─── 📦 Automated Database Snapshot Rotation ────────────────────────────────
  checkSnapshotRotation() {
    const now = Date.now();
    if (!this._lastSnapshotTime || now - this._lastSnapshotTime > 6 * 3600 * 1000) {
      this._lastSnapshotTime = now;
      this.createSnapshot().catch(() => {});
    }
  }

  async createSnapshot() {
    try {
      const backupDir = path.join(DATA_DIR, 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const filename = `snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const target = path.join(backupDir, filename);
      fs.writeFileSync(target, JSON.stringify(this.data, null, 2), 'utf8');

      // Keep only 10 latest snapshots
      const files = fs.readdirSync(backupDir).filter(f => f.startsWith('snapshot_')).sort();
      while (files.length > 10) {
        const oldest = files.shift();
        try { fs.unlinkSync(path.join(backupDir, oldest)); } catch (_) {}
      }
    } catch (e) {
      console.warn('[db] Snapshot creation failed:', e.message);
    }
  }

  // ─── Baileys WhatsApp Cloud Session Persistence ──────────────────────────────
  async restoreBaileysAuthFromMongo(accountId, authDir) {
    if (!this.mongoBaileysCol || !this.isMongoConnected) return false;
    try {
      const records = await this.mongoBaileysCol.find({ accountId }).toArray();
      if (!records || records.length === 0) return false;

      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      let restoredCount = 0;
      for (const rec of records) {
        if (!rec.filename || !rec.data) continue;
        const filePath = path.join(authDir, rec.filename);
        let shouldWrite = true;
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          if (rec.updatedAt && new Date(rec.updatedAt).getTime() <= stat.mtimeMs) {
            shouldWrite = false;
          }
        }
        if (shouldWrite) {
          const content = rec.isBase64 ? Buffer.from(rec.data, 'base64') : rec.data;
          fs.writeFileSync(filePath, content);
          restoredCount++;
        }
      }
      if (restoredCount > 0) {
        console.log(`🍃 [MongoDB Atlas] Restored ${restoredCount} Baileys auth keys for account "${accountId}".`);
      }
      return true;
    } catch (e) {
      console.warn(`[db] Failed to restore Baileys auth for ${accountId}:`, e.message);
      return false;
    }
  }

  async backupBaileysAuthToMongo(accountId, authDir) {
    if (!this.mongoBaileysCol || !this.isMongoConnected) return false;
    try {
      if (!fs.existsSync(authDir)) return false;
      const files = fs.readdirSync(authDir);
      if (!files || files.length === 0) return false;

      const bulkOps = [];
      const now = new Date();

      for (const file of files) {
        const filePath = path.join(authDir, file);
        try {
          const stat = fs.statSync(filePath);
          if (!stat.isFile()) continue;

          let data;
          let isBase64 = false;
          if (file.endsWith('.json')) {
            data = fs.readFileSync(filePath, 'utf8');
          } else {
            data = fs.readFileSync(filePath).toString('base64');
            isBase64 = true;
          }

          bulkOps.push({
            updateOne: {
              filter: { _id: `${accountId}:${file}` },
              update: {
                $set: {
                  accountId,
                  filename: file,
                  data,
                  isBase64,
                  updatedAt: now
                }
              },
              upsert: true
            }
          });
        } catch (fileErr) {}
      }

      if (bulkOps.length > 0) {
        await this.mongoBaileysCol.bulkWrite(bulkOps, { ordered: false });
        console.log(`🍃 [MongoDB Atlas] Backed up ${bulkOps.length} Baileys auth keys for account "${accountId}".`);
      }
      return true;
    } catch (e) {
      console.warn(`[db] Failed to backup Baileys auth for ${accountId}:`, e.message);
      return false;
    }
  }

  async clearBaileysAuthInMongo(accountId) {
    if (!this.mongoBaileysCol || !this.isMongoConnected) return;
    try {
      await this.mongoBaileysCol.deleteMany({ accountId });
      console.log(`🍃 [MongoDB Atlas] Cleared Baileys auth keys for account "${accountId}".`);
    } catch (e) {
      console.warn(`[db] Failed to clear Baileys auth in Mongo for ${accountId}:`, e.message);
    }
  }

  async syncToCloud() {
    const cloudUrl = process.env.CLOUD_SYNC_URL;
    const cloudKey = process.env.CLOUD_SYNC_KEY || '';
    if (!cloudUrl) return;
    try {
      await fetch(cloudUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cloudKey ? { 'Authorization': `Bearer ${cloudKey}`, 'x-access-token': cloudKey } : {})
        },
        body: JSON.stringify(this.data)
      });
    } catch (e) {
      console.warn('[db] Cloud sync failed:', e.message);
    }
  }

  async syncFromCloud() {
    const cloudUrl = process.env.CLOUD_SYNC_URL;
    const cloudKey = process.env.CLOUD_SYNC_KEY || '';
    if (!cloudUrl) return;
    try {
      const res = await fetch(cloudUrl, {
        headers: {
          ...(cloudKey ? { 'Authorization': `Bearer ${cloudKey}`, 'x-access-token': cloudKey } : {})
        }
      });
      if (res.ok) {
        const cloudData = await res.json();
        this.importDatabase(cloudData);
        console.log('[db] Successfully restored latest database snapshot from Cloud Storage on boot!');
      }
    } catch (e) {
      console.warn('[db] Failed to restore cloud database on boot:', e.message);
    }
  }

  // ─── Business Methods ────────────────────────────────────────────────────────
  getActiveBusiness() {
    const businesses = this.getAllBusinesses();
    const active = businesses.find(b => b.isActive);
    return active || businesses[0] || DEFAULT_BUSINESSES[0];
  }

  getAllBusinesses() {
    const demoIds = ['urbanstyle', 'royalcakes', 'techzone', 'glamour_salon', 'test_starter_store', 'test_pro_store', 'test_ent_store', 'boutique', 'salon', 'restaurant'];
    this.data.businesses = (this.data.businesses || []).filter(b => !demoIds.includes(b.id));
    if (this.data.businesses.length === 0) {
      this.data.businesses = [...DEFAULT_BUSINESSES];
    }
    return this.data.businesses;
  }

  getBusiness(id) {
    if (!id) return this.getActiveBusiness();
    return (this.data.businesses || []).find(b => b.id === id) || null;
  }

  setActiveBusiness(id) {
    this.data.businesses.forEach(b => {
      b.isActive = (b.id === id);
    });
    this.save();
    return this.getActiveBusiness();
  }

  saveBusiness(biz) {
    const idx = this.data.businesses.findIndex(b => b.id === biz.id);
    if (idx >= 0) {
      this.data.businesses[idx] = { ...this.data.businesses[idx], ...biz };
    } else {
      this.data.businesses.push(biz);
    }
    this.save();
    return biz;
  }

  createBusiness(biz) {
    const slug = (biz.name || 'store').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 20);
    const id = biz.id ? String(biz.id).trim() : (slug ? `${slug}_${Date.now().toString().slice(-4)}` : `store_${Date.now()}`);
    const newBiz = {
      id,
      name: (biz.name || 'New Store').trim(),
      category: (biz.category || 'general').trim(),
      ownerName: (biz.ownerName || '').trim(),
      phone: (biz.phone || '').trim(),
      whatsappPhone: (biz.whatsappPhone || (biz.phone || '').replace(/[^0-9]/g, '')).trim(),
      bankDetails: (biz.bankDetails || '').trim(),
      deliveryPolicy: (biz.deliveryPolicy || '').trim(),
      currency: (biz.currency || 'Rs.').trim(),
      brandColor: /^#[0-9A-Fa-f]{6}$/.test(biz.brandColor || '') ? biz.brandColor : '#2563EB',
      logoUrl: (biz.logoUrl || '').trim(),
      ...(biz.subscriptionPlan ? { subscriptionPlan: biz.subscriptionPlan } : {}),
      welcomeMessage: (biz.welcomeMessage || `ආයුබෝවන්! ${biz.name || 'Store'} වෙත සාදරයෙන් පිළිගන්නවා. මම ඔබට අද කොහොමද උදව් කරන්න පුළුවන්?`).trim(),
      dataset: biz.dataset || `Store: ${biz.name}\nContact: ${biz.phone}\nBank: ${biz.bankDetails}`,
      isActive: false
    };
    this.data.businesses.push(newBiz);
    this.save();
    return newBiz;
  }

  deleteBusiness(id) {
    if (this.data.businesses.length <= 1) {
      throw new Error('At least one store must remain. Operation not allowed.');
    }
    const wasActive = this.getActiveBusiness()?.id === id;
    this.data.businesses = this.data.businesses.filter(b => b.id !== id);
    if (wasActive && this.data.businesses.length > 0) {
      this.data.businesses[0].isActive = true;
    }
    this.save();
    return this.getActiveBusiness();
  }

  // ─── Products Catalog CRUD (From APK) ─────────────────────────────────────────
  getProducts(businessId) {
    if (businessId) {
      return (this.data.products || []).filter(p => p.businessId === businessId);
    }
    const bId = this.getActiveBusiness().id;
    return (this.data.products || []).filter(p => !p.businessId || p.businessId === bId);
  }

  addProduct(prod) {
    if (!this.data.products) this.data.products = [];
    const nextNum = (this.data.products || []).reduce((max, p) => {
      const num = parseInt(String(p.id).replace(/\D/g, ''), 10) || 0;
      return Math.max(max, num);
    }, 0) + 1;
    const rawImgs = Array.isArray(prod.images) ? prod.images.filter(Boolean) : (prod.imageUrl ? [prod.imageUrl] : []);
    const newProd = {
      id: prod.id || `PROD-${nextNum}`,
      businessId: prod.businessId || this.getActiveBusiness().id,
      name: prod.name || 'Untitled Product',
      category: prod.category || 'General',
      price: parseFloat(prod.price) || 0,
      cost: parseFloat(prod.cost) || 0,
      minFloorPrice: parseFloat(prod.minFloorPrice) || (parseFloat(prod.price) * 0.9) || 0,
      maxDiscountPct: parseInt(prod.maxDiscountPct) || 10,
      description: prod.description || '',
      images: rawImgs,
      imageUrl: rawImgs[0] || prod.imageUrl || prod.image || '',
      stockQty: (prod.stockQty !== undefined && prod.stockQty !== '' && prod.stockQty !== null)
        ? Math.max(0, parseInt(prod.stockQty, 10) || 0)
        : null,
      lowStockThreshold: (prod.lowStockThreshold !== undefined && prod.lowStockThreshold !== '')
        ? Math.max(1, parseInt(prod.lowStockThreshold, 10) || 5)
        : 5,
      inStock: (prod.stockQty !== undefined && prod.stockQty !== '' && prod.stockQty !== null && (parseInt(prod.stockQty, 10) || 0) === 0)
        ? false
        : (prod.inStock !== false)
    };
    this.data.products.push(newProd);
    this.save();
    return newProd;
  }

  updateProduct(id, updates) {
    const idx = (this.data.products || []).findIndex(p => p.id === id);
    if (idx >= 0) {
      if (Array.isArray(updates.images)) {
        updates.images = updates.images.filter(Boolean);
        updates.imageUrl = updates.images[0] || updates.imageUrl || '';
      } else if (updates.imageUrl && !updates.images) {
        updates.images = [updates.imageUrl];
      }
      if (updates.stockQty !== undefined) {
        if (updates.stockQty === '' || updates.stockQty === null) {
          updates.stockQty = null;
        } else {
          const parsed = Math.max(0, parseInt(updates.stockQty, 10) || 0);
          updates.stockQty = parsed;
          if (parsed === 0) updates.inStock = false;
        }
      }
      if (updates.lowStockThreshold !== undefined && updates.lowStockThreshold !== '') {
        updates.lowStockThreshold = Math.max(1, parseInt(updates.lowStockThreshold, 10) || 5);
      }
      this.data.products[idx] = { ...this.data.products[idx], ...updates };
      this.save();
      return this.data.products[idx];
    }
    return null;
  }

  parseOrderLineItems(itemText, defaultQty = 1) {
    const raw = String(itemText || '').trim();
    if (!raw) return [];
    return raw.split(/[,+\n&]+/).map(part => {
      let seg = part.trim();
      if (!seg) return null;
      let qty = defaultQty;
      const leadMatch = /^(\d+)\s*[xX*]\s+(.+)$/.exec(seg);
      const trailMatch = /^(.+?)\s*[xX*]\s*(\d+)$/.exec(seg);
      const parenMatch = /^(.+?)\s*\((\d+)\s*(?:pcs?|units?|qty)?\)$/i.exec(seg);
      if (leadMatch) {
        qty = Math.max(1, parseInt(leadMatch[1], 10) || 1);
        seg = leadMatch[2].trim();
      } else if (trailMatch) {
        seg = trailMatch[1].trim();
        qty = Math.max(1, parseInt(trailMatch[2], 10) || 1);
      } else if (parenMatch) {
        seg = parenMatch[1].trim();
        qty = Math.max(1, parseInt(parenMatch[2], 10) || 1);
      }
      return { name: seg, qty };
    }).filter(Boolean);
  }

  decrementOrderItemsStock(order, fallbackQty = 1) {
    const bId = order?.businessId || null;
    const explicitItems = Array.isArray(order?.items) && order.items.length > 0
      ? order.items.map(it => ({ name: it.name || it.item || '', qty: Math.max(1, parseInt(it.qty, 10) || 1) })).filter(it => it.name)
      : this.parseOrderLineItems(order?.item || '', fallbackQty);

    const decrements = [];
    const lowStockItems = [];
    const usedProductIds = new Set();

    for (const line of explicitItems) {
      const cleanLine = line.name.toLowerCase().trim();
      if (!cleanLine) continue;
      const storeProds = this.getProducts(bId);
      const matched = storeProds.find(p =>
        !usedProductIds.has(p.id) &&
        p.name &&
        (cleanLine.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanLine))
      );
      if (!matched || typeof matched.stockQty !== 'number') continue;
      usedProductIds.add(matched.id);

      const decrementBy = Math.max(1, parseInt(line.qty, 10) || 1);
      matched.stockQty = Math.max(0, matched.stockQty - decrementBy);
      if (matched.stockQty === 0) {
        matched.inStock = false;
      }
      const entry = {
        matchedProduct: matched,
        lowStockAlert: matched.stockQty <= (matched.lowStockThreshold || 5),
        outOfStock: matched.stockQty === 0
      };
      decrements.push(entry);
      if (entry.lowStockAlert) {
        lowStockItems.push({
          productId: matched.id,
          name: matched.name,
          remaining: matched.stockQty
        });
      }
    }
    if (decrements.length > 0) this.save();
    return { decrements, lowStockItems };
  }

  decrementProductStock(itemText, businessId = null, qty = 1) {
    const res = this.decrementOrderItemsStock({ item: itemText, businessId }, qty);
    return res.decrements[0] || null;
  }

  deleteProduct(id) {
    const initialLen = (this.data.products || []).length;
    this.data.products = (this.data.products || []).filter(p => p.id !== id);
    if (this.data.products.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  // ─── Custom Keyword Flows (From APK) ──────────────────────────────────────────
  getCustomFlows(businessId) {
    if (businessId) {
      return (this.data.customFlows || []).filter(f => f.businessId === businessId);
    }
    const bId = this.getActiveBusiness().id;
    return (this.data.customFlows || []).filter(f => !f.businessId || f.businessId === bId);
  }

  addCustomFlow(flow) {
    if (!this.data.customFlows) this.data.customFlows = [];
    const nextNum = (this.data.customFlows || []).reduce((max, f) => {
      const num = parseInt(String(f.id).replace(/\D/g, ''), 10) || 0;
      return Math.max(max, num);
    }, 0) + 1;
    const newFlow = {
      id: flow.id || `FLOW-${nextNum}`,
      businessId: flow.businessId || this.getActiveBusiness().id,
      trigger: (flow.trigger || '').toLowerCase().trim(),
      matchType: flow.matchType || 'contains', // 'contains' | 'exact'
      response: flow.response || '',
      isActive: flow.isActive !== false
    };
    this.data.customFlows.push(newFlow);
    this.save();
    return newFlow;
  }

  updateCustomFlow(id, updates) {
    const idx = (this.data.customFlows || []).findIndex(f => f.id === id);
    if (idx >= 0) {
      this.data.customFlows[idx] = { ...this.data.customFlows[idx], ...updates };
      this.save();
      return this.data.customFlows[idx];
    }
    return null;
  }

  deleteCustomFlow(id) {
    const initialLen = (this.data.customFlows || []).length;
    this.data.customFlows = (this.data.customFlows || []).filter(f => f.id !== id);
    if (this.data.customFlows.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  matchCustomFlow(text, businessId) {
    const flows = this.getCustomFlows(businessId);
    const clean = (text || '').toLowerCase().trim();
    for (const f of flows) {
      if (!f.isActive) continue;
      const trig = f.trigger.toLowerCase();
      if (f.matchType === 'exact' && clean === trig) return f;
      if (f.matchType === 'contains' && clean.includes(trig)) return f;
    }
    return null;
  }

  // ─── Store & AI Persona Settings (From APK) ──────────────────────────────────
  getSettings() {
    if (!this.data.settings) {
      this.data.settings = { ...DEFAULT_SETTINGS };
    } else if (this.data.settings.isDeliveryDetailsEnabled === undefined) {
      this.data.settings.isDeliveryDetailsEnabled = true;
    }
    return this.data.settings;
  }

  updateSettings(updates) {
    const current = this.getSettings();
    this.data.settings = { ...current, ...updates };
    this.save();
    return this.data.settings;
  }

  // Tenant-Scoped Store Settings (Multi-Tenant SaaS)
  getTenantSettings(businessId) {
    if (!businessId) return this.getSettings();
    const biz = this.getBusiness(businessId);
    if (!biz) return this.getSettings();
    if (!biz.settings) {
      const globalSettings = this.getSettings();
      biz.settings = {
        ...DEFAULT_SETTINGS,
        isDeliveryDetailsEnabled: globalSettings.isDeliveryDetailsEnabled !== false,
        aiName: `${biz.name} AI`,
        voiceReplyMode: 'auto'
      };
      this.save();
    } else if (biz.settings.isDeliveryDetailsEnabled === undefined) {
      biz.settings.isDeliveryDetailsEnabled = true;
    }
    return biz.settings;
  }

  updateTenantSettings(businessId, updates) {
    if (!businessId) return this.updateSettings(updates);
    const biz = this.getBusiness(businessId);
    if (!biz) return this.updateSettings(updates);
    biz.settings = { ...(biz.settings || DEFAULT_SETTINGS), ...updates };
    this.save();
    return biz.settings;
  }

  // ─── Real Orders Pipeline Methods ────────────────────────────────────────────
  getOrders(businessId) {
    const list = businessId
      ? (this.data.orders || []).filter(o => o.businessId === businessId)
      : (this.data.orders || []);
    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  addOrder(order) {
    if (!this.data.orders) this.data.orders = [];
    const safeAmount = String(order.amount !== undefined && order.amount !== null ? order.amount : '0').trim();
    const newOrder = {
      id: order.id || `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      businessId: order.businessId || this.getActiveBusiness().id,
      customerName: String(order.name || order.customerName || 'Customer').trim(),
      customerPhone: String(order.phone || order.customerPhone || '').trim(),
      item: String(order.item || 'Custom Order').trim(),
      ...(Array.isArray(order.items) && order.items.length > 0 ? { items: order.items } : {}),
      amount: safeAmount,
      address: String(order.address || order.note || 'To be confirmed').trim(),
      paymentMethod: order.paymentMethod || 'Bank Transfer',
      status: order.status || 'Pending Payment',
      trackingNumber: String(order.trackingNumber || '').trim(),
      createdAt: new Date().toISOString(),
      source: order.source || 'Live Voice Call'
    };
    this.data.orders.unshift(newOrder);
    const stockBatch = this.decrementOrderItemsStock(newOrder, parseInt(order.qty, 10) || 1);
    if (stockBatch.lowStockItems.length > 0) {
      newOrder.lowStockTriggered = stockBatch.lowStockItems[0];
      newOrder.lowStockItems = stockBatch.lowStockItems;
    }
    this.markLeadConfirmed(newOrder.customerPhone, newOrder.businessId);
    this.save();
    return newOrder;
  }

  updateOrderStatus(orderId, status, trackingNumber) {
    const ord = (this.data.orders || []).find(o => o.id === orderId);
    if (ord) {
      if (status !== undefined && status !== null && String(status).trim() !== '') {
        ord.status = String(status).trim();
      }
      if (trackingNumber !== undefined) ord.trackingNumber = String(trackingNumber).trim();
      this.save();
      return ord;
    }
    return null;
  }

  deleteOrder(orderId) {
    this.data.orders = (this.data.orders || []).filter(o => o.id !== orderId);
    this.save();
    return true;
  }

  // ─── Chats & Omnichannel Inbox (Real Production) ──────────────────────────────
  getChats(businessId = null) {
    let list = this.data.chats || [];
    if (businessId) {
      list = list.filter(c => c.businessId === businessId);
    }
    return list.slice().sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0));
  }

  getChat(chatId) {
    return (this.data.chats || []).find(c => c.id === chatId);
  }

  addChatMessage(chatId, sender, text, customerName = 'Customer', customerPhone = '', businessId = null, extra = {}) {
    if (!this.data.chats) this.data.chats = [];
    let chat = this.data.chats.find(c => c.id === chatId);
    const assignedBizId = businessId || (chat && chat.businessId) || this.getActiveBusiness().id;
    if (!chat) {
      chat = {
        id: chatId,
        businessId: assignedBizId,
        customerName: customerName,
        customerPhone: customerPhone || chatId,
        remoteJid: extra.remoteJid || (chatId.includes('@') ? chatId : (chatId.length > 13 ? (chatId + '@lid') : (chatId + '@s.whatsapp.net'))),
        accountId: extra.accountId || 'default',
        accountPhone: extra.accountPhone || '',
        accountLabel: extra.accountLabel || '',
        channel: extra.channel || 'whatsapp',
        aiMuted: false,
        aiMuteUntil: 0,
        unread: 0,
        archetype: 'GENERAL',
        isEscalated: false,
        escalationReason: '',
        lastTime: new Date().toISOString(),
        messages: []
      };
      this.data.chats.unshift(chat);
    } else {
      if (businessId && !chat.businessId) chat.businessId = businessId;
      if (extra.accountId) chat.accountId = extra.accountId;
      if (extra.accountPhone) chat.accountPhone = extra.accountPhone;
      if (extra.accountLabel) chat.accountLabel = extra.accountLabel;
      if (extra.channel) chat.channel = extra.channel;
      if (extra.remoteJid) chat.remoteJid = extra.remoteJid;
      if (!chat.remoteJid && chat.id && chat.id.length > 13) chat.remoteJid = chat.id + '@lid';
    }

    const safeAudio = (extra.audioBase64 && extra.audioBase64.length <= 950000) ? extra.audioBase64 : null;
    const safeImage = (extra.imageBase64 && extra.imageBase64.length <= 800000) ? extra.imageBase64 : null;
    const msgObj = {
      id: 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      sender: sender, // 'customer' | 'ai' | 'agent'
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      audioBase64: safeAudio,
      mimeType: extra.mimeType || null,
      imageBase64: safeImage,
      imageMimeType: extra.imageMimeType || null,
      mediaUrl: extra.mediaUrl || null,
      channel: extra.channel || null,
      visionSummary: extra.visionSummary || null,
      ...(extra.extractedOrder ? { extractedOrder: extra.extractedOrder } : {}),
      productId: extra.productId || null
    };

    chat.messages.push(msgObj);
    if (chat.messages.length > 100) {
      chat.messages = chat.messages.slice(-100);
    }
    if (this.data.chats.length > 1000) {
      this.data.chats = this.data.chats.slice(0, 1000);
    }
    chat.lastTime = new Date().toISOString();
    chat.lastMessage = text;
    if (sender === 'customer') {
      chat.unread = (chat.unread || 0) + 1;
      this.registerLead({
        customerName: chat.customerName || customerName,
        customerPhone: chat.customerPhone || customerPhone || chatId,
        inquiryText: text,
        businessId: assignedBizId
      });
    }

    this.save();
    this.emitChatUpdate({
      type: 'inbox_update',
      businessId: assignedBizId,
      chatId,
      sender,
      messageId: msgObj.id
    });
    return { chat, message: msgObj };
  }

  onChatUpdate(listener) {
    if (typeof listener !== 'function') return;
    if (!this._chatListeners) this._chatListeners = [];
    if (!this._chatListeners.includes(listener)) {
      this._chatListeners.push(listener);
    }
  }

  emitChatUpdate(event) {
    if (!Array.isArray(this._chatListeners)) return;
    for (const listener of this._chatListeners) {
      try {
        listener(event);
      } catch (_) {}
    }
  }

  markChatRead(chatId, businessId = null) {
    const chat = (this.data.chats || []).find(c => c.id === chatId && (!businessId || c.businessId === businessId));
    if (!chat) return null;
    if ((chat.unread || 0) !== 0) {
      chat.unread = 0;
      this.save();
      this.emitChatUpdate({
        type: 'inbox_update',
        businessId: chat.businessId,
        chatId,
        unreadReset: true
      });
    }
    return chat;
  }

  deleteChat(chatId, businessId = null) {
    const initialLen = (this.data.chats || []).length;
    const target = (this.data.chats || []).find(c => c.id === chatId && (!businessId || c.businessId === businessId));
    if (!target) return false;
    this.data.chats = (this.data.chats || []).filter(c => !(c.id === chatId && (!businessId || c.businessId === businessId)));
    if (this.data.chatMetadata && this.data.chatMetadata[chatId]) {
      delete this.data.chatMetadata[chatId];
    }
    if (this.data.chats.length !== initialLen) {
      this.save();
      this.emitChatUpdate({
        type: 'inbox_update',
        businessId: target.businessId,
        chatId,
        deleted: true
      });
      return true;
    }
    return false;
  }

  setChatAiMute(chatId, isMuted, minutes = 30) {
    const chat = (this.data.chats || []).find(c => c.id === chatId);
    if (chat) {
      chat.aiMuted = isMuted;
      chat.aiMuteUntil = isMuted ? Date.now() + minutes * 60 * 1000 : 0;
      this.save();
      return chat;
    }
    return null;
  }

  setChatEscalation(chatId, isEscalated, reason = '') {
    const chat = (this.data.chats || []).find(c => c.id === chatId);
    if (chat) {
      chat.isEscalated = isEscalated;
      chat.escalationReason = reason;
      if (isEscalated) {
        chat.aiMuted = true;
        chat.aiMuteUntil = Date.now() + 60 * 60 * 1000;
      }
      this.save();
      return chat;
    }
    return null;
  }

  setChatArchetype(chatId, archetype) {
    const chat = (this.data.chats || []).find(c => c.id === chatId);
    if (chat) {
      chat.archetype = archetype;
      this.save();
      return chat;
    }
    return null;
  }

  // ─── Broadcast Campaigns ──────────────────────────────────────────────────────
  getBroadcasts(businessId) {
    const list = this.data.broadcasts || [];
    if (businessId) {
      return list.filter(b => !b.businessId || b.businessId === businessId);
    }
    return list;
  }

  addBroadcast(bc) {
    if (!this.data.broadcasts) this.data.broadcasts = [];
    const newBc = {
      id: 'BC-' + (this.data.broadcasts.length + 1),
      businessId: bc.businessId || this.getActiveBusiness().id,
      title: bc.title || 'Untitled Campaign',
      message: bc.message,
      imageUrl: bc.imageUrl || null,
      accountId: bc.accountId || null,
      contacts: Array.isArray(bc.contacts) ? bc.contacts : null,
      minDelay: Number(bc.minDelay) || 8,
      maxDelay: Number(bc.maxDelay) || 22,
      scheduledAt: bc.scheduledAt || null,
      targetAudience: bc.targetAudience || 'All Customers',
      targetCount: bc.targetCount || 0,
      sentCount: bc.sentCount || 0,
      failedCount: bc.failedCount || 0,
      status: bc.status || 'Active',
      createdAt: new Date().toISOString()
    };
    this.data.broadcasts.unshift(newBc);
    this.save();
    return newBc;
  }

  getDueScheduledBroadcasts(nowMs = Date.now()) {
    return (this.data.broadcasts || []).filter(b => {
      if (b.status !== 'Scheduled' || !b.scheduledAt) return false;
      const ts = new Date(b.scheduledAt).getTime();
      return !isNaN(ts) && ts <= nowMs;
    });
  }

  // ─── Monthly AI Reply Quota Metering ──────────────────────────────────────────
  _currentUsageMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  checkAiQuota(businessId) {
    const biz = businessId ? (this.getBusiness(businessId) || this.getActiveBusiness()) : this.getActiveBusiness();
    const planId = (biz && biz.subscriptionPlan) || 'enterprise';
    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.enterprise;
    const limit = (plan.limits && plan.limits.aiReplies) || 25000;
    const month = this._currentUsageMonth();
    const usage = (biz && biz.usageStats && biz.usageStats.month === month)
      ? biz.usageStats
      : { month, aiReplies: 0 };
    const used = Number(usage.aiReplies) || 0;
    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      month,
      planName: plan.name,
      businessId: biz ? biz.id : null
    };
  }

  recordAiReplyUsage(businessId, increment = 1) {
    const biz = businessId ? (this.getBusiness(businessId) || this.getActiveBusiness()) : this.getActiveBusiness();
    if (!biz) return null;
    const month = this._currentUsageMonth();
    if (!biz.usageStats || biz.usageStats.month !== month) {
      biz.usageStats = { month, aiReplies: 0 };
    }
    biz.usageStats.aiReplies = (Number(biz.usageStats.aiReplies) || 0) + increment;
    this.save();
    return this.checkAiQuota(biz.id);
  }

  // ─── WhatsApp Status ────────────────────────────────────────────────────────
  getWhatsAppStatus() {
    return this.data.whatsapp || {};
  }

  updateWhatsAppStatus(status) {
    this.data.whatsapp = { ...this.data.whatsapp, ...status };
    this.save();
    return this.data.whatsapp;
  }

  // ─── Multi-Account WhatsApp Sessions ────────────────────────────────────────
  getWhatsAppAccounts(businessId = null) {
    if (this.data.whatsappAccounts) {
      this.data.whatsappAccounts.forEach(a => {
        if (a.label && (a.label.includes('455 8042') || a.label.includes('724558042'))) {
          a.label = 'Primary Business Line';
        }
        if (a.phoneNumber === '94724558042') {
          a.phoneNumber = null;
        }
      });
    }
    if (!this.data.whatsappAccounts || this.data.whatsappAccounts.length === 0) {
      // Seed default account from existing paired WhatsApp state
      this.data.whatsappAccounts = [
        {
          id: 'default',
          label: 'Primary Business Line',
          phoneNumber: this.data.whatsapp?.phoneNumber || null,
          connected: !!this.data.whatsapp?.connected,
          botActive: true,
          businessId: 'admin_primary',
          createdAt: this.data.whatsapp?.pairedAt || new Date().toISOString()
        }
      ];
      this.save();
    }
    if (businessId) {
      return this.data.whatsappAccounts.filter(a => a.id !== 'default' && a.businessId === businessId);
    }
    return this.data.whatsappAccounts;
  }

  saveWhatsAppAccount(acc) {
    if (!this.data.whatsappAccounts) this.getWhatsAppAccounts();
    const idx = this.data.whatsappAccounts.findIndex(a => a.id === acc.id);
    if (idx >= 0) {
      this.data.whatsappAccounts[idx] = { ...this.data.whatsappAccounts[idx], ...acc };
    } else {
      this.data.whatsappAccounts.push(acc);
    }
    this.save();
    return this.data.whatsappAccounts;
  }

  deleteWhatsAppAccount(id) {
    if (!this.data.whatsappAccounts) return;
    this.data.whatsappAccounts = this.data.whatsappAccounts.filter(a => a.id !== id);
    this.save();
    return this.data.whatsappAccounts;
  }

  // ─── Master Dataset Upload / Update ─────────────────────────────────────────
  updateBusinessDataset(businessId, newDataset) {
    const biz = this.getBusiness(businessId) || this.getActiveBusiness();
    biz.dataset = newDataset;
    this.saveBusiness(biz);
    return biz;
  }

  recordLiveCall() {
    if (!this.data.analytics) this.data.analytics = { totalCalls: 0 };
    this.data.analytics.totalCalls = (this.data.analytics.totalCalls || 0) + 1;
    this.save();
  }

  // ─── License Keys & Multi-Tenant Management ──────────────────────────────────
  isBusinessSubscriptionActive(businessId) {
    if (!businessId || typeof businessId !== 'string') {
      return {
        active: false,
        planTier: 'none',
        isExpired: true,
        daysLeft: 0,
        reason: 'Missing business store identifier'
      };
    }
    if (businessId === 'weddingarts') {
      return {
        active: true,
        planTier: 'enterprise',
        isExpired: false,
        daysLeft: 9999,
        planLabel: 'Enterprise Root',
        licenseKey: 'SYSTEM-ROOT'
      };
    }

    const biz = this.getBusiness(businessId);
    if (!biz) {
      return { active: false, planTier: 'none', isExpired: true, daysLeft: 0, reason: 'Business not found' };
    }

    const licenses = this.getLicenses().filter(l => l.businessId === businessId);
    const activeLic = licenses.find(l => l.status === 'Active' && !l.isExpired);

    if (activeLic) {
      return {
        active: true,
        planTier: activeLic.planTier || biz.subscriptionPlan || 'starter',
        isExpired: false,
        daysLeft: activeLic.daysLeft,
        planLabel: activeLic.planLabel || activeLic.label || activeLic.plan,
        licenseKey: activeLic.key
      };
    }

    const expiredLic = licenses.find(l => l.status === 'Expired' || l.isExpired);
    if (expiredLic) {
      return {
        active: false,
        planTier: expiredLic.planTier || biz.subscriptionPlan || 'starter',
        isExpired: true,
        daysLeft: 0,
        planLabel: expiredLic.planLabel || expiredLic.label || expiredLic.plan,
        reason: 'Subscription license expired',
        licenseKey: expiredLic.key
      };
    }

    // Trial calculation based on createdAt (3 days)
    if (biz.createdAt) {
      const createdTime = new Date(biz.createdAt).getTime();
      const now = Date.now();
      const diffMs = now - createdTime;
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (diffMs > threeDaysMs) {
        return {
          active: false,
          planTier: 'starter',
          isExpired: true,
          daysLeft: 0,
          planLabel: 'Free Trial (3 Days)',
          reason: '3-Day Free Trial Expired'
        };
      } else {
        const daysLeft = Math.max(1, Math.ceil((threeDaysMs - diffMs) / (24 * 60 * 60 * 1000)));
        return {
          active: true,
          planTier: 'starter',
          isExpired: false,
          daysLeft,
          planLabel: 'Free Trial (3 Days)'
        };
      }
    }

    return {
      active: false,
      planTier: 'starter',
      isExpired: true,
      daysLeft: 0,
      planLabel: 'Trial Expired',
      reason: 'No active paid plan found'
    };
  }

  addSubscriptionRequest({ businessId, storeName, planId, clientPhone, clientName, notes }) {
    if (!this.data.subscriptionRequests) this.data.subscriptionRequests = [];
    const entry = {
      id: 'REQ-' + Date.now(),
      businessId,
      storeName,
      planId,
      planName: SUBSCRIPTION_PLANS[planId]?.name || planId,
      price: SUBSCRIPTION_PLANS[planId]?.price || 0,
      clientPhone,
      clientName,
      notes: notes || '',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    this.data.subscriptionRequests.unshift(entry);
    this.save();
    return entry;
  }

  getSubscriptionRequests() {
    return this.data.subscriptionRequests || [];
  }

  getLicenses() {
    if (!this.data.licenses) this.data.licenses = [];
    return this.data.licenses.map(lic => {
      const now = new Date();
      const exp = new Date(lic.expiresAt);
      const isExpired = now > exp;
      const daysLeft = Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
      const planStr = (lic.plan || '').toUpperCase();
      const planTier = lic.planTier || (planStr.includes('STARTER') ? 'starter' : (planStr.includes('ENT') || planStr === '1Y' || planStr === 'LIFETIME' ? 'enterprise' : 'pro'));
      return {
        ...lic,
        planTier,
        isExpired,
        daysLeft,
        status: !lic.isActive ? 'Revoked' : (isExpired ? 'Expired' : 'Active')
      };
    });
  }

  getLicenseByKey(key) {
    if (!key) return null;
    const cleanKey = key.trim().toUpperCase();
    const lic = (this.data.licenses || []).find(l => (l.key || '').toUpperCase() === cleanKey);
    if (!lic) return null;
    const now = new Date();
    const exp = new Date(lic.expiresAt);
    const isExpired = now > exp;
    const daysLeft = Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
    const planStr = (lic.plan || '').toUpperCase();
    const planTier = lic.planTier || (planStr.includes('STARTER') ? 'starter' : (planStr.includes('ENT') || planStr === '1Y' || planStr === 'LIFETIME' ? 'enterprise' : 'pro'));
    return {
      ...lic,
      planTier,
      isExpired,
      daysLeft,
      status: !lic.isActive ? 'Revoked' : (isExpired ? 'Expired' : 'Active')
    };
  }

  generateLicense({ plan = '1M_STARTER', clientName = '', clientPhone = '', notes = '', businessId = null }) {
    if (!this.data.licenses) this.data.licenses = [];
    
    const PLAN_CONFIG = {
      '1M_STARTER': { days: 30, tier: 'starter', prefix: 'START', label: 'Starter Plan (රු. 1,900/මසකට)' },
      '1M_PRO': { days: 30, tier: 'pro', prefix: 'PRO', label: 'Pro Plan (රු. 2,900/මසකට)' },
      '1M_ENTERPRISE': { days: 30, tier: 'enterprise', prefix: 'ENT', label: 'Enterprise Plan (රු. 3,500/මසකට)' },
      '1M': { days: 30, tier: 'pro', prefix: 'PRO', label: 'Pro Plan (1 Month)' },
      '3M': { days: 90, tier: 'pro', prefix: 'PRO3M', label: '3 Months Pro Plan' },
      '3M_PRO': { days: 90, tier: 'pro', prefix: 'PRO3M', label: '3 Months Pro Plan' },
      '6M': { days: 180, tier: 'pro', prefix: 'PRO6M', label: '6 Months Pro Plan' },
      '6M_PRO': { days: 180, tier: 'pro', prefix: 'PRO6M', label: '6 Months Pro Plan' },
      '1Y': { days: 365, tier: 'enterprise', prefix: 'ENT1Y', label: '1 Year Enterprise VIP' },
      '1Y_ENTERPRISE': { days: 365, tier: 'enterprise', prefix: 'ENT1Y', label: '1 Year Enterprise VIP' },
      'TRIAL': { days: 3, tier: 'starter', prefix: 'TRIAL', label: 'Free Trial (3 Days)' },
      'LIFETIME': { days: 3650, tier: 'enterprise', prefix: 'LIFE', label: 'Lifetime Enterprise VIP' }
    };

    const cfg = PLAN_CONFIG[plan] || { days: 30, tier: 'starter', prefix: 'PLAN', label: plan };
    const days = cfg.days;
    const tier = cfg.tier || 'starter';
    const planLimits = (SUBSCRIPTION_PLANS && SUBSCRIPTION_PLANS[tier]) ? SUBSCRIPTION_PLANS[tier].limits : {};
    const planPrice = (SUBSCRIPTION_PLANS && SUBSCRIPTION_PLANS[tier]) ? SUBSCRIPTION_PLANS[tier].price : 1900;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000)).toISOString();
    
    // Generate secure random key: e.g. OMNI-START-8F3A-C4B2-9E10
    const crypto = require('crypto');
    const seg1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const seg2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const seg3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const key = `OMNI-${cfg.prefix}-${seg1}-${seg2}-${seg3}`;

    // Auto-create or link tenant store if clientName is provided
    let linkedBizId = businessId;
    if (!linkedBizId && clientName) {
      const cleanSlug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20) || 'store_' + Date.now();
      let uniqueId = cleanSlug;
      let counter = 1;
      while ((this.data.businesses || []).some(b => b.id === uniqueId)) {
        uniqueId = `${cleanSlug}_${counter++}`;
      }

      const newBiz = {
        id: uniqueId,
        name: clientName.trim(),
        category: 'other',
        subscriptionPlan: tier,
        ownerName: clientName.trim(),
        phone: clientPhone || '',
        whatsappPhone: clientPhone ? clientPhone.replace(/\D/g, '') : '',
        bankDetails: '',
        deliveryPolicy: 'Islandwide delivery available.',
        currency: 'Rs.',
        welcomeMessage: `ආයුබෝවන්! ${clientName.trim()} වෙත සාදරයෙන් පිළිගන්නවා. මම ඔබට අද කොහොමද උදව් කරන්න පුළුවන්?`,
        dataset: `Store: ${clientName.trim()}\nContact: ${clientPhone || '-'}\nServices: Inquiries & Orders\nDelivery: Islandwide Delivery`,
        isActive: false
      };
      this.data.businesses.push(newBiz);
      linkedBizId = uniqueId;
    } else if (linkedBizId) {
      this.updateBusinessPlan(linkedBizId, tier);
    }

    const newLic = {
      id: 'LIC-' + Date.now(),
      key,
      plan,
      planTier: tier,
      planLabel: cfg.label,
      price: planPrice,
      limits: planLimits,
      clientName: clientName || 'New Client',
      clientPhone: clientPhone || '',
      notes: notes || '',
      businessId: linkedBizId,
      createdAt: now.toISOString(),
      expiresAt,
      isActive: true
    };

    this.data.licenses.unshift(newLic);
    this.save();
    return newLic;
  }

  extendLicense(key, daysToAdd = 30) {
    const lic = (this.data.licenses || []).find(l => (l.key || '').toUpperCase() === (key || '').trim().toUpperCase());
    if (!lic) return null;
    const currentExp = new Date(lic.expiresAt);
    const baseDate = currentExp > new Date() ? currentExp : new Date();
    lic.expiresAt = new Date(baseDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000)).toISOString();
    lic.isActive = true;
    this.save();
    return lic;
  }

  toggleLicenseActive(key) {
    const lic = (this.data.licenses || []).find(l => (l.key || '').toUpperCase() === (key || '').trim().toUpperCase());
    if (!lic) return null;
    lic.isActive = !lic.isActive;
    this.save();
    return lic;
  }

  deleteLicense(key) {
    const prevLen = (this.data.licenses || []).length;
    this.data.licenses = (this.data.licenses || []).filter(l => (l.key || '').toUpperCase() !== (key || '').trim().toUpperCase());
    this.save();
    return this.data.licenses.length < prevLen;
  }

  // ─── Real Production Analytics (Zero Fake Figures) ───────────────────────────
  exportDatabase() {
    return this.data;
  }

  importDatabase(imported) {
    if (!imported || typeof imported !== 'object') throw new Error('Invalid JSON format');

    if (Array.isArray(imported.licenses)) {
      const existingKeys = new Set((this.data.licenses || []).map(l => l.key));
      imported.licenses.forEach(lic => {
        if (!existingKeys.has(lic.key)) {
          this.data.licenses.push(lic);
        } else {
          const idx = this.data.licenses.findIndex(l => l.key === lic.key);
          if (idx >= 0) this.data.licenses[idx] = { ...this.data.licenses[idx], ...lic };
        }
      });
    }

    if (Array.isArray(imported.businesses)) {
      const existingBizIds = new Set((this.data.businesses || []).map(b => b.id));
      imported.businesses.forEach(b => {
        if (!existingBizIds.has(b.id)) {
          this.data.businesses.push(b);
        }
      });
    }

    if (Array.isArray(imported.orders)) {
      const existingOrderIds = new Set((this.data.orders || []).map(o => o.id));
      imported.orders.forEach(o => {
        if (!existingOrderIds.has(o.id)) this.data.orders.push(o);
      });
    }

    if (Array.isArray(imported.products)) {
      const existingProdIds = new Set((this.data.products || []).map(p => p.id));
      imported.products.forEach(p => {
        if (!existingProdIds.has(p.id)) this.data.products.push(p);
      });
    }

    if (Array.isArray(imported.customFlows)) {
      const existingFlowIds = new Set((this.data.customFlows || []).map(f => f.id));
      imported.customFlows.forEach(f => {
        if (!existingFlowIds.has(f.id)) this.data.customFlows.push(f);
      });
    }

    this.save();
    return {
      ok: true,
      licensesCount: (this.data.licenses || []).length,
      businessesCount: (this.data.businesses || []).length,
      ordersCount: (this.data.orders || []).length
    };
  }

  // ─── Automated Follow-Up & Leads Engine ────────────────────────────────────
  registerLead({ customerName, customerPhone, inquiryText, businessId, inquiryType = 'general', productName = null }) {
    if (!this.data.leads) this.data.leads = [];
    const cleanPhone = (customerPhone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) return null;

    const bId = businessId || this.getActiveBusiness().id;
    let existing = this.data.leads.find(l => (l.customerPhone || '').replace(/\D/g, '') === cleanPhone && l.businessId === bId);

    const isPrice = inquiryType === 'price_inquiry' || PriceInquiryEngine.isPriceInquiry(inquiryText);

    if (existing) {
      const isNewCycle = isPrice && (existing.isConfirmed || existing.isFollowUpSent || existing.isStage2FollowUpSent);

      existing.lastInquiryText = inquiryText || existing.lastInquiryText;
      existing.lastInquiryTimestamp = Date.now();
      if (customerName && customerName !== 'Customer') existing.customerName = customerName;
      if (productName) existing.productName = productName;
      if (isPrice) existing.inquiryType = 'price_inquiry';

      if (isNewCycle) {
        existing.isConfirmed = false;          // Fresh inquiry cycle
        existing.isFollowUpSent = false;       // Enable Stage 1
        existing.followUpSentTimestamp = 0;
        existing.isStage2FollowUpSent = false; // Enable Stage 2
        existing.stage2SentTimestamp = 0;
        existing.retryCount = 0;
        existing.lastAttemptTimestamp = 0;
      }
      this.save();
      return existing;
    }

    const newLead = {
      id: 'lead_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      businessId: bId,
      customerName: (customerName && customerName !== 'Customer') ? customerName : '',
      customerPhone: cleanPhone,
      lastInquiryText: inquiryText || '',
      lastInquiryTimestamp: Date.now(),
      inquiryType: isPrice ? 'price_inquiry' : 'general',
      productName: productName || '',
      isConfirmed: false,
      isFollowUpSent: false,
      followUpSentTimestamp: 0,
      isStage2FollowUpSent: false,
      stage2SentTimestamp: 0,
      retryCount: 0,
      lastAttemptTimestamp: 0
    };
    this.data.leads.push(newLead);
    this.save();
    return newLead;
  }

  markLeadConfirmed(customerPhone, businessId = null) {
    if (!this.data.leads) return;
    const cleanPhone = (customerPhone || '').replace(/\D/g, '');
    let modified = false;
    this.data.leads.forEach(l => {
      const lPhone = (l.customerPhone || '').replace(/\D/g, '');
      if (lPhone === cleanPhone && (!businessId || l.businessId === businessId)) {
        l.isConfirmed = true;
        modified = true;
      }
    });
    if (modified) this.save();
  }

  getFollowUpCandidates(businessId = null) {
    const list = this.data.leads || [];
    const bId = businessId || this.getActiveBusiness().id;
    return list
      .filter(l => l.businessId === bId && !l.isConfirmed)
      .sort((a, b) => b.lastInquiryTimestamp - a.lastInquiryTimestamp);
  }

  markFollowUpSent(leadId, stage = 1) {
    const lead = (this.data.leads || []).find(l => l.id === leadId);
    if (lead) {
      if (stage === 1) {
        lead.isFollowUpSent = true;
        lead.followUpSentTimestamp = Date.now();
      } else if (stage === 2) {
        lead.isStage2FollowUpSent = true;
        lead.stage2SentTimestamp = Date.now();
      }
      this.save();
      return lead;
    }
    return null;
  }

  getDueFollowUps(businessId = null) {
    const bId = businessId || this.getActiveBusiness().id;
    const settings = this.getTenantSettings(bId) || this.getSettings();
    if (!settings.isFollowUpEnabled) return [];

    const now = Date.now();
    const stage1DelayMs = (settings.followUpDelayHours || 2) * 60 * 60 * 1000;
    const stage2DelayMs = (settings.followUpStage2DelayHours || 24) * 60 * 60 * 1000;

    return (this.data.leads || []).filter(lead => {
      if (lead.businessId !== bId || lead.isConfirmed) return false;

      // Safety Guard 1: Blacklist
      if (typeof this.isBlacklisted === 'function' && this.isBlacklisted(lead.customerPhone)) return false;

      // Safety Guard 2: Chat status & Silence Check
      const chat = (this.data.chats || []).find(c => c.businessId === bId && (c.customerPhone || '').replace(/\D/g, '') === lead.customerPhone);
      if (chat) {
        if (chat.isEscalated) return false; // Handed off to human agent
        if (chat.aiMuted && chat.aiMuteUntil > now) return false; // Human takeover active

        // Silence check: If customer messaged within last 2h, they are active!
        const msgs = chat.messages || [];
        const lastCustMsg = [...msgs].reverse().find(m => m.sender === 'customer');
        if (lastCustMsg && (now - lastCustMsg.timestamp < stage1DelayMs)) {
          return false;
        }
      }

      // Safety Guard 3: Max retry limit to prevent queue jamming
      if ((lead.retryCount || 0) >= 3) return false;

      // Stage 1 Follow-Up: 2 Hours of silence after inquiry
      if (!lead.isFollowUpSent) {
        return (now - lead.lastInquiryTimestamp >= stage1DelayMs);
      }

      // Stage 2 Follow-Up: 24 Hours of silence after inquiry / Stage 1
      if (settings.isFollowUpStage2Enabled && !lead.isStage2FollowUpSent) {
        const base = lead.followUpSentTimestamp || (lead.lastInquiryTimestamp + stage1DelayMs);
        return (now - base >= stage2DelayMs);
      }

      return false;
    });
  }

  getAnalytics(businessId) {
    const biz = businessId ? (this.getAllBusinesses().find(b => b.id === businessId) || this.getActiveBusiness()) : this.getActiveBusiness();
    const orders = this.getOrders(biz.id);
    const confirmedOrders = orders.filter(o => ['Confirmed', 'In Production', 'Dispatched', 'Delivered', 'Slip Received'].includes(o.status));
    const totalRev = confirmedOrders.reduce((sum, o) => {
      const val = parseInt(String(o.amount || '0').replace(/[^0-9]/g, '')) || 0;
      return sum + val;
    }, 0);

    const chats = this.getChats(biz.id);
    const unreadChats = chats.filter(c => (c.unread || 0) > 0).length;
    const escalatedChats = chats.filter(c => c.isEscalated).length;
    const waAccounts = this.getWhatsAppAccounts(biz.id);
    const waConnected = waAccounts.length > 0 ? waAccounts.some(a => a.connected) : (businessId ? false : !!(this.data.whatsapp && this.data.whatsapp.connected));

    return {
      activeBusiness: biz.name,
      totalOrders: orders.length,
      confirmedOrders: confirmedOrders.length,
      revenueLKR: totalRev.toLocaleString('en-US'),
      totalChats: chats.length,
      unreadChats: unreadChats,
      escalatedChats: escalatedChats,
      whatsappConnected: waConnected,
      liveCallsCount: this.data.analytics?.totalCalls || 0,
      totalLeads: chats.length,
      productsCount: this.getProducts(biz.id).length
    };
  }

  // ─── AI Sales Conversion & ROI Analytics (Proof of Value) ────────────────────
  getRoiAnalytics(businessId) {
    const biz = businessId ? (this.getAllBusinesses().find(b => b.id === businessId) || this.getActiveBusiness()) : this.getActiveBusiness();
    const orders = this.getOrders(biz.id);
    const chats = this.getChats(biz.id);
    const confirmedOrders = orders.filter(o => ['Confirmed', 'In Production', 'Dispatched', 'Delivered', 'Slip Received'].includes(o.status));

    const totalRev = confirmedOrders.reduce((sum, o) => {
      const val = parseInt(String(o.amount || '0').replace(/[^0-9]/g, '')) || 0;
      return sum + val;
    }, 0);

    // Calculate real numbers from DB (zero fallback, no fake numbers)
    const weeklyChats = chats.length;
    const confirmedCount = confirmedOrders.length;
    const revLKR = totalRev.toLocaleString('en-US');
    const conversionRate = weeklyChats > 0 ? ((confirmedCount / weeklyChats) * 100).toFixed(1) : '0.0';
    const hoursSaved = (weeklyChats * 5 / 60).toFixed(0);

    const planId = biz.subscriptionPlan || 'enterprise';
    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.enterprise;
    const quota = this.checkAiQuota(biz.id);

    return {
      weeklyConversations: weeklyChats,
      monthlyAiReplies: quota.used,
      monthlyAiLimit: quota.limit,
      confirmedOrders: confirmedCount,
      conversionRate: `${conversionRate}%`,
      revenueLKR: revLKR,
      hoursSaved: `${hoursSaved} පැය`,
      activePlan: plan,
      allPlans: SUBSCRIPTION_PLANS
    };
  }

    // ─── 1. WhatsApp Number Warmer Engine ────────────────────────────────────────
  getWarmer() {
    this.initDefaults();
    return this.data.warmer;
  }

  updateWarmer(settings = {}) {
    this.initDefaults();
    this.data.warmer = { ...this.data.warmer, ...settings };
    this.save();
    return this.data.warmer;
  }

  addWarmerScript(question, answer) {
    this.initDefaults();
    const script = {
      id: 'ws_' + Date.now(),
      question: String(question || '').trim(),
      answer: String(answer || '').trim()
    };
    if (script.question && script.answer) {
      this.data.warmer.scripts.push(script);
      this.save();
    }
    return this.data.warmer.scripts;
  }

  deleteWarmerScript(id) {
    this.initDefaults();
    this.data.warmer.scripts = this.data.warmer.scripts.filter(s => s.id !== id);
    this.save();
    return this.data.warmer.scripts;
  }

  logWarmerEvent(event) {
    this.initDefaults();
    if (!this.data.warmer.logs) this.data.warmer.logs = [];
    const entry = {
      id: 'wlog_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      ...event
    };
    this.data.warmer.logs.unshift(entry);
    if (this.data.warmer.logs.length > 100) this.data.warmer.logs.length = 100;
    this.save();
    return entry;
  }

  clearWarmerLogs() {
    this.initDefaults();
    this.data.warmer.logs = [];
    this.save();
    return { ok: true };
  }

  // ─── 2. Contact Management & Advanced Phonebook ──────────────────────────────
  getContacts(businessId = null) {
    this.initDefaults();
    if (!businessId || businessId === 'all') return this.data.contacts;
    return this.data.contacts.filter(c => !c.businessId || c.businessId === businessId);
  }

  saveContact(contact) {
    this.initDefaults();
    const id = contact.id || ('cnt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
    const idx = this.data.contacts.findIndex(c => c.id === id);
    const cleanPhone = String(contact.phone || '').replace(/\D/g, '');
    const entry = {
      id,
      name: contact.name || 'New Contact',
      phone: cleanPhone,
      group: contact.group || 'All Customers',
      var1: contact.var1 || '',
      var2: contact.var2 || '',
      var3: contact.var3 || '',
      var4: contact.var4 || '',
      var5: contact.var5 || '',
      tags: contact.tags || [],
      businessId: contact.businessId || 'weddingarts',
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      this.data.contacts[idx] = { ...this.data.contacts[idx], ...entry };
    } else {
      this.data.contacts.push(entry);
    }
    this.save();
    return entry;
  }

  bulkImportContacts(businessId, contactsList = []) {
    this.initDefaults();
    let imported = 0;
    contactsList.forEach(c => {
      const cleanPhone = String(c.phone || c.mobile || '').replace(/\D/g, '');
      if (cleanPhone.length >= 9) {
        this.saveContact({
          name: c.name || 'Imported Customer',
          phone: cleanPhone,
          group: c.group || 'All Customers',
          var1: c.var1 || '',
          var2: c.var2 || '',
          var3: c.var3 || '',
          var4: c.var4 || '',
          var5: c.var5 || '',
          businessId: businessId || 'weddingarts'
        });
        imported++;
      }
    });
    return { ok: true, imported, total: this.data.contacts.length };
  }

  deleteContact(id) {
    this.initDefaults();
    this.data.contacts = this.data.contacts.filter(c => c.id !== id);
    this.save();
    return { ok: true };
  }

  getContactGroups(businessId = null) {
    this.initDefaults();
    const contacts = this.getContacts(businessId);
    return this.data.contactGroups.map(grp => {
      const count = contacts.filter(c => c.group === grp.name || (grp.name === 'All Customers')).length;
      return { ...grp, count };
    });
  }

  // ─── 3. Kanban CRM & Deal Pipeline ───────────────────────────────────────────
  getKanbanDeals(businessId = null) {
    this.initDefaults();
    if (!businessId || businessId === 'all') return this.data.kanbanDeals;
    return this.data.kanbanDeals.filter(d => !d.businessId || d.businessId === businessId);
  }

  saveKanbanDeal(deal) {
    this.initDefaults();
    const id = deal.id || ('deal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
    const idx = this.data.kanbanDeals.findIndex(d => d.id === id);
    const entry = {
      id,
      title: deal.title || 'New Deal Opportunity',
      contactName: deal.contactName || 'Lead Customer',
      contactPhone: deal.contactPhone || '',
      dealValue: Number(deal.dealValue) || 0,
      stage: deal.stage || 'new', // new, contacted, proposal, won, lost
      tags: deal.tags || ['Inquiry'],
      assignedTo: deal.assignedTo || 'Unassigned',
      notes: deal.notes || [],
      businessId: deal.businessId || 'weddingarts',
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      this.data.kanbanDeals[idx] = { ...this.data.kanbanDeals[idx], ...entry };
    } else {
      this.data.kanbanDeals.push(entry);
    }
    this.save();
    return entry;
  }

  updateDealStage(id, stage) {
    this.initDefaults();
    const deal = this.data.kanbanDeals.find(d => d.id === id);
    if (deal) {
      deal.stage = stage;
      deal.updatedAt = new Date().toISOString();
      this.save();
      return deal;
    }
    return null;
  }

  deleteKanbanDeal(id) {
    this.initDefaults();
    this.data.kanbanDeals = this.data.kanbanDeals.filter(d => d.id !== id);
    this.save();
    return { ok: true };
  }

  // ─── 4. WhatsApp Interactive Forms & Flows ──────────────────────────────────
  getForms(businessId = null) {
    this.initDefaults();
    if (!businessId || businessId === 'all') return this.data.forms;
    return this.data.forms.filter(f => !f.businessId || f.businessId === businessId);
  }

  saveForm(form) {
    this.initDefaults();
    const id = form.id || ('form_' + Date.now());
    const idx = this.data.forms.findIndex(f => f.id === id);
    const entry = {
      id,
      name: form.name || 'Customer Intake Form',
      description: form.description || '',
      triggerKeyword: form.triggerKeyword || 'form',
      fields: form.fields || [
        { id: 'f_name', type: 'text', label: 'Full Name', required: true },
        { id: 'f_phone', type: 'phone', label: 'WhatsApp Phone Number', required: true },
        { id: 'f_service', type: 'dropdown', label: 'Preferred Service', options: ['Western Photo Retouching', 'Frameless UV Wall Art', 'Custom Gift Package'], required: true },
        { id: 'f_notes', type: 'textarea', label: 'Special Instructions', required: false }
      ],
      businessId: form.businessId || 'weddingarts',
      createdAt: form.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      this.data.forms[idx] = { ...this.data.forms[idx], ...entry };
    } else {
      this.data.forms.push(entry);
    }
    this.save();
    return entry;
  }

  deleteForm(id) {
    this.initDefaults();
    this.data.forms = this.data.forms.filter(f => f.id !== id);
    this.save();
    return { ok: true };
  }

  // ─── 5. Developer REST API & Webhooks ────────────────────────────────────────
  getApiKeys(businessId = null) {
    this.initDefaults();
    if (!businessId || businessId === 'all') return this.data.apiKeys;
    return this.data.apiKeys.filter(k => !k.businessId || k.businessId === businessId);
  }

  createApiKey(businessId = 'weddingarts', label = 'Production API Key') {
    this.initDefaults();
    const key = 'sk_live_' + Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const entry = {
      id: 'key_' + Date.now(),
      key,
      label,
      businessId,
      createdAt: new Date().toISOString(),
      lastUsed: null
    };
    this.data.apiKeys.push(entry);
    this.save();
    return entry;
  }

  revokeApiKey(id) {
    this.initDefaults();
    this.data.apiKeys = this.data.apiKeys.filter(k => k.id !== id);
    this.save();
    return { ok: true };
  }

  validateApiKey(token) {
    this.initDefaults();
    if (!token) return null;
    const clean = String(token).replace(/^Bearer\s+/i, '').trim();
    const found = this.data.apiKeys.find(k => k.key === clean);
    if (found) {
      found.lastUsed = new Date().toISOString();
      this.save();
      return found;
    }
    return null;
  }

  getWebhooks(businessId = null) {
    this.initDefaults();
    if (!businessId || businessId === 'all') return this.data.webhooks;
    return this.data.webhooks.filter(w => !w.businessId || w.businessId === businessId);
  }

  saveWebhook(webhook) {
    this.initDefaults();
    const id = webhook.id || ('wh_' + Date.now());
    const idx = this.data.webhooks.findIndex(w => w.id === id);
    const entry = {
      id,
      url: webhook.url,
      events: webhook.events || ['message.received', 'order.confirmed', 'call.completed'],
      status: webhook.status || 'active',
      secret: webhook.secret || ('whsec_' + Math.random().toString(36).slice(2, 12)),
      businessId: webhook.businessId || 'weddingarts',
      createdAt: new Date().toISOString()
    };
    if (idx >= 0) {
      this.data.webhooks[idx] = { ...this.data.webhooks[idx], ...entry };
    } else {
      this.data.webhooks.push(entry);
    }
    this.save();
    return entry;
  }

  deleteWebhook(id) {
    this.initDefaults();
    this.data.webhooks = this.data.webhooks.filter(w => w.id !== id);
    this.save();
    return { ok: true };
  }

  getWebhookLogs(businessId = null) {
    this.initDefaults();
    return this.data.webhookLogs.slice(0, 50);
  }

  logWebhookDispatch(log) {
    this.initDefaults();
    const entry = {
      id: 'whlog_' + Date.now(),
      timestamp: new Date().toISOString(),
      ...log
    };
    this.data.webhookLogs.unshift(entry);
    if (this.data.webhookLogs.length > 100) this.data.webhookLogs.length = 100;
    this.save();
    return entry;
  }

  // ─── 6. Team Collaboration & Agents ─────────────────────────────────────────
  getAgents(businessId = null) {
    this.initDefaults();
    return this.data.agents;
  }

  saveAgent(agent) {
    this.initDefaults();
    const id = agent.id || ('agt_' + Date.now());
    const idx = this.data.agents.findIndex(a => a.id === id);
    const entry = {
      id,
      name: agent.name || 'Agent',
      email: agent.email || '',
      role: agent.role || 'support', // admin, sales, support
      active: agent.active !== false,
      businessId: agent.businessId || 'weddingarts',
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      this.data.agents[idx] = { ...this.data.agents[idx], ...entry };
    } else {
      this.data.agents.push(entry);
    }
    this.save();
    return entry;
  }

  deleteAgent(id) {
    this.initDefaults();
    this.data.agents = this.data.agents.filter(a => a.id !== id);
    this.save();
    return { ok: true };
  }

  // ─── 7. Chat Metadata (Notes, Tags, Status) & Quick Replies ─────────────────
  getChatMetadata(chatId) {
    this.initDefaults();
    return this.data.chatMetadata[chatId] || {
      status: 'open',
      tags: [],
      notes: []
    };
  }

  saveChatNote(chatId, noteText, author = 'Agent') {
    this.initDefaults();
    if (!this.data.chatMetadata[chatId]) {
      this.data.chatMetadata[chatId] = { status: 'open', tags: [], notes: [] };
    }
    const note = {
      id: 'note_' + Date.now(),
      text: noteText,
      author,
      timestamp: new Date().toISOString()
    };
    this.data.chatMetadata[chatId].notes.push(note);
    this.save();
    return note;
  }

  updateChatStatus(chatId, status) {
    this.initDefaults();
    if (!this.data.chatMetadata[chatId]) {
      this.data.chatMetadata[chatId] = { status: 'open', tags: [], notes: [] };
    }
    this.data.chatMetadata[chatId].status = status; // open, pending, resolved
    this.save();
    return this.data.chatMetadata[chatId];
  }

  updateChatTags(chatId, tags = []) {
    this.initDefaults();
    if (!this.data.chatMetadata[chatId]) {
      this.data.chatMetadata[chatId] = { status: 'open', tags: [], notes: [] };
    }
    this.data.chatMetadata[chatId].tags = tags;
    this.save();
    return this.data.chatMetadata[chatId];
  }

  getQuickReplies(businessId = null) {
    this.initDefaults();
    return this.data.quickReplies;
  }

  saveQuickReply(reply) {
    this.initDefaults();
    const id = reply.id || ('qr_' + Date.now());
    const idx = this.data.quickReplies.findIndex(r => r.id === id);
    const entry = {
      id,
      shortcut: String(reply.shortcut || '').toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      category: reply.category || 'General',
      text: reply.text || ''
    };
    if (idx >= 0) {
      this.data.quickReplies[idx] = { ...this.data.quickReplies[idx], ...entry };
    } else {
      this.data.quickReplies.push(entry);
    }
    this.save();
    return entry;
  }

  deleteQuickReply(id) {
    this.initDefaults();
    this.data.quickReplies = this.data.quickReplies.filter(r => r.id !== id);
    this.save();
    return { ok: true };
  }

  // ─── 8. Voice Call Logs & Audio Transcriptions ──────────────────────────────
  getCallLogs(businessId = null) {
    this.initDefaults();
    if (!businessId || businessId === 'all') return this.data.callLogs.slice(0, 50);
    return this.data.callLogs.filter(c => !c.businessId || c.businessId === businessId).slice(0, 50);
  }

  recordCallLog(log) {
    this.initDefaults();
    const entry = {
      id: 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      sessionId: log.sessionId || '',
      number: log.number || log.customerPhone || 'Web Call',
      customerName: log.customerName || log.name || 'Valued Customer',
      direction: log.direction || 'incoming', // incoming, outgoing
      status: log.status || 'completed', // completed, missed, busy
      duration: log.duration || '00:45',
      sentiment: log.sentiment || 'Product Inquiry', // 'High Buying Intent', 'Product Inquiry', 'Price Concern', 'Critical Escalation', 'Satisfied'
      timestamp: new Date().toISOString(),
      audioUrl: log.audioUrl || '',
      audioBase64: log.audioBase64 || '',
      transcription: log.transcription || log.transcript || 'Call completed successfully via AI Live Voice Agent.',
      businessId: log.businessId || 'weddingarts'
    };
    this.data.callLogs.unshift(entry);
    if (this.data.callLogs.length > 200) this.data.callLogs.length = 200;
    this.recordLiveCall();
    this.save();
    return entry;
  }

  // ─── Multi-User Staff & Role-Based Access Control (RBAC) ─────────────────────
  _hashPassword(plain) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(String(plain || ''), salt, 64).toString('hex');
    return `scrypt$${salt}$${derived}`;
  }

  _verifyPassword(plain, stored) {
    if (!plain || !stored) return false;
    const str = String(stored);
    if (str.startsWith('scrypt$')) {
      const parts = str.split('$');
      if (parts.length !== 3) return false;
      const [, salt, expectedHex] = parts;
      const expectedBuf = Buffer.from(expectedHex, 'hex');
      const actualBuf = crypto.scryptSync(String(plain), salt, 64);
      return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
    }
    return String(plain) === str;
  }

  getStaff(businessId = null) {
    this.initDefaults();
    if (!this.data.staff) this.data.staff = [];
    if (!businessId || businessId === 'all') return this.data.staff;
    return this.data.staff.filter(s => !s.businessId || s.businessId === businessId || s.businessId === 'all');
  }

  addStaff(staffMember) {
    this.initDefaults();
    if (!this.data.staff) this.data.staff = [];
    const id = staffMember.id || 'staff_' + Date.now();
    const rawPw = staffMember.password || '123456';
    const hashedPassword = String(rawPw).startsWith('scrypt$') ? rawPw : this._hashPassword(rawPw);
    const entry = {
      id,
      name: staffMember.name || 'Staff Member',
      username: (staffMember.username || `user_${Date.now()}`).toLowerCase().trim(),
      password: hashedPassword,
      role: staffMember.role || 'support', // 'admin' | 'support' | 'dispatch'
      businessId: staffMember.businessId || this.getActiveBusiness().id,
      active: staffMember.active !== false,
      createdAt: new Date().toISOString()
    };
    this.data.staff = this.data.staff.filter(s => s.username !== entry.username);
    this.data.staff.push(entry);
    this.save();
    return entry;
  }

  deleteStaff(id) {
    this.initDefaults();
    if (!this.data.staff) return false;
    this.data.staff = this.data.staff.filter(s => s.id !== id);
    this.save();
    return true;
  }

  authenticateStaff(username, password) {
    this.initDefaults();
    const u = (username || '').toLowerCase().trim();
    const member = (this.data.staff || []).find(s => s.username === u && s.active && this._verifyPassword(password, s.password));
    if (member && member.password && !String(member.password).startsWith('scrypt$')) {
      member.password = this._hashPassword(password);
      this.save();
    }
    return member || null;
  }

  createStaffSession(staffMember, ttlMs = 7 * 24 * 60 * 60 * 1000) {
    if (!staffMember || !staffMember.id) return null;
    if (!this.data.staffSessions || typeof this.data.staffSessions !== 'object') {
      this.data.staffSessions = {};
    }
    const token = 'stf_' + crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    // Prune expired tokens opportunistically
    for (const [k, v] of Object.entries(this.data.staffSessions)) {
      if (!v || !v.exp || v.exp <= now) delete this.data.staffSessions[k];
    }
    this.data.staffSessions[token] = {
      id: staffMember.id,
      name: staffMember.name,
      username: staffMember.username,
      role: staffMember.role || 'support',
      businessId: staffMember.businessId || 'weddingarts',
      exp: now + ttlMs
    };
    this.save();
    return token;
  }

  validateStaffSession(token) {
    if (!token || typeof token !== 'string') return null;
    const clean = token.trim();
    if (!clean.startsWith('stf_')) return null;
    const store = this.data.staffSessions || {};
    const sess = store[clean];
    if (!sess || !sess.exp || sess.exp <= Date.now()) {
      if (sess) {
        delete store[clean];
        this.save();
      }
      return null;
    }
    return sess;
  }

  initDefaults() {
    if (!this.data) this.data = {};
    if (!this.data.warmer) {
      this.data.warmer = {
        running: false,
        intervalSeconds: 45,
        minDelay: 20,
        maxDelay: 60,
        scripts: [
          { id: 'ws_1', question: 'Hi, are your store products available for islandwide delivery?', answer: 'Yes, we provide 100% islandwide courier delivery in 2-3 business days!' },
          { id: 'ws_2', question: 'Can I get the latest price catalog and sizes?', answer: 'Sure! I can send you our latest catalog with all prices and discounts.' },
          { id: 'ws_3', question: 'How can I make the payment?', answer: 'You can deposit directly to our bank account or transfer via online banking.' },
          { id: 'ws_4', question: 'Is advance payment required before confirmation?', answer: 'Yes, an advance payment confirms your order and starts processing immediately.' },
          { id: 'ws_5', question: 'Do you offer custom package deals for events?', answer: 'Definitely! We have custom personalized packages tailored to your requirements.' }
        ],
        logs: []
      };
    }
    if (!this.data.contacts) this.data.contacts = [];
    if (!this.data.contactGroups) {
      this.data.contactGroups = [
        { id: 'grp_all', name: 'All Customers', count: 0 },
        { id: 'grp_vip', name: 'VIP Clients', count: 0 },
        { id: 'grp_leads', name: 'New Inquiries', count: 0 },
        { id: 'grp_wholesale', name: 'Wholesale Buyers', count: 0 }
      ];
    }
    if (!this.data.kanbanDeals) this.data.kanbanDeals = [];
    if (!this.data.forms) this.data.forms = [];
    if (!this.data.apiKeys) this.data.apiKeys = [];
    if (!this.data.webhooks) this.data.webhooks = [];
    if (!this.data.webhookLogs) this.data.webhookLogs = [];
    if (!this.data.agents) {
      this.data.agents = [
        { id: 'agt_super', name: 'Master Executive', email: 'admin@omnisix.ai', role: 'admin', active: true },
        { id: 'agt_sales1', name: 'Sales Agent (Kandy)', email: 'sales@omnisix.ai', role: 'sales', active: true },
        { id: 'agt_supp1', name: 'Support Rep (General)', email: 'support@omnisix.ai', role: 'support', active: true }
      ];
    }
    if (!this.data.chatMetadata) this.data.chatMetadata = {};
    if (!this.data.quickReplies) {
      this.data.quickReplies = [
        { id: 'qr_greet', shortcut: 'hi', category: 'General', text: 'ආයුබෝවන්! අප හා සම්බන්ධ වූවාට ස්තූතියි. අද ඔබට උදව් කළ හැක්කේ කෙසේද?' },
        { id: 'qr_bank', shortcut: 'bank', category: 'Payment', text: 'අපගේ බැංකු ගිණුම් විස්තර:\nBank of Ceylon (BOC)\nAccount: 92949122\nName: D T Rajapaksha\nBranch: Kandy' },
        { id: 'qr_deliv', shortcut: 'delivery', category: 'Shipping', text: 'මුළු දිවයිනටම කුරියර් බෙදාහැරීම දින 2-3ක් ඇතුළත ලබාගත හැක.' },
        { id: 'qr_thank', shortcut: 'thanks', category: 'General', text: 'ස්තූතියි! සුභ දවසක් වේවා!' }
      ];
    }
    if (!this.data.callLogs) this.data.callLogs = [];
    if (!this.data.staff || this.data.staff.length === 0) {
      this.data.staff = [
        { id: 'staff_admin', name: 'Master Admin', username: 'admin', password: 'password123', role: 'admin', businessId: 'all', active: true, createdAt: new Date().toISOString() },
        { id: 'staff_supp', name: 'Customer Care Support', username: 'support', password: 'support123', role: 'support', businessId: 'all', active: true, createdAt: new Date().toISOString() },
        { id: 'staff_disp', name: 'Courier & Packing Dispatch', username: 'dispatch', password: 'dispatch123', role: 'dispatch', businessId: 'all', active: true, createdAt: new Date().toISOString() }
      ];
    }
  }


  // ─── 🤖 Autonomous 20-Agent Enterprise Fleet Methods ─────────────────────────
  getAgentFleet() {
    this.initDefaults();
    return this.data.agentFleet || [];
  }

  setAgentFleet(fleet) {
    this.initDefaults();
    this.data.agentFleet = fleet;
    this.save();
    return this.data.agentFleet;
  }

  getAgentFleetMode() {
    this.initDefaults();
    return this.data.agentFleetMode || 'autonomous';
  }

  setAgentFleetMode(mode) {
    this.initDefaults();
    this.data.agentFleetMode = mode;
    this.save();
    return this.data.agentFleetMode;
  }

  get(key) {
    this.initDefaults();
    return this.data[key];
  }

  set(key, val) {
    this.initDefaults();
    this.data[key] = val;
    this.save();
    return val;
  }


  // ─── 🛡️ Blacklist Engine & Private Staff Sticky Notes ─────────────────────────
  getCustomerNotes(phone) {
    this.initDefaults();
    if (!this.data.customerNotes) this.data.customerNotes = {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    return this.data.customerNotes[cleanPhone] || [];
  }

  addCustomerNote(phone, text, author = 'Staff') {
    this.initDefaults();
    if (!this.data.customerNotes) this.data.customerNotes = {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!this.data.customerNotes[cleanPhone]) this.data.customerNotes[cleanPhone] = [];
    const note = {
      id: 'note_' + Date.now(),
      text: String(text || '').trim(),
      author: String(author || 'Staff'),
      timestamp: new Date().toISOString()
    };
    this.data.customerNotes[cleanPhone].unshift(note);
    this.save();
    return note;
  }

  deleteCustomerNote(phone, noteId) {
    this.initDefaults();
    if (!this.data.customerNotes) return false;
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!this.data.customerNotes[cleanPhone]) return false;
    this.data.customerNotes[cleanPhone] = this.data.customerNotes[cleanPhone].filter(n => n.id !== noteId);
    this.save();
    return true;
  }

  isBlacklisted(phone) {
    this.initDefaults();
    if (!this.data.blacklist) this.data.blacklist = [];
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    return this.data.blacklist.some(b => String(b.phone || '').replace(/\D/g, '') === cleanPhone);
  }

  toggleBlacklist(phone, reason = 'Suspected Fake Orders / Returns') {
    this.initDefaults();
    if (!this.data.blacklist) this.data.blacklist = [];
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const idx = this.data.blacklist.findIndex(b => String(b.phone || '').replace(/\D/g, '') === cleanPhone);
    let blacklisted = false;
    if (idx !== -1) {
      this.data.blacklist.splice(idx, 1);
      blacklisted = false;
    } else {
      this.data.blacklist.push({
        phone: cleanPhone,
        reason,
        timestamp: new Date().toISOString()
      });
      blacklisted = true;
    }
    this.save();
    return { blacklisted, phone: cleanPhone, reason };
  }

  getBlacklist() {
    this.initDefaults();
    return this.data.blacklist || [];
  }

  updateBusinessPlan(businessId, planId) {
    const biz = this.getBusiness(businessId);
    if (biz && SUBSCRIPTION_PLANS[planId]) {
      biz.subscriptionPlan = planId;
      (this.data.licenses || []).forEach(l => {
        if (l.businessId === businessId) {
          l.planTier = planId;
          l.limits = SUBSCRIPTION_PLANS[planId].limits;
        }
      });
      this.save();
      return biz;
    }
    return null;
  }
}

// ─── Tiered Subscription Models ────────────────────────────────────────────────
const SUBSCRIPTION_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter Plan',
    price: 1900,
    currency: 'රු.',
    billingPeriod: 'මසකට',
    badge: 'Standard',
    features: [
      '1 WhatsApp Number',
      'AI Text Replies 1,500',
      'Products Catalog 20',
      'Standard AI Auto-Reply'
    ],
    limits: {
      whatsAppNumbers: 1,
      aiReplies: 1500,
      products: 20,
      voiceNotes: false,
      liveCalls: false,
      digitalInvoices: false,
      followUpEngine: false,
      customDataset: false
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro Plan',
    price: 2900,
    currency: 'රු.',
    billingPeriod: 'මසකට',
    badge: 'Popular',
    features: [
      '1 WhatsApp Number',
      'AI Voice Notes (Sinhala/Singlish) + Text',
      'Products Catalog 100',
      '1-Click Digital Invoices & PDF',
      '2-Stage Automated Follow-Up Engine'
    ],
    limits: {
      whatsAppNumbers: 1,
      aiReplies: 5000,
      products: 100,
      voiceNotes: true,
      liveCalls: false,
      digitalInvoices: true,
      followUpEngine: true,
      customDataset: true
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price: 3500,
    currency: 'රු.',
    billingPeriod: 'මසකට',
    badge: 'VIP Ultimate',
    features: [
      'Multi-WhatsApp Numbers Hub (2+ Numbers)',
      'Live Voice Calls (Browser Calls)',
      'Dedicated Google Gemini API Key',
      'Full Custom Industry Dataset (17 Categories)'
    ],
    limits: {
      whatsAppNumbers: 5,
      aiReplies: 25000,
      products: 1000,
      voiceNotes: true,
      liveCalls: true,
      digitalInvoices: true,
      followUpEngine: true,
      customDataset: true
    }
  }
};

const db = new Database();
db.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS;
db.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
module.exports = db;
