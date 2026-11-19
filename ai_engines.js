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

module.exports = {
  CustomerArchetypeEngine,
  AngryCustomerEscalationEngine,
  SmartNegotiationEngine,
  SmartUpsellEngine,
  SlipDetectionEngine,
  LanguageDetectionEngine
};
