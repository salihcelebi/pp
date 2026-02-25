(() => {
  if (typeof window === 'undefined') return;
  if (window.__SMM_INIT__) return;
  window.__SMM_INIT__ = true;
  'use strict';

  const BASE_URL = 'https://anabayiniz.com/orders';
  const BOUND = new Set();
  const STATUS_MAP = {
    all: '',
    pending: 'pending',
    completed: 'completed',
    inprogress: 'inprogress',
    canceled: 'canceled'
  };

  const state = {
    rows: [],
    hashes: new Set(),
    dropped: 0,
    running: false,
    stop: false,
    scanFilter: { status: 'all', timeFilter: 'all', xDays: 30 }
  };
  const ui = {};

  const byId = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const toast = (m) => window.__PatpatUI?.UI?.toast?.(m) || alert(m);

  function bindOnce(el, ev, key, fn) {
    if (!el) return;
    const k = `${key}:${ev}`;
    if (BOUND.has(k)) return;
    BOUND.add(k);
    el.addEventListener(ev, fn);
  }

  function normalizeStatus(v) {
    const s = String(v || '').toLowerCase();
    if (s.includes('pending') || s.includes('bekle')) return 'pending';
    if (s.includes('inprogress') || s.includes('yüklen') || s.includes('işlem')) return 'inprogress';
    if (s.includes('completed') || s.includes('tamam')) return 'completed';
    if (s.includes('cancel') || s.includes('iptal')) return 'canceled';
    return '';
  }

  function matchesStatusFilter(row, status) {
    if (!status || status === 'all') return true;
    return normalizeStatus(row.status) === status;
  }

  function buildOrdersUrl(page, filter) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    const status = STATUS_MAP[filter.status] || '';
    if (status) params.set('status', status);

    if (filter.timeFilter === '1d') params.set('days', '1');
    else if (filter.timeFilter === '7d') params.set('days', '7');
    else if (filter.timeFilter === 'xd') params.set('days', String(Math.max(1, Number(filter.xDays || 30))));

    return `${BASE_URL}?${params.toString()}`;
  }

  async function hashRow(src) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function getActiveTabId() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) throw new Error('Aktif sekme yok');
    return tab.id;
  }

  async function navigate(tabId, url) {
    await chrome.tabs.update(tabId, { url });
    await new Promise((res) => {
      const l = (id, info) => {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(l);
          res(true);
        }
      };
      chrome.tabs.onUpdated.addListener(l);
    });
    await wait(250);
  }

  async function extractRows(tabId) {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const text = String(document.body?.innerText || '');
        const rows = [];
        const lines = text.split('\n').map((x) => x.trim()).filter(Boolean);
        for (const ln of lines) {
          const m = ln.match(/(\d{4,12}).*?(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?).*?(https?:\/\/\S+)?\s*([\d.,]+)?\s*(\d+)?\s*(\d+)?\s*(.+?)\s+(Beklemede|Yükleniyor|Tamamlandı|Kısmen\s*Tamamlandı|İşlem\s*Sırasında|İptal\s*Edildi|pending|inprogress|completed|canceled)/i);
          if (!m) continue;
          rows.push({
            orderId: m[1] || '',
            dateTime: m[2] || '',
            orderLink: m[3] || location.href,
            unitPrice: m[4] || '',
            startCount: m[5] || '',
            remains: m[6] || '',
            service: (m[7] || '').trim(),
            status: (m[8] || '').trim()
          });
        }
        return rows;
      }
    });
    return Array.isArray(result) ? result : [];
  }

  function appendRow(row) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.orderId || ''}</td><td>${row.dateTime || ''}</td><td>${row.orderLink || ''}</td><td>${row.unitPrice || ''}</td><td>${row.service || ''}</td><td>${row.status || ''}</td><td>${row.remains || ''}</td>`;
    ui.tbody?.appendChild(tr);
  }

  function updateStats(mode = 'beklemede', page = 0, maxPage = 0) {
    if (ui.stats) {
      ui.stats.textContent = `Satır: ${state.rows.length} • Atılan: ${state.dropped} • Filtre: ${state.scanFilter.status} • Sayfa: ${page}/${maxPage} • Durum: ${mode}`;
    }
    if (ui.empty) ui.empty.hidden = state.rows.length > 0;
  }

  function getFiltersFromUI() {
    return {
      status: ui.selStatus?.value || 'all',
      timeFilter: ui.selTimeFilter?.value || 'all',
      xDays: Math.max(1, Number(ui.inpXDays?.value || 30))
    };
  }

  async function startScan() {
    if (state.running) return;
    state.running = true;
    state.stop = false;
    state.scanFilter = getFiltersFromUI();

    try {
      const tabId = await getActiveTabId();
      const maxPage = Math.max(1, Number(ui.maxPage?.value || 1));

      for (let page = 1; page <= maxPage; page += 1) {
        if (state.stop) break;

        const target = buildOrdersUrl(page, state.scanFilter);
        await navigate(tabId, target);
        const rows = await extractRows(tabId);

        for (const row of rows) {
          if (state.stop) break;
          if (!matchesStatusFilter(row, state.scanFilter.status)) continue;

          const key = `${row.orderId}|${row.dateTime}|${row.orderLink}|${row.status}|${row.service}`;
          const h = await hashRow(key);
          if (state.hashes.has(h)) {
            state.dropped += 1;
            continue;
          }
          state.hashes.add(h);
          state.rows.push(row);
          appendRow(row);
        }

        updateStats(`p${page}/${maxPage}`, page, maxPage);
      }
    } finally {
      state.running = false;
      updateStats(state.stop ? 'durduruldu' : 'tamamlandı');
    }
  }

  function stopScan() { state.stop = true; }
  function clearTable() {
    state.rows = [];
    state.hashes.clear();
    state.dropped = 0;
    if (ui.tbody) ui.tbody.innerHTML = '';
    updateStats('temizlendi');
  }

  function bind() {
    ui.selStatus = byId('selSmmStatus');
    ui.maxPage = byId('inpSmmMaxPage');
    ui.selTimeFilter = byId('selSmmTimeFilter');
    ui.inpXDays = byId('inpSmmXDays');
    ui.tbody = byId('tblSmmBody');
    ui.stats = byId('smmStats');
    ui.empty = byId('smmEmpty');

    bindOnce(byId('btnSmmStart'), 'click', 'start', () => startScan().catch((e) => toast(String(e?.message || e))));
    bindOnce(byId('btnSmmStop'), 'click', 'stop', stopScan);
    bindOnce(byId('btnSmmClear'), 'click', 'clear', clearTable);
    updateStats();
  }

  const SMM = { init: bind, startScan, stopScan, clearTable, buildOrdersUrl };
  window.Patpat = window.Patpat || {};
  window.Patpat.SMM = SMM;
  if (document.body?.dataset?.page === 'sidepanel' || byId('btnSmmStart')) SMM.init();
})();
