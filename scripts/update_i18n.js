const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'public', 'admin.html');
let html = fs.readFileSync(targetFile, 'utf8');

const newTranslationBlock = `// ─── 🌐 OmniSix AI Comprehensive Full-Page Translation Engine (Sinhala / Tamil / English) ───
function normalizeI18nKey(str) {
  return String(str || '').toLowerCase().replace(/[\\r\\n\\t]+/g, ' ').replace(/\\s+/g, ' ').trim();
}

const OMNISIX_RAW_DICT = {
  si: {
    // Top Navbar
    "cloud live": "Cloud සක්‍රීයයි",
    "sound": "ශබ්දය",
    "eod summary": "දවසේ සාරාංශය",
    "oled midnight": "OLED Midnight (අඳුරු)",
    "slate cyber": "Slate Cyber",
    "deep carbon": "Deep Carbon",
    "store:": "වෙළඳසැල:",
    "+ new": "+ නව",
    "live call": "සජීවී Voice Call",
    "test live voice call": "සජීවී Voice Call පරීක්ෂාව",
    "24/7 active": "24/7 සක්‍රීයයි",
    "search menu...": "මෙනුව සොයන්න...",

    // Sidebar Categories
    "whatsapp connect": "WhatsApp සබඳතා",
    "ai workforce & voice": "AI කාර්ය මණ්ඩලය සහ හඬ",
    "crm & deals pipeline": "CRM සහ ගනුදෙනු නලමාර්ගය",
    "live inbox & team": "සජීවී පාරිභෝගික සංවාද සහ කාර්ය මණ්ඩලය",
    "commerce & catalog": "වෙළඳාම සහ නාමාවලිය",
    "commerce & dispatch": "වෙළඳාම සහ බෙදාහැරීම්",
    "administration": "පරිපාලන අංශය",
    "automation & bots": "ස්වයංක්‍රීයකරණය සහ බොට්ස්",

    // Sidebar Navigation Buttons
    "add whatsapp by qr": "QR මඟින් WhatsApp එක් කරන්න",
    "whatsapp warmer": "WhatsApp අංක Warmer (Anti-Ban)",
    "qr bulk campaign": "තොග පණිවිඩ ප්‍රචාරණ",
    "meta cloud api": "Meta Cloud API සම්බන්ධතාව",
    "link meta whatsapp": "Meta WhatsApp සම්බන්ධ කරන්න",
    "wa link & qr builder": "WhatsApp Link සහ QR සාදනය",
    "autonomous flows": "ස්වයංක්‍රීය පණිවිඩ Flows",
    "automation flows": "ස්වයංක්‍රීය පණිවිඩ Flows",
    "wa chatbot": "WhatsApp ස්වයංක්‍රීය Chatbot",
    "ai bot persona": "AI පෞරුෂය සහ සැකසුම්",
    "ai voice call logs": "සජීවී ඇමතුම් වාර්තා",
    "wa call logs": "සජීවී ඇමතුම් වාර්තා",
    "kanban board": "Kanban ගනුදෙනු පුවරුව",
    "interactive forms": "අන්තර්ක්‍රියාකාරී Forms",
    "contacts book": "පාරිභෝගික නාමාවලිය",
    "20 ai agents": "විශේෂඥ AI නියෝජිතයින් 20",
    "omnichannel inbox": "සජීවී පාරිභෝගික සංවාද",
    "team & live widget": "සේවකයින් සහ Web Widget",
    "orders & slips": "ඇණවුම් සහ ගෙවීම් පත්‍රිකා",
    "product catalog": "භාණ්ඩ සහ මිල නාමාවලිය",
    "business dataset": "ව්‍යාපාරික දත්ත සහ දැනුම",
    "overview": "ප්‍රධාන දළ විශ්ලේෂණය",
    "multi-store hub": "වෙළඳසැල් පාලන මධ්‍යස්ථානය",
    "licenses & keygen": "බලපත්‍ර සහ KeyGen",
    "developer rest api": "Developer REST API ලේඛනය",
    "roi simulator": "ROI සහ ලාභ ගණකය",
    "thermal 4x6 slips": "තාප මුද්‍රණ Slip මුද්‍රණය",
    "cod blacklist": "ව්‍යාජ COD කළු ලැයිස්තුව",

    // Overview Cards & Metrics
    "executive business overview": "ව්‍යාපාරික ප්‍රධාන දළ විශ්ලේෂණය",
    "actual revenue": "සත්‍ය ආදායම",
    "from verified & confirmed orders": "තහවුරු කළ ඇණවුම් වලින්",
    "total orders": "මුළු ඇණවුම්",
    "whatsapp & voice call pipeline": "WhatsApp සහ හඬ ඇමතුම් මඟින්",
    "customer leads": "පාරිභෝගික ලීඩ්ස්",
    "active customer conversations": "ක්‍රියාකාරී පාරිභෝගික සාකච්ඡා",
    "live voice calls": "සජීවී හඬ ඇමතුම්",
    "gemini live leda voice active": "Gemini Live හඬ සක්‍රීයයි",
    "ai sales conversion & roi proof analytics": "AI විකුණුම් පරිවර්තනය සහ ROI සාධක",
    "plans & pricing": "මිල ගණන් සහ පැකේජ",
    "active saas plan:": "සක්‍රීය SaaS පැකේජය:",
    "whatsapp & calls handled 24/7": "24/7 හැසිරවූ ඇමතුම් සහ චැට්",
    "inquiry -> paid order conversion": "විමසීම් -> ගෙවූ ඇණවුම් බවට පත්වීමේ අනුපාතය",
    "orders closed directly by ai": "AI මඟින් සෘජුවම අවසන් කළ ඇණවුම්",
    "human agent time saved": "ඉතිරි වූ මිනිස් ශ්‍රම කාලය",
    "hrs / 100+ automation savings": "පැය / 100+ ස්වයංක්‍රීයකරණයෙන් ඉතිරි වූ කාලය",
    "rate": "අනුපාතය",
    "live ai verified": "සජීවී AI මඟින් තහවුරුයි",

    // 20-Agent AI Enterprise Fleet
    "20-agent ai enterprise fleet": "විශේෂඥ AI නියෝජිතයින් 20 ක බලඇණිය",
    "autonomous enterprise mesh": "ස්වයංක්‍රීය Enterprise Mesh",
    "interactive agent dispatch tester": "නියෝජිත පරීක්ෂණ පද්ධතිය",
    "live decision stream (chain-of-thought)": "සජීවී AI තීරණ දාමය (Chain-of-Thought)",
    "total ai workforce": "මුළු AI ශ්‍රම බලකාය",
    "active on live whatsapp": "WhatsApp හි සක්‍රීය නියෝජිතයින්",
    "average decision speed": "සාමාන්‍ය තීරණ ගැනීමේ වේගය",
    "autonomous accuracy": "ස්වයංක්‍රීය නිරවද්‍යතාව",
    "all departments": "සියලුම දෙපාර්තමේන්තු",
    "sales & revenue": "විකුණුම් සහ ආදායම්",
    "customer support": "පාරිභෝගික සහාය",
    "logistics & finance": "බෙදාහැරීම් සහ මූල්‍ය",
    "marketing & growth": "ප්‍රචාරණය සහ වර්ධනය",
    "intelligence & sre": "බුද්ධි තොරතුරු සහ විශ්ලේෂණ",
    "across 5 key departments": "ප්‍රධාන දෙපාර්තමේන්තු 5ක් හරහා",
    "0 standby | 100% operational": "0 පොරොත්තු | 100% ක්‍රියාත්මකයි",
    "floor price margin guard active": "අවම මිල ආරක්ෂණය සක්‍රීයයි",
    "24/7 fully autonomous": "24/7 පූර්ණ ස්වයංක්‍රීය",
    "co-pilot (human review)": "සහයක මාදිලිය (Co-Pilot)",
    "supervised": "අධීක්ෂණ මාදිලිය",

    // Stores Hub
    "multi-store management hub": "වෙළඳසැල් පාලන මධ්‍යස්ථානය",
    "add new store": "නව වෙළඳසැලක් එක් කරන්න",
    "refresh stores": "වෙළඳසැල් යාවත්කාලීන කරන්න",
    "total registered stores": "ලියාපදිංචි මුළු වෙළඳසැල්",
    "active working store (this tab)": "සක්‍රීය වෙළඳසැල (මෙම Tab එක)",
    "active license keys": "සක්‍රීය බලපත්‍ර යතුරු",
    "store name & id": "වෙළඳසැලේ නම සහ ID",
    "category": "කාණ්ඩය",
    "plan tier": "පැකේජය",
    "owner & contact": "හිමිකරු සහ දුරකථන අංකය",
    "active license": "සක්‍රීය බලපත්‍රය",
    "orders / stats": "ඇණවුම් සහ සංඛ්‍යාලේඛන",
    "tab & management actions": "ක්‍රියාකාරකම් සහ පාලනය",
    "switch": "මාරු වන්න",
    "open in new tab": "නව Tab එකක අරින්න",
    "portal": "පාරිභෝගික Portal",
    "edit": "වෙනස් කරන්න",
    "no key issued": "බලපත්‍රයක් නිකුත් කර නැත",
    "active here": "මෙහි සක්‍රීයයි",
    "starter (rs. 1,900)": "Starter (රු. 1,900)",
    "pro (rs. 2,900)": "Pro (රු. 2,900)",
    "enterprise (rs. 3,500)": "Enterprise (රු. 3,500)",

    // General Buttons & Badges
    "close": "වසන්න",
    "cancel": "අවලංගු කරන්න",
    "save": "සුරකින්න",
    "save changes": "වෙනස්කම් සුරකින්න",
    "save staff member": "සේවකයා සුරකින්න",
    "print label": "මුද්‍රණය කරන්න",
    "copy whatsapp report": "WhatsApp වාර්තාව Copy කරන්න",
    "filter by department:": "දෙපාර්තමේන්තුව අනුව පෙරන්න:",
    "quick test scenario:": "ක්ෂණික පරීක්ෂණ අවස්ථාව:",
    "simulate incoming message": "පාරිභෝගික පණිවිඩය ඇතුළත් කරන්න",
    "dispatch & route test": "පරීක්ෂා කර යොමු කරන්න",
    "ai reasoning stream (live)": "සජීවී AI තීරණ සටහන් (Live)",
    "waiting for live incoming whatsapp or voice activity...": "සජීවී WhatsApp හෝ Voice ඇමතුම් පණිවිඩයක් ලැබෙන තෙක් රැඳී සිටියි..."
  },
  ta: {
    // Top Navbar
    "cloud live": "Cloud நேரலை",
    "sound": "ஒலி",
    "eod summary": "நாள் இறுதி சுருக்கம்",
    "oled midnight": "OLED Midnight (இருண்ட)",
    "slate cyber": "Slate Cyber",
    "deep carbon": "Deep Carbon",
    "store:": "கடை:",
    "+ new": "+ புதியது",
    "live call": "நேரலை Voice Call",
    "test live voice call": "நேரலை Voice Call சோதனை",
    "24/7 active": "24/7 இயங்குகிறது",
    "search menu...": "மெனுவைத் தேடுங்கள்...",

    // Sidebar Categories
    "whatsapp connect": "வாட்ஸ்அப் இணைப்பு",
    "ai workforce & voice": "AI பணியாளர்கள் & குரல்",
    "crm & deals pipeline": "CRM & ஒப்பந்த பைப்லைன்",
    "live inbox & team": "நேரலை அரட்டை & குழு",
    "commerce & catalog": "வணிகம் & பட்டியல்",
    "commerce & dispatch": "வணிகம் & அனுப்புதல்",
    "administration": "நிர்வாகம்",
    "automation & bots": "தானியங்கு & போட்கள்",

    // Sidebar Navigation Buttons
    "add whatsapp by qr": "QR மூலம் WhatsApp சேர்க்கவும்",
    "whatsapp warmer": "WhatsApp எண் வார்மர் (Anti-Ban)",
    "qr bulk campaign": "மொத்த பிரச்சாரங்கள்",
    "meta cloud api": "Meta Cloud API இணைப்பு",
    "link meta whatsapp": "Meta WhatsApp இணைக்கவும்",
    "wa link & qr builder": "WhatsApp இணைப்பு & QR ஜெனரேட்டர்",
    "autonomous flows": "தானியங்கி செய்தி ஓட்டங்கள்",
    "automation flows": "தானியங்கி செய்தி ஓட்டங்கள்",
    "wa chatbot": "WhatsApp தானியங்கி சாட்போட்",
    "ai bot persona": "AI ஆளுமை & அமைப்புகள்",
    "ai voice call logs": "நேரலை அழைப்பு பதிவுகள்",
    "wa call logs": "நேரலை அழைப்பு பதிவுகள்",
    "kanban board": "கன்பன் போர்டு",
    "interactive forms": "ஊடாடும் படிவங்கள்",
    "contacts book": "தொடர்புகள் புத்தகம்",
    "20 ai agents": "20 AI முகவர்கள் அணி",
    "omnichannel inbox": "நேரலை வாடிக்கையாளர் அரட்டை",
    "team & live widget": "குழு & வலை விட்ஜெட்",
    "orders & slips": "ஆர்டர்கள் & ரசீதுகள்",
    "product catalog": "தயாரிப்புகள் பட்டியல்",
    "business dataset": "வணிக அறிவுத் தரவுத்தளம்",
    "overview": "பிரதான மேலோட்டம்",
    "multi-store hub": "கடைகள் மேலாண்மை மையம்",
    "licenses & keygen": "உரிம சாவி ஜெனரேட்டர்",
    "developer rest api": "Developer REST API ஆவணங்கள்",
    "roi simulator": "ROI & லாப கணிப்பான்",
    "thermal 4x6 slips": "தெர்மல் ஸ்லிப் அச்சு",
    "cod blacklist": "போலி COD தடுப்புப்பட்டியல்",

    // Overview Cards & Metrics
    "executive business overview": "வணிக பிரதான மேலோட்டம்",
    "actual revenue": "உண்மையான வருவாய்",
    "from verified & confirmed orders": "உறுதிப்படுத்தப்பட்ட ஆர்டர்களில் இருந்து",
    "total orders": "மொத்த ஆர்டர்கள்",
    "whatsapp & voice call pipeline": "WhatsApp & குரல் அழைப்பு பைப்லைன்",
    "customer leads": "வாடிக்கையாளர் லீட்ஸ்",
    "active customer conversations": "செயலில் உள்ள வாடிக்கையாளர் உரையாடல்கள்",
    "live voice calls": "நேரலை குரல் அழைப்புகள்",
    "gemini live leda voice active": "Gemini Live குரல் செயலில் உள்ளது",
    "ai sales conversion & roi proof analytics": "AI விற்பனை மாற்றம் & ROI பகுப்பாய்வு",
    "plans & pricing": "திட்டங்கள் & விலை",
    "active saas plan:": "செயலில் உள்ள SaaS திட்டம்:",
    "whatsapp & calls handled 24/7": "24/7 கையாளப்பட்ட அழைப்புகள் & அரட்டைகள்",
    "inquiry -> paid order conversion": "விசாரணை -> கட்டண ஆர்டர் மாற்றம்",
    "orders closed directly by ai": "AI நேரடியாக முடித்த ஆர்டர்கள்",
    "human agent time saved": "சேமிக்கப்பட்ட மனித உழைப்பு நேரம்",
    "hrs / 100+ automation savings": "மணிநேரம் / 100+ தானியங்கி சேமிப்பு",
    "rate": "விகிதம்",
    "live ai verified": "நேரலை AI சரிபார்க்கப்பட்டது",

    // 20-Agent AI Enterprise Fleet
    "20-agent ai enterprise fleet": "20 AI முகவர்கள் அணி",
    "autonomous enterprise mesh": "தானியங்கி Enterprise Mesh",
    "interactive agent dispatch tester": "முகவர்கள் சோதனை அமைப்பு",
    "live decision stream (chain-of-thought)": "நேரலை AI முடிவு ஓட்டம்",
    "total ai workforce": "மொத்த AI பணியாளர்கள்",
    "active on live whatsapp": "WhatsApp இல் செயலில் உள்ள முகவர்கள்",
    "average decision speed": "சராசரி முடிவு வேகம்",
    "autonomous accuracy": "தானியங்கி துல்லியம்",
    "all departments": "அனைத்து துறைகள்",
    "sales & revenue": "விற்பனை & வருவாய்",
    "customer support": "வாடிக்கையாளர் ஆதரவு",
    "logistics & finance": "தளவாடங்கள் & நிதி",
    "marketing & growth": "சந்தைப்படுத்தல் & வளர்ச்சி",
    "intelligence & sre": "நுண்ணறிவு & நிலைத்தன்மை",
    "across 5 key departments": "முக்கிய 5 துறைகளில்",
    "0 standby | 100% operational": "0 காத்திருப்பு | 100% இயங்குகிறது",
    "floor price margin guard active": "குறைந்தபட்ச விலை பாதுகாப்பு செயலில் உள்ளது",
    "24/7 fully autonomous": "24/7 முழு தானியங்கி",
    "co-pilot (human review)": "துணை பைலட்",
    "supervised": "மேற்பார்வை",

    // Stores Hub
    "multi-store management hub": "கடைகள் மேலாண்மை மையம்",
    "add new store": "புதிய கடையைச் சேர்க்கவும்",
    "refresh stores": "கடைகளைப் புதுப்பிக்கவும்",
    "total registered stores": "பதிவு செய்யப்பட்ட மொத்த கடைகள்",
    "active working store (this tab)": "செயலில் உள்ள கடை (இந்த தாவல்)",
    "active license keys": "செயலில் உள்ள உரிம சாவிகள்",
    "store name & id": "கடையின் பெயர் & ID",
    "category": "வகை",
    "plan tier": "திட்டம்",
    "owner & contact": "உரிமையாளர் & தொடர்பு",
    "active license": "உரிம நிலை",
    "orders / stats": "ஆர்டர்கள் / புள்ளிவிவரங்கள்",
    "tab & management actions": "செயல்கள் & மேலாண்மை",
    "switch": "மாறவும்",
    "open in new tab": "புதிய தாவலில் திறக்கவும்",
    "portal": "போர்டல்",
    "edit": "திருத்து",
    "no key issued": "சாவி வழங்கப்படவில்லை",
    "active here": "இங்கே செயலில் உள்ளது",
    "starter (rs. 1,900)": "Starter (ரூ. 1,900)",
    "pro (rs. 2,900)": "Pro (ரூ. 2,900)",
    "enterprise (rs. 3,500)": "Enterprise (ரூ. 3,500)",

    // General Buttons & Badges
    "close": "மூடு",
    "cancel": "ரத்துசெய்",
    "save": "சேமி",
    "save changes": "மாற்றங்களைச் சேமி",
    "save staff member": "பணியாளரைச் சேமி",
    "print label": "அச்சிடு",
    "copy whatsapp report": "WhatsApp அறிக்கையை நகலெடு",
    "filter by department:": "துறை வாரியாக வடிகட்டவும்:",
    "quick test scenario:": "விரைவு சோதனை காட்சி:",
    "simulate incoming message": "உள்வரும் செய்தியை உருவகப்படுத்தவும்",
    "dispatch & route test": "சோதித்து வழிநடத்தவும்",
    "ai reasoning stream (live)": "நேரலை AI பகுத்தறிவு ஓட்டம்",
    "waiting for live incoming whatsapp or voice activity...": "நேரலை வாட்ஸ்அப் அல்லது அழைப்புக்காக காத்திருக்கிறது..."
  }
};

const OMNISIX_TRANSLATIONS = {
  si: {},
  ta: {}
};

// Build normalized fast-lookup maps
for (const lang of ['si', 'ta']) {
  const src = OMNISIX_RAW_DICT[lang] || {};
  for (const [k, v] of Object.entries(src)) {
    OMNISIX_TRANSLATIONS[lang][normalizeI18nKey(k)] = v;
  }
}

function applyFullPageLanguage(lang) {
  if (!lang) lang = localStorage.getItem('omnisix_ui_lang') || 'en';
  localStorage.setItem('omnisix_ui_lang', lang);

  const switcher = document.getElementById('ui-lang-switcher');
  if (switcher && switcher.value !== lang) switcher.value = lang;

  const dict = OMNISIX_TRANSLATIONS[lang] || {};

  function translateNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const raw = node.nodeValue;
    const norm = normalizeI18nKey(raw);
    if (!norm) return;

    if (!node._omnisixOrig) {
      node._omnisixOrig = raw;
    }

    if (lang === 'en') {
      if (node._omnisixOrig) node.nodeValue = node._omnisixOrig;
    } else {
      const origNorm = normalizeI18nKey(node._omnisixOrig);
      if (dict[origNorm]) {
        const lead = raw.match(/^\\s*/)[0];
        const trail = raw.match(/\\s*$/)[0];
        node.nodeValue = lead + dict[origNorm] + trail;
      }
    }
  }

  function walkElement(el) {
    if (!el) return;
    const tag = el.tagName ? el.tagName.toUpperCase() : '';
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;

    // Direct text nodes
    for (let child = el.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === Node.TEXT_NODE) {
        translateNode(child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walkElement(child);
      }
    }

    // Placeholders
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      const ph = el.getAttribute('placeholder');
      if (ph) {
        if (!el.getAttribute('data-orig-ph')) el.setAttribute('data-orig-ph', ph);
        const origPh = el.getAttribute('data-orig-ph');
        const normPh = normalizeI18nKey(origPh);
        if (lang === 'en') {
          el.setAttribute('placeholder', origPh);
        } else if (dict[normPh]) {
          el.setAttribute('placeholder', dict[normPh]);
        }
      }
    }

    // Options
    if (tag === 'OPTION') {
      const text = el.innerText || el.textContent;
      if (text && el.value !== 'en' && el.value !== 'si' && el.value !== 'ta') {
        if (!el.getAttribute('data-orig-opt')) el.setAttribute('data-orig-opt', text.trim());
        const origOpt = el.getAttribute('data-orig-opt');
        const normOpt = normalizeI18nKey(origOpt);
        if (lang === 'en') {
          el.textContent = origOpt;
        } else if (dict[normOpt]) {
          el.textContent = dict[normOpt];
        }
      }
    }
  }

  // 1. Sidebar Walk
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) walkElement(sidebar);

  // 2. Top Nav Walk
  const topNav = document.querySelector('.whatzi-top-nav') || document.querySelector('header') || document.querySelector('.nav-right')?.parentElement;
  if (topNav) walkElement(topNav);

  // 3. Current Tab & Overview Walk
  const curTabEl = document.getElementById('tab-' + (typeof currentTab !== 'undefined' ? currentTab : 'overview'));
  if (curTabEl) walkElement(curTabEl);

  const overviewTab = document.getElementById('tab-overview');
  if (overviewTab && overviewTab !== curTabEl) walkElement(overviewTab);

  const agentsTab = document.getElementById('tab-agents');
  if (agentsTab && agentsTab !== curTabEl) walkElement(agentsTab);

  const storesTab = document.getElementById('tab-stores');
  if (storesTab && storesTab !== curTabEl) walkElement(storesTab);

  // 4. Modals
  document.querySelectorAll('.modal-overlay').forEach(m => walkElement(m));

  // 5. Breadcrumb & Title Sync
  if (typeof currentTab !== 'undefined' && typeof omnisixTitlesByLang !== 'undefined') {
    const langTitles = omnisixTitlesByLang[lang] || omnisixTitlesByLang['en'];
    const bTitle = document.getElementById('whatzi-cur-page-title');
    if (bTitle && langTitles[currentTab]) {
      bTitle.textContent = langTitles[currentTab];
    }
  }

  // 6. User Guide Dictionary
  if (typeof I18N_DICT !== 'undefined' && I18N_DICT[lang]) {
    const d = I18N_DICT[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (d[k]) el.textContent = d[k];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (d[k]) el.setAttribute('placeholder', d[k]);
    });
  }
}

function changeUILanguage(lang) {
  if (!lang) lang = 'si';
  applyFullPageLanguage(lang);
  updateGuideStepView(currentGuideStep);
}
`;

const startMarker = '// ─── 🌐 OmniSix AI Comprehensive Full-Page Translation Engine';
const endMarker = '// ─── Feature: Interactive 5-Step First-Time User Guide';

const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);

if (startIdx >= 0 && endIdx >= 0) {
  html = html.substring(0, startIdx) + newTranslationBlock + '\n\n' + html.substring(endIdx);
  fs.writeFileSync(targetFile, html, 'utf8');
  console.log('✅ Successfully replaced Translation Engine in public/admin.html!');
} else {
  console.error('❌ Markers not found in public/admin.html:', { startIdx, endIdx });
}
