// ─── Shared Delivery Details Toggle & Owner Referral Helper ─────────────────
// Mirrors OmniSix Android APK delivery toggle & owner-referral behavior cleanly across web server modules.

function isDeliveryEnabled(settings) {
  return !(settings && settings.isDeliveryDetailsEnabled === false);
}

function toInternationalWhatsAppDigits(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length === 10) {
    return '94' + digits.slice(1);
  }
  if (digits.startsWith('94') && digits.length >= 11 && digits.length <= 12) {
    return digits;
  }
  if (digits.length >= 9 && digits.length <= 15) {
    return digits;
  }
  return null;
}

function formatDigitsForDisplay(digits) {
  if (!digits) return '';
  const clean = String(digits).replace(/\D/g, '');
  if (clean.startsWith('94') && clean.length === 11) {
    return '0' + clean.slice(2);
  }
  return clean;
}

function resolveOwnerContactNumber(business = {}, settings = {}) {
  const bPhone = String((business && business.phone) || '').trim();
  if (bPhone) return bPhone;

  const bWa = String((business && business.whatsappPhone) || '').trim();
  if (bWa) return formatDigitsForDisplay(bWa) || bWa;

  const alertPhone = String((settings && settings.ownerAlertPhone) || '').trim();
  if (alertPhone) return alertPhone;

  const kb = String((business && business.dataset) || '');
  if (!kb.trim()) return '';

  const contactLabelRegex = /(?:owner|hotline|whatsapp|contact|call|දූරකථන|දුරකථන|අංක)/i;
  const bankExcludeRegex = /(?:bank|account|ගිණු|boc|commercial|sampath|hnb|peoples)/i;
  const phoneRegex = /(?:\+94|0)[\s-]?7\d[\s-]?\d{3}[\s-]?\d{4}|\b0\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/;
  const waMeRegex = /wa\.me\/(\d{9,15})/;

  for (const line of kb.split(/\r?\n/)) {
    if (!contactLabelRegex.test(line) || bankExcludeRegex.test(line)) continue;
    const phoneMatch = line.match(phoneRegex);
    if (phoneMatch && phoneMatch[0]) return phoneMatch[0].trim();
    const waMatch = line.match(waMeRegex);
    if (waMatch && waMatch[1]) return formatDigitsForDisplay(waMatch[1]);
  }

  const anyWaMatch = kb.match(waMeRegex);
  if (anyWaMatch && anyWaMatch[1]) {
    return formatDigitsForDisplay(anyWaMatch[1]);
  }
  return '';
}

function resolveOwnerWhatsAppUrl(business = {}, settings = {}) {
  const contact = resolveOwnerContactNumber(business, settings);
  const intl = toInternationalWhatsAppDigits(contact);
  return intl ? `https://wa.me/${intl}` : null;
}

function stripDeliveryDetailsFromDataset(content) {
  if (!content || typeof content !== 'string') return content || '';
  const inlineParenRegex = /\s*\([^)]*(?:delivery|courier|cash on delivery|\bcod\b|ඩිලිවරි|බෙදාහැරී)[^)]*\)/gi;
  const deliveryQaOrBulletRegex = /(?:delivery\s*(?:time|fee|fees|charge|charges|rate)|free\s*delivery|island-?wide\s*delivery|courier\s*(?:return|delivery|service|charge)|cash\s*on\s*delivery|\bcod\b\s*return|ඩිලිවරි\s*ගාස්තුව|බෙදාහැරීමේ|නිවසටම\s*ගෙන්වා|ලිපිනය,?\s*ළඟම\s*නගරය)/i;

  const kept = [];
  let skipImmediateAnswer = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const cleanedLine = rawLine.replace(inlineParenRegex, '').trimEnd();
    const trimmed = cleanedLine.trim();
    if (!trimmed) {
      skipImmediateAnswer = false;
      kept.push('');
      continue;
    }

    const isQuestionLine = /^(?:Q\s*\d*\s*:|\d+\.\s*)/i.test(trimmed);
    const isAnswerLine = /^A\s*\d*\s*:/i.test(trimmed);

    if (skipImmediateAnswer && isAnswerLine) {
      skipImmediateAnswer = false;
      continue;
    }
    skipImmediateAnswer = false;

    if (deliveryQaOrBulletRegex.test(trimmed)) {
      if (isQuestionLine) skipImmediateAnswer = true;
      continue;
    }
    kept.push(cleanedLine);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeLangBucket(detectedLang) {
  const l = String(detectedLang || 'Sinhala');
  if (l === 'English') return 'English';
  if (l === 'Tamil') return 'Tamil';
  if (l === 'Tanglish') return 'Tanglish';
  if (l === 'Singlish') return 'Singlish';
  return 'Sinhala';
}

