const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SERVER_DIR = path.resolve(__dirname, '..');

function extractHtmlInlineScripts(html) {
  const scripts = [];
  const regex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  return scripts.join('\n;\n');
}

function cleanupStoredMedia(mediaId) {
  if (!mediaId) return;
  const dirs = [
    path.join(SERVER_DIR, 'data', 'media'),
    process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'media') : null
  ].filter(Boolean);
  for (const dir of dirs) {
    for (const ext of ['.bin', '.json']) {
      const p = path.join(dir, `${mediaId}${ext}`);
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
    }
  }
}

test('Cloud Media Store saves binary/base64, serves immutable HTTP /api/media/:id, and blocks traversal', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const mediaStore = require(path.join(SERVER_DIR, 'mediaStore.js'));
  const { app } = require(path.join(SERVER_DIR, 'server.js'));

  const origSave = db.save.bind(db);
  db.save = () => {};
  const prevState = {
    staff: JSON.parse(JSON.stringify(db.data.staff || [])),
    staffSessions: JSON.parse(JSON.stringify(db.data.staffSessions || {})),
    businesses: JSON.parse(JSON.stringify(db.data.businesses || []))
  };

  const createdIds = [];
  let srv;

  try {
    srv = app.listen(0);
    await new Promise(resolve => srv.once('listening', resolve));
    const base = `http://127.0.0.1:${srv.address().port}`;

    // 1. Direct MediaStore save & traversal guard
    const sampleBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const saved = await mediaStore.saveMedia(sampleBuf, 'image/png', { purpose: 'unit_test' });
    assert.equal(saved.ok, true);
    assert.ok(saved.id.startsWith('med_'));
    assert.equal(saved.url, `/api/media/${saved.id}`);
    createdIds.push(saved.id);

    const fetchedDirect = await mediaStore.getMedia(saved.id);
    assert.ok(fetchedDirect);
    assert.equal(fetchedDirect.mimeType, 'image/png');
    assert.deepEqual(fetchedDirect.buffer, sampleBuf);
    assert.equal(await mediaStore.getMedia('../../etc/passwd'), null);

    // 2. HTTP POST /api/media/upload accepting dataUrl (used by UI logo upload)
    db.saveBusiness({ id: 'media_biz', name: 'Media Shop' });
    db.addStaff({
      id: 'stf_media_1',
      name: 'Media Staff',
      username: 'media_staff_test',
      password: 'media_pw_123',
      role: 'admin',
      businessId: 'media_biz'
    });
    const loginRes = await fetch(`${base}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'media_staff_test', password: 'media_pw_123' })
    });
    const { token } = await loginRes.json();
    assert.ok(token);

    const dataUrl = `data:image/jpeg;base64,${Buffer.from('hello-jpeg-bytes').toString('base64')}`;
    const upRes = await fetch(`${base}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': token },
      body: JSON.stringify({ dataUrl, mimeType: 'image/jpeg', source: 'store_logo' })
    });
    assert.equal(upRes.status, 200);
    const upData = await upRes.json();
    assert.equal(upData.ok, true);
    assert.ok(upData.url.startsWith('/api/media/med_'));
    createdIds.push(upData.id);

    const getRes = await fetch(`${base}${upData.url}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get('content-type'), 'image/jpeg');
    assert.match(getRes.headers.get('cache-control') || '', /immutable/);
    const getBuf = Buffer.from(await getRes.arrayBuffer());
    assert.equal(getBuf.toString('utf8'), 'hello-jpeg-bytes');
  } finally {
    if (srv) await new Promise(resolve => srv.close(resolve));
    createdIds.forEach(cleanupStoredMedia);
    db.data.staff = prevState.staff;
    db.data.staffSessions = prevState.staffSessions;
    db.data.businesses = prevState.businesses;
    db.save = origSave;
  }
});

test('PayHere signed links, checkout page, ITN webhook verification, and Live Courier REST dispatch & webhook', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const commerce = require(path.join(SERVER_DIR, 'commerceIntegrations.js'));
  const { app } = require(path.join(SERVER_DIR, 'server.js'));

  const origSave = db.save.bind(db);
  db.save = () => {};
  const origFetch = global.fetch;

  const prevState = {
    staff: JSON.parse(JSON.stringify(db.data.staff || [])),
    staffSessions: JSON.parse(JSON.stringify(db.data.staffSessions || {})),
    businesses: JSON.parse(JSON.stringify(db.data.businesses || [])),
    orders: JSON.parse(JSON.stringify(db.data.orders || [])),
    products: JSON.parse(JSON.stringify(db.data.products || [])),
    tenantSettings: JSON.parse(JSON.stringify(db.data.tenantSettings || {}))
  };

  let srv;
  try {
    db.saveBusiness({ id: 'pay_biz', name: 'Pay & Ship Store', phone: '0771234567' });
    db.updateTenantSettings('pay_biz', {
      paymentGateway: {
        enabled: true,
        provider: 'payhere',
        sandbox: true,
        merchantId: '1220001',
        merchantSecret: 'secret_payhere_xyz',
        currency: 'USD'
      },
      courierApi: {
        enabled: true,
        provider: 'koombiyo',
        apiKey: 'kmb_key_123',
        webhookSecret: 'courier_sec_999'
      }
    });
    db.addStaff({
      id: 'stf_pay_1',
      name: 'Pay Staff',
      username: 'pay_staff_test',
      password: 'pay_pw_123',
      role: 'admin',
      businessId: 'pay_biz'
    });
    const order = db.addOrder({
      id: 'ORD-PAY-101',
      businessId: 'pay_biz',
      customerName: 'Kasun Perera',
      customerPhone: '94771112233',
      item: '16x24 UV Frame',
      amount: 7800,
      address: 'No 10, Galle Road, Colombo'
    });

    srv = app.listen(0);
    await new Promise(resolve => srv.once('listening', resolve));
    const port = srv.address().port;
    const base = `http://127.0.0.1:${port}`;

    const loginRes = await fetch(`${base}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'pay_staff_test', password: 'pay_pw_123' })
    });
    const { token } = await loginRes.json();

    // 1. Signed Payment Link generation
    const linkRes = await fetch(`${base}/api/orders/payment-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': token },
      body: JSON.stringify({ orderId: order.id, sendToWhatsApp: false })
    });
    assert.equal(linkRes.status, 200);
    const linkData = await linkRes.json();
    assert.equal(linkData.ok, true);
    const sigMatch = /\bsig=([^&]+)/.exec(linkData.paymentUrl);
    assert.ok(sigMatch, 'Payment URL must include HMAC signature');

    // Invalid signature -> 403
    const badCheckout = await fetch(`${base}/api/payments/checkout/${order.id}?sig=tampered`);
    assert.equal(badCheckout.status, 403);

    // Valid signature -> 200 with Sandbox auto-submit form & USD currency
    const goodCheckout = await fetch(`${base}/api/payments/checkout/${order.id}?sig=${sigMatch[1]}`);
    assert.equal(goodCheckout.status, 200);
    const checkoutHtml = await goodCheckout.text();
    assert.ok(checkoutHtml.includes('https://sandbox.payhere.lk/pay/checkout'));
    assert.ok(checkoutHtml.includes('value="USD"'));

    // 2. PayHere ITN form-urlencoded webhook verification
    const payAmt = '7800.00';
    const badItn = await fetch(`${base}/api/webhook/payhere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        merchant_id: '1220001',
        order_id: order.id,
        payhere_amount: payAmt,
        payhere_currency: 'USD',
        status_code: '2',
        md5sig: 'INVALID'
      })
    });
    assert.equal(badItn.status, 403);

    const validMd5Sig = commerce.md5Upper(
      `1220001${order.id}${payAmt}USD2${commerce.md5Upper('secret_payhere_xyz')}`
    );
    const goodItn = await fetch(`${base}/api/webhook/payhere`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        merchant_id: '1220001',
        order_id: order.id,
        payhere_amount: payAmt,
        payhere_currency: 'USD',
        status_code: '2',
        md5sig: validMd5Sig
      })
    });
    assert.equal(goodItn.status, 200);
    assert.equal(order.status, 'Paid');
    assert.equal(order.paymentMethod, 'PayHere Online');

    // 3. Live Courier Dispatch (mock remote courier endpoint while letting 127.0.0.1 pass through)
    global.fetch = async (url, opts) => {
      if (String(url).includes('koombiyodelivery.lk')) {
        return new Response(JSON.stringify({ waybill_id: 'KMB-884422', status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return origFetch(url, opts);
    };

    const dispRes = await origFetch(`${base}/api/orders/courier-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': token },
      body: JSON.stringify({ orderId: order.id })
    });
    assert.equal(dispRes.status, 200);
    const dispJson = await dispRes.json();
    assert.equal(dispJson.ok, true);
    assert.equal(dispJson.trackingNumber, 'KMB-884422');
    assert.equal(order.status, 'Dispatched');

    // 4. Courier Webhook secret validation & tracking update
    const badWh = await origFetch(`${base}/api/webhook/courier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, status: 'Delivered', secret: 'wrong' })
    });
    assert.equal(badWh.status, 403);

    const goodWh = await origFetch(`${base}/api/webhook/courier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id, status: 'Delivered', trackingNumber: 'KMB-884422', secret: 'courier_sec_999' })
    });
    assert.equal(goodWh.status, 200);
    assert.equal(order.status, 'Delivered');
  } finally {
    global.fetch = origFetch;
    if (srv) await new Promise(resolve => srv.close(resolve));
    db.data.staff = prevState.staff;
    db.data.staffSessions = prevState.staffSessions;
    db.data.businesses = prevState.businesses;
    db.data.orders = prevState.orders;
    db.data.products = prevState.products;
    db.data.tenantSettings = prevState.tenantSettings;
    db.save = origSave;
  }
});

