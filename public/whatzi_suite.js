// ═══════════════════════════════════════════════════════════════════════════
// WHATZI CRM 1-10 FULL FEATURE SUITE JAVASCRIPT ENGINE
// ═══════════════════════════════════════════════════════════════════════════

let currentDraggedDealId = null;

// ─── Global Utility: Menu Search Filter ───────────────────────────────────────
function filterSidebarMenu(query) {
  const q = String(query || '').toLowerCase().trim();
  const buttons = document.querySelectorAll('.sidebar .tab-btn');
  buttons.forEach(btn => {
    const text = btn.innerText.toLowerCase();
    if (!q || text.includes(q)) {
      btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
    }
  });
}

// ─── Global Utility: Dark / Light Mode Switcher ──────────────────────────────
function toggleThemeMode() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('omnisix_theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.innerHTML = isLight ? '🌙 Dark' : '☀️ Light';
}

// ─── Global Utility: LTR / RTL Switcher ───────────────────────────────────────
function toggleRTLMode() {
  const isRTL = document.body.getAttribute('dir') === 'rtl';
  document.body.setAttribute('dir', isRTL ? 'ltr' : 'rtl');
  localStorage.setItem('omnisix_dir', isRTL ? 'ltr' : 'rtl');
  const btn = document.getElementById('rtl-toggle-btn');
  if (btn) btn.innerHTML = isRTL ? '⇄ RTL' : '⇄ LTR';
}

// Apply saved theme & dir on load
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('omnisix_theme') === 'light') {
    document.body.classList.add('light-theme');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = '🌙 Dark';
  }
  if (localStorage.getItem('omnisix_dir') === 'rtl') {
    document.body.setAttribute('dir', 'rtl');
    const btn = document.getElementById('rtl-toggle-btn');
    if (btn) btn.innerHTML = '⇄ LTR';
  }
});

// ─── 1. Kanban CRM & Deal Pipeline Engine ────────────────────────────────────
async function fetchKanbanDeals() {
  try {
    const res = await fetch('/api/kanban/deals');
    const data = await res.json();
    if (!data.ok) return;

    const stages = ['new', 'contacted', 'proposal', 'won', 'lost'];
    const deals = data.deals || [];

    stages.forEach(st => {
      const colList = document.getElementById(`kanban-list-${st}`);
      const colCount = document.getElementById(`kanban-count-${st}`);
      const colVal = document.getElementById(`kanban-val-${st}`);
      if (!colList) return;

      const stageDeals = deals.filter(d => d.stage === st);
      if (colCount) colCount.textContent = stageDeals.length;
      if (colVal) {
        const total = stageDeals.reduce((sum, d) => sum + (Number(d.dealValue) || 0), 0);
        colVal.textContent = `Rs. ${total.toLocaleString()}`;
      }

      if (stageDeals.length === 0) {
        colList.innerHTML = `<div style="text-align:center;color:#64748b;font-size:0.75rem;padding:24px 8px;border:1px dashed rgba(255,255,255,0.06);border-radius:10px;">No deals in this stage</div>`;
        return;
      }

      colList.innerHTML = stageDeals.map(d => {
        return `
          <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, '${d.id}')" ondragend="handleDragEnd(event)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
              <h5 style="font-size:0.88rem;font-weight:700;color:var(--text-primary);margin:0;">${escapeHtml(d.title)}</h5>
              <button onclick="deleteKanbanDeal('${d.id}')" style="background:none;border:none;color:#f43f5e;cursor:pointer;font-size:0.85rem;" title="Remove Deal">✕</button>
            </div>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:6px;display:flex;align-items:center;gap:6px;">
              <span>👤</span> ${escapeHtml(d.contactName)} (${escapeHtml(d.contactPhone || '-')})
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
              <span style="font-size:0.85rem;font-weight:800;color:#ff0055;">Rs. ${(Number(d.dealValue) || 0).toLocaleString()}</span>
              <a href="https://wa.me/${String(d.contactPhone).replace(/\\D/g, '')}" target="_blank" style="padding:4px 8px;border-radius:6px;background:rgba(16,185,129,0.15);color:#34d399;text-decoration:none;font-size:0.72rem;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                💬 WhatsApp
              </a>
            </div>
          </div>
        `;
      }).join('');
    });
  } catch(e) {
    console.error('fetchKanbanDeals error:', e);
  }
}