function buildOwnerOrderReferralReply(business = {}, settings = {}, detectedLang = 'Sinhala') {
  const ownerNum = resolveOwnerContactNumber(business, settings);
  const waUrl = resolveOwnerWhatsAppUrl(business, settings);
  const waLine = waUrl ? `\n👉 ${waUrl}` : '';
  const lang = normalizeLangBucket(detectedLang);

  if (ownerNum) {
    if (lang === 'Tamil') {
      return `📞 *ஆர்டர் செய்ய:*\n\nஉங்கள் ஆர்டரை வழங்க எங்கள் Store Owner ஐ நேரடியாக தொடர்பு கொள்ளவும் 👇\n📱 *Owner WhatsApp / Call:* ${ownerNum}${waLine}\n\n_மேலே உள்ள இலக்கத்திற்கு WhatsApp அல்லது Call செய்து ஆர்டர் செய்யலாம்!_ 😊`;
    }
    if (lang === 'Tanglish') {
      return `📞 *Order Panna:*\n\nOrder place panna engaloda Store Owner ah neradiya contact pannunga 👇\n📱 *Owner WhatsApp / Call:* ${ownerNum}${waLine}\n\n_Mela irukka number ku WhatsApp or Call panni order pannunga!_ 😊`;
    }
    if (lang === 'English') {
      return `📞 *To Place an Order:*\n\nPlease contact our Store Owner directly on WhatsApp or Call to place your order 👇\n📱 *Owner WhatsApp / Call:* ${ownerNum}${waLine}\n\n_Reach out directly to the number above and the owner will assist you right away!_ 😊`;
    }
    if (lang === 'Singlish') {
      return `📞 *Order ekak danna:*\n\nOrder ekak danna ape Store Owner ekka kelinma contact wenna 👇\n📱 *Owner WhatsApp / Call:* ${ownerNum}${waLine}\n\n_Uda thiyena number ekata WhatsApp ho Call karala order eka danna!_ 😊`;
    }
    return `📞 *ඇණවුමක් ලබා දීමට:*\n\nඇණවුමක් සිදු කිරීමට අපගේ Store Owner සමඟ සෘජුවම සම්බන්ධ වන්න 👇\n📱 *Owner WhatsApp / Call:* ${ownerNum}${waLine}\n\n_ඉහත අංකයට WhatsApp හෝ Call කර ඔබට අවශ්‍ය ඇණවුම සිදු කරන්න!_ 😊`;
  }

  if (lang === 'Tamil') {
    return `📞 *ஆர்டர் செய்ய:*\n\nஉங்கள் ஆர்டரை வழங்க எங்கள் Store Owner ஐ நேரடியாக தொடர்பு கொள்ளவும் — விரைவில் உதவுவோம்! 😊`;
  }
  if (lang === 'Tanglish') {
    return `📞 *Order Panna:*\n\nOrder place panna engaloda Store Owner ah neradiya contact pannunga — owner seekirame help pannuvaanga! 😊`;
  }
  if (lang === 'English') {
    return `📞 *To Place an Order:*\n\nPlease reach out to our Store Owner directly right here — the owner will assist you with your order shortly! 😊`;
  }
  if (lang === 'Singlish') {
    return `📞 *Order ekak danna:*\n\nOrder ekak danna ape Store Owner ekka kelinma contact wenna — ikmanata owner udaw karayi! 😊`;
  }
  return `📞 *ඇණවුමක් ලබා දීමට:*\n\nඇණවුමක් සිදු කිරීමට කරුණාකර අපගේ Store Owner සමඟ සෘජුවම සම්බන්ධ වන්න — ඉක්මනින්ම ඔබව සම්බන්ධ කරගනු ඇත! 😊`;
}

