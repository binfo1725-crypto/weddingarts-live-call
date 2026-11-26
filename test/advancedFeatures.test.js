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
  const dir = path.join(SERVER_DIR, 'data', 'media');
  for (const ext of ['.bin', '.json']) {
    const p = path.join(dir, `${mediaId}${ext}`);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
  }
}

test('Public Order Tracking Portal, Koko/Mintpay 3x BNPL Checkout, and Koko Webhook', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const commerce = require(path.join(SERVER_DIR, 'commerceIntegrations.js'));
  const { app } = require(path.join(SERVER_DIR, 'server.js'));

  const origSave = db.save.bind(db);
  db.save = () => {};
  const prevState = {
    staff: JSON.parse(JSON.stringify(db.data.staff || [])),
    staffSessions: JSON.parse(JSON.stringify(db.data.staffSessions || {})),
    businesses: JSON.parse(JSON.stringify(db.data.businesses || [])),
    orders: JSON.parse(JSON.stringify(db.data.orders || [])),
    tenantSettings: JSON.parse(JSON.stringify(db.data.tenantSettings || {}))
  };

  let srv;
  try {
    db.saveBusiness({ id: 'adv_biz_1', name: 'Lanka Crafts', brandColor: '#9333EA', phone: '0771234567' });
    db.saveBusiness({ id: 'adv_biz_2', name: 'Other Store', phone: '0719999999' });
    db.updateTenantSettings('adv_biz_1', {
      paymentGateway: {
        enabled: true,
        merchantId: '1220001',
        merchantSecret: 'pay_sec_111',
        kokoEnabled: true,
        kokoMerchantId: 'koko_m_01',
        kokoApiKey: 'koko_api_secret_99',
        kokoSandbox: true,
        mintpayEnabled: true,
        mintpayMerchantId: 'mp_m_02'
      }
    });
    db.addStaff({
      id: 'stf_adv_1',
      name: 'Adv Staff',
      username: 'adv_staff_1',
      password: 'adv_pw_123',
      role: 'admin',
      businessId: 'adv_biz_1'
    });
    db.addStaff({
      id: 'stf_adv_2',
      name: 'Other Staff',
      username: 'adv_staff_2',
      password: 'adv_pw_123',
      role: 'admin',
      businessId: 'adv_biz_2'
    });

    const ord = db.addOrder({
      id: 'ORD-ADV-901',
      businessId: 'adv_biz_1',
      customerName: 'Amaya Silva',
      customerPhone: '94771112233',
      item: 'Wedding Frame',
      amount: 9000,
      status: 'Dispatched',
      trackingNumber: 'KMB-554433'
    });

    srv = app.listen(0);
    await new Promise(resolve => srv.once('listening', resolve));
    const base = `http://127.0.0.1:${srv.address().port}`;

    const tok1 = (await (await fetch(`${base}/api/staff/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'adv_staff_1', password: 'adv_pw_123' })
    })).json()).token;
    const tok2 = (await (await fetch(`${base}/api/staff/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'adv_staff_2', password: 'adv_pw_123' })
    })).json()).token;

    // Cross-tenant track-link -> 403
    const crossTrack = await fetch(`${base}/api/orders/${ord.id}/track-link`, {
      headers: { 'x-staff-token': tok2 }
    });
    assert.equal(crossTrack.status, 403);

    // Owner tenant track-link -> 200 & public signed tracking page works
    const trackRes = await fetch(`${base}/api/orders/${ord.id}/track-link`, {
      headers: { 'x-staff-token': tok1 }
    });
    assert.equal(trackRes.status, 200);
    const { trackUrl } = await trackRes.json();
    const sig = /\bsig=([^&]+)/.exec(trackUrl)[1];

    const badTrack = await fetch(`${base}/track/${ord.id}?sig=invalid`);
    assert.equal(badTrack.status, 403);

    const goodTrack = await fetch(`${base}/track/${ord.id}?sig=${sig}`);
    assert.equal(goodTrack.status, 200);
    const trackHtml = await goodTrack.text();
    assert.ok(trackHtml.includes('Lanka Crafts'));
    assert.ok(trackHtml.includes('KMB-554433'));
    assert.ok(trackHtml.includes('#9333EA'));

    // Koko / Mintpay BNPL breakdown & checkout page
    const bnpl = commerce.buildBnplInstallmentBreakdown(9000);
    assert.equal(bnpl.installment, 3000);

    const payUrl = commerce.buildCustomerPaymentUrl(ord.id, base, 'pay_sec_111');
    const paySig = /\bsig=([^&]+)/.exec(payUrl)[1];
    const checkoutHtml = await (await fetch(`${base}/api/payments/checkout/${ord.id}?sig=${paySig}`)).text();
    assert.ok(checkoutHtml.includes('Pay 3x Rs. 3,000 with Koko'));
    assert.ok(checkoutHtml.includes('Mintpay Merchant ID'));

    // Koko webhook signature verification
    const badKoko = await fetch(`${base}/api/webhook/koko`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: ord.id, status: 'SUCCESS', signature: 'wrong' })
    });
    assert.equal(badKoko.status, 403);

    const kokoParams = commerce.buildKokoCheckoutParams(ord, { id: 'adv_biz_1' }, { kokoMerchantId: 'koko_m_01', kokoApiKey: 'koko_api_secret_99' }, base);
    const goodKoko = await fetch(`${base}/api/webhook/koko`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: ord.id, status: 'SUCCESS', signature: kokoParams.fields.signature })
    });
    assert.equal(goodKoko.status, 200);
    assert.equal(ord.status, 'Paid');
    assert.equal(ord.paymentMethod, 'Koko BNPL (3x)');
  } finally {
    if (srv) await new Promise(resolve => srv.close(resolve));
    db.data.staff = prevState.staff;
    db.data.staffSessions = prevState.staffSessions;
    db.data.businesses = prevState.businesses;
    db.data.orders = prevState.orders;
    db.data.tenantSettings = prevState.tenantSettings;
    db.save = origSave;
  }
});

