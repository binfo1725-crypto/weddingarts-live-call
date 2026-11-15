// ─── OmniSix Production AI Intelligence Engines ──────────────────────────────
// Ported from OmniSix Android Pro Kotlin Architecture
// Modules: Customer Archetype, Angry Escalation, Smart Upsell, Smart Negotiation, Slip Detection

// ─── 1. Customer Psychological Archetype Engine ───────────────────────────────
const CustomerArchetypeEngine = {
  BARGAIN_KEYWORDS: [
    'gana adu', 'gaana adu', 'adui', 'adutawata', 'aduwata', 'adu karanna', 'adu karannako',
    'discount', 'offer', 'bargain', 'gana wadi', 'gaana wadi', 'expensive', 'cheaper',
    'wasi', 'wasi nadda', 'last price', 'keeyatada denne', 'thawa adu', 'discount ekak',
    'aduda', 'best price', 'special price', 'sale price', 'puluwan aduma', 'aduma gana'
  ],
  IMPULSE_KEYWORDS: [
    'danma', 'danma danna', 'danma ewanna', 'ikmanata', 'ikmanta', 'urgent', 'fast delivery',
    'ada ewanna', 'ada danna', 'ada deliver', 'ada onama', 'heta udema', 'immediately',
    'send now', 'ready to buy', 'danma gannawa', 'same day', 'quick dispatch', 'now please'
  ],
  SKEPTICAL_KEYWORDS: [
    'sure da', 'sure nadda', 'boruda', 'horu', 'fake', 'original da', 'quality',
    'cod thiyenawada', 'cash on delivery', 'badu balala gewanna', 'guarantee', 'warranty',
    'damage unoth', 'return karanna puluwanda', 'replace', 'reviews', 'proof', 'awulak unoth'
  ],
  BULK_KEYWORDS: [
    'wholesale', 'bulk', 'thoga', 'thogayata', 'quantity', 'pieces', 'pcs', 'resell',
    'reseller', 'shop ekata', 'dealer', '10k gaththoth', '20k', '50k', '100k', 'thoga mila'
  ],

  classify(text) {
    const lower = (text || '').toLowerCase().trim();
    let scores = {
      BARGAIN_HUNTER: 0,
      IMPULSE_BUYER: 0,
      SKEPTICAL_BUYER: 0,
      BULK_WHOLESALE: 0
    };

    for (const kw of this.BARGAIN_KEYWORDS) if (lower.includes(kw)) scores.BARGAIN_HUNTER += 1;
    for (const kw of this.IMPULSE_KEYWORDS) if (lower.includes(kw)) scores.IMPULSE_BUYER += 1;
    for (const kw of this.SKEPTICAL_KEYWORDS) if (lower.includes(kw)) scores.SKEPTICAL_BUYER += 1;
    for (const kw of this.BULK_KEYWORDS) if (lower.includes(kw)) scores.BULK_WHOLESALE += 1;

    let highest = 'GENERAL';
    let maxVal = 0;
    for (const [arch, val] of Object.entries(scores)) {
      if (val > maxVal) {
        maxVal = val;
        highest = arch;
      }
    }

    let promptDirective = '';
    switch (highest) {
      case 'BARGAIN_HUNTER':
        promptDirective = '[PSYCHOLOGY: Customer is a Bargain Hunter. Emphasize incredible value, package savings, and exclusive limited-time bonus.]';
        break;
      case 'IMPULSE_BUYER':
        promptDirective = '[PSYCHOLOGY: Customer is an Impulse Buyer ready to checkout. Keep response ultra-short, confirm order instantly, and mention fastest courier dispatch.]';
        break;
      case 'SKEPTICAL_BUYER':
        promptDirective = '[PSYCHOLOGY: Customer is cautious/skeptical. Reassure 100% premium quality, safe packaging guarantee, and verified customer trust.]';
        break;
      case 'BULK_WHOLESALE':
        promptDirective = '[PSYCHOLOGY: Customer is inquiring about bulk/resale quantities. Offer tier pricing advantages and direct business support.]';
        break;
      default:
        promptDirective = '';
    }

    return { archetype: highest, promptDirective };
  }
};

