// ─── Universal Multi-Business Database Engine (Production Clean) ─────────────
// Real Production Database for Omnichannel AI Agent
// Supports Multi-Business, Products Catalog, Custom Keyword Flows, Orders Pipeline,
// Live Chats Inbox, Safe Broadcasts, and Settings. ZERO DEMO / FAKE DATA.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

// ─── Business Presets ─────────────────────────────────────────────────────────
const DEFAULT_BUSINESSES = [
  {
    id: 'weddingarts',
    name: 'WEDDING ARTS',
    category: 'studio',
    ownerName: 'D T Rajapaksha (Tharindu)',
    phone: '076 210 7801',
    whatsappPhone: '94762107801',
    bankDetails: 'Bank of Ceylon (BOC) | Account: 92949122 | Name: D T Rajapaksha | Branch: Kandy',
    deliveryPolicy: 'Islandwide Courier Delivery available. Free delivery on 16x24 and above. 2-3 business days.',
    currency: 'Rs.',
    welcomeMessage: 'ආයුබෝවන්! Wedding Arts වෙත සාදරයෙන් පිළිගන්නවා. මම ඔබට අද කොහොමද උදව් කරන්න පුළුවන්?',
    dataset: `Store: WEDDING ARTS
Owner: D T Rajapaksha (Tharindu)
BOC Bank Account: 92949122
Contact / WhatsApp: 076 210 7801

PRODUCTS & SERVICES:
- Western / Kandyan Single Photo Edit: Rs. 1,500
- 10-Photo Shoot Retouching: Rs. 5,000
- Army Uniform Single Photo Edit: Rs. 2,000
- Army Uniform 10-Photo Shoot: Rs. 8,000
- 8x12 UV Gloss Frameless: Rs. 2,300
- 10x15 UV Gloss Frameless: Rs. 3,200
- 12x18 UV Gloss Frameless: Rs. 4,800
- 16x24 UV Gloss Frameless: Rs. 7,800 (FREE Island-wide Courier Delivery)
- 20x30 UV Gloss Frameless: Rs. 11,500 (FREE Island-wide Courier Delivery)
- 24x36 UV Gloss Frameless: Rs. 13,000 (FREE Island-wide Courier Delivery)
- 3-Panel Wall Hanging Set: Rs. 14,000 (FREE Island-wide Courier Delivery)

DELIVERY & PAYMENT:
- 12x18 and below courier delivery fee: Rs. 450
- 16x24 and above: 100% Free Island-wide Courier Delivery
- Payment: Bank of Ceylon (BOC) Account 92949122 D T Rajapaksha. Advance payment required to begin editing & printing.`,
    isActive: true
  }
];