test('Real Stock Inventory decrements on orders and updates system prompt OUT OF STOCK state', () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const { buildSystemPrompt } = require(path.join(SERVER_DIR, 'server.js'));

  const origSave = db.save.bind(db);
  db.save = () => {};
  const prevState = {
    businesses: JSON.parse(JSON.stringify(db.data.businesses || [])),
    products: JSON.parse(JSON.stringify(db.data.products || [])),
    orders: JSON.parse(JSON.stringify(db.data.orders || []))
  };

  try {
    const biz = db.saveBusiness({ id: 'stock_biz', name: 'Stock Test Store' });
    const prod = db.addProduct({
      id: 'prod_stock_1',
      businessId: 'stock_biz',
      name: 'Smart Watch Pro',
      category: 'Watch',
      price: 4500,
      stockQty: 2,
      lowStockThreshold: 2,
      inStock: true
    });

    let promptBefore = buildSystemPrompt({ businessId: 'stock_biz', storeName: biz.name });
    assert.ok(promptBefore.includes('[Stock Left: 2]'));

    const ord1 = db.addOrder({
      businessId: 'stock_biz',
      customerName: 'Nimal',
      customerPhone: '0771000001',
      item: 'Smart Watch Pro x1',
      amount: 4500
    });
    assert.equal(prod.stockQty, 1);
    assert.equal(prod.inStock, true);
    assert.equal(ord1.lowStockTriggered.remaining, 1);

    db.addOrder({
      businessId: 'stock_biz',
      customerName: 'Sunil',
      customerPhone: '0771000002',
      item: 'Smart Watch Pro x1',
      amount: 4500
    });
    assert.equal(prod.stockQty, 0);
    assert.equal(prod.inStock, false);

    let promptAfter = buildSystemPrompt({ businessId: 'stock_biz', storeName: biz.name });
    assert.ok(promptAfter.includes('[OUT OF STOCK'));
  } finally {
    db.data.businesses = prevState.businesses;
    db.data.products = prevState.products;
    db.data.orders = prevState.orders;
    db.save = origSave;
  }
});

