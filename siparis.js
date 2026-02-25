(() => {
  if (typeof window === 'undefined' || document.body?.dataset?.page !== 'sidepanel') return;
  'use strict';

  const STATUSES = ['pending', 'processing', 'completed', 'cancelled', 'returnprocess'];
  const BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar';

  const state = {
    rows: [],
    hashes: new Set(),
    dropped: 0,
    stop: false,
    running: false,
    speed: 3
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

  // [KANIT@KOD: KOŞUL/FİLTRE] 1<=speed<=100 && isNumber
  function getSpeedFactor() {
    const raw = Number(ui.inpSpeed?.value ?? state.speed);
    if (!Number.isFinite(raw) || raw < 1 || raw > 100) {
      throw new Error('Tarama hızı 1-100 arasında sayısal olmalıdır.');
    }
    state.speed = raw;
    return raw;
  }

  // [KANIT@KOD: DÖNÜŞÜM] speed_factor_to_delay
  function speedDelayMs() {
    const factor = Math.max(1, Math.min(100, Number(state.speed || 3)));
    const delay = Math.round(1800 / factor);
    return Math.max(40, delay);
  }

  function updateStats(extra = 'beklemede') {
    if (ui.stats) ui.stats.textContent = `Satır: ${state.rows.length} • Atılan: ${state.dropped} • Hız: ${state.speed}x • Durum: ${extra}`;
    if (ui.empty) ui.empty.hidden = state.rows.length > 0;
  }

  async function hashRow(r) {
    const src = `${r.orderNo}|${r.smmId}|${r.dateTime}|${r.totalTl}|${r.status}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function appendRow(row) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.title}</td><td>${row.orderNo}</td><td>${row.smmId}</td><td>${row.dateTime}</td><td>${row.status}</td><td>${row.totalTl}</td><td>${row.username || ''}</td>`;
    ui.tbody.appendChild(tr);
    updateStats(state.running ? 'taranıyor' : 'tamamlandı');
  }

  // [KANIT@KOD: DÖNÜŞÜM] url_build_page
  function buildPageUrl(status, page) {
    const qs = [`page=${page}`];
    if (status) qs.push(`status=${encodeURIComponent(status)}`);
    return `${BASE_URL}?${qs.join('&')}`;
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
        let y = 0;
        while (y < document.body.scrollHeight) {
          window.scrollTo({ top: y, behavior: 'auto' });
          y += step;
          await sleep(140);
        }

        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const rows = [];
        const cards = Array.from(document.querySelectorAll('article, .card, [class*="order"], [class*="siparis"], .list-group-item')).filter((n) => clean(n.innerText).includes('Sipariş'));

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
            if (orderNo || smmId) rows.push({ title, orderNo, smmId, dateTime, statusRaw, totalTl, username, error: '' });
          } catch (e) {
            rows.push({ title: '', orderNo: '', smmId: '', dateTime: '', statusRaw: '', totalTl: '', username: '', error: String(e?.message || e) });
          }
        }

        return { rows, pageText: String(document.body.innerText || '') };
      }
    });
    return result || { rows: [], pageText: '' };
  }

  async function scanStatus(tabId, status, pageLimitInput) {
    const pageLimit = Math.max(1, Number(pageLimitInput || 1));

    // [KANIT@KOD: DÖNGÜ/BİTİRME] for page=1..K
    for (let p = 1; p <= pageLimit; p++) {
      if (state.stop) return;
      const url = buildPageUrl(status, p);
      updateStats(`${status || 'genel'} p${p}/${pageLimit}`);

      try {
        await navigateWait(tabId, url);
        let ext = await executeExtract(tabId);

        if (!ext.rows.length) {
          await chrome.tabs.reload(tabId);
          await wait(speedDelayMs());
          ext = await executeExtract(tabId);
        }

        if (!ext.rows.length) {
          log('Hata', `[KANIT@KOD: HATA YAKALAMA/LOG] Sayfa ${p} veri alınamadı, sonraki sayfaya geçiliyor.`);
          continue;
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
            appendRow(row);
          } catch (e) {
            log('Hata', `Satır parse hatası: ${String(e?.message || e)}`);
          }
        }
      } catch (e) {
        // [KANIT@KOD: HATA YAKALAMA/LOG] LOG+SAFE+continue
        log('Hata', `Sayfa tarama hatası p${p}: ${String(e?.message || e)}`);
      }

      await wait(speedDelayMs());
    }
  }

  async function startScan({ status, maxPages }) {
    if (state.running) throw new Error('Tarama zaten çalışıyor.');
    state.stop = false;
    state.running = true;
    getSpeedFactor();
    updateStats('başlatıldı');

    const tabId = await getActiveTabId();
    const statuses = status === 'all' ? STATUSES : [status];
    for (const st of statuses) {
      if (state.stop) break;
      await scanStatus(tabId, st, maxPages || 1);
    }

    state.running = false;
    updateStats(state.stop ? 'durduruldu' : 'tamamlandı');
    toast(state.stop ? 'Sipariş taraması durduruldu.' : 'Sipariş taraması tamamlandı.');
  }

  function stopScan() { state.stop = true; }
  function clearTable() {
    if (!confirm('Sipariş tablosu ve state temizlensin mi?')) return;
    state.rows = [];
    state.hashes.clear();
    state.dropped = 0;
    ui.tbody.innerHTML = '';
    updateStats('temizlendi');
  }

  async function copyTableMarkdown() {
    const head = '| İlan Başlığı | Sipariş No | SMM ID | Tarih | Durum | Tutar (TL) | Kullanıcı |\n|---|---|---|---|---|---:|---|';
    const body = state.rows.map((r) => `| ${r.title} | ${r.orderNo} | ${r.smmId} | ${r.dateTime} | ${r.status} | ${r.totalTl} | ${r.username} |`).join('\n');
    try { await navigator.clipboard.writeText(`${head}\n${body}`); toast('Sipariş tablosu MD olarak kopyalandı.'); }
    catch { toast('Panoya kopyalama başarısız.'); }
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() { download(`siparis_${Date.now()}.json`, JSON.stringify(state.rows, null, 2), 'application/json'); }

  function exportCsv() {
    const cols = ['İlan Başlığı', 'Sipariş No', 'SMM ID', 'Tarih', 'Durum', 'Tutar (TL)', 'Kullanıcı'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(',')].concat(state.rows.map((r) => [r.title, r.orderNo, r.smmId, r.dateTime, r.status, r.totalTl, r.username].map(esc).join(',')));
    download(`siparis_${Date.now()}.csv`, '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function bind() {
    ui.selStatus = byId('selSiparisStatus');
    ui.inpMaxPage = byId('inpSiparisMaxPage');
    ui.inpSpeed = byId('inpScanSpeed');
    ui.tbody = byId('tblSiparisBody');
    ui.stats = byId('siparisStats');
    ui.empty = byId('ordersEmpty');

    if (ui.inpSpeed) {
      ui.inpSpeed.value = String(state.speed);
      ui.inpSpeed.addEventListener('change', () => {
        try {
          getSpeedFactor();
          updateStats('hız güncellendi');
        } catch (e) {
          toast(String(e.message || e));
          ui.inpSpeed.value = '3';
          state.speed = 3;
          updateStats('hız varsayılanlandı');
        }
      });
    }

    byId('btnSiparisStart')?.addEventListener('click', async () => {
      try {
        const status = ui.selStatus?.value || 'all';
        const maxPages = Number(ui.inpMaxPage?.value || 1);
        await startScan({ status, maxPages });
      } catch (e) {
        toast(`Sipariş tarama hatası: ${String(e?.message || e)}`);
      }
    });
    byId('btnSiparisStop')?.addEventListener('click', () => stopScan());
    byId('btnSiparisClear')?.addEventListener('click', () => clearTable());
    byId('btnSiparisCopyMd')?.addEventListener('click', () => copyTableMarkdown());
    byId('btnSiparisExportJson')?.addEventListener('click', () => exportJson());
    byId('btnSiparisExportCsv')?.addEventListener('click', () => exportCsv());
    updateStats();
  }

  const Siparis = { init: bind, startScan, stopScan, clearTable, copyTableMarkdown, exportJson, exportCsv };

  window.Patpat = window.Patpat || {};
  window.Patpat.Siparis = Siparis;
  Siparis.init();
})();
