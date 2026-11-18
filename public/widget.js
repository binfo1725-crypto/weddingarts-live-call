(function() {
  if (window.OmniSixWidgetLoaded) return;
  window.OmniSixWidgetLoaded = true;

  var container = document.createElement("div");
  container.id = "omnisix-chat-bubble";
  container.innerHTML = [
    '<div style="position:fixed;bottom:24px;right:24px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">',
      '<div id="omnisix-bubble-window" style="display:none;width:340px;height:440px;background:#10121b;border:1px solid rgba(255,0,85,0.3);border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,0.6);margin-bottom:12px;overflow:hidden;flex-direction:column;">',
        '<div style="background:linear-gradient(135deg, #ff0055, #dc2626);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">',
          '<div>',
            '<div style="font-weight:700;font-size:1rem;">OmniSix AI Assistant</div>',
            '<div style="font-size:0.75rem;opacity:0.9;">🟢 Online | WhatsApp & Live Chat</div>',
          '</div>',
          '<button id="omnisix-close-btn" style="background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;">✕</button>',
        '</div>',
        '<div style="flex:1;padding:16px;background:#07080c;color:#cbd5e1;font-size:0.86rem;overflow-y:auto;display:flex;flex-direction:column;gap:12px;">',
          '<div style="background:#10121b;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;">',
            'ආයුබෝවන්! 👋 ඔබට අපගේ භාණ්ඩ හා සේවා පිළිබඳ විමසීම් හෝ WhatsApp හරහා ඇණවුම් කිරීමට සහය අවශ්‍යද?',
          '</div>',
        '</div>',
        '<div style="padding:12px;background:#10121b;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;">',
          '<a href="https://wa.me/94762107801?text=Hi!+I+need+more+information" target="_blank" style="flex:1;background:linear-gradient(135deg,#ff0055,#dc2626);color:#fff;text-align:center;padding:10px;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.85rem;display:flex;align-items:center;justify-content:center;gap:6px;">',
            '<span>💬</span> WhatsApp Chat',
          '</a>',
        '</div>',
      '</div>',
      '<button id="omnisix-toggle-btn" style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#ff0055,#dc2626);color:#fff;border:none;box-shadow:0 8px 25px rgba(255,0,85,0.45);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.8rem;transition:all 0.2s;">',
        '💬',
      '</button>',
    '</div>'
  ].join('');

  document.body.appendChild(container);
  var bubbleWin = document.getElementById("omnisix-bubble-window");
  var toggleBtn = document.getElementById("omnisix-toggle-btn");
  var closeBtn = document.getElementById("omnisix-close-btn");

  if (toggleBtn) toggleBtn.onclick = function() { bubbleWin.style.display = bubbleWin.style.display === "none" ? "flex" : "none"; };
  if (closeBtn) closeBtn.onclick = function() { bubbleWin.style.display = "none"; };
})();