// ─── Real Official Store Products ─────────────────────────────────────────────
const DEFAULT_PRODUCTS = [
  {
    id: 'PROD-1',
    businessId: 'weddingarts',
    name: '16x24 UV Gloss Frameless',
    category: 'UV Frames',
    price: 7800,
    cost: 4200,
    minFloorPrice: 7200,
    maxDiscountPct: 10,
    description: '16x24 inch Premium High-Gloss UV Protected Frameless Wall Portrait. 100% Free Island-wide Courier Delivery.',
    inStock: true
  },
  {
    id: 'PROD-2',
    businessId: 'weddingarts',
    name: '12x18 UV Gloss Frameless',
    category: 'UV Frames',
    price: 4800,
    cost: 2600,
    minFloorPrice: 4500,
    maxDiscountPct: 10,
    description: '12x18 inch High-Gloss UV Frameless Wall Hanging.',
    inStock: true
  },
  {
    id: 'PROD-3',
    businessId: 'weddingarts',
    name: '20x30 UV Gloss Frameless',
    category: 'UV Frames',
    price: 11500,
    cost: 6500,
    minFloorPrice: 10500,
    maxDiscountPct: 10,
    description: '20x30 inch Grand Wall Portrait UV Gloss Frameless. Free Island-wide Courier Delivery.',
    inStock: true
  },
  {
    id: 'PROD-4',
    businessId: 'weddingarts',
    name: '8x12 UV Gloss Frameless',
    category: 'UV Frames',
    price: 2300,
    cost: 1200,
    minFloorPrice: 2100,
    maxDiscountPct: 10,
    description: '8x12 inch Desk / Wall UV Gloss Frameless Photo Print.',
    inStock: true
  },
  {
    id: 'PROD-5',
    businessId: 'weddingarts',
    name: '10x15 UV Gloss Frameless',
    category: 'UV Frames',
    price: 3200,
    cost: 1700,
    minFloorPrice: 3000,
    maxDiscountPct: 10,
    description: '10x15 inch Medium UV Frameless Portrait.',
    inStock: true
  },
  {
    id: 'PROD-6',
    businessId: 'weddingarts',
    name: '3-Panel Wall Hanging Set',
    category: 'UV Frames',
    price: 14000,
    cost: 7500,
    minFloorPrice: 13000,
    maxDiscountPct: 10,
    description: '3-Piece Triptych Luxury UV Gloss Wall Gallery. Free Courier Delivery.',
    inStock: true
  },
  {
    id: 'PROD-7',
    businessId: 'weddingarts',
    name: 'Western / Kandyan Single Photo Edit',
    category: 'Photo Editing',
    price: 1500,
    cost: 200,
    minFloorPrice: 1300,
    maxDiscountPct: 15,
    description: 'High-end portrait skin retouching, background enhancement & color grading.',
    inStock: true
  },
  {
    id: 'PROD-8',
    businessId: 'weddingarts',
    name: '10-Photo Shoot Retouching Bundle',
    category: 'Photo Editing',
    price: 5000,
    cost: 1000,
    minFloorPrice: 4500,
    maxDiscountPct: 10,
    description: 'Complete 10-photo album retouching bundle. Best value for pre-shoots and weddings.',
    inStock: true
  },
  {
    id: 'PROD-9',
    businessId: 'weddingarts',
    name: 'Army / Police Uniform Photo Edit',
    category: 'Photo Editing',
    price: 2000,
    cost: 300,
    minFloorPrice: 1800,
    maxDiscountPct: 10,
    description: 'Specialized uniform portrait restoration, medal detailing & official retouching.',
    inStock: true
  }
];

// ─── Automated Keyword Flows ──────────────────────────────────────────────────
const DEFAULT_FLOWS = [
  {
    id: 'FLOW-1',
    businessId: 'weddingarts',
    trigger: 'bank',
    matchType: 'contains',
    response: '🏦 *Bank Details (Wedding Arts)*:\n\nBank: Bank of Ceylon (BOC)\nAccount: 92949122\nName: D T Rajapaksha\nBranch: Kandy City\n\n_Payment කළ පසු කරුණාකර Slip පත හෝ Screenshot එක මෙහි එවන්න._',
    isActive: true
  },
  {
    id: 'FLOW-2',
    businessId: 'weddingarts',
    trigger: 'delivery',
    matchType: 'contains',
    response: '🚚 *Delivery Information*:\n\n• 16x24, 20x30 සහ 3-Panel Sets සඳහා *100% Free Islandwide Courier Delivery*!\n• 12x18 සහ ඊට කුඩා Frames සඳහා Delivery Fee රු. 450කි.\n• දින 2-4ක් ඇතුළත ආරක්ෂිතව නිවසටම ගෙන්වා ගත හැක.',
    isActive: true
  },
  {
    id: 'FLOW-3',
    businessId: 'weddingarts',
    trigger: 'order',
    matchType: 'contains',
    response: '📦 *ඇණවුමක් ලබා දීමට අවශ්‍ය විස්තර*:\n\n1. ඔබගේ නම:\n2. ලිපිනය:\n3. දුරකථන අංක 2ක්:\n4. අවශ්‍ය Frame ප්‍රමාණය (උදා: 16x24):\n5. Print කිරීමට අවශ්‍ය පැහැදිලි ඡායාරූපය Document එකක් ලෙස මෙහි එවන්න.',
    isActive: true
  }
];