test('SaaS Monthly AI Quota Metering, White-Label Branding PDF & Public Endpoint, and Scheduled Broadcasts', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const { generateInvoicePdf } = require(path.join(SERVER_DIR, 'invoiceGenerator.js'));
  const { app } = require(path.join(SERVER_DIR, 'server.js'));

  const origSave = db.save.bind(db);
  db.save = () => {};
  const prevState = {
    businesses: JSON.parse(JSON.stringify(db.data.businesses || [])),
    broadcasts: JSON.parse(JSON.stringify(db.data.broadcasts || [])),
    staff: JSON.parse(JSON.stringify(db.data.staff || [])),
    staffSessions: JSON.parse(JSON.stringify(db.data.staffSessions || {}))
  };

  let srv;
  try {
    const biz = db.createBusiness({
      id: 'quota_brand_biz',
      name: 'Brand Couture',
      subscriptionPlan: 'starter',
      brandColor: '#EC4899',
      logoUrl: '/api/media/med_brand_logo'
    });

    // 1. Monthly AI Quota Metering
    const qInitial = db.checkAiQuota(biz.id);
    assert.equal(qInitial.limit, 1500);
    assert.equal(qInitial.allowed, true);

    db.recordAiReplyUsage(biz.id, 1500);
    const qMax = db.checkAiQuota(biz.id);
    assert.equal(qMax.used, 1500);
    assert.equal(qMax.remaining, 0);
    assert.equal(qMax.allowed, false);

    const roi = db.getRoiAnalytics(biz.id);
    assert.equal(roi.monthlyAiReplies, 1500);
    assert.equal(roi.monthlyAiLimit, 1500);

    // 2. White-Label PDF Invoice generation with custom brandColor
    const pdfBuf = await generateInvoicePdf(
      { id: 'ORD-WL-1', customerName: 'Sita', customerPhone: '0772223334', item: 'Saree', amount: 6500 },
      biz
    );
    assert.ok(Buffer.isBuffer(pdfBuf) && pdfBuf.slice(0, 5).toString('utf8') === '%PDF-');

    // 3. Public scoped /api/business?businessId=... returns brandColor + logoUrl cleanly & /api/broadcasts schedules future jobs
    db.addStaff({
      id: 'stf_wl_1',
      name: 'Brand Staff',
      username: 'wl_staff_test',
      password: 'wl_pw_123',
      role: 'admin',
      businessId: biz.id
    });

    srv = app.listen(0);
    await new Promise(resolve => srv.once('listening', resolve));
    const base = `http://127.0.0.1:${srv.address().port}`;

    const pubRes = await fetch(`${base}/api/business?businessId=${biz.id}`);
    assert.equal(pubRes.status, 200);
    const pubJson = await pubRes.json();
    assert.equal(pubJson.active.id, biz.id);
    assert.equal(pubJson.active.brandColor, '#EC4899');
    assert.equal(pubJson.active.logoUrl, '/api/media/med_brand_logo');

    const { token } = await (await fetch(`${base}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'wl_staff_test', password: 'wl_pw_123' })
    })).json();

    const futureIso = new Date(Date.now() + 3600000).toISOString();
    const schedRes = await fetch(`${base}/api/broadcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': token },
      body: JSON.stringify({ title: 'Scheduled Promo', message: 'Big Sale', scheduledAt: futureIso })
    });
    assert.equal(schedRes.status, 200);
    const schedJson = await schedRes.json();
    assert.equal(schedJson.broadcast.status, 'Scheduled');
    assert.equal(db.getDueScheduledBroadcasts(Date.now()).length, 0);

    // Backdate in memory to confirm scheduler pickup
    const savedBc = db.data.broadcasts.find(b => b.id === schedJson.broadcast.id);
    savedBc.scheduledAt = new Date(Date.now() - 1000).toISOString();
    assert.equal(db.getDueScheduledBroadcasts(Date.now()).some(b => b.id === savedBc.id), true);
  } finally {
    if (srv) await new Promise(resolve => srv.close(resolve));
    db.data.businesses = prevState.businesses;
    db.data.broadcasts = prevState.broadcasts;
    db.data.staff = prevState.staff;
    db.data.staffSessions = prevState.staffSessions;
    db.save = origSave;
  }
});