test('Multi-Item Cart Order endpoint & multi-item stock parsing decrement every product accurately', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const { app } = require(path.join(SERVER_DIR, 'server.js'));

  const origSave = db.save.bind(db);
  db.save = () => {};
  const prevState = {
    staff: JSON.parse(JSON.stringify(db.data.staff || [])),
    staffSessions: JSON.parse(JSON.stringify(db.data.staffSessions || {})),
    businesses: JSON.parse(JSON.stringify(db.data.businesses || [])),
    products: JSON.parse(JSON.stringify(db.data.products || [])),
    orders: JSON.parse(JSON.stringify(db.data.orders || []))
  };

  let srv;
  try {
    db.saveBusiness({ id: 'cart_biz', name: 'Cart Store', phone: '0770001122' });
    const p1 = db.addProduct({ id: 'p_cart_1', businessId: 'cart_biz', name: 'UV Frame', price: 4500, stockQty: 5, lowStockThreshold: 2 });
    const p2 = db.addProduct({ id: 'p_cart_2', businessId: 'cart_biz', name: 'Photo Keychain', price: 500, stockQty: 2, lowStockThreshold: 2 });
    db.addStaff({
      id: 'stf_cart_1',
      name: 'Cart Staff',
      username: 'cart_staff_1',
      password: 'cart_pw_123',
      role: 'admin',
      businessId: 'cart_biz'
    });

    srv = app.listen(0);
    await new Promise(resolve => srv.once('listening', resolve));
    const base = `http://127.0.0.1:${srv.address().port}`;
    const tok = (await (await fetch(`${base}/api/staff/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cart_staff_1', password: 'cart_pw_123' })
    })).json()).token;

    const cartRes = await fetch(`${base}/api/orders/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': tok },
      body: JSON.stringify({
        customerName: 'Dilshan',
        customerPhone: '0775556677',
        items: [
          { productId: p1.id, qty: 2 },
          { productId: p2.id, qty: 2 }
        ]
      })
    });
    assert.equal(cartRes.status, 200);
    const cartJson = await cartRes.json();
    assert.equal(cartJson.ok, true);
    assert.equal(cartJson.order.amount, '10000');
    assert.ok(cartJson.trackUrl.includes('/track/'));
    assert.equal(p1.stockQty, 3);
    assert.equal(p2.stockQty, 0);
    assert.equal(p2.inStock, false);

    // String-based multi-item order parsing
    db.addOrder({
      businessId: 'cart_biz',
      customerName: 'Ruwan',
      item: '2x UV Frame, Gift Box x1',
      amount: 9000
    });
    assert.equal(p1.stockQty, 1);
  } finally {
    if (srv) await new Promise(resolve => srv.close(resolve));
    db.data.staff = prevState.staff;
    db.data.staffSessions = prevState.staffSessions;
    db.data.businesses = prevState.businesses;
    db.data.products = prevState.products;
    db.data.orders = prevState.orders;
    db.save = origSave;
  }
});

