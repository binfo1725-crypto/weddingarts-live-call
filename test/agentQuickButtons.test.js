const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const waEngine = require('../whatsapp');

test('resolveAgentQuickButtons returns defaults, respects toggle, and caps at 3 buttons / 20 chars', () => {
  const defaults = waEngine.resolveAgentQuickButtons({ isInteractiveButtonsEnabled: true }, 'English');
  assert.equal(defaults.length, 3);
  assert.equal(defaults[0].id, 'ACTION_CATALOG');

  const disabled = waEngine.resolveAgentQuickButtons({ isInteractiveButtonsEnabled: false }, 'English');
  assert.deepEqual(disabled, []);

  const custom = waEngine.resolveAgentQuickButtons({
    isInteractiveButtonsEnabled: true,
    agentQuickButtons: [
      { label: '  1234567890123456789012345  ', action: 'Check prices' },
      { label: 'Order', action: 'Place order' },
      { label: 'Support', action: 'Talk to agent' },
      { label: 'Extra Ignored', action: 'Ignored' }
    ]
  });
  assert.equal(custom.length, 3);
  assert.equal(custom[0].label.length, 20);
  assert.equal(custom[0].action, 'Check prices');
});

test('buildMetaInteractivePayload generates valid Meta WhatsApp Cloud API interactive button payload', () => {
  const payload = waEngine.buildMetaInteractivePayload('+94771234567', 'Hello! Choose an option:', [
    { id: 'BTN_1', label: '📦 Catalog' },
    { id: 'BTN_2', label: '🛒 Order' }
  ]);
  assert.equal(payload.messaging_product, 'whatsapp');
  assert.equal(payload.to, '94771234567');
  assert.equal(payload.type, 'interactive');
  assert.equal(payload.interactive.type, 'button');
  assert.equal(payload.interactive.action.buttons.length, 2);
  assert.equal(payload.interactive.action.buttons[0].type, 'reply');
  assert.equal(payload.interactive.action.buttons[0].reply.id, 'BTN_1');
  assert.equal(payload.interactive.action.buttons[0].reply.title, '📦 Catalog');
});

test('widget.js, admin.html, and portal.html expose agent quick buttons UI & handlers', () => {
  const pubDir = path.join(__dirname, '..', 'public');
  const widgetSrc = fs.readFileSync(path.join(pubDir, 'widget.js'), 'utf8');
  assert.doesNotThrow(() => new Function(widgetSrc));
  assert.ok(widgetSrc.includes('appendQuickButtons'));
  assert.ok(widgetSrc.includes('sendWidgetMessage'));

  for (const page of ['admin.html', 'portal.html']) {
    const html = fs.readFileSync(path.join(pubDir, page), 'utf8');
    assert.ok(html.includes('setting-quick-btn-1-label'), `${page} missing quick btn 1 label`);
    assert.ok(html.includes('setting-quick-btn-3-action'), `${page} missing quick btn 3 action`);
    assert.ok(html.includes('agentQuickButtons'), `${page} missing agentQuickButtons wiring`);
  }
});