function handleDragStart(ev, dealId) {
  currentDraggedDealId = dealId;
  ev.target.classList.add('dragging');
  ev.dataTransfer.setData('text/plain', dealId);
}
function handleDragEnd(ev) {
  ev.target.classList.remove('dragging');
}
function handleDragOver(ev) {
  ev.preventDefault();
}
async function handleDrop(ev, targetStage) {
  ev.preventDefault();
  if (!currentDraggedDealId) return;
  try {
    await fetch(`/api/kanban/deals/${currentDraggedDealId}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetStage })
    });
    currentDraggedDealId = null;
    fetchKanbanDeals();
  } catch(e) {
    console.error('handleDrop error:', e);
  }
}

function openAddDealModal() {
  const modal = document.getElementById('modal-add-deal');
  if (modal) modal.style.display = 'flex';
}
function closeAddDealModal() {
  const modal = document.getElementById('modal-add-deal');
  if (modal) modal.style.display = 'none';
}
async function submitAddDeal(e) {
  e.preventDefault();
  const title = document.getElementById('deal-title-input').value.trim();
  const contactName = document.getElementById('deal-contact-name').value.trim();
  const contactPhone = document.getElementById('deal-contact-phone').value.trim();
  const dealValue = document.getElementById('deal-value-input').value.trim();
  const stage = document.getElementById('deal-stage-select').value;

  try {
    const res = await fetch('/api/kanban/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, contactName, contactPhone, dealValue, stage })
    });
    const data = await res.json();
    if (data.ok) {
      closeAddDealModal();
      document.getElementById('form-add-deal').reset();
      fetchKanbanDeals();
    } else {
      alert('Error: ' + data.error);
    }
  } catch(err) {
    alert('Failed to save deal: ' + err.message);
  }
}
async function deleteKanbanDeal(id) {
  if (!confirm('ඔබට මෙම Deal එක ඉවත් කිරීමට අවශ්‍ය බව තහවුරු කරන්නද?')) return;
  try {
    await fetch(`/api/kanban/deals/${id}`, { method: 'DELETE' });
    fetchKanbanDeals();
  } catch(e) {}
}

// ─── 2. WhatsApp Number Warmer Controls ───────────────────────────────────────
async function fetchWarmerStatus() {
  try {
    const res = await fetch('/api/warmer');
    const data = await res.json();
    if (!data.ok || !data.warmer) return;

    const w = data.warmer;
    const toggle = document.getElementById('warmer-toggle-checkbox');
    const statusText = document.getElementById('warmer-status-pill');
    if (toggle) toggle.checked = !!w.running;
    if (statusText) {
      statusText.innerHTML = w.running ? '🟢 RUNNING (Auto P2P Active)' : '⏸️ STOPPED';
      statusText.style.color = w.running ? '#34d399' : '#94a3b8';
    }

    // Scripts table
    const scriptsList = document.getElementById('warmer-scripts-list');
    if (scriptsList) {
      if (!w.scripts || w.scripts.length === 0) {
        scriptsList.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#64748b;padding:16px;">No dialogue scripts configured yet.</td></tr>`;
      } else {
        scriptsList.innerHTML = w.scripts.map((s, idx) => `
          <tr>
            <td style="font-weight:700;color:var(--text-muted);font-family:'JetBrains Mono';">${idx + 1}</td>
            <td style="color:var(--text-primary);font-size:0.82rem;"><strong>Q:</strong> ${escapeHtml(s.question)}<br><span style="color:#38bdf8;"><strong>A:</strong> ${escapeHtml(s.answer)}</span></td>
            <td><button onclick="deleteWarmerScript('${s.id}')" style="background:none;border:none;color:#f43f5e;cursor:pointer;">🗑️</button></td>
          </tr>
        `).join('');
      }
    }

    // Terminal logs
    const term = document.getElementById('warmer-terminal-logs');
    if (term) {
      if (!w.logs || w.logs.length === 0) {
        term.innerHTML = `<div style="color:#64748b;">No dialogue events recorded yet. Turn on Warmer to start simulated human dialogues.</div>`;
      } else {
        term.innerHTML = w.logs.slice(0, 30).map(l => `
          <div class="warmer-log-entry">
            <span style="color:#94a3b8;">[${new Date(l.timestamp).toLocaleTimeString()}]</span>
            <span style="color:${l.status === 'success' ? '#34d399' : '#f59e0b'};">[${l.status.toUpperCase()}]</span>
            <span>+${l.from || 'Line1'} ➔ +${l.to || 'Line2'}: "${escapeHtml(l.question || l.details || '')}"</span>
          </div>
        `).join('');
      }
    }
  } catch(e) {
    console.error('fetchWarmerStatus error:', e);
  }
}