test('Unified Meta Omnichannel Webhook (Messenger & Instagram DM) + Embeddable /api/chat Widget Endpoint', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const { app } = require(path.join(SERVER_DIR, 'server.js'));

  const origSave = db.save.bind(db);
  db.save = () => {};
  const prevState = {
    businesses: JSON.parse(JSON.stringify(db.data.businesses || [])),
    chats: JSON.parse(JSON.stringify(db.data.chats || [])),
    tenantSettings: JSON.parse(JSON.stringify(db.data.tenantSettings || {}))
  };

  let srv;
  try {
    const biz = db.saveBusiness({
      id: 'omni_biz',
      name: 'Omni Store',
      brandColor: '#10B981',
      phone: '0762107801',
      dataset: 'Omni Store frames cost Rs. 4500.'
    });
    db.updateTenantSettings(biz.id, {
      metaOmnichannel: {
        enabled: true,
        pageId: 'FB_PAGE_999',
        igAccountId: 'IG_ACC_888',
        pageAccessToken: ''
      }
    });

    srv = app.listen(0);
    await new Promise(resolve => srv.once('listening', resolve));
    const base = `http://127.0.0.1:${srv.address().port}`;

    // 1. Messenger incoming webhook
    const fbRes = await fetch(`${base}/api/webhook/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'fb_user_101' },
            recipient: { id: 'FB_PAGE_999' },
            message: { text: 'price keeyada?' }
          }]
        }]
      })
    });
    assert.equal(fbRes.status, 200);
    const fbChat = db.getChat('messenger_fb_user_101');
    assert.ok(fbChat);
    assert.equal(fbChat.channel, 'messenger');

    // 2. Instagram DM incoming webhook
    const igRes = await fetch(`${base}/api/webhook/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: 'instagram',
        entry: [{
          messaging: [{
            sender: { id: 'ig_user_202' },
            recipient: { id: 'IG_ACC_888' },
            message: { text: 'catalog eka ewanna' }
          }]
        }]
      })
    });
    assert.equal(igRes.status, 200);
    const igChat = db.getChat('instagram_ig_user_202');
    assert.ok(igChat);
    assert.equal(igChat.channel, 'instagram');

    // 3. Embeddable Widget live text /api/chat with skipAudio & businessId
    const chatRes = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'widget_test_sess_1',
        businessId: biz.id,
        storeName: biz.name,
        message: 'delivery thiyenawada?',
        skipAudio: true
      })
    });
    assert.equal(chatRes.status, 200);
    const chatJson = await chatRes.json();
    assert.equal(chatJson.ok, true);
    assert.equal(chatJson.storeName, 'Omni Store');
    assert.equal(chatJson.brandColor, '#10B981');
    assert.equal(chatJson.audioBase64, null);
    assert.ok(typeof chatJson.reply === 'string' && chatJson.reply.length > 0);
  } finally {
    if (srv) await new Promise(resolve => srv.close(resolve));
    db.data.businesses = prevState.businesses;
    db.data.chats = prevState.chats;
    db.data.tenantSettings = prevState.tenantSettings;
    db.save = origSave;
  }
});

