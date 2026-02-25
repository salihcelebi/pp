(() => {
  if (typeof window === 'undefined') return;
  if (window.__SMM_INIT__) return; // [KANIT@KOD: DURUM/STATE] __SMM_INIT__ gate
  window.__SMM_INIT__ = true;
  'use strict';

  // [KANIT@KOD: DIŞ BAĞIMLILIK] BASE_URL
  const BASE_URL = 'https://anabayiniz.com/orders';
  const STATUSES = ['pending', 'completed', 'inprogress', 'canceled'];
  const BOUND_EVENTS = new Set();

  const state = {
    rows: [],
    hashes: new Set(),
    dropped: 0,
    stop: false,
    running: false
  };

  const ui = {};

  const byId = (id) => document.getElementById(id);
  const toast = (m) => window.__PatpatUI?.UI?.toast?.(m) || alert(m);
  const log = (level, msg) => window.__PatpatUI?.UI?.log?.(level, msg) || console[level === 'Hata' ? 'error' : 'log'](msg);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function normalizeSpace(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

  // [KANIT@KOD: DÖNÜŞÜM] buildPageUrl
  function buildPageUrl(baseUrl, page) {
    return `${String(baseUrl || '').replace(/\?page=\d+$/i, '')}?page=${page}`;
  }

  // [KANIT@KOD: KOŞUL/FİLTRE] 1<=speed<=100 && isFinite
  function parseSpeedInput() {
    const raw = Number(ui.speed?.value ?? 3);
    if (!Number.isFinite(raw) || raw < 1 || raw > 100) {
      throw new Error('Tarama hızı 1-100 arasında sayı olmalıdır.');
    }
    return raw;
  }

  // [KANIT@KOD: DÖNÜŞÜM] speed->delay
  function speedDelayMs(speed) {
    const s = Math.max(1, Math.min(100, Number(speed || 3)));
    return Math.max(40, Math.round(1800 / s));
  }

  function updateStats(mode = 'beklemede') {
    if (ui.stats) {
      ui.stats.textContent = `Kayıt: ${state.rows.length} • Dedup: ${state.dropped} • Durum: ${mode}`;
    }
    if (ui.empty) ui.empty.hidden = state.rows.length > 0;
  }

  async function hashRow(r) {
    const src = `${r.orderId}|${r.dateTime}|${r.orderUrl}|${r.unitPrice}|${r.service}|${r.status}|${r.remains}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function appendRow(row) {
    if (!ui.tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.orderId}</td><td>${row.dateTime}</td><td>${row.orderUrl}</td><td>${row.unitPrice}</td><td>${row.service}</td><td>${row.status}</td><td>${row.remains}</td>`;
    ui.tbody.appendChild(tr);
    updateStats(state.running ? 'taranıyor' : 'hazır');
  }

  // [KANIT@KOD: KOŞUL/FİLTRE] listener not duplicated
  function bindOnce(element, eventName, key, handler) {
    if (!element) return;
    const guardKey = `${key}:${eventName}`;
    if (BOUND_EVENTS.has(guardKey)) return;
    BOUND_EVENTS.add(guardKey);
    element.addEventListener(eventName, handler);
  }

  // [KANIT@KOD: UI] container reset
  function renderSmmPanel() {
    const container = byId('smmPanel');
    if (!container) return;
    container.innerHTML = '';
    container.insertAdjacentHTML('beforeend', `
      <div class="card">
        <h3>SMM Yönetimi</h3>
        <div class="row">
          <select id="selSmmStatus">
            <option value="all">Tüm Durumlar</option>
            <option value="pending">pending</option>
            <option value="completed">completed</option>
            <option value="inprogress">inprogress</option>
            <option value="canceled">canceled</option>
          </select>
          <input id="inpSmmMaxPage" type="number" min="1" max="50" value="5" />
          <input id="inpScanSpeed" type="number" min="1" max="100" value="3" />
          <button id="btnSmmStart" type="button">SMM Taramayı Başlat</button>
          <button id="btnSmmStop" type="button">Durdur</button>
          <button id="btnSmmClear" type="button">Temizle</button>
        </div>
        <div id="smmStats">Kayıt: 0 • Dedup: 0 • Durum: beklemede</div>
      </div>
      <div class="card" style="margin-top:10px;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:900px;">
          <thead><tr><th>Sipariş ID</th><th>Tarih</th><th>Sipariş Link</th><th>Birim Fiyat</th><th>Servis</th><th>Durum</th><th>Kalan</th></tr></thead>
          <tbody id="tblSmmBody"></tbody>
        </table>
        <div id="smmEmpty">Henüz SMM verisi yok.</div>
      </div>
    `);
  }

  async function getActiveTabId() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) throw new Error('Aktif sekme bulunamadı.');
    return tab.id;
  }

  async function gotoAndWait(tabId, url, speed) {
    await chrome.tabs.update(tabId, { url });
    await new Promise((resolve) => {
      const listener = (id, info) => {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(true);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    await wait(speedDelayMs(speed));
  }

  async function extractFromCurrentPage(tabId) {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const step = Math.floor(window.innerHeight * 0.9);
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo({ top: y, behavior: 'auto' });
          await sleep(120);
        }

        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const rows = [];
        const trList = Array.from(document.querySelectorAll('table tbody tr'));
        for (const tr of trList) {
          try {
            const txt = clean(tr.innerText);
            if (!txt) continue;
            const orderId = (txt.match(/^([0-9]{7,12})$/m) || [, ''])[1];
            const dateTime = (txt.match(/(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/) || [, ''])[1];
            const orderUrl = tr.querySelector('a[href]')?.href || (txt.match(/https?:\/\/[^\s\]]+/) || [, ''])[1] || '';
            const unitPrice = Number((txt.match(/(\d+(?:\.\d+)?)/) || [, '0'])[1]);
            const service = (txt.match(/(\d+\s*[—-]\s*.*)/) || [, ''])[1];
            const status = (txt.match(/(Tamamlandı|İşlem Sırasında|Beklemede|İptal Edildi|Kısmi Tamamlandı|İade Edildi)/i) || [, ''])[1];
            const remains = Number((txt.match(/\b(\d+)\b\s*$/) || [, '0'])[1]);
            if (orderId || orderUrl) rows.push({ orderId, dateTime, orderUrl, unitPrice, service, status, remains, error: '' });
          } catch (e) {
            rows.push({ orderId: '', dateTime: '', orderUrl: '', unitPrice: 0, service: '', status: '', remains: 0, error: String(e?.message || e) });
          }
        }
        return { rows };
      }
    });
    return result || { rows: [] };
  }

  function passTimeFilter(dateTime) {
    const mode = ui.timeFilter?.value || 'all';
    if (mode === 'all') return true;
    const d = new Date(String(dateTime || '').replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return false;
    const now = Date.now();
    if (mode === '1d') return now - d.getTime() <= 24 * 3600 * 1000;
    if (mode === '7d') return now - d.getTime() <= 7 * 24 * 3600 * 1000;
    const x = Number(ui.xDays?.value || 30);
    return now - d.getTime() <= x * 24 * 3600 * 1000;
  }

  async function scanStatus(tabId, status, userMaxPage, speed) {
    const maxPage = Math.max(1, Number(userMaxPage || 1));

    // [KANIT@KOD: DÖNGÜ/BİTİRME] for 1..N
    for (let page = 1; page <= maxPage; page++) {
      if (state.stop) return;
      const statusBase = `${BASE_URL}/${status}`;
      const pageUrl = buildPageUrl(statusBase, page);
      updateStats(`${status} p${page}/${maxPage}`);

      try {
        await gotoAndWait(tabId, pageUrl, speed);
        let ext = await extractFromCurrentPage(tabId);
        if (!ext.rows.length) {
          await chrome.tabs.reload(tabId);
          await wait(speedDelayMs(speed));
          ext = await extractFromCurrentPage(tabId);
        }

        for (const r of ext.rows) {
          if (state.stop) return;
          if (!passTimeFilter(r.dateTime)) continue;
          const row = {
            orderId: normalizeSpace(r.orderId),
            dateTime: normalizeSpace(r.dateTime),
            orderUrl: normalizeSpace(r.orderUrl),
            unitPrice: Number(r.unitPrice || 0),
            service: normalizeSpace(r.service),
            status: normalizeSpace(r.status),
            remains: Number(r.remains || 0),
            error: r.error || ''
          };
          const hash = await hashRow(row);
          if (state.hashes.has(hash)) { state.dropped += 1; continue; }
          state.hashes.add(hash);
          state.rows.push(row);
          appendRow(row);
        }
      } catch (e) {
        // [KANIT@KOD: HATA YAKALAMA/LOG] LOG+SAFE+continue
        log('Hata', `SMM sayfa hatası status=${status} page=${page}: ${String(e?.message || e)}`);
      }

      updateStats(`${status} p${page}/${maxPage}`);
      await wait(speedDelayMs(speed));
    }
  }

  async function startScan({ status, maxPages }) {
    if (state.running) throw new Error('SMM taraması zaten çalışıyor.');

    const speed = parseSpeedInput();
    state.stop = false;
    state.running = true;
    updateStats('başlatıldı');

    const tabId = await getActiveTabId();
    const list = status === 'all' ? STATUSES : [status];

    for (const st of list) {
      if (state.stop) break;
      await scanStatus(tabId, st, maxPages || 1, speed);
    }

    state.running = false;
    updateStats(state.stop ? 'durduruldu' : 'tamamlandı');
    toast(state.stop ? 'SMM taraması durduruldu.' : 'SMM taraması tamamlandı.');
  }

  function stopScan() { state.stop = true; }

  function clearTable() {
    if (!confirm('SMM tablo ve state temizlensin mi?')) return;
    state.rows = [];
    state.hashes.clear();
    state.dropped = 0;
    if (ui.tbody) ui.tbody.innerHTML = '';
    updateStats('temizlendi');
  }

  async function copyTableMarkdown() {
    const head = '| Sipariş ID | Tarih | Sipariş Link | Birim Fiyat | Servis | Durum | Kalan |\n|---|---|---|---:|---|---|---:|';
    const body = state.rows.map((r) => `| ${r.orderId} | ${r.dateTime} | ${r.orderUrl} | ${r.unitPrice} | ${r.service} | ${r.status} | ${r.remains} |`).join('\n');
    try {
      await navigator.clipboard.writeText(`${head}\n${body}`);
      toast('SMM tablosu MD kopyalandı.');
    } catch {
      toast('Panoya kopyalama başarısız.');
    }
  }

  function dl(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() { dl(`smm_${Date.now()}.json`, JSON.stringify(state.rows, null, 2), 'application/json'); }

  function exportCsv() {
    const cols = ['Sipariş ID', 'Tarih', 'Sipariş Link', 'Birim Fiyat', 'Servis', 'Durum', 'Kalan'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(',')].concat(state.rows.map((r) => [r.orderId, r.dateTime, r.orderUrl, r.unitPrice, r.service, r.status, r.remains].map(esc).join(',')));
    dl(`smm_${Date.now()}.csv`, '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function bind() {
    // standalone smm.html render
    if (byId('smmPanel')) renderSmmPanel();

    ui.selStatus = byId('selSmmStatus');
    ui.maxPage = byId('inpSmmMaxPage');
    ui.timeFilter = byId('selSmmTimeFilter');
    ui.xDays = byId('inpSmmXDays');
    ui.speed = byId('inpScanSpeed');
    ui.tbody = byId('tblSmmBody');
    ui.stats = byId('smmStats');
    ui.empty = byId('smmEmpty');

    bindOnce(byId('btnSmmStart'), 'click', 'btnSmmStart', async () => {
      try {
        await startScan({ status: ui.selStatus?.value || 'all', maxPages: Number(ui.maxPage?.value || 5) });
      } catch (e) {
        toast(`SMM tarama hatası: ${String(e?.message || e)}`);
      }
    });
    bindOnce(byId('btnSmmStop'), 'click', 'btnSmmStop', () => stopScan());
    bindOnce(byId('btnSmmClear'), 'click', 'btnSmmClear', () => clearTable());
    bindOnce(byId('btnSmmCopyMd'), 'click', 'btnSmmCopyMd', () => copyTableMarkdown());
    bindOnce(byId('btnSmmExportJson'), 'click', 'btnSmmExportJson', () => exportJson());
    bindOnce(byId('btnSmmExportCsv'), 'click', 'btnSmmExportCsv', () => exportCsv());

    bindOnce(ui.speed, 'change', 'inpScanSpeed', () => {
      try {
        parseSpeedInput();
        updateStats('hız güncellendi');
      } catch (e) {
        toast(String(e?.message || e));
        if (ui.speed) ui.speed.value = '3';
      }
    });

    updateStats();
  }

  const SMM = { init: bind, startScan, stopScan, clearTable, copyTableMarkdown, exportJson, exportCsv, buildPageUrl, speedDelayMs, hashRow };
  window.Patpat = window.Patpat || {};
  window.Patpat.SMM = SMM;

  if (document.body?.dataset?.page === 'sidepanel' || byId('smmPanel')) {
    SMM.init();
  }
})();