async function toggleWarmer(running) {
  try {
    await fetch('/api/warmer/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ running })
    });
    fetchWarmerStatus();
  } catch(e) {}
}

async function submitAddWarmerScript(e) {
  e.preventDefault();
  const q = document.getElementById('warmer-q-input').value.trim();
  const a = document.getElementById('warmer-a-input').value.trim();
  if (!q || !a) return;
  try {
    await fetch('/api/warmer/scripts/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, answer: a })
    });
    document.getElementById('form-add-warmer-script').reset();
    fetchWarmerStatus();
  } catch(e) {}
}

async function deleteWarmerScript(id) {
  try {
    await fetch(`/api/warmer/scripts/${id}`, { method: 'DELETE' });
    fetchWarmerStatus();
  } catch(e) {}
}

async function clearWarmerLogs() {
  try {
    await fetch('/api/warmer/logs/clear', { method: 'POST' });
    fetchWarmerStatus();
  } catch(e) {}
}

// ─── 3. Contacts Management & Phonebook ───────────────────────────────────────
async function fetchContacts() {
  try {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    if (!data.ok) return;

    const contacts = data.contacts || [];
    const groups = data.groups || [];

    // Render groups chips
    const grpContainer = document.getElementById('contacts-groups-chips');
    if (grpContainer) {
      grpContainer.innerHTML = groups.map(g => `
        <button class="var-chip" onclick="filterContactsByGroup('${escapeHtml(g.name)}')">
          📁 ${escapeHtml(g.name)} (${g.count || 0})
        </button>
      `).join('');
    }

    // Render contacts table
    const tableBody = document.getElementById('contacts-table-body');
    if (tableBody) {
      if (contacts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#64748b;">No contacts saved yet. Upload CSV or Add Contact.</td></tr>`;
      } else {
        tableBody.innerHTML = contacts.map(c => `
          <tr>
            <td style="font-weight:700;color:var(--text-primary);">${escapeHtml(c.name)}</td>
            <td style="font-family:'JetBrains Mono';color:#38bdf8;">+${escapeHtml(c.phone)}</td>
            <td><span class="deal-badge" style="background:rgba(255,0,85,0.12);color:#ff4d6d;">${escapeHtml(c.group || 'All Customers')}</span></td>
            <td style="font-size:0.75rem;color:var(--text-muted);font-family:'JetBrains Mono';">${escapeHtml(c.var1 || '-')}, ${escapeHtml(c.var2 || '-')}</td>
            <td>
              <a href="https://wa.me/${c.phone}" target="_blank" style="padding:4px 10px;border-radius:6px;background:rgba(16,185,129,0.15);color:#34d399;font-weight:700;font-size:0.75rem;text-decoration:none;">
                💬 Chat
              </a>
            </td>
            <td><button onclick="deleteContact('${c.id}')" style="background:none;border:none;color:#f43f5e;cursor:pointer;">🗑️</button></td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {
    console.error('fetchContacts error:', e);
  }
}

function openAddContactModal() {
  const m = document.getElementById('modal-add-contact');
  if (m) m.style.display = 'flex';
}
function closeAddContactModal() {
  const m = document.getElementById('modal-add-contact');
  if (m) m.style.display = 'none';
}
async function submitAddContact(e) {
  e.preventDefault();
  const name = document.getElementById('cnt-name-input').value.trim();
  const phone = document.getElementById('cnt-phone-input').value.trim();
  const group = document.getElementById('cnt-group-select').value;
  const var1 = document.getElementById('cnt-var1-input').value.trim();
  const var2 = document.getElementById('cnt-var2-input').value.trim();

  try {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, group, var1, var2 })
    });
    const data = await res.json();
    if (data.ok) {
      closeAddContactModal();
      document.getElementById('form-add-contact').reset();
      fetchContacts();
    } else {
      alert('Error: ' + data.error);
    }
  } catch(err) {
    alert('Failed to save contact: ' + err.message);
  }
}
async function deleteContact(id) {
  if (!confirm('ඔබට මෙම Contact එක ඉවත් කිරීමට අවශ්‍ය බව තහවුරු කරන්නද?')) return;
  try {
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    fetchContacts();
  } catch(e) {}
}

function handleCsvFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const text = evt.target.result;
    const lines = text.split(/\\r?\\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return alert('CSV file must have a header row and at least 1 contact.');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('number'));
    const nameIdx = headers.findIndex(h => h.includes('name'));

    if (phoneIdx === -1) {
      return alert('CSV header must contain a column named "phone", "mobile", or "number".');
    }

    const parsedContacts = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols[phoneIdx]) {
        parsedContacts.push({
          name: nameIdx !== -1 ? cols[nameIdx] : 'Customer ' + i,
          phone: cols[phoneIdx],
          var1: cols[2] || '',
          var2: cols[3] || '',
          group: 'All Customers'
        });
      }
    }

    try {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: parsedContacts })
      });
      const data = await res.json();
      alert(`✅ සාර්ථකව Contacts ${data.imported || parsedContacts.length} ක් Import කරන ලදී!`);
      fetchContacts();
    } catch(err) {
      alert('Failed to import contacts: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ─── 4. Interactive Forms & Flows ───────────────────────────────────────────
async function fetchForms() {
  try {
    const res = await fetch('/api/forms');
    const data = await res.json();
    if (!data.ok) return;

    const forms = data.forms || [];
    const list = document.getElementById('forms-cards-grid');
    if (list) {
      if (forms.length === 0) {
        list.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:#64748b;">No interactive forms built yet. Click Create WhatsApp Form to start.</div>`;
      } else {
        list.innerHTML = forms.map(f => `
          <div style="background:#10121b;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
              <h4 style="font-size:0.96rem;font-weight:700;color:var(--text-primary);margin:0;">📝 ${escapeHtml(f.name)}</h4>
              <button onclick="deleteForm('${f.id}')" style="background:none;border:none;color:#f43f5e;cursor:pointer;">✕</button>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:12px;">Trigger keyword: <span style="color:#ff0055;font-weight:700;">"${escapeHtml(f.triggerKeyword)}"</span></p>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:14px;">Fields: ${(f.fields || []).map(fl => fl.label).join(', ')}</div>
            <button class="btn-secondary" onclick="renderFormPreview('${f.id}')" style="width:100%;padding:6px;font-size:0.78rem;">
              📱 Preview in WhatsApp Simulator
            </button>
          </div>
        `).join('');
      }
    }
  } catch(e) {
    console.error('fetchForms error:', e);
  }
}

let activeFormFields = [];

function openCreateFormModal() {
  activeFormFields = [
    { id: 'f_name', type: 'text', label: 'Full Name', required: true },
    { id: 'f_phone', type: 'phone', label: 'WhatsApp Phone', required: true },
    { id: 'f_service', type: 'dropdown', label: 'Service / Product', options: ['Western Photo Shoot', 'Frameless Wall Art', 'Custom Retouching'], required: true }
  ];
  renderFormFieldsEditor();
  const m = document.getElementById('modal-create-form');
  if (m) m.style.display = 'flex';
}
function closeCreateFormModal() {
  const m = document.getElementById('modal-create-form');
  if (m) m.style.display = 'none';
}
function renderFormFieldsEditor() {
  const container = document.getElementById('form-fields-editor-list');
  if (!container) return;
  container.innerHTML = activeFormFields.map((f, idx) => `
    <div style="background:#07080c;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-weight:700;font-size:0.84rem;color:#fff;">${escapeHtml(f.label)} <span style="font-size:0.72rem;color:#ff0055;">(${f.type})</span></div>
      </div>
      <button type="button" onclick="removeFormField(${idx})" style="background:none;border:none;color:#f43f5e;cursor:pointer;">✕</button>
    </div>
  `).join('');
}
function addFieldToActiveForm(type) {
  const label = prompt('Enter Field Label / Title:', 'Question / Input');
  if (!label) return;
  activeFormFields.push({ id: 'f_' + Date.now(), type, label, required: true });
  renderFormFieldsEditor();
}
function removeFormField(idx) {
  activeFormFields.splice(idx, 1);
  renderFormFieldsEditor();
}
async function submitCreateForm(e) {
  e.preventDefault();
  const name = document.getElementById('form-name-input').value.trim();
  const triggerKeyword = document.getElementById('form-trigger-keyword').value.trim();

  try {
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, triggerKeyword, fields: activeFormFields })
    });
    const data = await res.json();
    if (data.ok) {
      closeCreateFormModal();
      fetchForms();
    } else {
      alert('Error: ' + data.error);
    }
  } catch(err) {
    alert('Failed to save form: ' + err.message);
  }
}
async function deleteForm(id) {
  if (!confirm('ඔබට මෙම Form එක ඉවත් කිරීමට අවශ්‍ය බව තහවුරු කරන්නද?')) return;
  try {
    await fetch(`/api/forms/${id}`, { method: 'DELETE' });
    fetchForms();
  } catch(e) {}
}

