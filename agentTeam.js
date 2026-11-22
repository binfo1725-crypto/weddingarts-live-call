// ─── OmniSix AI 20-Agent Autonomous Enterprise Fleet ──────────────────────────
// Multi-Agent Architecture: 20 Specialized Agent Roles across 5 Departments
// Provides autonomous decision routing, tool execution, and chain-of-thought audit.

const AGENT_ROSTER_DEFINITION = [
  // ─── DEPARTMENT A: SALES, REVENUE & CONVERSIONS (5 Agents) ───────────────────
  {
    id: 'agent_closer',
    dept: 'Sales & Revenue',
    name: 'චතුරිකා (Chathurika)',
    title: 'Senior Sales Closer',
    avatar: '🎯',
    description: 'මිලදී ගැනීමේ සූදානම ඇති පාරිභෝගිකයින් කඩිනමින් Checkout වෙත මෙහෙයවීම සහ ගෙවීම් ලබා ගැනීම.',
    directive: 'Focus aggressively on closing deals. Address final hesitations, emphasize stock urgency, and prompt for delivery details.',
    allowedTools: ['create_order', 'send_payment_details', 'apply_discount'],
    active: true
  },
  {
    id: 'agent_negotiator',
    dept: 'Sales & Revenue',
    name: 'දිනේෂ් (Dinesh)',
    title: 'Smart Price Negotiator',
    avatar: '💰',
    description: 'මිල අඩු කරන ලෙස ඉල්ලන විට Floor Price එක ආරක්ෂා කරමින් පැකේජ වට්ටම් සමඟ සාකච්ඡා කිරීම.',
    directive: 'Protect store margins. Never drop below product minimum floor price. Offer volume bundles, free shipping, or small vouchers instead of heavy cash discounts.',
    allowedTools: ['calculate_margin', 'apply_discount', 'suggest_bundle'],
    active: true
  },
  {
    id: 'agent_upsell',
    dept: 'Sales & Revenue',
    name: 'හිරුනි (Hiruni)',
    title: 'Smart Upsell & Combo Specialist',
    avatar: '✨',
    description: 'තෝරාගත් භාණ්ඩයට ගැළපෙන අමතර උපාංග සහ Premium Packages ස්වයංක්‍රීයව නිර්දේශ කිරීම.',
    directive: 'Recommend high-converting complementary products and bundles that increase average order value (AOV).',
    allowedTools: ['fetch_related_products', 'create_combo_offer'],
    active: true
  },
  {
    id: 'agent_wholesale',
    dept: 'Sales & Revenue',
    name: 'රොෂාන් (Roshan)',
    title: 'B2B & Wholesale Accounts Consultant',
    avatar: '🏢',
    description: 'තොග වෙළඳුන්, සාප්පු හිමියන් සහ Resellers සඳහා MOQ මිල ගණන් සහ Quotations සැකසීම.',
    directive: 'Handle high-quantity B2B buyers. Inquire business location, monthly purchase volume, and offer tiered volume discounts.',
    allowedTools: ['generate_quotation', 'set_wholesale_tier'],
    active: true
  },
  {
    id: 'agent_recovery',
    dept: 'Sales & Revenue',
    name: 'නෙත්මි (Nethmi)',
    title: 'Abandoned Cart & Lead Recovery',
    avatar: '⏰',
    description: 'මිල විමසා නිහඬ වූ පාරිභෝගිකයින් පැය 2කින් සහ පැය 24කින් ආචාරශීලීව නැවත ගෙන්වා ගැනීම.',
    directive: 'Re-engage quiet leads with gentle, personalized follow-ups highlighting limited stock and personalized delivery offers.',
    allowedTools: ['send_followup', 'check_cart_status'],
    active: true
  },

  // ─── DEPARTMENT B: CUSTOMER CARE & RETENTION (4 Agents) ──────────────────────
  {
    id: 'agent_concierge',
    dept: 'Customer Support',
    name: 'සහන් (Sahan)',
    title: '24/7 First-Response Concierge',
    avatar: '🛎️',
    description: 'තත්පර 1ක් ඇතුළත සංවාද පිළිගැනීම, භාෂාව (Sinhala/Singlish/English/Tamil) හඳුනා ගැනීම සහ වර්ගීකරණය.',
    directive: 'Welcome every incoming lead with warmth and high energy. Identify the preferred language and query category instantly.',
    allowedTools: ['route_department', 'detect_language'],
    active: true
  },
  {
    id: 'agent_resolver',
    dept: 'Customer Support',
    name: 'කාව්‍යා (Kavya)',
    title: 'Empathetic Issue & Return Resolver',
    avatar: '🤝',
    description: 'හානි වූ භාණ්ඩ, Returns, Refunds සහ පාරිභෝගික ගැටළු කාරුණිකව නිරාකරණය කිරීම.',
    directive: 'Show extreme empathy. Apologize sincerely for inconveniences and offer zero-hassle replacements or warranty solutions.',
    allowedTools: ['process_replacement', 'check_warranty'],
    active: true
  },
  {
    id: 'agent_vip',
    dept: 'Customer Support',
    name: 'සචිත් (Sachith)',
    title: 'VIP & High-Value Concierge',
    avatar: '👑',
    description: 'නිතර මිලදී ගන්නා VIP ගනුදෙනුකරුවන්ට විශේෂ සැලකිලි සහ ගෞරවනීය සේවාවක් ලබා දීම.',
    directive: 'Recognize repeat high-ticket customers. Provide concierge-level luxury tone, priority processing, and complimentary gifts.',
    allowedTools: ['check_customer_ltv', 'assign_vip_badge'],
    active: true
  },
  {
    id: 'agent_feedback',
    dept: 'Customer Support',
    name: 'දිලිනි (Dilini)',
    title: 'Post-Delivery Happiness & Review Driver',
    avatar: '⭐',
    description: 'පාර්සලය ලැබුණු පසු තත්ත්වය විමසීම, තෘප්තිමත් බව තහවුරු කර 5-Star Reviews ලබා ගැනීම.',
    directive: 'Check in 24 hours post-delivery. Request reviews, ratings, and unboxing photos with friendly Sinhala messaging.',
    allowedTools: ['request_review', 'log_satisfaction_score'],
    active: true
  },

  // ─── DEPARTMENT C: LOGISTICS, FULFILLMENT & FINANCE (4 Agents) ───────────────
  {
    id: 'agent_logistics',
    dept: 'Logistics & Finance',
    name: 'කවිඳු (Kavindu)',
    title: 'Courier Dispatch & Waybill Agent',
    avatar: '🚚',
    description: 'Koombiyo, Domex, Prompt X, Fardar Tracking තොරතුරු ක්ෂණිකව පරික්ෂා කර පාරිභෝගිකයාට දන්වීම.',
    directive: 'Provide real-time dispatch status, tracking links, and expected delivery dates to prevent repetitive calls.',
    allowedTools: ['lookup_tracking', 'generate_waybill', 'update_dispatch_status'],
    active: true
  },
  {
    id: 'agent_slip_auditor',
    dept: 'Logistics & Finance',
    name: 'ඉසුරු (Isuru)',
    title: 'Gemini Vision Payment Slip Auditor',
    avatar: '🧾',
    description: 'බැංකු තැන්පතු පත්‍රිකා, CDM රිසිට්පත් OCR මඟින් ස්කෑන් කර මුදල සහ ගිණුම් අංකය සනාථ කිරීම.',
    directive: 'Analyze receipt images with Gemini Vision. Extract bank, date, reference, and amount. Reject forged or fake receipts.',
    allowedTools: ['verify_slip_vision', 'confirm_order_paid'],
    active: true
  },
  {
    id: 'agent_address_verifier',
    dept: 'Logistics & Finance',
    name: 'මාලිකා (Malika)',
    title: 'Address & Destination Validator',
    avatar: '📍',
    description: 'ශ්‍රී ලංකාවේ නොමඟ යවන සුළු ලිපින, නොපැහැදිලි නගර සහ වැරදි දුරකථන අංක පිරිසිදු කර තහවුරු කිරීම.',
    directive: 'Verify full delivery address, nearest landmark, and two working contact numbers before dispatching parcels.',
    allowedTools: ['clean_sri_lankan_address', 'validate_phone_format'],
    active: true
  },
  {
    id: 'agent_cod_converter',
    dept: 'Logistics & Finance',
    name: 'අනුෂ්ක (Anushka)',
    title: 'COD to Pre-Paid Incentive Converter',
    avatar: '💳',
    description: 'Courier Returns අඩු කිරීම සඳහා Cash on Delivery පාරිභෝගිකයින් බැංකු තැන්පතු වෙත දිරිගැන්වීම.',
    directive: 'Encourage direct bank transfers by offering a 5% discount or free extra gift, lowering courier return costs.',
    allowedTools: ['offer_prepaid_discount', 'send_bank_details'],
    active: true
  },

  // ─── DEPARTMENT D: MARKETING, CONTENT & CAMPAIGNS (4 Agents) ─────────────────
  {
    id: 'agent_broadcast',
    dept: 'Marketing & Growth',
    name: 'තරිඳු (Tharindu)',
    title: 'Safe Spintax Broadcast Strategist',
    avatar: '📢',
    description: 'WhatsApp Anti-Ban නීති රකිමින් විචල්‍ය පණිවිඩ (Spintax) මඟින් Outbound Campaigns සැලසුම් කිරීම.',
    directive: 'Generate safe, high-converting spintax messages with jitter delays (8-22s) to protect numbers from bans.',
    allowedTools: ['generate_spintax', 'dispatch_campaign'],
    active: true
  },
  {
    id: 'agent_copywriter',
    dept: 'Marketing & Growth',
    name: 'නිම්නා (Nimna)',
    title: 'Creative Product Storyteller',
    avatar: '✍️',
    description: 'භාණ්ඩවල ගුණාත්මක බව සහ ප්‍රයෝජන විස්තර කෙරෙන ආකර්ෂණීය සිංහල Teaser Descriptions ලිවීම.',
    directive: 'Write emotion-driven, catchy product descriptions with Sinhala storytelling and clear call-to-actions.',
    allowedTools: ['format_product_story', 'generate_social_caption'],
    active: true
  },
  {
    id: 'agent_seasonal',
    dept: 'Marketing & Growth',
    name: 'රුචිර (Ruchira)',
    title: 'Festival & Seasonal Promo Director',
    avatar: '🎉',
    description: 'අවුරුදු, නත්තල්, වෙසක්, රාමසාන් සහ Payday Flash Sales සඳහා විශේෂ දීමනා ස්වයංක්‍රීයව දියත් කිරීම.',
    directive: 'Detect upcoming holidays and payday weekends. Launch timely promotional triggers and countdown deals.',
    allowedTools: ['schedule_holiday_offer', 'set_flash_sale_pricing'],
    active: true
  },
  {
    id: 'agent_reorder',
    dept: 'Marketing & Growth',
    name: 'තක්ෂි (Thakshi)',
    title: 'Predictive Re-Order & Cycle Specialist',
    avatar: '🔄',
    description: 'පාරිභෝගිකයා මිලදී ගත් භාණ්ඩයේ කාලසීමාව නිමවන විට (උදා: දින 30න්) නැවත මිලදී ගැනීමට මතක් කිරීම.',
    directive: 'Calculate product lifespan. Contact customers right before supplies finish to drive high lifetime repeat revenue.',
    allowedTools: ['predict_reorder_date', 'send_reorder_nudge'],
    active: true
  },

  // ─── DEPARTMENT E: INTELLIGENCE, SAFETY & SUPERVISION (3 Agents) ──────────────
  {
    id: 'agent_deescalator',
    dept: 'Intelligence & Supervision',
    name: 'පසිඳු (Pasindu)',
    title: 'Crisis & Negative Sentiment Firefighter',
    avatar: '🛡️',
    description: 'දැඩි කෝපයෙන් සිටින පාරිභෝගිකයින් ක්ෂණිකව සන්සුන් කිරීම සහ AI නිහඬ කර කළමනාකාරීත්වය දැනුවත් කිරීම.',
    directive: 'Detect acute anger or threats. Immediately pause automated replies, de-escalate with respect, and page human manager.',
    allowedTools: ['mute_ai_takeover', 'page_manager_whatsapp'],
    active: true
  },
  {
    id: 'agent_market_scout',
    dept: 'Intelligence & Supervision',
    name: 'නිරෝෂ් (Nirosh)',
    title: 'Competitor Benchmark & Objection Scout',
    avatar: '🔍',
    description: '"වෙන තැනක මීට වඩා අඩුයි" වැනි පාරිභෝගික විරෝධතා අපේ වගකීම හා උසස් තත්ත්වය පෙන්වා ජය ගැනීම.',
    directive: 'Counter competitor price objections by emphasizing superior build quality, official warranty, and fast Sri Lankan delivery.',
    allowedTools: ['lookup_market_rates', 'explain_value_advantage'],
    active: true
  },
  {
    id: 'agent_prime',
    dept: 'Intelligence & Supervision',
    name: 'OmniSix Prime (චීෆ් ඒජන්ට්)',
    title: 'Autonomous Master Team Orchestrator',
    avatar: '🧠',
    description: 'ඉතිරි ඒජන්තවරුන් 19 දෙනාගේ තීරණ, වැඩ බෙදාහැරීම සහ සමස්ත CRM කාර්යක්ෂමතාව කළමනාකරණය කරන ප්‍රධානියා.',
    directive: 'Analyze incoming conversation stream. Dynamically delegate work to the best matching specialized agent. Maintain audit log.',
    allowedTools: ['delegate_agent', 'audit_decision_stream'],
    active: true
  }
];

