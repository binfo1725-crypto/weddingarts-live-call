const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const WebSocket = require('ws');

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

test('Unauthenticated requests to newly secured routes return 401 and admin/staff tokens work cleanly with tenant isolation', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const origSave = db.save.bind(db);
  db.save = () => {};

  const prevState = {
    staff: JSON.parse(JSON.stringify(db.data.staff || [])),
    staffSessions: JSON.parse(JSON.stringify(db.data.staffSessions || {})),
    products: JSON.parse(JSON.stringify(db.data.products || [])),
    chats: JSON.parse(JSON.stringify(db.data.chats || [])),
    broadcasts: JSON.parse(JSON.stringify(db.data.broadcasts || [])),
    businesses: JSON.parse(JSON.stringify(db.data.businesses || []))
  };

  const { app } = require(path.join(SERVER_DIR, 'server.js'));
  let srv;

  try {
    srv = app.listen(0);
    await new Promise(resolve => srv.once('listening', resolve));
    const port = srv.address().port;
    const base = `http://127.0.0.1:${port}`;

    // 1. All newly secured endpoints MUST return 401 when unauthenticated
    const securedGets = [
      '/api/broadcasts',
      '/api/staff',
      '/api/developer/webhooks',
      '/api/developer/webhook-logs',
      '/api/whatsapp/status',
      '/api/warmer',
      '/api/quick-replies',
      '/api/calls/logs',
      '/api/agents',
      '/api/agents/decisions',
      '/api/chats/test_chat/metadata'
    ];
    for (const p of securedGets) {
      const r = await fetch(`${base}${p}`);
      assert.equal(r.status, 401, `Expected 401 on unauthenticated GET ${p}, got ${r.status}`);
    }

    const securedPosts = [
      ['/api/chats/read', { chatId: '123' }],
      ['/api/chats/delete', { chatId: '123' }],
      ['/api/chats/send-media', { chatId: '123', mediaType: 'image', base64Data: 'aGk=' }],
      ['/api/broadcasts', { title: 'Test', message: 'Hi' }],
      ['/api/whatsapp/restart', {}],
      ['/api/warmer/toggle', { running: false }]
    ];
    for (const [p, body] of securedPosts) {
      const r = await fetch(`${base}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      assert.equal(r.status, 401, `Expected 401 on unauthenticated POST ${p}, got ${r.status}`);
    }

    // 2. Provision two stores, scoped staff user, cross-tenant records
    db.saveBusiness({ id: 'tenant_alpha', name: 'Alpha Shop' });
    db.saveBusiness({ id: 'tenant_beta', name: 'Beta Shop' });
    const staffAlpha = db.addStaff({
      id: 'stf_alpha_1',
      name: 'Alpha Agent',
      username: 'alpha_agent_test',
      password: 'secret_alpha_pw',
      role: 'support',
      businessId: 'tenant_alpha'
    });
    assert.ok(staffAlpha);

    db.addProduct({ id: 'prod_alpha_1', businessId: 'tenant_alpha', name: 'Alpha Watch', category: 'Watch', price: 3000 });
    db.addProduct({ id: 'prod_beta_1', businessId: 'tenant_beta', name: 'Beta Ring', category: 'Ring', price: 5000 });
    db.addBroadcast({ title: 'Alpha Promo', message: 'Hi', businessId: 'tenant_alpha' });
    db.addBroadcast({ title: 'Beta Promo', message: 'Yo', businessId: 'tenant_beta' });
    db.addChatMessage('94771111111', 'customer', 'Hello Alpha', 'Nimal', '94771111111', 'tenant_alpha');
    db.addChatMessage('94772222222', 'customer', 'Hello Beta', 'Kamal', '94772222222', 'tenant_beta');

    // 3. Staff login issues scoped stf_ session token
    const loginRes = await fetch(`${base}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alpha_agent_test', password: 'secret_alpha_pw' })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.ok, true);
    assert.ok(loginData.token && loginData.token.startsWith('stf_'));

    // 4. Scoped staff token sees only tenant_alpha data and never leaks passwords
    const staffListRes = await fetch(`${base}/api/staff`, {
      headers: { 'x-staff-token': loginData.token }
    });
    assert.equal(staffListRes.status, 200);
    const staffListJson = await staffListRes.json();
    assert.ok(staffListJson.staff.every(s => s.password === undefined), 'GET /api/staff must redact plaintext passwords');

    const bcRes = await fetch(`${base}/api/broadcasts`, {
      headers: { 'x-staff-token': loginData.token }
    });
    const bcJson = await bcRes.json();
    assert.equal(bcJson.broadcasts.length, 1);
    assert.equal(bcJson.broadcasts[0].businessId, 'tenant_alpha');

    // Cross-tenant product update & chat delete MUST return 403
    const crossProdRes = await fetch(`${base}/api/products/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': loginData.token },
      body: JSON.stringify({ id: 'prod_beta_1', price: 1 })
    });
    assert.equal(crossProdRes.status, 403);

    const crossChatDelRes = await fetch(`${base}/api/chats/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': loginData.token },
      body: JSON.stringify({ chatId: '94772222222' })
    });
    assert.equal(crossChatDelRes.status, 403);

    // Staff token cannot access global Super Admin mutation
    const adminMutRes = await fetch(`${base}/api/agents/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': loginData.token },
      body: JSON.stringify({ mode: 'manual' })
    });
    assert.equal(adminMutRes.status, 401);

    // Own-tenant unread mark-read, media record & delete work cleanly
    const readRes = await fetch(`${base}/api/chats/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': loginData.token },
      body: JSON.stringify({ chatId: '94771111111' })
    });
    assert.equal(readRes.status, 200);
    assert.equal(db.getChat('94771111111').unread, 0);

    const mediaRes = await fetch(`${base}/api/chats/send-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': loginData.token },
      body: JSON.stringify({
        chatId: '94771111111',
        mediaType: 'image',
        mimeType: 'image/png',
        base64Data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        caption: 'Sample photo'
      })
    });
    assert.equal(mediaRes.status, 200);
    const mediaJson = await mediaRes.json();
    assert.equal(mediaJson.ok, true);
    assert.ok(mediaJson.message.imageBase64);

    const delRes = await fetch(`${base}/api/chats/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': loginData.token },
      body: JSON.stringify({ chatId: '94771111111' })
    });
    assert.equal(delRes.status, 200);
    assert.equal(db.getChat('94771111111'), undefined);
  } finally {
    if (srv) srv.close();
    db.data.staff = prevState.staff;
    db.data.staffSessions = prevState.staffSessions;
    db.data.products = prevState.products;
    db.data.chats = prevState.chats;
    db.data.broadcasts = prevState.broadcasts;
    db.data.businesses = prevState.businesses;
    db.save = origSave;
  }
});

