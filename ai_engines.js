// ─── OmniSix Production AI Intelligence Engines ──────────────────────────────
// Ported from OmniSix Android Pro Kotlin Architecture
// Modules: Customer Archetype, Angry Escalation, Smart Upsell, Smart Negotiation, Slip Detection
const {
  isDeliveryEnabled,
  buildOwnerOrderReferralReply,
  buildOwnerOrderShortCta
} = require('./deliveryPolicyHelper.js');

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

  classify(text, isDeliveryDetailsEnabled = true) {
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
        promptDirective = isDeliveryDetailsEnabled
          ? '[PSYCHOLOGY: Customer is an Impulse Buyer ready to checkout. Keep response ultra-short, confirm order instantly, and mention fastest courier dispatch.]'
          : '[PSYCHOLOGY: Customer is an Impulse Buyer ready to purchase. Keep response snappy, highlight availability, and NEVER ask for Name, Delivery Address, or Phone — direct ready buyers straight to the Store Owner contact number.]';
        break;
      case 'SKEPTICAL_BUYER':
        promptDirective = isDeliveryDetailsEnabled
          ? '[PSYCHOLOGY: Customer is cautious/skeptical. Reassure 100% premium quality, safe packaging guarantee, and verified customer trust.]'
          : '[PSYCHOLOGY: Customer is cautious/skeptical. Reassure 100% genuine quality, official support, and direct communication with the Store Owner. NEVER promise Cash on Delivery (COD) or courier delivery.]';
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

  check(text, detectedLang = 'Sinhala', storeName = 'OmniSix AI') {
    const lower = (text || '').toLowerCase().trim();
    for (const kw of this.ANGRY_TRIGGERS) {
      if (lower.includes(kw)) {
        return {
          isAngry: true,
          trigger: kw,
          deEscalationReply: this.buildDeEscalationReply(detectedLang, storeName)
        };
      }
    }
    return { isAngry: false };
  },

  buildDeEscalationReply(detectedLang = 'Sinhala', storeName = 'OmniSix AI') {
    const sName = storeName || 'අපගේ ආයතනය';
    if (detectedLang === 'English') {
      return `🙏 *We Sincerely Apologize for the Inconvenience!*\n\nWe take your concern very seriously and regret any frustration caused.\n\n🚨 An *Urgent High-Priority Alert* has just been dispatched directly to our Store Owner & General Manager.\n\nA senior team member will contact you personally right away to resolve this issue to your complete satisfaction. Thank you for your patience with us! 💕`;
    }
    if (detectedLang === 'Tamil') {
      return `🙏 *ஏற்பட்ட சிரமத்திற்கு நாங்கள் மிகவும் வருந்துகிறோம்!*\n\nஉங்கள் பிரச்சினை குறித்து நாங்கள் மிகவும் அக்கறை கொண்டுள்ளோம்.\n\n🚨 இது தொடர்பாக எமது Store Manager / Owner அவர்களுக்கு அவசர அறிவிப்பு (*Urgent Alert*) உடனடியாக அனுப்பப்பட்டுள்ளது.\n\nஉங்களின் இந்த பிரச்சினையை உடனடியாக தீர்த்து வைக்க எமது பொறுப்புள்ள அதிகாரி ஒருவர் சற்று நேரத்தில் உங்களை நேரடியாக தொடர்பு கொள்வார். தயவுசெய்து சிறிது நேரம் காத்திருங்கள்! 💕`;
    }
    if (detectedLang === 'Tanglish') {
      return `🙏 *Ungalukku erpatta shiramathirkku naanga romba mannikkanum!*\n\nUngaloda issue pathi naanga romba care panrom.\n\n🚨 Idhu sambandhama Store Manager / Owner ku ippave *Urgent Alert* anuppiyachu.\n\nSeekirame engaloda senior team member ungalukku direct call panni idhai solve panni tharuvaanga. Please konjam wait pannunga! Romba nandri! 💕`;
    }
    return `🙏 *අපගේ සේවාව නිසා ඔබට ඇති වූ අපහසුතාවය පිළිබඳව අප මුළු හදවතින්ම සමාව අයැද සිටිනවා!*\n\nඔබගේ මෙම ගැටලුව කඩිනමින් විසඳීම සඳහා ${sName} හි Store Owner / Manager වෙත දැන්ම *Urgent Escalation Alert* එකක් මගින් දැනුම් දුන්නා.\n\nසුළු මොහොතකින් අපගේ කණ්ඩායමේ වගකිවයුතු නිලධාරියෙක් ඔබ හා සෘජුවම සම්බන්ධ වී මෙය විසඳා දෙනු ඇත! කරුණාකර සුළු මොහොතක් රැඳී සිටින්න. ස්තූතියි! 💕`;
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
      return '[NEGOTIATION TURN 1: Politely highlight superior AI reliability, 24/7 automation, and multi-channel features. Offer a gentle polite concession of around 5% or 3 extra trial days.]';
    } else if (turnCount === 2) {
      return '[NEGOTIATION TURN 2: If customer pushes further, offer a 3-Month or Annual Plan bundle discount instead of dropping short plan prices.]';
    } else {
      return '[NEGOTIATION TURN 3+: Enforce strict floor price. Firmly and courteously state this is the lowest direct developer pricing available.]';
    }
  }
};