class AgentFleetManager {
  constructor(db) {
    this.db = db;
    this.operatingMode = 'autonomous'; // 'autonomous' | 'copilot' | 'supervised'
    this.recentDecisions = [];
    this.initFleet();
  }

  initFleet() {
    const existing = this.db.get('ai_agent_fleet');
    if (!existing || !Array.isArray(existing) || existing.length === 0) {
      this.db.set('ai_agent_fleet', AGENT_ROSTER_DEFINITION);
    }
  }

  getFleet() {
    const fleet = this.db.get('ai_agent_fleet');
    return Array.isArray(fleet) && fleet.length > 0 ? fleet : AGENT_ROSTER_DEFINITION;
  }

  toggleAgent(agentId, activeState) {
    const fleet = this.getFleet().map(a => {
      if (a.id === agentId) {
        return { ...a, active: activeState !== undefined ? activeState : !a.active };
      }
      return a;
    });
    this.db.set('ai_agent_fleet', fleet);
    return fleet.find(a => a.id === agentId);
  }

  setOperatingMode(mode) {
    if (['autonomous', 'copilot', 'supervised'].includes(mode)) {
      this.operatingMode = mode;
      this.db.set('ai_agent_fleet_mode', mode);
    }
    return this.operatingMode;
  }

  getOperatingMode() {
    return this.db.get('ai_agent_fleet_mode') || this.operatingMode;
  }