async function renderFormPreview(formId) {
  try {
    const res = await fetch('/api/forms');
    const data = await res.json();
    const form = (data.forms || []).find(f => f.id === formId);
    if (!form) return;

    const phoneBody = document.getElementById('phone-simulator-body');
    if (!phoneBody) return;

    phoneBody.innerHTML = `
      <div style="background:#10121b;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;margin-bottom:12px;">
        <h5 style="color:#ff0055;margin:0 0 6px 0;font-size:0.9rem;">📋 ${escapeHtml(form.name)}</h5>
        <p style="font-size:0.75rem;color:#94a3b8;margin:0 0 12px 0;">කරුණාකර පහත තොරතුරු සම්පූර්ණ කර ඉදිරිපත් කරන්න.</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${(form.fields || []).map(f => `
            <div>
              <label style="font-size:0.72rem;color:#cbd5e1;font-weight:700;display:block;margin-bottom:3px;">${escapeHtml(f.label)}</label>
              ${f.type === 'dropdown' ? `
                <select class="form-select" style="width:100%;font-size:0.78rem;padding:6px;">
                  ${(f.options || ['Option 1', 'Option 2']).map(o => `<option>${escapeHtml(o)}</option>`).join('')}
                </select>
              ` : `
                <input type="text" class="form-input" placeholder="Type here..." style="width:100%;font-size:0.78rem;padding:6px;" />
              `}
            </div>
          `).join('')}
          <button class="btn-primary" style="margin-top:8px;padding:8px;font-size:0.78rem;width:100%;">
            📤 Submit Form
          </button>
        </div>
      </div>
    `;
  } catch(e) {}
}