test('Messenger & Instagram attachment media offload & Admin/Portal advanced UI checks', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const { app } = require(path.join(SERVER_DIR, 'server.js'));

  const origSave = db.save.bind(db);
  db.save = () => {};
  const origFetch = global.fetch;
  const createdMediaIds = [];
  const prevState = {
    businesses: JSON.parse(JSON.stringify(db.data.businesses || [])),
    chats: JSON.parse(JSON.stringify(db.data.chats || [])),
    tenantSettings: JSON.parse(JSON.stringify(db.data.tenantSettings || {}))
  };

  let srv;
  try {
    db.saveBusiness({ id: 'social_media_biz', name: 'Social Shop' });
    db.updateTenantSettings('social_media_biz', {
      metaOmnichannel: { enabled: true, pageId: 'FB_MEDIA_PAGE', igAccountId: 'IG_MEDIA_ACC', pageAccessToken: '' }
    });

    srv = app.listen(0);
    await new Promise(resolve => srv.once('listening', resolve));
    const base = `http://127.0.0.1:${srv.address().port}`;

    global.fetch = async (url, opts) => {
      if (String(url).includes('cdn.example.test/sample.jpg')) {
        return new Response(Buffer.from('fake-social-image-bytes'), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' }
        });
      }
      return origFetch(url, opts);
    };

    const res = await origFetch(`${base}/api/webhook/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: 'instagram',
        entry: [{
          messaging: [{
            sender: { id: 'ig_img_user_1' },
            recipient: { id: 'IG_MEDIA_ACC' },
            message: {
              text: 'meka keeyada?',
              attachments: [{ type: 'image', payload: { url: 'https://cdn.example.test/sample.jpg' } }]
            }
          }]
        }]
      })
    });
    assert.equal(res.status, 200);
    const chat = db.getChat('instagram_ig_img_user_1');
    assert.ok(chat);
    assert.equal(chat.channel, 'instagram');
    const custMsg = chat.messages.find(m => m.sender === 'customer');
    assert.ok(custMsg && custMsg.mediaUrl && custMsg.mediaUrl.startsWith('/api/media/med_'));
    createdMediaIds.push(custMsg.mediaUrl.split('/').pop());

    // Admin & Portal UI checks
    for (const page of ['admin.html', 'portal.html']) {
      const html = fs.readFileSync(path.join(SERVER_DIR, 'public', page), 'utf8');
      assert.doesNotThrow(() => new vm.Script(extractHtmlInlineScripts(html)));
      assert.ok(html.includes('openOrderTrackLink'));
      assert.ok(html.includes('setting-pg-koko-enabled'));
      assert.ok(html.includes('setting-pg-mintpay-enabled'));
    }
  } finally {
    global.fetch = origFetch;
    if (srv) await new Promise(resolve => srv.close(resolve));
    createdMediaIds.forEach(cleanupStoredMedia);
    db.data.businesses = prevState.businesses;
    db.data.chats = prevState.chats;
    db.data.tenantSettings = prevState.tenantSettings;
    db.save = origSave;
  }
});