test('WebSocket /ws?channel=inbox requires valid auth and pushes real-time inbox_update events', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const origSave = db.save.bind(db);
  db.save = () => {};

  const prevChats = JSON.parse(JSON.stringify(db.data.chats || []));
  const { app, wss } = (() => {
    const mod = require(path.join(SERVER_DIR, 'server.js'));
    // Access server from server.js HTTP instance directly
    return { app: mod.app, serverObj: mod.server };
  })();
  const { server } = require(path.join(SERVER_DIR, 'server.js'));

  let ws;
  try {
    await new Promise(resolve => {
      if (server.listening) return resolve();
      server.listen(0, resolve);
    });
    const port = server.address().port;
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws?channel=inbox`);

    const messages = [];
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WS timeout')), 5000);
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe_inbox', adminToken: 'invalid_pin' }));
      });
      ws.on('message', (raw) => {
        const parsed = JSON.parse(raw.toString());
        messages.push(parsed);
        if (parsed.type === 'inbox_error') {
          ws.send(JSON.stringify({ type: 'subscribe_inbox', adminToken: process.env.ADMIN_PASSWORD || '486485' }));
        } else if (parsed.type === 'inbox_subscribed') {
          db.addChatMessage('94779998888', 'customer', 'Realtime Ping', 'Kasun', '94779998888', db.getActiveBusiness().id);
        } else if (parsed.type === 'inbox_update' && parsed.chatId === '94779998888') {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    assert.ok(messages.some(m => m.type === 'inbox_error'));
    assert.ok(messages.some(m => m.type === 'inbox_subscribed' && m.ok === true));
    assert.ok(messages.some(m => m.type === 'inbox_update' && m.chatId === '94779998888'));
  } finally {
    if (ws) ws.close();
    if (server.listening) server.close();
    db.data.chats = prevChats;
    db.save = origSave;
  }
});

test('WhatsApp manager exposes Meta Cloud API & voice helpers and preserves customer-image photo guard', () => {
  const waManager = require(path.join(SERVER_DIR, 'whatsapp.js'));
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const origSave = db.save.bind(db);
  db.save = () => {};

  const prevProds = JSON.parse(JSON.stringify(db.data.products || []));
  try {
    assert.equal(typeof waManager.sendMetaCloudMessage, 'function');
    assert.equal(typeof waManager.sendMetaCloudImage, 'function');
    assert.equal(typeof waManager.sendVoiceMessage, 'function');
    assert.equal(typeof waManager.matchProductsForMessage, 'function');

    db.addProduct({
      id: 'prod_guard_1',
      businessId: 'weddingarts',
      name: 'Luxury Album Frame',
      category: 'Frames',
      price: 8500,
      imageUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//'
    });

    // Customer sends an image without requesting catalog -> MUST NOT dump product images
    const guardRes = waManager.matchProductsForMessage({
      businessId: 'weddingarts',
      customerText: '[Customer Image Description: bank slip Luxury Album Frame Rs 8500]',
      aiReply: 'Thank you for sending your photo.',
      isImage: true,
      rawCaption: ''
    });
    assert.equal(guardRes.matchedProducts.length, 0);

    // Explicit text request for product photos -> MUST match cleanly
    const reqRes = waManager.matchProductsForMessage({
      businessId: 'weddingarts',
      customerText: 'Luxury Album Frame photo ewanna',
      aiReply: 'Menna Luxury Album Frame wisthara.',
      isImage: false,
      rawCaption: ''
    });
    assert.equal(reqRes.matchedProducts.length, 1);
    assert.equal(reqRes.matchedProducts[0].id, 'prod_guard_1');
  } finally {
    db.data.products = prevProds;
    db.save = origSave;
  }
});

test('admin.html & portal.html inline JS compile cleanly and contain Edit Product, Edit Flow, Voice, Image, Delete, and WS handlers', () => {
  for (const file of ['admin.html', 'portal.html']) {
    const html = fs.readFileSync(path.join(SERVER_DIR, 'public', file), 'utf8');
    const inlineJs = extractHtmlInlineScripts(html);
    assert.doesNotThrow(() => new vm.Script(inlineJs, { filename: file }));

    for (const token of [
      'id="mp-id"',
      'id="mp-instock"',
      'id="mf-id"',
      'id="mf-active"',
      'id="btn-chat-voice"',
      'id="btn-chat-delete"',
      'id="inbox-custom-image-file"',
      'openEditProductModal(',
      'openEditFlowModal(',
      'deleteCurrentChat(',
      'handleInboxCustomImageUpload(',
      'toggleInboxVoiceRecording(',
      'initInboxWebSocket('
    ]) {
      assert.ok(html.includes(token), `Missing ${token} in ${file}`);
    }
  }
});
