// ─── Universal Multi-Business Database Engine ────────────────────────────────
// Persistent JSON Storage for Omnichannel AI Agent (Businesses, Orders, Chats, Products, Broadcasts)

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}

// ─── Default Business Presets ─────────────────────────────────────────────────
const DEFAULT_BUSINESSES = [
  {
    id: 'weddingarts',
    name: 'WEDDING ARTS',
    category: 'studio',
    ownerName: 'D T Rajapaksha (Tharindu)',
    phone: '076 210 7801',
    whatsappPhone: '94762107801',
    bankDetails: 'Bank of Ceylon (BOC) | Account: 92949122 | Name: D T Rajapaksha',
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
  },
  {
    id: 'urbanstyle',
    name: 'URBAN STYLE FASHION',
    category: 'fashion',
    ownerName: 'Kasun Perera',
    phone: '077 123 4567',
    whatsappPhone: '94771234567',
    bankDetails: 'Commercial Bank | Account: 8001234567 | Name: Urban Style PVT LTD',
    deliveryPolicy: 'Cash on Delivery (COD) islandwide Rs. 350. Free delivery for orders over Rs. 6,000. 2-4 days delivery.',
    currency: 'Rs.',
    welcomeMessage: 'Hi! Urban Style Fashion වෙත සාදරයෙන් පිළිගන්නවා. අලුත්ම ඇඳුම් විලාසිතා ගැන විස්තර දැනගන්න පුළුවන්.',
    dataset: `Store: URBAN STYLE FASHION
Owner: Kasun Perera
Commercial Bank Account: 8001234567
Contact / WhatsApp: 077 123 4567

COLLECTION & PRICES:
- Linen Floral Maxi Dress: Rs. 3,850 (Sizes: S, M, L, XL | Colors: Maroon, Teal, Beige)
- Men's Premium Casual Slim Shirt: Rs. 2,950 (Sizes: M, L, XL | Colors: Navy, White, Olive)
- Crop Top & High-Waist Wide Pants Set: Rs. 4,200 (Sizes: Free Size fits S-L | Colors: Black, Sage Green)
- Oversized Unisex Graphic Tees: Rs. 1,850 (Sizes: M, L, XL, XXL | 100% Cotton)
- Casual Denim Jumpsuit: Rs. 4,500 (Sizes: S, M, L)

DELIVERY & RETURNS:
- Islandwide Cash on Delivery (COD): Rs. 350
- Orders over Rs. 6,000: Free Delivery
- Exchange policy: 7 days size exchange available.`,
    isActive: false
  },
  {
    id: 'royalcakes',
    name: 'ROYAL CAKES & BAKES',
    category: 'food',
    ownerName: 'Nimasha Fernando',
    phone: '071 987 6543',
    whatsappPhone: '94719876543',
    bankDetails: 'Sampath Bank | Account: 1009876543 | Name: Royal Cakes',
    deliveryPolicy: 'Delivery across Colombo & suburbs within 24 hours. Custom cakes require 24 hours prior booking.',
    currency: 'Rs.',
    welcomeMessage: 'ආයුබෝවන්! Royal Cakes වෙත සාදරයෙන් පිළිගන්නවා. ඔබට අවශ්‍ය රසවත් කේක් හෝ බේකරි නිෂ්පාදන ඇණවුම් කරන්න පුළුවන්.',
    dataset: `Store: ROYAL CAKES & BAKES
Owner: Nimasha Fernando
Sampath Bank Account: 1009876543
Contact / WhatsApp: 071 987 6543

CAKES & PRICES:
- Signature Ribbon Birthday Cake (1kg): Rs. 3,200 | (2kg): Rs. 5,800
- Belgian Chocolate Fudge Drip Cake (1.5kg): Rs. 4,800
- Classic Black Forest Gateau (1kg): Rs. 3,900
- Red Velvet Cream Cheese Heart Cake (1kg): Rs. 4,500
- Box of 6 Decorated Cupcakes: Rs. 1,500
- Box of 12 Éclairs / Brownies: Rs. 2,400

CUSTOMIZATION & DELIVERY:
- Free personalized icing message on all cakes!
- Advance notice: At least 24 hours required for custom birthday/wedding cakes.
- Delivery: Colombo 1-15 (Rs. 300), Suburbs (Rs. 450). Free pickup available.`,
    isActive: false
  },
  {
    id: 'techzone',
    name: 'TECHZONE GADGETS',
    category: 'electronics',
    ownerName: 'Malik Jayawardena',
    phone: '075 555 8899',
    whatsappPhone: '94755558899',
    bankDetails: 'Hatton National Bank (HNB) | Account: 0300123499 | Name: TechZone Electronics',
    deliveryPolicy: 'Prompt 1-2 days delivery. 6-Month One-to-One replacement warranty on all electronics.',
    currency: 'Rs.',
    welcomeMessage: 'Welcome to TechZone! How can we assist you with mobile accessories and gadgets today?',
    dataset: `Store: TECHZONE GADGETS
Owner: Malik Jayawardena
HNB Bank Account: 0300123499
Contact / WhatsApp: 075 555 8899

PRODUCTS & PRICES:
- 20W PD Fast Charger (iPhone & Type-C): Rs. 2,450 (6 Months Warranty)
- TWS Wireless Bluetooth Gaming Earbuds: Rs. 3,950 (Low Latency, 24h Playtime)
- 10,000mAh Ultra-Slim Fast Power Bank: Rs. 4,800 (Dual Output)
- 9D Edge-to-Edge Tempered Glass: Rs. 1,200
- MagSafe Magnetic Wireless Car Mount: Rs. 2,800
- Braided Heavy Duty 60W Type-C Cable: Rs. 950

DELIVERY & WARRANTY:
- Islandwide Courier: Rs. 350 | Cash on Delivery available.
- All electronics covered with 6-month replacement warranty.`,
    isActive: false
  },
  {
    id: 'glamour_salon',
    name: 'GLAMOUR SALON & SPA',
    category: 'salon',
    ownerName: 'Dr. Senuri Wickramasinghe',
    phone: '070 333 4455',
    whatsappPhone: '94703334455',
    bankDetails: 'Nations Trust Bank | Account: 0200888999 | Name: Glamour Beauty Studio',
    deliveryPolicy: 'Appointment-based service. Open Tuesday to Sunday, 9:00 AM - 7:00 PM.',
    currency: 'Rs.',
    welcomeMessage: 'ආයුබෝවන්! Glamour Salon වෙත සාදරයෙන් පිළිගන්නවා. ඔබට Hair, Skin හෝ Bridal සේවාවක් වෙන්කරවා ගැනීමට අවශ්‍යද?',
    dataset: `Store: GLAMOUR SALON & SPA
Owner: Dr. Senuri Wickramasinghe
Contact / WhatsApp: 070 333 4455

SERVICES & CHARGES:
- Hair Keratin Protein Treatment: Rs. 8,500 (Short) | Rs. 14,000 (Medium) | Rs. 18,000 (Long)
- Full Face Clean-up & 24K Gold Glow Facial: Rs. 4,500
- Spa Manicure & Gel Pedicure with Nail Art: Rs. 3,500
- Professional Hair Color & Highlights: Rs. 6,500 - Rs. 12,000
- Complete Party Hair Styling & Make-up: Rs. 6,000
- Bridal Dressing Consultation & Trial: Rs. 5,000

BOOKINGS & HOURS:
- Open Tuesday to Sunday: 9:00 AM - 7:00 PM (Closed on Mondays)
- Prior reservation required to avoid waiting time. Send name & preferred time.`,
    isActive: false
  }
];