// ─── 5. Developer REST API & Webhooks Engine ─────────────────────────────────
async function fetchDeveloperKeys() {
  try {
    const res = await fetch('/api/developer/keys');
    const data = await res.json();
    if (!data.ok) return;

    const keysList = document.getElementById('api-keys-list');
    if (keysList) {
      if (!data.keys || data.keys.length === 0) {
        keysList.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:#64748b;">No active API keys. Click Generate New Key.</td></tr>`;
      } else {
        keysList.innerHTML = data.keys.map(k => `
          <tr>
            <td style="font-weight:700;color:var(--text-primary);">${escapeHtml(k.label)}</td>
            <td style="font-family:'JetBrains Mono';color:#ff0055;">${escapeHtml(k.key.slice(0, 10))}••••••••••••${escapeHtml(k.key.slice(-4))}</td>
            <td style="font-size:0.75rem;color:var(--text-muted);">${new Date(k.createdAt).toLocaleDateString()}</td>
            <td><button onclick="revokeApiKey('${k.id}')" style="background:none;border:none;color:#f43f5e;cursor:pointer;">Revoke</button></td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {}
}

async function generateApiKey() {
  const label = prompt('Enter a label for this API Token (e.g. ERP System, Zapier, Custom App):', 'Production REST API Key');
  if (!label) return;
  try {
    const res = await fetch('/api/developer/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label })
    });
    const data = await res.json();
    if (data.ok && data.key) {
      alert(`✅ New API Key Generated Successfully!\n\nBearer Token:\n${data.key.key}\n\nPlease copy this key now.`);
      fetchDeveloperKeys();
    }
  } catch(e) {
    alert('Failed to generate key: ' + e.message);
  }
}
async function revokeApiKey(id) {
  if (!confirm('ඔබට මෙම API Key එක අවලංගු කිරීමට අවශ්‍ය බව තහවුරු කරන්නද?')) return;
  try {
    await fetch(`/api/developer/keys/${id}`, { method: 'DELETE' });
    fetchDeveloperKeys();
  } catch(e) {}
}

async function fetchWebhooks() {
  try {
    const res = await fetch('/api/developer/webhooks');
    const data = await res.json();
    if (!data.ok) return;

    const list = document.getElementById('webhooks-list');
    if (list) {
      if (!data.webhooks || data.webhooks.length === 0) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:#64748b;">No outbound webhooks configured.</td></tr>`;
      } else {
        list.innerHTML = data.webhooks.map(w => `
          <tr>
            <td style="font-family:'JetBrains Mono';color:#38bdf8;font-size:0.78rem;">${escapeHtml(w.url)}</td>
            <td style="font-size:0.75rem;color:var(--text-muted);">${(w.events || []).join(', ')}</td>
            <td><span class="deal-badge" style="background:rgba(16,185,129,0.15);color:#34d399;">${escapeHtml(w.status)}</span></td>
            <td><button onclick="deleteWebhook('${w.id}')" style="background:none;border:none;color:#f43f5e;cursor:pointer;">🗑️</button></td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {}
}

async function submitAddWebhook(e) {
  e.preventDefault();
  const url = document.getElementById('webhook-url-input').value.trim();
  if (!url) return;
  try {
    await fetch('/api/developer/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, events: ['message.received', 'order.confirmed', 'call.completed'] })
    });
    document.getElementById('form-add-webhook').reset();
    fetchWebhooks();
  } catch(e) {}
}
async function deleteWebhook(id) {
  if (!confirm('ඔබට මෙම Webhook එක ඉවත් කිරීමට අවශ්‍ය බව තහවුරු කරන්නද?')) return;
  try {
    await fetch(`/api/developer/webhooks/${id}`, { method: 'DELETE' });
    fetchWebhooks();
  } catch(e) {}
}

// ─── 6. Team & Agents Collaboration ──────────────────────────────────────────
async function fetchTeamAgents() {
  try {
    const res = await fetch('/api/team/agents');
    const data = await res.json();
    if (!data.ok) return;

    const grid = document.getElementById('team-agents-grid');
    if (grid) {
      grid.innerHTML = (data.agents || []).map(a => `
        <div style="background:#10121b;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;display:flex;align-items:center;gap:14px;">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#ff0055,#dc2626);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.1rem;">
            ${(a.name || 'A')[0].toUpperCase()}
          </div>
          <div style="flex:1;">
            <div style="font-weight:700;color:var(--text-primary);font-size:0.92rem;">${escapeHtml(a.name)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(a.email || '-')}</div>
            <span class="deal-badge" style="margin-top:4px;background:rgba(255,0,85,0.12);color:#ff4d6d;text-transform:uppercase;">${escapeHtml(a.role)}</span>
          </div>
        </div>
      `).join('');
    }
  } catch(e) {}
}

function copyWidgetSnippet() {
  const origin = window.location.origin;
  const snippet = `<script src="${origin}/widget.js"></script>`;
  navigator.clipboard.writeText(snippet);
  alert('✅ Embeddable Website Widget Code copied to clipboard!\n\nPaste this script tag into any HTML website before </body> to display the floating live chat assistant.');
}

// ─── 7. Voice Call Logs Engine ───────────────────────────────────────────────
async function fetchCallLogs() {
  try {
    const res = await fetch('/api/calls/logs');
    const data = await res.json();
    if (!data.ok) return;

    const list = document.getElementById('call-logs-table-body');
    if (list) {
      if (!data.logs || data.logs.length === 0) {
        list.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b;">No voice call records found yet.</td></tr>`;
      } else {
        list.innerHTML = data.logs.map(c => `
          <tr>
            <td style="font-family:'JetBrains Mono';color:#38bdf8;">+${escapeHtml(c.number)}</td>
            <td><span class="deal-badge" style="background:${c.direction === 'incoming' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)'};color:${c.direction === 'incoming' ? '#34d399' : '#60a5fa'};">${escapeHtml(c.direction)}</span></td>
            <td><span class="deal-badge" style="background:rgba(255,0,85,0.12);color:#ff4d6d;">${escapeHtml(c.status)}</span></td>
            <td style="font-family:'JetBrains Mono';color:var(--text-muted);">${escapeHtml(c.duration)}</td>
            <td style="font-size:0.75rem;color:var(--text-muted);">${new Date(c.timestamp).toLocaleString()}</td>
            <td style="font-size:0.8rem;color:var(--text-secondary);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(c.transcription)}">
              ${escapeHtml(c.transcription)}
            </td>
            <td>
              <a href="https://wa.me/${c.number}" target="_blank" style="padding:4px 10px;border-radius:6px;background:rgba(16,185,129,0.15);color:#34d399;font-weight:700;font-size:0.75rem;text-decoration:none;">
                💬 Follow-up
              </a>
            </td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {}
}

// ─── 8. Anti-Ban Broadcast Variable Inserter ─────────────────────────────────
function insertBroadcastVariable(varName) {
  const textarea = document.getElementById('broadcast-msg') || document.querySelector('textarea[name="broadcast-message"]');
  if (!textarea) return;
  const start = textarea.selectionStart || textarea.value.length;
  const end = textarea.selectionEnd || textarea.value.length;
  const val = textarea.value;
  textarea.value = val.substring(0, start) + varName + val.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + varName.length;
}

// ─── Tab Switcher Dispatcher for New Modules ─────────────────────────────────
const origShowTab = window.showTab;
window.showTab = function(tabName) {
  if (typeof origShowTab === 'function') {
    origShowTab(tabName);
  }

  // Trigger lazy fetching when tab is shown
  if (tabName === 'kanban') fetchKanbanDeals();
  if (tabName === 'contacts') fetchContacts();
  if (tabName === 'forms') fetchForms();
  if (tabName === 'warmer') fetchWarmerStatus();
  if (tabName === 'developer') { fetchDeveloperKeys(); fetchWebhooks(); }
  if (tabName === 'team') fetchTeamAgents();
  if (tabName === 'calls') fetchCallLogs();
};
