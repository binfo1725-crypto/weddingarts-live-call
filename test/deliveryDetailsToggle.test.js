const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SERVER_DIR = path.resolve(__dirname, '..');

test('deliveryPolicyHelper resolves owner number from phone, whatsappPhone, ownerAlertPhone, and KB fallback', () => {
  const helper = require(path.join(SERVER_DIR, 'deliveryPolicyHelper.js'));

  assert.equal(helper.isDeliveryEnabled(undefined), true);
  assert.equal(helper.isDeliveryEnabled({}), true);
  assert.equal(helper.isDeliveryEnabled({ isDeliveryDetailsEnabled: true }), true);
  assert.equal(helper.isDeliveryEnabled({ isDeliveryDetailsEnabled: false }), false);

  assert.equal(
    helper.resolveOwnerContactNumber(
      { phone: '077 123 4567', whatsappPhone: '94710000000', dataset: 'Hotline: 076 210 7801' },
      { ownerAlertPhone: '0720000000' }
    ),
    '077 123 4567'
  );
  assert.equal(
    helper.resolveOwnerWhatsAppUrl(
      { phone: '077 123 4567' },
      {}
    ),
    'https://wa.me/94771234567'
  );

  assert.equal(
    helper.resolveOwnerContactNumber(
      { phone: '', whatsappPhone: '94762107801', dataset: '' },
      {}
    ),
    '0762107801'
  );

  assert.equal(
    helper.resolveOwnerContactNumber(
      {
        phone: '',
        whatsappPhone: '',
        dataset: [
          'Bank of Ceylon (BOC): Account 92949122',
          '📞 WhatsApp / Hotline: 076 210 7801',
          '👉 Direct Chat Link: https://wa.me/94762107801'
        ].join('\n')
      },
      { ownerAlertPhone: '' }
    ),
    '076 210 7801'
  );

  assert.equal(
    helper.resolveOwnerWhatsAppUrl(
      { phone: '', whatsappPhone: '', dataset: 'WhatsApp: https://wa.me/94762107801' },
      {}
    ),
    'https://wa.me/94762107801'
  );
});

test('deliveryPolicyHelper strips delivery/COD details from dataset while keeping product pricing', () => {
  const helper = require(path.join(SERVER_DIR, 'deliveryPolicyHelper.js'));
  const raw = [
    '- 12x18 inch: Rs. 4800 (Delivery Rs. 450)',
    '- 16x24 inch: Rs. 7800 (Free Delivery)',
    'Q: Frame delivery time?',
    'A: 3-5 days island-wide delivery.',
    '📞 WhatsApp / Hotline: 076 210 7801'
  ].join('\n');

  const cleaned = helper.stripDeliveryDetailsFromDataset(raw);
  assert.ok(cleaned.includes('- 12x18 inch: Rs. 4800'));
  assert.ok(cleaned.includes('- 16x24 inch: Rs. 7800'));
  assert.ok(cleaned.includes('076 210 7801'));
  assert.equal(cleaned.includes('Delivery Rs. 450'), false);
  assert.equal(cleaned.includes('Free Delivery'), false);
  assert.equal(cleaned.includes('3-5 days'), false);
});