function buildOwnerOrderShortCta(business = {}, settings = {}, detectedLang = 'Sinhala') {
  const ownerNum = resolveOwnerContactNumber(business, settings);
  const waUrl = resolveOwnerWhatsAppUrl(business, settings);
  const waSuffix = waUrl ? `\n👉 ${waUrl}` : '';
  const lang = normalizeLangBucket(detectedLang);

  if (ownerNum) {
    if (lang === 'Tamil') {
      return `📞 _ஆர்டர் செய்ய Store Owner ஐ தொடர்பு கொள்ளவும்:_ *${ownerNum}*${waSuffix} 😊`;
    }
    if (lang === 'Tanglish') {
      return `📞 _Order panna Store Owner ah contact pannunga:_ *${ownerNum}*${waSuffix} 😊`;
    }
    if (lang === 'English') {
      return `📞 _To place an order, please contact our Store Owner directly:_ *${ownerNum}*${waSuffix} 😊`;
    }
    if (lang === 'Singlish') {
      return `📞 _Order karanna ape Owner number ekata contact karanna:_ *${ownerNum}*${waSuffix} 😊`;
    }
    return `📞 _Order කිරීමට අවශ්‍ය නම් අපගේ Owner අංකයට සම්බන්ධ වන්න:_ *${ownerNum}*${waSuffix} 😊`;
  }

  if (lang === 'Tamil') {
    return `📞 _ஆர்டர் செய்ய Store Owner ஐ நேரடியாக தொடர்பு கொள்ளவும்!_ 😊`;
  }
  if (lang === 'Tanglish') {
    return `📞 _Order panna Store Owner ah neradiya contact pannunga!_ 😊`;
  }
  if (lang === 'English') {
    return `📞 _To place an order, please contact our Store Owner directly!_ 😊`;
  }
  if (lang === 'Singlish') {
    return `📞 _Order karanna ape Store Owner ekka kelinma contact wenna!_ 😊`;
  }
  return `📞 _Order කිරීමට අවශ්‍ය නම් Store Owner සමඟ සෘජුවම සම්බන්ධ වන්න!_ 😊`;
}

function buildQuickOrderReply(business = {}, settings = {}, detectedLang = 'Sinhala') {
  if (isDeliveryEnabled(settings)) {
    const bizName = (business && business.name) || 'Store';
    const bankDetails = (business && business.bankDetails) || 'ගිණුම් විස්තර සඳහා විමසන්න';
    return `🛒 *${bizName} — Fast Order Placement:*\n\nඔබගේ ඇණවුම අදම තහවුරු කිරීමට කරුණාකර පහත විස්තර 4 එවන්න:\n\n1️⃣ *ඔබගේ නම (Full Name):*\n2️⃣ *අවශ්‍ය භාණ්ඩය සහ ප්‍රමාණය (Item & Qty):*\n3️⃣ *ලැබිය යුතු ලිපිනය (Delivery Address):*\n4️⃣ *දුරකථන අංක 1 හෝ 2ක් (Phone Numbers):*\n\n🏦 *බැංකු ගිණුම් විස්තර:*\n${bankDetails}\n\n_ස්ලිප් පතක් හෝ Cash on Delivery (COD) මගින් ලබාගත හැක. විස්තර ලැබුණු සැණින් අපගේ Dispatch කණ්ඩායම පැකේජය සූදානම් කරනු ඇත!_ 🚚✨`;
  }
  return buildOwnerOrderReferralReply(business, settings, detectedLang);
}