// ─── 2. Angry Customer Escalation Engine ──────────────────────────────────────
const AngryCustomerEscalationEngine = {
  ANGRY_TRIGGERS: [
    'thama awe na', 'thama awe nane', 'parcel eka awe na', 'parcel eka ko', 'ko mage badu',
    'thama labune na', 'kawadda ewanne', 'sathiyak wenawa', 'dawas keeyakda', 'boru kiyanna epa',
    'scam', 'scammer', 'horu', 'policiyata kiyanawa', 'police', 'nadu danawa', 'wanchawak',
    'chater service', 'fake page', 'refund ona', 'refund my money', 'salli deepan', 'salli apahu',
    'call me now', 'call me immediately', 'danma call karanna', 'manager ta kiyanna', 'talk to human',
    'human agent', 'stop this bot', 'robot talk epa', 'worst service', 'terrible service',
    'damage wela', 'aparade salli', 'කෝ මගේ බඩු', 'තාම ආවේ නෑ', 'බොරු කරන්න එපා', 'වංචා', 'රිෆන්ඩ්'
  ],

  check(text) {
    const lower = (text || '').toLowerCase().trim();
    for (const kw of this.ANGRY_TRIGGERS) {
      if (lower.includes(kw)) {
        return {
          isAngry: true,
          trigger: kw,
          deEscalationReply: 'සමාවෙන්න සහෝදරයා / අක්කේ ඔබට සිදු වූ අපහසුතාවයට. මම මේ පිළිබඳව අපේ Store Owner / Management වෙත දැන්ම දැනුම් දුන්නා. අපේ කණ්ඩායමෙන් කෙනෙක් මිනිත්තු කිහිපයක් ඇතුළත සෘජුවම ඔබ හා සම්බන්ධ වෙනවා ඇත.'
        };
      }
    }
    return { isAngry: false };
  }
};

// ─── 3. Smart Dynamic Negotiation Engine ──────────────────────────────────────
const SmartNegotiationEngine = {
  isBargaining(text) {
    const lower = (text || '').toLowerCase().trim();
    return CustomerArchetypeEngine.BARGAIN_KEYWORDS.some(kw => lower.includes(kw));
  },

  getNegotiationDirective(turnCount = 1) {
    if (turnCount === 1) {
      return '[NEGOTIATION TURN 1: Politely highlight superior UV Gloss durability and craftsmanship. Offer a gentle polite concession of around 5% or free gift retouch.]';
    } else if (turnCount === 2) {
      return '[NEGOTIATION TURN 2: If customer pushes further, offer a 2-item bundle deal with 100% Free Island-wide Delivery instead of dropping single unit price.]';
    } else {
      return '[NEGOTIATION TURN 3+: Enforce strict floor price. Firmly and courteously state this is the lowest direct factory price available for this premium quality.]';
    }
  }
};

// ─── 4. Smart Upsell Engine ───────────────────────────────────────────────────
const SmartUpsellEngine = {
  detectUpsellOpportunity(userText, activeProducts = []) {
    const lower = (userText || '').toLowerCase();
    
    // Photo Edit -> 10-Shoot Retouch bundle
    if (lower.includes('photo edit') || lower.includes('single edit') || lower.includes('retouch')) {
      return '\n[UPSELL TIP: Suggest the 10-Photo Retouching Shoot Bundle for only Rs. 5,000 (saving Rs. 10,000 compared to single photo edits).]';
    }

    // 12x18 Frame -> 16x24 UV Frame with Free Delivery
    if (lower.includes('12x18') || lower.includes('dolahai')) {
      return '\n[UPSELL TIP: Suggest the grand 16x24 UV Gloss Frameless at Rs. 7,800 which includes 100% FREE Islandwide Courier Delivery (saving delivery cost).]';
    }

    // 16x24 -> 3-Panel Wall Set
    if (lower.includes('16x24') || lower.includes('dahashayai')) {
      return '\n[UPSELL TIP: Mention our luxury 3-Panel Wall Gallery Set (Rs. 14,000 with Free Delivery) for master living rooms and wedding bedrooms.]';
    }

    return '';
  }
};

// ─── 5. Bank Slip & Payment Detection ─────────────────────────────────────────
const SlipDetectionEngine = {
  SLIP_TRIGGERS: [
    'slip', 'slip eka', 'receipt', 'payment kala', 'payment kara', 'gewwa', 'paid', 'transfer kala',
    'transfer kara', 'boc slip', 'hnb slip', 'slip demma', 'salli demma', 'screenshot', 'රිසිට්', 'ස්ලිප්'
  ],

  isSlipSubmission(text) {
    const lower = (text || '').toLowerCase().trim();
    return this.SLIP_TRIGGERS.some(kw => lower.includes(kw));
  }
};

module.exports = {
  CustomerArchetypeEngine,
  AngryCustomerEscalationEngine,
  SmartNegotiationEngine,
  SmartUpsellEngine,
  SlipDetectionEngine
};