test('Widget.js, Admin, Portal & Login UI compile cleanly and include all 7 upgrade controls', () => {
  const widgetCode = fs.readFileSync(path.join(SERVER_DIR, 'public', 'widget.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(widgetCode), 'public/widget.js must compile cleanly');
  assert.ok(widgetCode.includes('omnisix-chat-form'));
  assert.ok(widgetCode.includes('/api/chat'));
  assert.ok(widgetCode.includes('data-business-id'));

  for (const page of ['admin.html', 'portal.html', 'login.html']) {
    const html = fs.readFileSync(path.join(SERVER_DIR, 'public', page), 'utf8');
    const js = extractHtmlInlineScripts(html);
    assert.doesNotThrow(() => new vm.Script(js), `${page} inline scripts must compile cleanly`);

    if (page !== 'login.html') {
      for (const token of [
        'mp-stock-qty',
        'mp-low-stock',
        'setting-pg-merchant-id',
        'setting-courier-provider',
        'setting-omnichannel-enabled',
        'form-biz-brand-color',
        'form-biz-logo-url',
        'bc-scheduled-at',
        'broadcasts-history-tbody',
        'sendOrderPaymentLink',
        'dispatchOrderCourier',
        'monthlyAiLimit'
      ]) {
        assert.ok(html.includes(token), `${page} missing expected upgrade control/symbol: ${token}`);
      }
    }
  }
});