const DEFAULT_ORDERS = [
  {
    id: 'ORD-1001',
    businessId: 'weddingarts',
    customerName: 'Kamal Perera',
    customerPhone: '077 456 7890',
    item: '16x24 UV Gloss Frameless',
    amount: '7,800',
    address: 'No 45, Temple Road, Kandy',
    paymentMethod: 'Bank of Ceylon Transfer',
    status: 'In Production',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    source: 'Live Voice Call'
  },
  {
    id: 'ORD-1002',
    businessId: 'weddingarts',
    customerName: 'Dilshan Silva',
    customerPhone: '071 888 9900',
    item: '12x18 UV Gloss Frame + Edit',
    amount: '4,800',
    address: '12/A, Galle Road, Matara',
    paymentMethod: 'Cash on Delivery',
    status: 'Dispatched',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    source: 'WhatsApp'
  },
  {
    id: 'ORD-1003',
    businessId: 'weddingarts',
    customerName: 'Chathurika Madu',
    customerPhone: '075 222 3344',
    item: '10-Photo Shoot Retouching',
    amount: '5,000',
    address: 'Colombo 07',
    paymentMethod: 'Bank Slip Sent',
    status: 'Slip Received',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    source: 'WhatsApp'
  }
];

const DEFAULT_CHATS = [
  {
    id: '94762107801',
    customerName: 'Kavindu Sandaruwan',
    customerPhone: '076 210 7801',
    aiMuted: false,
    aiMuteUntil: 0,
    unread: 0,
    lastTime: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    lastMessage: 'ඔව් මම BOC එකට payment කරලා slip එක එවන්නම්.',
    messages: [
      { id: 'm1', sender: 'customer', text: 'Hi, 16x24 UV Frame eke price kiyada?', time: '10:15 AM', timestamp: Date.now() - 1000 * 60 * 20 },
      { id: 'm2', sender: 'ai', text: 'ආයුබෝවන්! 16x24 UV Gloss Frameless එක රුපියල් 7,800ක් වෙනවා. ඒකට දිවයින පුරා නොමිලේ ඩිලිවරි (Free Courier Delivery) ලැබෙනවා.', time: '10:15 AM', timestamp: Date.now() - 1000 * 60 * 18 },
      { id: 'm3', sender: 'customer', text: 'Mata BOC bank details ewanna puluwanda?', time: '10:20 AM', timestamp: Date.now() - 1000 * 60 * 14 },
      { id: 'm4', sender: 'ai', text: 'අපගේ BOC ගිණුම් අංකය 92949122, නම D T Rajapaksha. මුදල් තැන්පත් කර රිසිට්පත මෙහි එවන්න.', time: '10:20 AM', timestamp: Date.now() - 1000 * 60 * 13 },
      { id: 'm5', sender: 'customer', text: 'ඔව් මම BOC එකට payment කරලා slip එක එවන්නම්.', time: '10:22 AM', timestamp: Date.now() - 1000 * 60 * 12 }
    ]
  },
  {
    id: '94775551234',
    customerName: 'Rashmi Senanayake',
    customerPhone: '077 555 1234',
    aiMuted: true,
    aiMuteUntil: Date.now() + 3600000,
    unread: 1,
    lastTime: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    lastMessage: 'Wedding shoot package eka customize karaganna puluwanda?',
    messages: [
      { id: 'm11', sender: 'customer', text: 'Wedding shoot package eka customize karaganna puluwanda?', time: '10:45 AM', timestamp: Date.now() - 1000 * 60 * 5 }
    ]
  }
];

