(() => {
  if (typeof window === 'undefined') return;
  if (window.__SIPARIS_INIT__) return; // [KANIT@KOD: DURUM/STATE] __SIPARIS_INIT__ gate
  window.__SIPARIS_INIT__ = true;
  'use strict';

  const STATUSES = ['pending', 'processing', 'completed', 'cancelled', 'returnprocess'];
  const BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar'; // [KANIT@KOD: DIŞ BAĞIMLILIK]
  const BOUND_EVENTS = new Set();

  const state = {
    rows: [],
    hashes: new Set(),
    dropped: 0,
    stop: false,
    running: false,
    speed: 3,
    lastPageAdded: 0
  };

  const ui = {};

  function byId(id) { return document.getElementById(id); }
  function toast(msg) { window.__PatpatUI?.UI?.toast?.(msg) || alert(msg); }
  function log(level, msg) { window.__PatpatUI?.UI?.log?.(level, msg) || console[level === 'Hata' ? 'error' : 'log'](msg); }
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function normalizeSpace(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

  function normalizeStatus(s) {
    const t = normalizeSpace(s).toLowerCase();
    if (t.includes('teslimat bekleniyor')) return 'pending';
    if (t.includes('müşteriden onay bekleniyor')) return 'processing';
    if (t.includes('teslim edildi')) return 'completed';
    if (t.includes('iptal edildi')) return 'cancelled';
    if (t.includes('iade sürecinde')) return 'returnprocess';
    if (t.includes('sorun bildirildi')) return 'problem';
    return t;
  }

  // [KANIT@KOD: DÖNÜŞÜM] buildPageUrl
  function buildPageUrl(baseUrl, page, status = '') {
    const qp = [`page=${page}`];
    if (status) qp.push(`status=${encodeURIComponent(status)}`);
    return `${baseUrl}?${qp.join('&')}`;
  }

  // [KANIT@KOD: KOŞUL/FİLTRE] clamp 1..100
  function parseSpeed() {
    const raw = Number(ui.inpSpeed?.value ?? state.speed ?? 3);
    if (!Number.isFinite(raw)) throw new Error('Tarama hızı sayısal olmalıdır.');
    const clamped = Math.max(1, Math.min(100, raw));
    state.speed = clamped;
    if (ui.inpSpeed) ui.inpSpeed.value = String(clamped);
    return clamped;
  }

  // [KANIT@KOD: DÖNÜŞÜM] await sleep(speedDelayMs())
  function speedDelayMs() {
    const speed = Math.max(1, Math.min(100, Number(state.speed || 3)));
    return Math.max(40, Math.round(1800 / speed));
  }

  // [KANIT@KOD: KOŞUL/FİLTRE] maxPage>=1
  function parseMaxPage() {
    const raw = Number(ui.inpMaxPage?.value);
    if (!Number.isFinite(raw) || raw < 1) {
      throw new Error('Sayfa sayısı en az 1 olmalıdır.');
    }
    return Math.floor(raw);
  }

  function updateStats(extra = 'beklemede') {
    if (ui.stats) {
      ui.stats.textContent = `Toplam: ${state.rows.length} • Dedup atılan: ${state.dropped} • Sayfa-başı son eklenen: ${state.lastPageAdded} • Hız: ${state.speed}x • Durum: ${extra}`;
    }
    if (ui.empty) ui.empty.hidden = state.rows.length > 0;
  }

  async function hashRow(row) {
    const src = `${row.orderNo}|${row.smmId}|${row.dateTime}|${row.totalTl}|${row.status}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function appendRow(row) {
    if (!ui.tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.title}</td><td>${row.orderNo}</td><td>${row.smmId}</td><td>${row.dateTime}</td><td>${row.status}</td><td>${row.totalTl}</td><td>${row.username || ''}</td>`;
    ui.tbody.appendChild(tr);
  }

  async function getActiveTabId() {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tabs[0]?.id) throw new Error('Aktif sekme bulunamadı.');
    return tabs[0].id;
  }

  async function navigateWait(tabId, url) {
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
    await wait(speedDelayMs());
  }

  async function executeExtract(tabId) {
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
        const cards = Array.from(document.querySelectorAll('article, .card, [class*="order"], [class*="siparis"], .list-group-item'));

        for (const c of cards) {
          try {
            const text = clean(c.innerText);
            const title = clean((c.querySelector('h1,h2,h3,h4,strong,[class*="title"]') || c).textContent || '').split('Sipariş')[0].trim();
            const orderNo = (text.match(/(?:Sipari[sş])\s*#(\d+)/i) || [, ''])[1];
            const smmId = (text.match(/SMM ID:\s*(\d+)/i) || [, ''])[1];
            const dateTime = (text.match(/(\d{2}\.\d{2}\.\d{4}\s\d{2}:\d{2})/) || [, ''])[1];
            const statusRaw = (text.match(/\d{2}:\d{2}\s+([^\n]+?)\s+Toplam Tutar/i) || [, ''])[1];
            const totalTl = (text.match(/([\d.,]+)\s*TL/i) || [, ''])[1];
            const username = (text.match(/^([A-Za-z0-9_\.]{3,32})$/m) || [, ''])[1];
            if (orderNo || smmId) {
              rows.push({ title, orderNo, smmId, dateTime, statusRaw, totalTl, username, error: '' });
            }
          } catch (e) {
            rows.push({ title: '', orderNo: '', smmId: '', dateTime: '', statusRaw: '', totalTl: '', username: '', error: String(e?.message || e) });
          }
        }

        return { rows };
      }
    });
    return result || { rows: [] };
  }

  async function scanStatus(tabId, status, maxPage) {
    // [KANIT@KOD: DÖNGÜ/BİTİRME] 1..maxPage
    for (let page = 1; page <= maxPage; page++) {
      if (state.stop) {
        log('Bilgi', 'Tarama stop sinyali ile sonlandırıldı.');
        return;
      }

      const target = buildPageUrl(BASE_URL, page, status);
      updateStats(`${status || 'genel'} p${page}/${maxPage}`);
      state.lastPageAdded = 0;

      try {
        await navigateWait(tabId, target);
        let ext = await executeExtract(tabId);
        if (!ext.rows.length) {
          await chrome.tabs.reload(tabId);
          await wait(speedDelayMs());
          ext = await executeExtract(tabId);
        }

        for (const raw of ext.rows) {
          if (state.stop) return;
          try {
            const row = {
              title: normalizeSpace(raw.title),
              orderNo: raw.orderNo || '',
              smmId: raw.smmId || '',
              dateTime: raw.dateTime || '',
              status: normalizeStatus(raw.statusRaw || status || ''),
              totalTl: Number(String(raw.totalTl || '0').replace(/\./g, '').replace(',', '.')) || 0,
              username: raw.username || '',
              error: raw.error || ''
            };
            const h = await hashRow(row);
            if (state.hashes.has(h)) { state.dropped += 1; continue; }
            state.hashes.add(h);
            state.rows.push(row);
            state.lastPageAdded += 1;
            appendRow(row);
          } catch (e) {
            // [KANIT@KOD: HATA YAKALAMA/LOG] row parse -> continue
            log('Hata', `Satır parse hatası (page=${page}): ${String(e?.message || e)}`);
          }
        }
      } catch (e) {
        // [KANIT@KOD: HATA YAKALAMA/LOG] page fetch/parse -> continue
        log('Hata', `Sayfa hatası (page=${page}): ${String(e?.message || e)}`);
      }

      updateStats(`${status || 'genel'} p${page}/${maxPage}`);
      await wait(speedDelayMs());
    }
  }

  async function startScan({ status, maxPages }) {
    if (state.running) throw new Error('Tarama zaten çalışıyor.');

    state.stop = false;
    state.running = true; // [KANIT@KOD: DURUM/STATE] running toggles
    parseSpeed();
    const maxPage = Number(maxPages);
    if (!Number.isFinite(maxPage) || maxPage < 1) {
      state.running = false;
      throw new Error('Sayfa sayısı geçersiz.');
    }

    updateStats('başlatıldı');

    try {
      const tabId = await getActiveTabId();
      const statuses = status === 'all' ? STATUSES : [status];
      for (const st of statuses) {
        if (state.stop) break;
        await scanStatus(tabId, st, maxPage);
      }
      updateStats(state.stop ? 'durduruldu' : 'tamamlandı');
      toast(state.stop ? 'Sipariş taraması durduruldu.' : 'Sipariş taraması tamamlandı.');
    } finally {
      state.running = false;
    }
  }

  function stopScan() {
    state.stop = true; // [KANIT@KOD: HATA YAKALAMA/LOG] stop mid-loop
    log('Bilgi', 'Kullanıcı durdurma sinyali verdi.');
    updateStats('durduruluyor');
  }

  function clearTable() {
    if (!confirm('Sipariş tablosu ve state temizlensin mi?')) return;
    state.rows = [];
    state.hashes.clear();
    state.dropped = 0;
    state.lastPageAdded = 0;
    if (ui.tbody) ui.tbody.innerHTML = '';
    updateStats('temizlendi');
  }

  async function copyTableMarkdown() {
    const head = '| İlan Başlığı | Sipariş No | SMM ID | Tarih | Durum | Tutar (TL) | Kullanıcı |\n|---|---|---|---|---|---:|---|';
    const body = state.rows.map((r) => `| ${r.title} | ${r.orderNo} | ${r.smmId} | ${r.dateTime} | ${r.status} | ${r.totalTl} | ${r.username} |`).join('\n');
    try {
      await navigator.clipboard.writeText(`${head}\n${body}`);
      toast('Sipariş tablosu MD olarak kopyalandı.');
    } catch {
      toast('Panoya kopyalama başarısız.');
    }
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() { download(`siparis_${Date.now()}.json`, JSON.stringify(state.rows, null, 2), 'application/json'); }

  function exportCsv() {
    const cols = ['İlan Başlığı', 'Sipariş No', 'SMM ID', 'Tarih', 'Durum', 'Tutar (TL)', 'Kullanıcı'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(',')].concat(state.rows.map((r) => [r.title, r.orderNo, r.smmId, r.dateTime, r.status, r.totalTl, r.username].map(esc).join(',')));
    download(`siparis_${Date.now()}.csv`, '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function bindOnce(element, event, key, fn) {
    if (!element) return;
    const bindKey = `${key}:${event}`;
    if (BOUND_EVENTS.has(bindKey)) return;
    BOUND_EVENTS.add(bindKey);
    element.addEventListener(event, fn);
  }

  function bind() {
    ui.selStatus = byId('selSiparisStatus');
    ui.inpMaxPage = byId('inpSiparisMaxPage');
    ui.inpSpeed = byId('inpScanSpeed');
    ui.tbody = byId('tblSiparisBody');
    ui.stats = byId('siparisStats');
    ui.empty = byId('ordersEmpty');

    if (ui.inpSpeed && !ui.inpSpeed.value) ui.inpSpeed.value = '3';

    bindOnce(ui.inpSpeed, 'change', 'inpScanSpeed', () => {
      try {
        parseSpeed();
        updateStats('hız güncellendi');
      } catch (e) {
        toast(String(e?.message || e));
        if (ui.inpSpeed) ui.inpSpeed.value = '3';
        state.speed = 3;
      }
    });

    bindOnce(byId('btnSiparisStart'), 'click', 'btnSiparisStart', async () => {
      try {
        const status = ui.selStatus?.value || 'all';
        const maxPages = parseMaxPage();
        await startScan({ status, maxPages });
      } catch (e) {
        toast(`Sipariş tarama hatası: ${String(e?.message || e)}`);
      }
    });

    bindOnce(byId('btnSiparisStop'), 'click', 'btnSiparisStop', () => stopScan());
    bindOnce(byId('btnSiparisClear'), 'click', 'btnSiparisClear', () => clearTable());
    bindOnce(byId('btnSiparisCopyMd'), 'click', 'btnSiparisCopyMd', () => copyTableMarkdown());
    bindOnce(byId('btnSiparisExportJson'), 'click', 'btnSiparisExportJson', () => exportJson());
    bindOnce(byId('btnSiparisExportCsv'), 'click', 'btnSiparisExportCsv', () => exportCsv());

    updateStats();
  }

  const Siparis = { init: bind, startScan, stopScan, clearTable, copyTableMarkdown, exportJson, exportCsv, buildPageUrl, speedDelayMs, hashRow };
  window.Patpat = window.Patpat || {};
  window.Patpat.Siparis = Siparis;

  if (document.body?.dataset?.page === 'sidepanel' || byId('btnSiparisStart')) {
    Siparis.init();
  }
})();