  recordDecision(agentId, customerPhone, summary, reasoning = '') {
    const agent = this.getFleet().find(a => a.id === agentId) || { name: agentId, title: 'AI Agent' };
    const entry = {
      id: 'dec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      agentId,
      agentName: agent.name,
      agentTitle: agent.title,
      customerPhone,
      summary,
      reasoning,
      timestamp: new Date().toISOString()
    };
    this.recentDecisions.unshift(entry);
    if (this.recentDecisions.length > 100) this.recentDecisions.pop();
    return entry;
  }

  getRecentDecisions(limit = 30) {
    return this.recentDecisions.slice(0, limit);
  }

  /**
   * Intelligently routes customer message to the best specialized agent among the 20
   */
  resolveBestAgent(customerText, context = {}) {
    const text = (customerText || '').toLowerCase().trim();
    const fleet = this.getFleet();

    // 🛡️ Security Sentinel check
    const injectionCheck = PromptInjectionShield ? PromptInjectionShield.inspect(customerText) : { isSuspicious: false };
    if (injectionCheck.isSuspicious) {
      const guard = fleet.find(a => a.id === 'agent_guard' && a.active);
      if (guard) return { ...guard, isGuarded: true, safeReply: injectionCheck.safeReply };
    }

    const isAngry = /horu|fake|polici|police|case|boruwa|anthimayi|damage|wada na|wada karanne na|balu|chora/i.test(text);
    const isSlip = !!context.isSlip || /slip|reciept|receipt|gewwa|damma|transfer/i.test(text);
    const isTrack = /tracking|track|kohedo|koheda|deliver|domex|koombiyo|prompt|fardar|enakan|thama na/i.test(text);
    const isBargain = /\badu\b|\baduwen\b|\baduwata\b|discount|offer|gana wadi|last price|keeyatada|\bwasi\b/i.test(text);
    const isWholesale = /wholesale|bulk|thoga|quantity|pcs|shop|resell/i.test(text);
    const isReorder = /aye ganna|aye one|kalin gaththa|iwarai/i.test(text);
    const isReview = /elakiri|supiri|harima lassanayi|sthuthiyi|badu awa|hodayi/i.test(text);
    const isAddress = /(?:road|rd|mawatha|street|lane|st|no\.?|\d+\/\d+|nawathinna|palatha|distrikkaya)/i.test(text);
    const isCOD = /\bcod\b|cash on delivery|athata gewanna|badu labunama/i.test(text);
    const isCompetitor = /wena thenaka|wena shop|anith kattiya|wena thanaka|gana adui/i.test(text);
    const isIssue = /return|maru karanna|exchange|warrenty|warranty|kadila|kedila|wada na/i.test(text);
    const isSeasonal = /awurudu|avurudu|christmas|vesak|ramadan|payday|flash sale|black friday/i.test(text);
    const isGreeting = /^(hi|hello|hey|ayubowan|ayubbo|vanakkam|good morning|suba dawasak)$/i.test(text);
    const isCheckout = /order karanna|mata ona|confirm karanna|buy|ganne kohomada|danna order/i.test(text);

    let targetId = 'agent_closer'; // Default sales closer
    if (isAngry) targetId = 'agent_deescalator';
    else if (isIssue) targetId = 'agent_resolver';
    else if (isSlip) targetId = 'agent_slip_auditor';
    else if (isSeasonal) targetId = 'agent_seasonal';
    else if (isCompetitor) targetId = 'agent_market_scout';
    else if (isWholesale) targetId = 'agent_wholesale';
    else if (isBargain) targetId = 'agent_negotiator';
    else if (isCOD) targetId = 'agent_cod_converter';
    else if (isTrack) targetId = 'agent_logistics';
    else if (isAddress) targetId = 'agent_address_verifier';
    else if (isReorder) targetId = 'agent_reorder';
    else if (isReview) targetId = 'agent_feedback';
    else if (isGreeting) targetId = 'agent_concierge';
    else if (context.isAbandoned || context.isFollowUp) targetId = 'agent_recovery';
    else if (context.isVip) targetId = 'agent_vip';
    else if (isCheckout) targetId = 'agent_closer';

    const chosen = fleet.find(a => a.id === targetId && a.active);
    return chosen || fleet.find(a => a.id === 'agent_prime') || fleet[0];
  }
}

module.exports = {
  AGENT_ROSTER_DEFINITION,
  AgentFleetManager
};