// ─── 4. Smart Upsell Engine ───────────────────────────────────────────────────
const SmartUpsellEngine = {
  detectUpsellOpportunity(userText, activeProducts = []) {
    const lower = (userText || '').toLowerCase();
    
    // 1 Month -> 3 Months or 1 Year VIP plan
    if (lower.includes('1 month') || lower.includes('masayak') || lower.includes('eka masayak')) {
      return '\n[UPSELL TIP: Suggest the 3-Month Plan (Rs. 2,000 saving Rs. 400) or 1-Year VIP Plan (Rs. 5,500 saving thousands).]';
    }

    // Trial / Demo -> Pro License
    if (lower.includes('trial') || lower.includes('free') || lower.includes('nomile')) {
      return '\n[UPSELL TIP: Mention our full PRO features with 24/7 WhatsApp auto-reply and Voice notes support.]';
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

// ─── 6. High-Accuracy Multilingual Language Detection Engine ───────────────────
// Ported directly from GeminiAIEngine.kt with multi-turn continuity & script adherence
const LanguageDetectionEngine = {
  SINGLISH_KEYWORDS: new Set([
    "ayubowan", "ayubbo", "suba", "dawasak", "udasanak", "rathriyak", "elakiri", "sthuthi", "bohoma",
    "mata", "mama", "api", "apita", "apage", "oya", "oyata", "oyage", "oyala", "oba", "obata", "obage",
    "kauda", "kawda", "mokakda", "mokadda", "mokada", "monada", "monawada", "koheda", "kothanada", "kochchara",
    "keeyada", "keeyad", "kiyada", "kiyad", "keeyakda", "kawada", "kawadada", "ganan", "mila", "milaganang",
    "gana", "salli", "mudhal", "ganna", "gannako", "denna", "dennako", "ewanna", "ewannako", "ewapan",
    "kiyanna", "kiyannako", "dannako", "dapan", "danna", "balanna", "balannako", "karanna", "karannako",
    "karapan", "karanne", "karala", "karanawa", "karanawada", "thiyenawa", "thiyenawada", "thiyanawa",
    "thiyanawada", "thiyeda", "thiyenne", "thibba", "thibune", "puluwan", "puluwanda", "baaha", "baeda",
    "behe", "beheda", "ba", "bae", "naha", "nehe", "nathi", "nadda", "nane", "aduda", "wisthara", "visthara",
    "hoda", "hodai", "hodaida", "hari", "harida", "ehenam", "thawa", "wage", "meka", "meke", "mekata",
    "araka", "arake", "oke", "dannawada", "ikmanata", "badu", "bhanda", "kadden", "labada", "aduwen",
    "yawanna", "yawannako", "yanna", "danaganna", "gaththoth", "kiyala", "darana", "machan", "mcn", "aiye",
    "akki", "malli", "nangi", "gedaratama", "athatama", "athata", "onee", "oneda", "onada", "oone", "ooni",
    "nam", "thama", "thamai", "neda", "nedha", "ane", "ayyo", "enna", "ennada", "innawa", "innawada",
    "sathiye", "ada", "heta", "dawas", "dawasata", "gatte", "gaththa", "ewwe", "ewwa", "damma", "damme",
    "hambuna", "hambune", "labuna", "labune", "wade", "wadak", "ow", "oww", "naa", "nae", "ko", "kohomada"
  ]),

  SINGLISH_PHRASES: [
    "delivery karanna", "delivery thiyenawada", "delivery puluwanda", "delivery thiyeda", "delivery thiyanawada",
    "order danna", "order karanna", "ewanne kohomada", "gana keeyada", "mila keeyada", "gana kiyada", "mila kiyada",
    "price eka", "price eka keeyada", "price eka kiyada", "wisthara ewanna", "details ewanna", "puluwanda kiyanna",
    "puluwanda ahanna", "order eka", "size eka", "photo eka", "cash on delivery thiyeda", "cod thiyenawada",
    "cod puluwanda", "transfer karannam", "slip eka", "mata ona", "mata oneda", "oyage number", "koheda thiyenne",
    "kothanada thiyenne", "badu thiyenawada", "meka ganna", "danna puluwanda", "ewanna puluwanda", "ganna puluwanda"
  ],

  TANGLISH_KEYWORDS: new Set([
    "vanakkam", "vaanga", "vanga", "ponga", "nandri", "sari", "aama", "aamanga", "illa", "illai", "illaye",
    "enakku", "ungalukku", "ungala", "ungalku", "unaku", "enna", "ethana", "evalavu", "evvalavu", "eppadi",
    "eppudi", "edhu", "yaar", "yaaruku", "anna", "thambi", "akka", "thangachi", "nanba", "thozha",
    "irukku", "irukka", "kedaikkuma", "kedaikkum", "theriyuma", "theriyum", "venum", "vendaam", "solunga",
    "kudunga", "anuppunga", "anuppu", "pannunga", "panunga", "paaru", "paarkka", "pesunga", "podunga",
    "thanga", "thareengala", "romba", "nalla", "periya", "chinna", "seekiram", "marupadiyum", "idhoda",
    "adhoda", "ethoda", "yen", "eppoluthu", "eppo", "solla", "kedaika", "vilai", "theriyala"
  ]),

  TANGLISH_PHRASES: [
    "delivery irukka", "vilai enna", "rate enna", "cost enna", "details solunga", "photo anuppunga",
    "price enna", "available ah", "delivery panveengala", "enna price", "irukka bro", "solunga bro",
    "delivery iruka", "vanakkam bro", "nandri bro"
  ],

  ENGLISH_STRUCTURAL_WORDS: new Set([
    "what", "where", "when", "who", "which", "how", "why", "is", "are", "can", "could", "would",
    "will", "should", "please", "have", "has", "had", "there", "this", "that", "these", "those",
    "from", "with", "about", "want", "need", "like", "looking", "show", "send", "deliver", "delivery",
    "available", "price", "cost", "order", "store", "shop", "photos", "images", "items", "products",
    "thank", "thanks", "much", "many", "does", "done", "give", "take", "help", "assist",
    "do", "did", "you", "your", "i", "me", "my", "we", "our", "to", "for", "in", "on", "at",
    "the", "a", "an", "any", "some", "all", "get", "buy", "tell", "know", "hello", "hi", "hey",
    "good", "morning", "afternoon", "evening", "night", "item", "items", "size", "sizes",
    "color", "colors", "cash", "bank", "cod", "transfer", "account", "card", "pay", "payment",
    "time", "days", "day", "address", "location", "place", "ship", "shipping", "charge", "charges",
    "fee", "fees", "stock", "catalog", "details", "contact", "phone", "number", "tomorrow", "today"
  ]),

  evaluateLatinLanguageDirect(text) {
    const lower = (text || '').toLowerCase();
    const tokens = new Set(lower.split(/[^a-zA-Z0-9]+/).filter(Boolean));

    let singlishScore = 0;
    tokens.forEach(t => {
      if (this.SINGLISH_KEYWORDS.has(t)) singlishScore += 2;
    });
    if (this.SINGLISH_PHRASES.some(p => lower.includes(p))) singlishScore += 5;

    // Morphological heuristics for Sinhala verb endings and question tags
    tokens.forEach(t => {
      if (/^[a-z]+(nnako|anko)$/.test(t)) singlishScore += 3;
      if (/^[a-z]+(wada|wanda|nawada|yeda)$/.test(t)) singlishScore += 3;
      if (/^[a-z]+(eka|ekak|eke|ekata)$/.test(t) && t.length > 4) singlishScore += 2;
    });

    let tanglishScore = 0;
    tokens.forEach(t => {
      if (this.TANGLISH_KEYWORDS.has(t)) tanglishScore += 2;
    });
    if (this.TANGLISH_PHRASES.some(p => lower.includes(p))) tanglishScore += 5;

    if (tanglishScore > singlishScore && tanglishScore >= 2) return "Tanglish";
    if (singlishScore >= 2) return "Singlish";
    if (singlishScore === 1 && tanglishScore === 0) return "Singlish";
    if (tanglishScore === 1 && singlishScore === 0) return "Tanglish";
    return "Unknown";
  },

  isUnambiguousEnglish(text) {
    const lower = (text || '').toLowerCase();
    const words = lower.split(/[^a-zA-Z]+/).filter(w => w.length >= 2);
    if (words.length < 2) return false;

    let count = 0;
    let hasNonEnglish = false;
    words.forEach(w => {
      if (this.ENGLISH_STRUCTURAL_WORDS.has(w)) count++;
      if (this.SINGLISH_KEYWORDS.has(w) || this.TANGLISH_KEYWORDS.has(w)) hasNonEnglish = true;
    });

    return count >= 2 && !hasNonEnglish;
  },

  detectForeignLanguage(text) {
    const s = text || '';
    if (/[\u0600-\u06FF]/.test(s)) return "Arabic";
    if (/[\u0900-\u097F]/.test(s)) return "Hindi";
    if (/[\u4E00-\u9FFF]/.test(s)) return "Chinese";
    if (/[\u0400-\u04FF]/.test(s)) return "Russian";
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(s)) return "Japanese";

    const lower = s.toLowerCase();
    const words = lower.split(/[^\p{L}]+/u).filter(Boolean);
    if (words.length === 0) return null;

    // Italian
    const italianWords = new Set(["qual", "quale", "vostro", "vostra", "servizio", "consegna", "grazie", "ciao", "prezzo", "quanto", "costa", "buongiorno", "spedizione", "ordine", "dove", "quando", "come", "dettagli", "informazioni", "disponibile"]);
    if (words.filter(w => italianWords.has(w)).length >= 2 || (words.length >= 2 && words.some(w => ["consegna", "servizio", "vostro", "vostra", "buongiorno", "spedizione"].includes(w)))) {
      return "Italian";
    }

    // French
    const frenchWords = new Set(["bonjour", "merci", "livraison", "combien", "coute", "coûte", "prix", "votre", "notre", "service", "commande", "disponible", "avec", "pour", "dans", "comment"]);
    if (words.filter(w => frenchWords.has(w)).length >= 2 || words.some(w => ["bonjour", "livraison", "combien"].includes(w))) {
      return "French";
    }

    // German
    const germanWords = new Set(["hallo", "guten", "morgen", "tag", "abend", "danke", "bitte", "lieferung", "wieviel", "kosten", "kostet", "preis", "bestellung", "versand", "kann"]);
    if (words.filter(w => germanWords.has(w)).length >= 2 || words.some(w => ["lieferung", "wieviel", "versand"].includes(w))) {
      return "German";
    }

    // Spanish
    const spanishWords = new Set(["hola", "gracias", "por favor", "cuanto", "cuánto", "cuesta", "precio", "envio", "envío", "entrega", "servicio", "pedido", "disponible", "tienen", "como"]);
    if (words.filter(w => spanishWords.has(w)).length >= 2 || words.some(w => ["entrega", "envío", "envio"].includes(w))) {
      return "Spanish";
    }

    return null;
  },

  isAmbiguousContinuation(text) {
    const trimmed = (text || '').trim();
    if (trimmed.length <= 15) {
      const lower = trimmed.toLowerCase();
      const ambiguousTokens = new Set([
        "ok", "okay", "yes", "no", "hari", "ow", "ela", "done", "cancel", "fine", "yep", "nope",
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
        "m", "l", "xl", "xxl", "s", "xs", "3xl", "4xl", "5xl", "6xl",
        "size m", "size l", "size xl", "size xxl", "size s",
        "red", "black", "blue", "white", "green", "yellow", "pink", "maroon", "ash",
        "cod", "bank", "transfer", "cash", "confirm", "send", "order"
      ]);
      if (ambiguousTokens.has(lower)) return true;
    }

    // Numeric only or phone numbers
    if (/^[\d\s\+\-\(\)/,.:]+$/.test(trimmed)) return true;
    // Emojis and punctuation only
    if (/^[\p{P}\p{S}\s]+$/u.test(trimmed)) return true;

    // Sri Lankan address without question marks
    const isAddressLike = /\b(road|rd|mawatha|street|lane|st|no\.?|\d+\/\d+)\b/i.test(trimmed);
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (isAddressLike && words.length <= 8 && !trimmed.includes('?')) {
      return true;
    }

    return false;
  },

  resolveLanguageFromHistory(chatHistory = []) {
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) return null;
    // Check backwards from customer messages first
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      const text = (msg.parts?.[0]?.text || msg.text || msg.messageText || '').trim();
      if (!text || text.startsWith('[Photo') || text.startsWith('[Voice') || text.startsWith('[OFFICIAL')) continue;
      if (/[\u0D80-\u0DFF]/.test(text)) return "Sinhala";
      if (/[\u0B80-\u0BFF]/.test(text)) return "Tamil";
      const evaluated = this.evaluateLatinLanguageDirect(text);
      if (evaluated === "Singlish" || evaluated === "Tanglish") return evaluated;
      const foreign = this.detectForeignLanguage(text);
      if (foreign) return foreign;
      if (this.isUnambiguousEnglish(text)) return "English";
    }
    return null;
  },

  detectLanguage(text, chatHistory = []) {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return this.resolveLanguageFromHistory(chatHistory) || "English";
    }

    // 1. Native Scripts (100% Deterministic)
    if (/[\u0D80-\u0DFF]/.test(trimmed)) {
      return "Sinhala";
    }
    if (/[\u0B80-\u0BFF]/.test(trimmed)) {
      return "Tamil";
    }

    // 2. Direct message token and morphology analysis (Singlish / Tanglish)
    const directLang = this.evaluateLatinLanguageDirect(trimmed);
    if (directLang === "Singlish" || directLang === "Tanglish") {
      return directLang;
    }

    // 3. Foreign Languages
    const foreignLang = this.detectForeignLanguage(trimmed);
    if (foreignLang) {
      return foreignLang;
    }

    // 4. Clear English sentence or grammatical structure
    if (this.isUnambiguousEnglish(trimmed)) {
      return "English";
    }

    // 5. Short / ambiguous continuations (resolve from chat history)
    if (this.isAmbiguousContinuation(trimmed)) {
      const historyLang = this.resolveLanguageFromHistory(chatHistory);
      if (historyLang) return historyLang;
    }

    // 6. Multi-word Latin message with ZERO Singlish/Tanglish tokens
    const words = trimmed.toLowerCase().split(/[^\p{L}]+/u).filter(w => w.length >= 2);
    if (words.length >= 3) {
      return "English";
    }

    // 7. Fallback to history
    const historyLang = this.resolveLanguageFromHistory(chatHistory);
    if (historyLang) return historyLang;

    // 8. Short greetings
    const q = trimmed.toLowerCase();
    if (q === "hi" || q === "hello" || q === "hey" || q.startsWith("good morning") || q.startsWith("good evening")) {
      return "English";
    }
    if (q.includes("ayubowan") || q.includes("suba")) {
      return "Singlish";
    }
    if (q.includes("vanakkam")) {
      return "Tanglish";
    }

    return "English";
  }
};