// ─── Database Class ───────────────────────────────────────────────────────────
class Database {
  constructor() {
    this.data = {
      businesses: DEFAULT_BUSINESSES,
      orders: DEFAULT_ORDERS,
      chats: DEFAULT_CHATS,
      broadcasts: [
        {
          id: 'BC-1',
          businessId: 'weddingarts',
          title: 'Wedding Season 15% OFF UV Frames',
          message: 'විශේෂ මංගල වාරයේ දීමනාව! 16x24 සහ 20x30 UV Frames සඳහා 15% ක විශේෂ වට්ටමක් සහ නොමිලේ දිවයින පුරා බෙදාහැරීම. අදම ඇණවුම් කරන්න!',
          targetCount: 142,
          sentCount: 142,
          status: 'Completed',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ],
      whatsapp: {
        connected: false,
        phoneNumber: '076 210 7801',
        pairedAt: null,
        pairingCode: 'WED-8842',
        qrData: 'https://weddingarts-live-call.onrender.com/ws/pair',
        lastSeen: new Date().toISOString()
      },
      analytics: {
        totalCalls: 34,
        totalWhatsappMessages: 189,
        activeSessions: 2
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
          this.data = { ...this.data, ...parsed };
          if (!this.data.chats || this.data.chats.length === 0) {
            this.data.chats = [...DEFAULT_CHATS];
          }
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

  // ─── Orders Methods ──────────────────────────────────────────────────────────
  getOrders(businessId) {
    const list = businessId
      ? this.data.orders.filter(o => !o.businessId || o.businessId === businessId)
      : this.data.orders;
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  addOrder(order) {
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
      createdAt: new Date().toISOString(),
      source: order.source || 'Live Voice Call'
    };
    this.data.orders.unshift(newOrder);
    this.save();
    return newOrder;
  }

  updateOrderStatus(orderId, status) {
    const ord = this.data.orders.find(o => o.id === orderId);
    if (ord) {
      ord.status = status;
      this.save();
      return ord;
    }
    return null;
  }

  // ─── Chats & Omnichannel Inbox ───────────────────────────────────────────────
  getChats(businessId) {
    return this.data.chats.sort((a, b) => new Date(b.lastTime || 0) - new Date(a.lastTime || 0));
  }

  getChat(chatId) {
    return this.data.chats.find(c => c.id === chatId);
  }

  addChatMessage(chatId, sender, text, customerName = 'Customer', customerPhone = '') {
    let chat = this.data.chats.find(c => c.id === chatId);
    if (!chat) {
      chat = {
        id: chatId,
        customerName: customerName,
        customerPhone: customerPhone || chatId,
        aiMuted: false,
        aiMuteUntil: 0,
        unread: 0,
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
    const chat = this.data.chats.find(c => c.id === chatId);
    if (chat) {
      chat.aiMuted = isMuted;
      chat.aiMuteUntil = isMuted ? Date.now() + minutes * 60 * 1000 : 0;
      this.save();
      return chat;
    }
    return null;
  }

  // ─── Broadcasts ─────────────────────────────────────────────────────────────
  getBroadcasts(businessId) {
    return this.data.broadcasts;
  }

  addBroadcast(bc) {
    const newBc = {
      id: 'BC-' + (this.data.broadcasts.length + 1),
      businessId: bc.businessId || this.getActiveBusiness().id,
      title: bc.title || 'Untitled Campaign',
      message: bc.message,
      targetCount: bc.targetCount || 100,
      sentCount: bc.sentCount || bc.targetCount || 100,
      status: 'Completed',
      createdAt: new Date().toISOString()
    };
    this.data.broadcasts.unshift(newBc);
    this.save();
    return newBc;
  }

  // ─── WhatsApp Status ────────────────────────────────────────────────────────
  getWhatsAppStatus() {
    return this.data.whatsapp;
  }

  updateWhatsAppStatus(status) {
    this.data.whatsapp = { ...this.data.whatsapp, ...status };
    this.save();
    return this.data.whatsapp;
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────
  getAnalytics() {
    const biz = this.getActiveBusiness();
    const orders = this.getOrders(biz.id);
    const totalRev = orders.reduce((sum, o) => {
      const val = parseInt((o.amount || '0').replace(/[^0-9]/g, '')) || 0;
      return sum + val;
    }, 0);

    return {
      activeBusiness: biz.name,
      totalOrders: orders.length,
      revenueLKR: totalRev.toLocaleString('en-US'),
      totalChats: this.data.chats.length,
      whatsappConnected: this.data.whatsapp.connected,
      liveCallsCount: this.data.analytics.totalCalls,
      totalLeads: 24 + this.data.chats.length
    };
  }
}

const db = new Database();
module.exports = db;
