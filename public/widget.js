(function() {
  if (window.OmniSixWidgetLoaded) return;
  window.OmniSixWidgetLoaded = true;

  // Retrieve configuration from current script tag
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var storeName = currentScript.getAttribute('data-store') || 'OmniSix AI Store';
  var brandColor = currentScript.getAttribute('data-color') || '#ff0055';
  var position = currentScript.getAttribute('data-position') || 'right';
  var whatsappNumber = currentScript.getAttribute('data-whatsapp') || '94762107801';
  var serverHost = currentScript.getAttribute('data-host') || (window.location.origin.includes('localhost') ? window.location.origin : 'https://omnisix-ai.onrender.com');

  var cleanPhone = String(whatsappNumber).replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = '94' + cleanPhone.slice(1);

  var posCss = position === 'left' ? 'left:24px;' : 'right:24px;';

  var style = document.createElement('style');
  style.innerHTML = `
    @keyframes omnisix-pulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 0, 85, 0.5); }
      70% { box-shadow: 0 0 0 16px rgba(255, 0, 85, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 0, 85, 0); }
    }
    .omnisix-pulse-anim {
      animation: omnisix-pulse 2s infinite;
    }
  `;
  document.head.appendChild(style);

  var container = document.createElement('div');
  container.id = 'omnisix-chat-bubble';
  container.innerHTML = [
    '<div style="position:fixed;bottom:24px;' + posCss + 'z-index:999999;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">',
      '<div id="omnisix-bubble-window" style="display:none;width:350px;height:470px;background:#10121b;border:1px solid rgba(255,255,255,0.12);border-radius:20px;box-shadow:0 16px 48px rgba(0,0,0,0.7);margin-bottom:14px;overflow:hidden;flex-direction:column;box-sizing:border-box;">',
        '<div style="background:' + brandColor + ';color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">',
          '<div>',
            '<div style="font-weight:800;font-size:1.05rem;display:flex;align-items:center;gap:6px;">' + storeName + '</div>',
            '<div style="font-size:0.75rem;opacity:0.95;margin-top:2px;">🟢 24/7 AI Voice Call & WhatsApp</div>',
          '</div>',
          '<button id="omnisix-close-btn" style="background:rgba(0,0,0,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.95rem;display:flex;align-items:center;justify-content:center;">✕</button>',
        '</div>',
        '<div style="flex:1;padding:18px;background:#07080c;color:#cbd5e1;font-size:0.88rem;overflow-y:auto;display:flex;flex-direction:column;gap:12px;">',
          '<div style="background:#10121b;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;line-height:1.45;">',
            'ආයුබෝවන්! 👋 <strong>' + storeName + '</strong> වෙත සාදරයෙන් පිළිගන්නවා. ඔබට අවශ්‍ය ඕනෑම විමසීමක්, භාණ්ඩ තොරතුරු හෝ මිල ගණන් දැනගැනීමට පහතින් තෝරන්න:',
          '</div>',
          '<div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);border-radius:12px;padding:12px;color:#93c5fd;font-size:0.82rem;">',
            '🎙️ <strong>Instant Voice Call:</strong> සිංහලෙන් කතා කර තොරතුරු දැනගන්න.',
          '</div>',
        '</div>',
        '<div style="padding:14px;background:#10121b;border-top:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;gap:10px;">',
          '<a href="' + serverHost + '/call?store=' + encodeURIComponent(storeName) + '" target="_blank" style="background:' + brandColor + ';color:#fff;text-align:center;padding:11px;border-radius:12px;text-decoration:none;font-weight:700;font-size:0.86rem;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 15px rgba(0,0,0,0.3);">',
            '<span>🎙️</span> Start Live AI Voice Call',
          '</a>',
          '<a href="https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent('Hi ' + storeName + '! I need more information.') + '" target="_blank" style="background:#25D366;color:#fff;text-align:center;padding:11px;border-radius:12px;text-decoration:none;font-weight:700;font-size:0.86rem;display:flex;align-items:center;justify-content:center;gap:8px;">',
            '<span>💬</span> Chat on WhatsApp',
          '</a>',
        '</div>',
      '</div>',
      '<button id="omnisix-toggle-btn" class="omnisix-pulse-anim" style="width:62px;height:62px;border-radius:50%;background:' + brandColor + ';color:#fff;border:none;box-shadow:0 8px 25px rgba(0,0,0,0.5);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.8rem;transition:transform 0.2s;">',
        '💬',
      '</button>',
    '</div>'
  ].join('');

  document.body.appendChild(container);
  var bubbleWin = document.getElementById('omnisix-bubble-window');
  var toggleBtn = document.getElementById('omnisix-toggle-btn');
  var closeBtn = document.getElementById('omnisix-close-btn');

  if (toggleBtn) {
    toggleBtn.onclick = function() {
      var isHidden = bubbleWin.style.display === 'none';
      bubbleWin.style.display = isHidden ? 'flex' : 'none';
      toggleBtn.style.transform = isHidden ? 'scale(0.92)' : 'scale(1)';
    };
  }
  if (closeBtn) {
    closeBtn.onclick = function() {
      bubbleWin.style.display = 'none';
      if (toggleBtn) toggleBtn.style.transform = 'scale(1)';
    };
  }
})();