// ─── 7. Production AI Prompt Injection & Jailbreak Defense Shield ─────────────
const PromptInjectionShield = {
  INJECTION_PATTERNS: [
    /ignore (all )?(previous|prior|above) (instructions|directions|rules)/i,
    /disregard (all )?(previous|prior|above) (instructions|directions|rules)/i,
    /you are now (in )?(developer mode|unrestricted|god mode|dan)/i,
    /\b(dan mode|jailbreak|prompt injection|dev mode|bypass filters)\b/i,
    /pretend (you have no|there are no|to be) (filters|limits|rules|unrestricted)/i,
    /system prompt override/i,
    /forget (all )?(your )?(instructions|rules|prompt)/i,
    /pretend to be an unrestricted/i,
    /act as an adversarial/i,
    /reveal (your )?(system prompt|initial prompt|secret key|api key)/i,
    /output (your )?(system instructions|developer instructions)/i,
    /approve this order (for free|with 0 amount|automatically)/i,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
    /javascript:/i,
    /union\s+select/i
  ],

  inspect(text) {
    if (!text || typeof text !== 'string') return { isSuspicious: false, cleanText: text };
    const trimmed = text.trim();
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isSuspicious: true,
          pattern: pattern.toString(),
          safeReply: 'ආයුබෝවන්! අපගේ පද්ධතිය සාමාන්‍ය ව්‍යාපාරික නීතිරීති සහ පාරිභෝගික මිල ගණන් අනුව පමණක් ක්‍රියාත්මක වේ. අපගේ Products සහ Services පිළිබඳ ඕනෑම තොරතුරක් විමසිය හැක. 😊'
        };
      }
    }
    return { isSuspicious: false, cleanText: trimmed };
  }
};