function buildQuickCatalogReply(business = {}, products = [], settings = {}, detectedLang = 'Sinhala') {
  if (!Array.isArray(products) || products.length === 0) return null;
  const bizName = (business && business.name) || 'Store';
  let catMsg = `📦 *${bizName} — Products & Pricing Catalog:*\n\n`;
  products.slice(0, 8).forEach((p, idx) => {
    catMsg += `${idx + 1}. *${p.name}* — Rs. ${(p.price || 0).toLocaleString()}\n`;
    if (p.description) catMsg += `   _${p.description}_\n`;
  });
  if (isDeliveryEnabled(settings)) {
    catMsg += `\n🚚 *Delivery:* ${(business && business.deliveryPolicy) || 'දිවයින පුරා බෙදාහැරීම දින 2-3ක් ඇතුළත'}\n`;
    catMsg += `\n💬 *ඕනෑම භාණ්ඩයක Photo එකක් බැලීමට* භාණ්ඩයේ නම එවන්න (උදා: "Photo")\n🛒 *ඇණවුම් කිරීමට* "2" හෝ "Order" ලෙස එවන්න!`;
  } else {
    catMsg += `\n💬 *ඕනෑම භාණ්ඩයක Photo එකක් බැලීමට* භාණ්ඩයේ නම එවන්න (උදා: "Photo")\n${buildOwnerOrderShortCta(business, settings, detectedLang)}`;
  }
  return catMsg;
}

function buildProductPhotoCaption(product = {}, index = 0, total = 1, business = {}, settings = {}, detectedLang = 'Sinhala') {
  if (index > 0) {
    return `📸 *${product.name}* (${index + 1}/${total})`;
  }
  const countPart = total > 1 ? ` (Photo 1/${total})` : '';
  const priceLine = `💰 මිල: Rs. ${(product.price || 0).toLocaleString()}`;
  const descLine = product.description ? `${product.description}\n` : '';
  const footerLine = isDeliveryEnabled(settings)
    ? '📦 ඇණවුම් කිරීමට ඔබගේ නම සහ ලිපිනය එවන්න.'
    : buildOwnerOrderShortCta(business, settings, detectedLang);
  return `📸 *${product.name}*${countPart}\n${priceLine}\n${descLine}${footerLine}`;
}

