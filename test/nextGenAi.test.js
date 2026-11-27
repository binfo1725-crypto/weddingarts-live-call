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

test('All 7 Next-Gen AI endpoints (Copilot, Photo-to-Product, Ask Data, Insights, Extract Order) and Admin/Portal UI', async () => {
  const db = require(path.join(SERVER_DIR, 'db.js'));
  const { app } = require(path.join(SERVER_DIR, 'server.js'));

  const origSave = db.save.bind(db);
  db.save = () => {};
  const prevState = {
    staff: JSON.parse(JSON.stringify(db.data.staff || [])),
    staffSessions: JSON.parse(JSON.stringify(db.data.staffSessions || {})),
    businesses: JSON.parse(JSON.stringify(db.data.businesses || [])),
    products: JSON.parse(JSON.stringify(db.data.products || [])),
    orders: JSON.parse(JSON.stringify(db.data.orders || [])),
    chats: JSON.parse(JSON.stringify(db.data.chats || []))
  };

  let srv;
  try {
    db.saveBusiness({ id: 'ai7_biz', name: 'AI7 Store', phone: '0771234567' });
    db.addProduct({ id: 'ai7_p1', businessId: 'ai7_biz', name: 'UV Frame 16x24', category: 'Frames', price: 7800, cost: 4000, stockQty: 2, lowStockThreshold: 3 });
    db.addOrder({ id: 'ORD-AI7-1', businessId: 'ai7_biz', customerName: 'Nimal', customerPhone: '0771112233', item: 'UV Frame 16x24', amount: 7800, status: 'Confirmed' });
    db.addOrder({ id: 'ORD-AI7-2', businessId: 'ai7_biz', customerName: 'Nimal', customerPhone: '0771112233', item: 'UV Frame 16x24', amount: 8000, status: 'Delivered' });
    db.addChatMessage('94771112233', 'customer', 'price keeyada? discount adu karanna puluwanda?', 'Nimal', '94771112233', 'ai7_biz');
    db.addStaff({
      id: 'stf_ai7_1',
      name: 'AI7 Staff',
      username: 'ai7_staff_1',
      password: 'ai7_pw_123',
      role: 'admin',
      businessId: 'ai7_biz'
    });

    srv = app.listen(0);
    await new Promise(resolve => srv.once('listening', resolve));
    const base = `http://127.0.0.1:${srv.address().port}`;

    // Unauthenticated must return 401
    assert.equal((await fetch(`${base}/api/ai/insights`)).status, 401);

    const tok = (await (await fetch(`${base}/api/staff/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ai7_staff_1', password: 'ai7_pw_123' })
    })).json()).token;

    // 1. Copilot Suggest + Polish
    const copSuggest = await (await fetch(`${base}/api/ai/copilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': tok },
      body: JSON.stringify({ chatId: '94771112233', mode: 'suggest' })
    })).json();
    assert.equal(copSuggest.ok, true);
    assert.equal(copSuggest.suggestions.length, 3);

    const copPolish = await (await fetch(`${base}/api/ai/copilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': tok },
      body: JSON.stringify({ chatId: '94771112233', mode: 'polish', draftText: 'meka 7500 dennam' })
    })).json();
    assert.equal(copPolish.ok, true);
    assert.ok(copPolish.polished.includes('7500'));

    // 2. Photo-to-Product
    const p2p = await (await fetch(`${base}/api/ai/photo-to-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': tok },
      body: JSON.stringify({ dataUrl: 'data:image/jpeg;base64,ZmFrZQ==' })
    })).json();
    assert.equal(p2p.ok, true);
    assert.ok(p2p.product && p2p.product.name && p2p.product.description);

    // 3. Ask Your Data
    const ask = await (await fetch(`${base}/api/ai/ask-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': tok },
      body: JSON.stringify({ question: 'total revenue keeyada?' })
    })).json();
    assert.equal(ask.ok, true);
    assert.equal(ask.metrics.totalOrders, 2);
    assert.equal(ask.metrics.totalRevenue, 15800);
    assert.ok(ask.answer.length > 10);

    // 4, 5, 6. Demand Forecast, CLV & Pricing Insights
    const ins = await (await fetch(`${base}/api/ai/insights`, {
      headers: { 'x-staff-token': tok }
    })).json();
    assert.equal(ins.ok, true);
    assert.ok(ins.forecast.length >= 1);
    assert.ok(['CRITICAL', 'WARNING'].includes(ins.forecast[0].riskLevel));
    assert.ok(ins.clv.length >= 1);
    assert.equal(ins.clv[0].segment, 'VIP');
    assert.ok(ins.pricing.length >= 1);
    assert.equal(ins.pricing[0].currentPrice, 7800);

    // 7. Voice-to-Order Extractor
    const ext = await (await fetch(`${base}/api/ai/extract-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': tok },
      body: JSON.stringify({ text: 'mama Kasun, mata 2x UV Frame 16x24 ewanna, 0779988776' })
    })).json();
    assert.equal(ext.ok, true);
    assert.equal(ext.extracted.item, 'UV Frame 16x24');
    assert.equal(ext.extracted.qty, 2);
    assert.equal(ext.extracted.customerPhone, '0779988776');

    // UI verification
    for (const page of ['admin.html', 'portal.html']) {
      const html = fs.readFileSync(path.join(SERVER_DIR, 'public', page), 'utf8');
      assert.doesNotThrow(() => new vm.Script(extractHtmlInlineScripts(html)));
      for (const tokUi of [
        'runInboxAiCopilot',
        'autoFillProductFromPhoto',
        'askAiBusinessAnalyst',
        'loadAiInsights',
        'createOrderFromExtracted',
        'ai-forecast-list',
        'ai-clv-list',
        'ai-pricing-list'
      ]) {
        assert.ok(html.includes(tokUi), `${page} missing ${tokUi}`);
      }
    }
  } finally {
    if (srv) await new Promise(resolve => srv.close(resolve));
    db.data.staff = prevState.staff;
    db.data.staffSessions = prevState.staffSessions;
    db.data.businesses = prevState.businesses;
    db.data.products = prevState.products;
    db.data.orders = prevState.orders;
    db.data.chats = prevState.chats;
    db.save = origSave;
  }
});