test('HybridFastCacheEngine and CustomerArchetypeEngine send owner number instead of asking details when delivery disabled', () => {
  const { HybridFastCacheEngine, CustomerArchetypeEngine } = require(path.join(SERVER_DIR, 'ai_engines.js'));

  const biz = {
    id: 'st_shop',
    name: 'ST Store',
    category: 'retail',
    phone: '076 210 7801',
    whatsappPhone: '94762107801',
    dataset: 'ST Store items'
  };
  const products = [{ name: 'Smart Watch Pro', price: 4500, description: 'AMOLED watch' }];

  // When enabled (default) -> preserves existing COD & courier delivery info
  const enabledDeliveryReply = HybridFastCacheEngine.resolve('delivery keeyada?', biz, products, 'Singlish', { isDeliveryDetailsEnabled: true });
  assert.ok(enabledDeliveryReply && enabledDeliveryReply.includes('Cash on Delivery'));

  // When disabled -> no COD, no Name/Address/Phone request; sends owner's number instead
  const disabledSettings = { isDeliveryDetailsEnabled: false };
  const disabledDeliveryReply = HybridFastCacheEngine.resolve('delivery keeyada?', biz, products, 'Singlish', disabledSettings);
  assert.ok(disabledDeliveryReply, 'Expected owner referral reply for delivery query when disabled');
  assert.ok(disabledDeliveryReply.includes('076 210 7801'));
  assert.ok(disabledDeliveryReply.includes('https://wa.me/94762107801'));
  assert.equal(/Cash on Delivery|Delivery|ලිපිනය|සම්පූර්ණ නම/i.test(disabledDeliveryReply), false);

  const disabledOrderReply = HybridFastCacheEngine.resolve('order ekak danna one', biz, products, 'English', disabledSettings);
  assert.ok(disabledOrderReply && disabledOrderReply.includes('076 210 7801'));
  assert.equal(/Full Name|Delivery Address|Mobile Number/i.test(disabledOrderReply), false);

  const disabledPriceReply = HybridFastCacheEngine.resolve('price kiyada', biz, products, 'Sinhala', disabledSettings);
  assert.ok(disabledPriceReply && disabledPriceReply.includes('076 210 7801'));
  assert.equal(/Cash on Delivery/i.test(disabledPriceReply), false);

  const impulseDisabled = CustomerArchetypeEngine.classify('danma order ganna one', false);
  assert.equal(impulseDisabled.archetype, 'IMPULSE_BUYER');
  assert.equal(impulseDisabled.promptDirective.includes('fastest courier dispatch'), false);
  assert.ok(/Store Owner/i.test(impulseDisabled.promptDirective));

  const skepticalDisabled = CustomerArchetypeEngine.classify('cod thiyenawada', false);
  assert.equal(skepticalDisabled.archetype, 'SKEPTICAL_BUYER');
  assert.ok(/NEVER.*COD/i.test(skepticalDisabled.promptDirective));
});

test('whatsapp quick order, catalog, photo caption, and menu helpers omit address form and refer to owner when disabled', () => {
  const helper = require(path.join(SERVER_DIR, 'deliveryPolicyHelper.js'));
  const biz = {
    id: 'wedart',
    name: 'WEDART',
    phone: '076 210 7801',
    whatsappPhone: '94762107801',
    deliveryPolicy: 'Islandwide Courier 2-3 days',
    bankDetails: 'BOC 92949122'
  };
  const products = [{ id: 'p1', name: 'OmniSix AI cloud', price: 1900, description: 'Cloud AI agent' }];

  const disabledSettings = { isDeliveryDetailsEnabled: false };
  const orderReply = helper.buildQuickOrderReply(biz, disabledSettings, 'Sinhala');
  assert.ok(orderReply.includes('076 210 7801'));
  assert.ok(orderReply.includes('https://wa.me/94762107801'));
  assert.equal(/Full Name|Delivery Address|ලැබිය යුතු ලිපිනය|දුරකථන අංක/i.test(orderReply), false);

  const photoCaption = helper.buildProductPhotoCaption(products[0], 0, 4, biz, disabledSettings);
  assert.ok(photoCaption.includes('076 210 7801'));
  assert.equal(photoCaption.includes('ඔබගේ නම සහ ලිපිනය එවන්න'), false);

  const catalogReply = helper.buildQuickCatalogReply(biz, products, disabledSettings, 'Sinhala');
  assert.equal(catalogReply.includes('🚚 *Delivery:*'), false);
  assert.ok(catalogReply.includes('076 210 7801'));

  const menuEng = helper.buildQuickActionsMenu('English', false);
  assert.equal(menuEng.includes('Delivery'), false);
  assert.ok(menuEng.includes('Contact Owner'));
});