function buildQuickActionsMenu(effectiveLang = 'Sinhala', deliveryEnabled = true) {
  if (deliveryEnabled) {
    if (effectiveLang === 'English') {
      return '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Quick Actions (Reply Number):*\n1️⃣ *View Full Catalog & Prices*\n2️⃣ *Confirm Order & Delivery*\n3️⃣ *Connect with Human Agent*';
    }
    if (effectiveLang === 'Tamil' || effectiveLang === 'Tanglish') {
      return '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *விரைவு தேர்வுகள் (எண்ணை அனுப்பவும்):*\n1️⃣ *தயாரிப்பு பட்டியல் & விலை*\n2️⃣ *ஆர்டரை உறுதிப்படுத்தவும்*\n3️⃣ *மனித சேவையாளருடன் பேசவும்*';
    }
    if (effectiveLang === 'Singlish') {
      return '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Quick Actions (Number eka reply karanna):*\n1️⃣ *Catalog & Price List balanna*\n2️⃣ *Order eka Confirm karanna*\n3️⃣ *Agent kenek ekka katha karanna*';
    }
    return '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *ක්ෂණික ක්‍රියාකාරකම් (අංකය එවන්න):*\n1️⃣ *භාණ්ඩ නාමාවලිය සහ මිල ගණන්*\n2️⃣ *ඇණවුම තහවුරු කිරීම (Order Now)*\n3️⃣ *පාරිභෝගික සේවා නිලධාරියෙකු ඇමතීම*';
  }

  if (effectiveLang === 'English') {
    return '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Quick Actions (Reply Number):*\n1️⃣ *View Full Catalog & Prices*\n2️⃣ *Place an Order (Contact Owner)*\n3️⃣ *Connect with Human Agent*';
  }
  if (effectiveLang === 'Tamil' || effectiveLang === 'Tanglish') {
    return '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *விரைவு தேர்வுகள் (எண்ணை அனுப்பவும்):*\n1️⃣ *தயாரிப்பு பட்டியல் & விலை*\n2️⃣ *ஆர்டர் செய்ய (Owner தொடர்பு எண்)*\n3️⃣ *மனித சேவையாளருடன் பேசவும்*';
  }
  if (effectiveLang === 'Singlish') {
    return '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *Quick Actions (Number eka reply karanna):*\n1️⃣ *Catalog & Price List balanna*\n2️⃣ *Order ekak danna (Owner Number)*\n3️⃣ *Agent kenek ekka katha karanna*';
  }
  return '\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ *ක්ෂණික ක්‍රියාකාරකම් (අංකය එවන්න):*\n1️⃣ *භාණ්ඩ නාමාවලිය සහ මිල ගණන්*\n2️⃣ *ඇණවුම් කිරීමට (Owner අංකය)*\n3️⃣ *පාරිභෝගික සේවා නිලධාරියෙකු ඇමතීම*';
}

function buildDeliveryDisabledPromptBlock(business = {}, settings = {}) {
  const ownerNum = resolveOwnerContactNumber(business, settings);
  const waUrl = resolveOwnerWhatsAppUrl(business, settings);
  const ownerContactDisplay = ownerNum
    ? `${ownerNum}${waUrl ? ` (${waUrl})` : ''}`
    : '(Ask the customer to contact/wait for our Store Owner directly here)';

  return `\n=== 🚫 DELIVERY DETAILS DISABLED BY STORE OWNER (MANDATORY ORDER REFERRAL RULES) ===
Store Owner Direct Contact Number (For All Orders): ${ownerContactDisplay}
- STRICTLY FORBIDDEN: NEVER ask the customer to send their Full Name, Delivery Address, Phone Numbers, Landmark, City, or order checkout form!
- STRICTLY FORBIDDEN: NEVER mention delivery fees, courier services, delivery timeframes, or Cash on Delivery (COD), and NEVER output automated checkout/order confirmation tags!
- WHENEVER a customer wants to place an order, buy an item/package, confirms a purchase, OR asks about delivery / Cash on Delivery ("order ekak danna one", "kohomada ganne", "cod thiyenawada", "delivery kohomada"):
  * Warmly share the product/package pricing (without mentioning delivery fees or COD) and direct them to contact our Store Owner directly on WhatsApp or Call at:
    ${ownerNum ? `📱 *Owner WhatsApp / Call:* ${ownerNum}${waUrl ? `\n    👉 ${waUrl}` : ''}` : '💬 Contact our Store Owner directly here.'}
  * Always respond in the customer's matching language!
=== END MANDATORY ORDER REFERRAL RULES ===\n`;
}

module.exports = {
  isDeliveryEnabled,
  toInternationalWhatsAppDigits,
  formatDigitsForDisplay,
  resolveOwnerContactNumber,
  resolveOwnerWhatsAppUrl,
  stripDeliveryDetailsFromDataset,
  buildOwnerOrderReferralReply,
  buildOwnerOrderShortCta,
  buildQuickOrderReply,
  buildQuickCatalogReply,
  buildProductPhotoCaption,
  buildQuickActionsMenu,
  buildDeliveryDisabledPromptBlock
};