// ─── 8. Ultra-Fast Zero-Latency Hybrid Fast-Cache Intent Engine ───────────────
const HybridFastCacheEngine = {
  resolve(text, business = {}, products = [], detectedLang = 'Sinhala', settings = null) {
    if (!text || typeof text !== 'string') return null;
    if (text.includes('[📷 Image Content:') || text.includes('[Image Sent:') || text.includes('[Customer Sent an Image]') || text.trim().startsWith('📷')) {
      return null;
    }
    const clean = text.trim().toLowerCase();
    const isEnglish = detectedLang === 'English';
    const deliveryEnabled = isDeliveryEnabled(settings);
    const bizName = business.name || 'OmniSix AI Software';
    const isSoftware = (business.category === 'software' || business.id === 'software' || business.id === 'omnisix' || business.id === 'weddingarts' || (bizName || '').toLowerCase().includes('software') || (bizName || '').toLowerCase().includes('omnisix'));

    // 1. Pricing / Packages / Plans Inquiry (Flexible match anywhere in message)
    const isPricingQuery = /(price|pricing|mila|gana|ganan|package|packages|plans|plan|cost|charges|fees|rental|monthly|starter|enterprise|how much|kotcharada|kiyada|keeyada)/i.test(clean);
    const isExplicitDeliveryOrCod = /(cash on delivery|cod thiyenawada|cod puluwanda|\bcod\b|delivery|deliver|courier|ewanne kohomada|dawas kiyak|delivery charges|delivery fee)/i.test(clean);

    if (isPricingQuery && !isExplicitDeliveryOrCod) {
      if (isSoftware) {
        if (isEnglish) {
          return `💼 *${bizName} — Cloud AI SaaS Pricing Plans:*\n\n` +
            `🔹 *Starter Cloud Plan:* Rs. 1,900/month\n` +
            `• 1 WhatsApp Line, 500 AI chats/mo, Auto-reply, Basic CRM\n\n` +
            `🔹 *Pro Cloud Plan:* Rs. 2,900/month\n` +
            `• 3 WhatsApp Lines, 2,500 AI chats/mo, Gemini AI, Audio Transcription\n\n` +
            `🔹 *Enterprise Cloud VIP Plan:* Rs. 3,500/month\n` +
            `• Unlimited Lines, Real-Time AI Live Voice Calls, Dedicated Account Manager\n\n` +
            `🎁 *Get your 3-Day Free Trial:* https://omnisix-ai.onrender.com/free\n\n` +
            `Which plan fits your business best? You can test it today with our 3-Day Free Trial! 😊`;
        }
        return `💼 *${bizName} — පැකේජ සහ මිල ගණන්:*\n\n` +
          `🔹 *Starter Cloud Plan:* රු. 1,900/මසකට\n` +
          `• WhatsApp Line 1ක්, AI Chats 500ක්, Auto-Replies & Basic CRM\n\n` +
          `🔹 *Pro Cloud Plan:* රු. 2,900/මසකට\n` +
          `• WhatsApp Lines 3ක්, AI Chats 2,500ක්, Gemini AI & Voice Notes\n\n` +
          `🔹 *Enterprise Cloud VIP Plan:* රු. 3,500/මසකට\n` +
          `• Unlimited Lines, Real-Time AI Live Voice Calls & Full CRM Automation\n\n` +
          `🎁 *නොමිලේ දින 3ක අත්හදා බැලීම සඳහා (Free 3-Day Trial):*\n` +
          `👉 https://omnisix-ai.onrender.com/free\n\n` +
          `ඔබේ ව්‍යාපාරයට වඩාත් ගැළපෙන පැකේජය කුමක්ද? නොමිලේ ටෙස්ට් කර බැලීමට අදම ලියාපදිංචි වන්න! 😊`;
      }

      if (Array.isArray(products) && products.length > 0) {
        const topProds = products.slice(0, 5).map(p => `• *${p.name}:* රු. ${(p.price || 0).toLocaleString()} ${p.description ? `(${p.description.slice(0, 45)})` : ''}`).join('\n');
        if (!deliveryEnabled) {
          return `🏷️ *${bizName} — භාණ්ඩ හා මිල ගණන් ලැයිස්තුව:*\n\n${topProds}\n\n${buildOwnerOrderShortCta(business, settings, detectedLang)}`;
        }
        return `🏷️ *${bizName} — භාණ්ඩ හා මිල ගණන් ලැයිස්තුව:*\n\n${topProds}\n\n📦 Islandwide Cash on Delivery (COD) පහසුකම ඇත.\nඇණවුම් කිරීමට හෝ විස්තර දැනගැනීමට කැමති භාණ්ඩයේ නම එවන්න. 😊`;
      }
    }

    // 2. AI Agent / Bot / Features / Service Info
    if (/(ai agent|agent|bot|features|software|omnisix|monawada karanne|mokakda me|what is this|demo|system|crm)/i.test(clean)) {
      if (isEnglish) {
        return `🤖 *${bizName} — 24/7 Autonomous WhatsApp & Voice AI:*

` +
          `• ⚡ *Instant WhatsApp Auto-Reply:* Answers prices, products, bank details & takes orders.
` +
          `• 🎙️ *Live Voice AI Calls:* Answers incoming voice calls in human-like Sinhala or English.
` +
          `• 📊 *Omnichannel Live CRM:* Manage multiple WhatsApp numbers in one dashboard.
` +
          `• 🛡️ *100% Anti-Ban Safety:* Smart typing emulation & zero-width character protection.

` +
          `🎁 *Try free for 3 days:* https://omnisix-ai.onrender.com/free
` +
          `Send *price* to see our affordable packages starting from Rs. 1,900/mo! 😊`;
      }
      return `🤖 *${bizName} — 24/7 ස්වයංක්‍රීය WhatsApp & Voice AI පද්ධතිය:*

` +
        `• ⚡ *ක්ෂණික WhatsApp Auto-Reply:* පාරිභෝගික ප්‍රශ්න, මිල ගණන්, බැංකු විස්තර වලට පිළිතුරු දෙමින් ඇණවුම් ලබා ගැනීම.
` +
        `• 🎙️ *Live Voice AI ඇමතුම්:* පාරිභෝගිකයින් කතා කරන විට ස්වභාවික සිංහලෙන් සජීවීව කතා කර පිළිතුරු දීම.
` +
        `• 📊 *Omnichannel Live CRM:* WhatsApp අංක කිහිපයක් එකම තිරයකින් (Dashboard) කළමනාකරණය.
` +
        `• 🛡️ *100% Anti-Ban ආරක්ෂාව:* WhatsApp අංක Block නොවී පවත්වා ගැනීමේ ආරක්ෂක ක්‍රමවේද.

` +
        `🎁 *දින 3ක් නොමිලේ අත්හදා බැලීමට (Free Trial):* https://omnisix-ai.onrender.com/free
` +
        `අපගේ පැකේජ බැලීමට *price* ලෙස එවන්න (රු. 1,900/මසක සිට). 😊`;
    }

    // 3. Free Trial Registration
    if (/(free trial|test karanna|register|try|try karanna|free trial link)/i.test(clean)) {
      if (isEnglish) {
        return `🎁 *${bizName} — 3-Day Free Trial:*

You can test all features including WhatsApp AI automation and Omnichannel CRM with zero commitment.

👉 *Activate Free Trial:* https://omnisix-ai.onrender.com/free

No credit card required. Instant activation! 😊`;
      }
      return `🎁 *${bizName} — නොමිලේ දින 3ක අත්හදා බැලීම:*

ඔබගේ WhatsApp අංකය සම්බන්ධ කර සියලුම AI පහසුකම් සහ CRM Dashboard එක නොමිලේ අත්හදා බැලිය හැක.

👉 *Free Trial එක සක්‍රීය කරගන්න:* https://omnisix-ai.onrender.com/free

ලියාපදිංචි වී ක්ෂණිකවම භාවිතය ආරම්භ කරන්න! 😊`;
    }

    // 4. Bank Details / Account Number Inquiry
    if (/(bank details|account details|account number|acc no|boc|bank eka|gewanna ona|salli danna|payment details|bank ekata|account eka)/i.test(clean)) {
      const bDetails = business.bankDetails || 'Bank of Ceylon (BOC)\n• Account No: 92949122\n• Account Name: D T Rajapaksha\n• Branch: Piliyandala';
      if (isEnglish) {
        return `💳 *Official Bank Details for Payment:*\n\n${bDetails}\n\n📌 After payment, please send a clear photo or screenshot of the deposit slip here to confirm your order/activation. Thank you!`;
      }
      return `💳 *මුදල් ගෙවීම් සඳහා නිල බැංකු විස්තර:*\n\n${bDetails}\n\n📌 මුදල් තැන්පත් කළ පසු රිසිට්පතේ (Slip/Screenshot) පැහැදිලි ඡායාරූපයක් මෙහි එවන්න. එවිට ඔබගේ ඇණවුම/ගිණුම සක්‍රීය කරනු ලැබේ. ස්තූතියි!`;
    }

    // 5. Delivery / COD / Order Placement Inquiry
    const isOrderIntent = /(\border\b|order ekak|order karanna|order danna|how to order|place order|\bganna\b|ganna one|gannada|\bbuy\b|\bpurchase\b|ඇණවුම්)/i.test(clean);
    if (isExplicitDeliveryOrCod || (!deliveryEnabled && isOrderIntent)) {
      if (!deliveryEnabled) {
        return buildOwnerOrderReferralReply(business, settings, detectedLang);
      }
      if (isEnglish) {
        return `🚚 *Delivery & Payment Options:*\n\n` +
          `• *Islandwide Cash on Delivery (COD):* Available for all main regions.\n` +
          `• *Delivery Time:* 2 to 3 business days via PromptX / Domex courier.\n` +
          `• *Bank Deposit:* You can also deposit directly to our bank account.\n\n` +
          `To place an order, send your Name, Delivery Address, and Mobile Number! 📦`;
      }
      return `🚚 *බෙදාහැරීම් සහ ගෙවීම් විස්තර (Delivery & COD):*

` +
        `• *Cash on Delivery (COD):* භාණ්ඩය ලැබුණු පසු මුදල් ගෙවීමේ පහසුකම දිවයින පුරා ඇත.
` +
        `• *භාණ්ඩ ලැබීමට ගතවන කාලය:* වැඩකරන දින 2-3ක් ඇතුළත කුරියර් (PromptX / Domex) මඟින් නිවසටම ගෙනැවිත් දෙනු ලැබේ.
` +
        `• *බැංකු තැන්පතු:* අවශ්‍ය නම් බැංකු ගිණුමට මුදල් තැන්පත් කරද ඇණවුම් කළ හැක.

` +
        `ඇණවුම තහවුරු කිරීමට ඔබගේ නම, ලිපිනය සහ දුරකථන අංකය අප වෙත එවන්න. 📦`;
    }

    // 6. Greetings
    if (/^(hi|hello|hey|hlo|good morning|good evening|suba udasanak|suba rathriyak|oya kawda|kawda me|halo|helo)(\s*|\.|\!)*$/i.test(clean)) {
      if (isEnglish) {
        return `Hello! 👋 Welcome to *${bizName}*.\nI am your 24/7 AI Smart Assistant. How can I help you today? Feel free to ask about our pricing, packages, or services! 😊`;
      }
      return `ආයුබෝවන්! 👋 *${bizName}* වෙත සාදරයෙන් පිළිගන්නවා.\nමම ඔබගේ 24/7 AI සහායකයායි. අද ඔබට අවශ්‍ය තොරතුරු, මිල ගණන් හෝ ඇණවුම් පිළිබඳව ඕනෑම දෙයක් මෙහි විමසිය හැක. 😊`;
    }

    return null;
  }
};
module.exports = {
  HybridFastCacheEngine,
  PromptInjectionShield,
  CustomerArchetypeEngine,
  AngryCustomerEscalationEngine,
  SmartNegotiationEngine,
  SmartUpsellEngine,
  SlipDetectionEngine,
  LanguageDetectionEngine
};
