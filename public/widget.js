(function() {
  if (window.OmniSixWidgetLoaded) return;
  window.OmniSixWidgetLoaded = true;

  function escapeWidgetHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Retrieve configuration from current script tag
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var businessId = (currentScript && currentScript.getAttribute('data-business-id')) || '';
  var storeName = (currentScript && currentScript.getAttribute('data-store')) || 'OmniSix AI Store';
  var brandColor = (currentScript && currentScript.getAttribute('data-color')) || '#10b981';
  var logoUrl = (currentScript && currentScript.getAttribute('data-logo')) || '';
  var position = (currentScript && currentScript.getAttribute('data-position')) || 'right';
  var whatsappNumber = (currentScript && currentScript.getAttribute('data-whatsapp')) || '94762107801';
  var serverHost = (currentScript && currentScript.getAttribute('data-host')) ||
    (window.location.origin.includes('localhost') ? window.location.origin : 'https://omnisix-ai.onrender.com');

  var cleanPhone = String(whatsappNumber).replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = '94' + cleanPhone.slice(1);

  var storageKey = 'omnisix_widget_sid_' + (businessId || 'default');
  var sessionId = '';
  try {
    sessionId = localStorage.getItem(storageKey) || '';
    if (!sessionId) {
      sessionId = 'widget_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(storageKey, sessionId);
    }
  } catch (e) {
    sessionId = 'widget_' + Date.now().toString(36);
  }

  var posCss = position === 'left' ? 'left:24px;' : 'right:24px;';

  var style = document.createElement('style');
  style.innerHTML = [
    '@keyframes omnisix-pulse {',
    '  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45); }',
    '  70% { box-shadow: 0 0 0 16px rgba(16, 185, 129, 0); }',
    '  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }',
    '}',
    '.omnisix-pulse-anim { animation: omnisix-pulse 2s infinite; }',
    '#omnisix-chat-stream::-webkit-scrollbar { width: 5px; }',
    '#omnisix-chat-stream::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 4px; }'
  ].join('\n');
  document.head.appendChild(style);

  var container = document.createElement('div');
  container.id = 'omnisix-chat-bubble';
  container.innerHTML = [
    '<div style="position:fixed;bottom:24px;' + posCss + 'z-index:999999;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">',
      '<div id="omnisix-bubble-window" style="display:none;width:360px;max-width:92vw;height:520px;max-height:85vh;background:#10121b;border:1px solid rgba(255,255,255,0.12);border-radius:20px;box-shadow:0 16px 48px rgba(0,0,0,0.75);margin-bottom:14px;overflow:hidden;flex-direction:column;box-sizing:border-box;">',
        '<div id="omnisix-widget-header" style="background:' + escapeWidgetHtml(brandColor) + ';color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">',
          '<div style="display:flex;align-items:center;gap:10px;min-width:0;">',
            '<img id="omnisix-widget-logo" src="' + escapeWidgetHtml(logoUrl) + '" alt="" style="width:34px;height:34px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,0.2);' + (logoUrl ? 'display:block;' : 'display:none;') + '">',
            '<div style="min-width:0;">',
              '<div id="omnisix-widget-store-title" style="font-weight:800;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeWidgetHtml(storeName) + '</div>',
              '<div style="font-size:0.72rem;opacity:0.95;margin-top:2px;">🟢 24/7 AI Chat, Voice & WhatsApp</div>',
            '</div>',
          '</div>',
          '<button id="omnisix-close-btn" type="button" style="background:rgba(0,0,0,0.22);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.95rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>',
        '</div>',
        '<div id="omnisix-chat-stream" style="flex:1;padding:14px;background:#07080c;color:#cbd5e1;font-size:0.86rem;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">',
          '<div style="background:#10121b;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px 14px;line-height:1.45;">',
            'ආයුබෝවන්! 👋 <strong>' + escapeWidgetHtml(storeName) + '</strong> වෙත සාදරයෙන් පිළිගන්නවා. භාණ්ඩ මිල ගණන් හෝ ඇණවුම් විස්තර මෙහි Type කර අසන්න:',
          '</div>',
        '</div>',
        '<form id="omnisix-chat-form" style="padding:10px 12px;background:#0d1018;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;align-items:center;flex-shrink:0;">',
          '<input id="omnisix-chat-input" type="text" placeholder="මෙහි පණිවිඩයක් Type කරන්න..." autocomplete="off" style="flex:1;background:#161a26;color:#f8fafc;border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:9px 12px;font-size:0.84rem;outline:none;">',
          '<button id="omnisix-chat-send" type="submit" style="background:' + escapeWidgetHtml(brandColor) + ';color:#fff;border:none;border-radius:10px;padding:9px 14px;font-weight:700;font-size:0.82rem;cursor:pointer;flex-shrink:0;">Send</button>',
        '</form>',
        '<div style="padding:10px 12px;background:#10121b;border-top:1px solid rgba(255,255,255,0.06);display:grid;grid-template-columns:1fr 1fr;gap:8px;flex-shrink:0;">',
          '<a id="omnisix-voice-link" href="' + escapeWidgetHtml(serverHost) + '/call?store=' + encodeURIComponent(storeName) + '" target="_blank" style="background:rgba(59,130,246,0.18);border:1px solid rgba(59,130,246,0.38);color:#93c5fd;text-align:center;padding:8px 10px;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.78rem;display:flex;align-items:center;justify-content:center;gap:5px;">',
            '<span>🎙️</span> Live Voice',
          '</a>',
          '<a id="omnisix-wa-link" href="https://wa.me/' + escapeWidgetHtml(cleanPhone) + '?text=' + encodeURIComponent('Hi ' + storeName + '! I need more information.') + '" target="_blank" style="background:#25D366;color:#fff;text-align:center;padding:8px 10px;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.78rem;display:flex;align-items:center;justify-content:center;gap:5px;">',
            '<span>💬</span> WhatsApp',
          '</a>',
        '</div>',
      '</div>',
      '<button id="omnisix-toggle-btn" type="button" class="omnisix-pulse-anim" style="width:62px;height:62px;border-radius:50%;background:' + escapeWidgetHtml(brandColor) + ';color:#fff;border:none;box-shadow:0 8px 25px rgba(0,0,0,0.5);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.8rem;transition:transform 0.2s;">',
        '💬',
      '</button>',
    '</div>'
  ].join('');

  document.body.appendChild(container);
  var bubbleWin = document.getElementById('omnisix-bubble-window');
  var toggleBtn = document.getElementById('omnisix-toggle-btn');
  var closeBtn = document.getElementById('omnisix-close-btn');
  var chatStream = document.getElementById('omnisix-chat-stream');
  var chatForm = document.getElementById('omnisix-chat-form');
  var chatInput = document.getElementById('omnisix-chat-input');
  var chatSendBtn = document.getElementById('omnisix-chat-send');

  function appendChatBubble(sender, text) {
    if (!chatStream) return null;
    var row = document.createElement('div');
    var isUser = sender === 'user';
    row.style.cssText = 'align-self:' + (isUser ? 'flex-end' : 'flex-start') + ';max-width:85%;padding:10px 12px;border-radius:12px;font-size:0.83rem;line-height:1.45;white-space:pre-wrap;word-break:break-word;' +
      (isUser
        ? 'background:' + brandColor + ';color:#fff;border-bottom-right-radius:3px;'
        : 'background:#151926;color:#e2e8f0;border:1px solid rgba(255,255,255,0.08);border-bottom-left-radius:3px;');
    row.textContent = String(text || '');
    chatStream.appendChild(row);
    chatStream.scrollTop = chatStream.scrollHeight;
    return row;
  }

  function applyBrandingTheme(info) {
    if (!info || !info.ok) return;
    var d = info.active || info;
    if (!currentScript.getAttribute('data-store') && d.name) {
      storeName = d.name;
      var titleEl = document.getElementById('omnisix-widget-store-title');
      if (titleEl) titleEl.textContent = storeName;
    }
    if (!currentScript.getAttribute('data-color') && d.brandColor) {
      brandColor = d.brandColor;
      var hdr = document.getElementById('omnisix-widget-header');
      if (hdr) hdr.style.background = brandColor;
      if (toggleBtn) toggleBtn.style.background = brandColor;
      if (chatSendBtn) chatSendBtn.style.background = brandColor;
    }
    if (!logoUrl && d.logoUrl) {
      logoUrl = d.logoUrl;
      var logoEl = document.getElementById('omnisix-widget-logo');
      if (logoEl) {
        logoEl.src = logoUrl;
        logoEl.style.display = 'block';
      }
    }
  }

  var brandingFetched = false;
  function maybeLoadBranding() {
    if (brandingFetched || typeof fetch !== 'function') return;
    brandingFetched = true;
    var qs = businessId ? ('?businessId=' + encodeURIComponent(businessId)) : '';
    fetch(serverHost.replace(/\/$/, '') + '/api/business' + qs)
      .then(function(r) { return r.json(); })
      .then(applyBrandingTheme)
      .catch(function() {});
  }

  if (toggleBtn) {
    toggleBtn.onclick = function() {
      var isHidden = bubbleWin.style.display === 'none';
      bubbleWin.style.display = isHidden ? 'flex' : 'none';
      toggleBtn.style.transform = isHidden ? 'scale(0.92)' : 'scale(1)';
      if (isHidden) {
        maybeLoadBranding();
        if (chatInput) setTimeout(function() { chatInput.focus(); }, 60);
      }
    };
  }
  if (closeBtn) {
    closeBtn.onclick = function() {
      bubbleWin.style.display = 'none';
      if (toggleBtn) toggleBtn.style.transform = 'scale(1)';
    };
  }

  if (chatForm) {
    chatForm.onsubmit = function(e) {
      e.preventDefault();
      var msg = (chatInput && chatInput.value || '').trim();
      if (!msg) return;
      chatInput.value = '';
      appendChatBubble('user', msg);
      var typingEl = appendChatBubble('ai', 'Typing...');
      if (chatSendBtn) chatSendBtn.disabled = true;

      fetch(serverHost.replace(/\/$/, '') + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          message: msg,
          businessId: businessId || undefined,
          storeName: storeName,
          skipAudio: true
        })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
        if (data && data.reply) {
          appendChatBubble('ai', data.reply);
        } else {
          appendChatBubble('ai', (data && data.error) ? data.error : 'සමාවන්න, කෙටි දෝෂයක් ඇති වුණා. නැවත උත්සාහ කරන්න.');
        }
      })
      .catch(function() {
        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
        appendChatBubble('ai', 'සම්බන්ධතාවයේ දෝෂයක් ඇත. කරුණාකර WhatsApp හරහා සම්බන්ධ වන්න.');
      })
      .finally(function() {
        if (chatSendBtn) chatSendBtn.disabled = false;
        if (chatInput) chatInput.focus();
      });
    };
  }
})();