// ─── Store & AI Settings ──────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  aiPersona: 'FRIENDLY_CUSTOMER_CARE',
  aiName: 'Nethmi (OmniSix AI)',
  assistantTitle: 'Senior Customer Support Agent',
  voiceProfile: 'Leda',
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
  isAngryEscalationEnabled: true
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
      whatsappAccounts: [], // Multi-Account WhatsApp Sessions
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
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.businesses && parsed.businesses.length > 0) {
          // Remove mock demo stores: urbanstyle, royalcakes, techzone, glamour_salon
          const demoIds = ['urbanstyle', 'royalcakes', 'techzone', 'glamour_salon'];
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
          this.data.whatsappAccounts = parsed.whatsappAccounts || [];
          if (parsed.whatsapp) this.data.whatsapp = { ...this.data.whatsapp, ...parsed.whatsapp };
          if (parsed.analytics) this.data.analytics = { ...this.data.analytics, ...parsed.analytics };
        }
      } else {
        this.save();
      }
    } catch (e) {
      console.warn('[db] Failed to load DB file, using in-memory defaults:', e.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.warn('[db] Failed to save DB file:', e.message);
    }
  }

  // ─── Business Methods ────────────────────────────────────────────────────────
  getActiveBusiness() {
    const active = this.data.businesses.find(b => b.isActive);
    return active || this.data.businesses[0];
  }

  getAllBusinesses() {
    return this.data.businesses;
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
    const id = slug ? `${slug}_${Date.now().toString().slice(-4)}` : `store_${Date.now()}`;
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
    const bId = businessId || this.getActiveBusiness().id;
    return (this.data.products || []).filter(p => !p.businessId || p.businessId === bId);
  }

  addProduct(prod) {
    if (!this.data.products) this.data.products = [];
    const newProd = {
      id: 'PROD-' + (this.data.products.length + 1),
      businessId: prod.businessId || this.getActiveBusiness().id,
      name: prod.name || 'Untitled Product',
      category: prod.category || 'General',
      price: parseFloat(prod.price) || 0,
      cost: parseFloat(prod.cost) || 0,
      minFloorPrice: parseFloat(prod.minFloorPrice) || (parseFloat(prod.price) * 0.9) || 0,
      maxDiscountPct: parseInt(prod.maxDiscountPct) || 10,
      description: prod.description || '',
      inStock: prod.inStock !== false
    };
    this.data.products.push(newProd);
    this.save();
    return newProd;
  }

  updateProduct(id, updates) {
    const idx = (this.data.products || []).findIndex(p => p.id === id);
    if (idx >= 0) {
      this.data.products[idx] = { ...this.data.products[idx], ...updates };
      this.save();
      return this.data.products[idx];
    }
    return null;
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
    const bId = businessId || this.getActiveBusiness().id;
    return (this.data.customFlows || []).filter(f => !f.businessId || f.businessId === bId);
  }

  addCustomFlow(flow) {
    if (!this.data.customFlows) this.data.customFlows = [];
    const newFlow = {
      id: 'FLOW-' + (this.data.customFlows.length + 1),
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
    return this.data.settings || DEFAULT_SETTINGS;
  }

  updateSettings(updates) {
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    return this.data.settings;
  }

  // ─── Real Orders Pipeline Methods ────────────────────────────────────────────
  getOrders(businessId) {
    const list = businessId
      ? (this.data.orders || []).filter(o => !o.businessId || o.businessId === businessId)
      : (this.data.orders || []);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  addOrder(order) {
    if (!this.data.orders) this.data.orders = [];
    const newOrder = {
      id: order.id || 'ORD-' + (Math.floor(1000 + Math.random() * 9000)),
      businessId: order.businessId || this.getActiveBusiness().id,
      customerName: order.name || order.customerName || 'Customer',
      customerPhone: order.phone || order.customerPhone || '',
      item: order.item || 'Custom Order',
      amount: order.amount || '0',
      address: order.address || order.note || 'To be confirmed',
      paymentMethod: order.paymentMethod || 'Bank Transfer',
      status: order.status || 'Pending Payment',
      trackingNumber: order.trackingNumber || '',
      createdAt: new Date().toISOString(),
      source: order.source || 'Live Voice Call'
    };
    this.data.orders.unshift(newOrder);
    this.save();
    return newOrder;
  }

  updateOrderStatus(orderId, status, trackingNumber) {
    const ord = (this.data.orders || []).find(o => o.id === orderId);
    if (ord) {
      ord.status = status;
      if (trackingNumber !== undefined) ord.trackingNumber = trackingNumber;
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
  getChats(businessId) {
    return (this.data.chats || []).sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0));
  }

  getChat(chatId) {
    return (this.data.chats || []).find(c => c.id === chatId);
  }

  addChatMessage(chatId, sender, text, customerName = 'Customer', customerPhone = '') {
    if (!this.data.chats) this.data.chats = [];
    let chat = this.data.chats.find(c => c.id === chatId);
    if (!chat) {
      chat = {
        id: chatId,
        customerName: customerName,
        customerPhone: customerPhone || chatId,
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
    }

    const msgObj = {
      id: 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      sender: sender, // 'customer' | 'ai' | 'agent'
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    chat.messages.push(msgObj);
    chat.lastTime = new Date().toISOString();
    chat.lastMessage = text;
    if (sender === 'customer') chat.unread = (chat.unread || 0) + 1;

    this.save();
    return { chat, message: msgObj };
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
    return this.data.broadcasts || [];
  }

  addBroadcast(bc) {
    if (!this.data.broadcasts) this.data.broadcasts = [];
    const newBc = {
      id: 'BC-' + (this.data.broadcasts.length + 1),
      businessId: bc.businessId || this.getActiveBusiness().id,
      title: bc.title || 'Untitled Campaign',
      message: bc.message,
      targetAudience: bc.targetAudience || 'All Customers',
      targetCount: bc.targetCount || 0,
      sentCount: bc.sentCount || 0,
      status: bc.status || 'Active',
      createdAt: new Date().toISOString()
    };
    this.data.broadcasts.unshift(newBc);
    this.save();
    return newBc;
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
  getWhatsAppAccounts() {
    if (!this.data.whatsappAccounts || this.data.whatsappAccounts.length === 0) {
      // Seed default account from existing paired WhatsApp state
      this.data.whatsappAccounts = [
        {
          id: 'default',
          label: 'Primary Line (Account 1)',
          phoneNumber: this.data.whatsapp?.phoneNumber || '94724558042',
          connected: !!this.data.whatsapp?.connected,
          botActive: true,
          businessId: this.getActiveBusiness().id,
          createdAt: this.data.whatsapp?.pairedAt || new Date().toISOString()
        }
      ];
      this.save();
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

  // ─── Real Production Analytics (Zero Fake Figures) ───────────────────────────
  getAnalytics() {
    const biz = this.getActiveBusiness();
    const orders = this.getOrders(biz.id);
    const confirmedOrders = orders.filter(o => ['Confirmed', 'In Production', 'Dispatched', 'Delivered', 'Slip Received'].includes(o.status));
    const totalRev = confirmedOrders.reduce((sum, o) => {
      const val = parseInt((o.amount || '0').replace(/[^0-9]/g, '')) || 0;
      return sum + val;
    }, 0);

    const chats = this.data.chats || [];
    const unreadChats = chats.filter(c => (c.unread || 0) > 0).length;
    const escalatedChats = chats.filter(c => c.isEscalated).length;

    return {
      activeBusiness: biz.name,
      totalOrders: orders.length,
      confirmedOrders: confirmedOrders.length,
      revenueLKR: totalRev.toLocaleString('en-US'),
      totalChats: chats.length,
      unreadChats: unreadChats,
      escalatedChats: escalatedChats,
      whatsappConnected: !!(this.data.whatsapp && this.data.whatsapp.connected),
      liveCallsCount: this.data.analytics?.totalCalls || 0,
      totalLeads: chats.length,
      productsCount: (this.data.products || []).filter(p => !p.businessId || p.businessId === biz.id).length
    };
  }
}

const db = new Database();
module.exports = db;