test('server.js buildSystemPrompt and checkForOrderTag enforce disabled delivery & owner referral without dirtying DB', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const origSave = db.save.bind(db);
  db.save = () => {}; // Keep test strictly isolated from disk/Mongo persistence

  const { app, buildSystemPrompt, checkForOrderTag } = require(path.join(SERVER_DIR, 'server.js'));

  assert.equal(db.DEFAULT_SETTINGS.isDeliveryDetailsEnabled, true);

  let srv;
  const activeBiz = db.getActiveBusiness();
  const prevBizSettings = activeBiz.settings ? JSON.parse(JSON.stringify(activeBiz.settings)) : undefined;
  const prevGlobalSettings = JSON.parse(JSON.stringify(db.getSettings()));

  try {
    db.updateTenantSettings(activeBiz.id, { isDeliveryDetailsEnabled: false });

    const sess = {
      businessId: activeBiz.id,
      storeName: activeBiz.name,
      customerName: 'Nimal',
      customerPhone: '94771234567',
      isWhatsApp: true,
      isVoiceCall: false,
      history: []
    };
    const rawDataset = [
      'Product A - Rs. 4,800 (Delivery Rs. 450)',
      'Q: Frame delivery time?',
      'A: 3-5 days island-wide delivery.',
      '📞 WhatsApp / Hotline: 076 210 7801'
    ].join('\n');

    const prompt = buildSystemPrompt(sess, rawDataset, null, 'Cod thiyenawada', 'Singlish');
    assert.ok(prompt.includes('Product A - Rs. 4,800'));
    assert.equal(prompt.includes('Delivery Rs. 450'), false);
    assert.equal(prompt.includes('3-5 days island-wide delivery'), false);
    assert.equal(prompt.includes('Islandwide delivery thiyenawa'), false);
    assert.equal(prompt.includes('with free delivery'), false);
    assert.equal(prompt.includes('[[ORDER:'), false);
    assert.ok(prompt.includes('076 210 7801'));
    assert.ok(prompt.includes('DELIVERY DETAILS DISABLED'));

    const ordCountBefore = (db.data.orders || []).length;
    const stripped = checkForOrderTag('Done! [[ORDER: name=Nimal|item=Product A|amount=4800]]', sess, '94771234567');
    assert.equal(stripped, 'Done!');
    assert.equal((db.data.orders || []).length, ordCountBefore, 'Must not record order when delivery details are disabled');

    // HTTP smoke test on ephemeral port
    await new Promise(resolve => {
      srv = app.listen(0, '127.0.0.1', resolve);
    });
    const port = srv.address().port;
    const base = `http://127.0.0.1:${port}`;

    const pubRes = await fetch(`${base}/api/business`);
    const pubJson = await pubRes.json();
    assert.equal(pubJson.ok, true);
    assert.equal(pubJson.active.isDeliveryDetailsEnabled, false);

    // Login as admin using ADMIN_MASTER_PASSWORD and toggle via POST /api/settings
    const loginRes = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || '486485' })
    });
    const loginJson = await loginRes.json();
    assert.equal(loginJson.ok, true, 'Admin login failed in test');
    const adminToken = loginJson.token;

    const getSetRes = await fetch(`${base}/api/settings`, {
      headers: { 'x-admin-token': adminToken, 'x-business-id': activeBiz.id }
    });
    const getSetJson = await getSetRes.json();
    assert.equal(getSetJson.ok, true);
    assert.equal(getSetJson.settings.isDeliveryDetailsEnabled, false);

    const postSetRes = await fetch(`${base}/api/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
        'x-business-id': activeBiz.id
      },
      body: JSON.stringify({ isDeliveryDetailsEnabled: true })
    });
    const postSetJson = await postSetRes.json();
    assert.equal(postSetJson.ok, true);
    assert.equal(postSetJson.settings.isDeliveryDetailsEnabled, true);

    const pubRes2 = await fetch(`${base}/api/business`);
    const pubJson2 = await pubRes2.json();
    assert.equal(pubJson2.active.isDeliveryDetailsEnabled, true);
  } finally {
    if (prevBizSettings === undefined) delete activeBiz.settings;
    else activeBiz.settings = prevBizSettings;
    db.data.settings = prevGlobalSettings;
    db.save = origSave;
    if (srv) await new Promise(resolve => srv.close(resolve));
  }
});

test('portal.html and admin.html expose Send Delivery Details toggles wired to /api/settings', () => {
  for (const page of ['portal.html', 'admin.html']) {
    const html = fs.readFileSync(path.join(SERVER_DIR, 'public', page), 'utf8');
    assert.ok(html.includes('setting-delivery-details'), `${page} missing #setting-delivery-details`);
    assert.ok(html.includes('overview-delivery-details-toggle'), `${page} missing #overview-delivery-details-toggle`);
    assert.ok(html.includes('isDeliveryDetailsEnabled'), `${page} missing isDeliveryDetailsEnabled serialization`);
    assert.ok(html.includes('toggleDeliveryDetails'), `${page} missing instant toggle handler`);
  }
});
