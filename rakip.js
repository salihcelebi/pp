(() => {
  if (typeof window === 'undefined') return;
  if (window.__RAKIP_INIT__) return; // [KANIT@KOD: DURUM/STATE] __RAKIP_INIT__ gate
  window.__RAKIP_INIT__ = true;
  'use strict';

  const BASE_URL = 'https://hesap.com.tr/p'; // [KANIT@KOD: DIŞ BAĞIMLILIK]
  const BOUND_EVENTS = new Set();

  const PLATFORM_SERVICE_MAP = Object.freeze({
    tiktok: ['hesap', 'takipci', 'begeni', 'izlenme', 'yorum'],
    instagram: ['hesap', 'takipci', 'begeni', 'izlenme', 'yorum'],
    youtube: ['hesap', 'takipci', 'begeni', 'izlenme', 'yorum'],
    twitter: ['hesap', 'takipci', 'begeni', 'izlenme', 'yorum']
  });

  const state = {
    rows: [],
    hashes: new Set(),
    dropped: 0,
    shouldStop: false,
    running: false,
    pageCounts: {}
  };

  const ui = {};

  const byId = (id) => document.getElementById(id);
  const toast = (m) => window.__PatpatUI?.UI?.toast?.(m) || alert(m);
  const log = (level, msg) => window.__PatpatUI?.UI?.log?.(level, msg) || console[level === 'Hata' ? 'error' : 'log'](msg);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  function bindOnce(el, event, key, fn) {
    if (!el) return;
    const token = `${key}:${event}`;
    if (BOUND_EVENTS.has(token)) return;
    BOUND_EVENTS.add(token);
    el.addEventListener(event, fn);
  }

  function renderServiceOptions() {
    if (!ui.selService || !ui.selPlatform) return;
    const p = ui.selPlatform.value;
    const list = p === 'hepsi'
      ? ['hepsi', ...new Set(Object.values(PLATFORM_SERVICE_MAP).flat())]
      : (PLATFORM_SERVICE_MAP[p] || []);
    const options = (p ? list : []).length ? list : [];
    if (!options.length) {
      ui.selService.innerHTML = '<option value="">Önce platform seç</option>';
      ui.selService.disabled = true;
      return;
    }
    ui.selService.disabled = false;
    ui.selService.innerHTML = options.map((x) => `<option value="${x}">${x}</option>`).join('');
  }

  function parseNumericOptional(v, label) {
    const s = String(v || '').trim();
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) throw new Error(`${label} sayısal olmalıdır.`);
    return n;
  }

  function parseSpeed() {
    const raw = Number(ui.inpSpeed?.value || 3);
    if (!Number.isFinite(raw)) throw new Error('Tarama hızı sayısal olmalıdır.');
    const c = Math.max(1, Math.min(100, raw));
    if (ui.inpSpeed) ui.inpSpeed.value = String(c);
    return c;
  }

  function speedDelayMs(speed) {
    const s = Math.max(1, Math.min(100, Number(speed || 3)));
    return Math.max(30, Math.round(1600 / s));
  }

  // [KANIT@KOD: DÖNÜŞÜM] buildPageUrl
  function buildPageUrl(baseUrl, page) {
    return `${baseUrl}?page=${page}`;
  }

  function updateStatus(statusText) {
    if (ui.statusLine) ui.statusLine.textContent = `Durum: ${statusText}`;
  }

  function updateStats() {
    const pages = Object.keys(state.pageCounts).sort((a, b) => Number(a) - Number(b)).map((k) => `p${k}:${state.pageCounts[k]}`).join(' | ');
    if (ui.stats) ui.stats.textContent = `Toplam bulunan: ${state.rows.length} • Dedup atılan: ${state.dropped} • Sayfa başına: ${pages || '—'}`;
    if (ui.empty) ui.empty.hidden = state.rows.length > 0;
  }

  async function hashRow(row) {
    const src = `${row.platform}|${row.ilanBasligi}|${row.hizmet}|${row.magaza}|${row.garanti}|${row.fiyat}|${row.reklam}`;
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function appendRow(row) {
    if (!ui.tblBody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.platform || ''}</td><td>${row.ilanBasligi || ''}</td><td>${row.hizmet || ''}</td><td>${row.magaza || ''}</td><td>${row.garanti || ''}</td><td>${row.fiyat ?? ''}</td><td>${row.reklam || ''}</td>`;
    ui.tblBody.appendChild(tr);
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

  async function extractPage(tabId, platformHint, serviceHint) {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [platformHint, serviceHint],
      func: async (platform, service) => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const rows = [];

        // [KANIT@KOD: DÖNGÜ/BİTİRME] scroll+rescan N
        const step = Math.floor(window.innerHeight * 0.9);
        for (let round = 0; round < 3; round++) {
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo({ top: y, behavior: 'auto' });
            await sleep(140);
          }
          await sleep(220);
        }

        const cards = Array.from(document.querySelectorAll('article, .card, .list-group-item, [class*="ilan"], [class*="listing"]'));
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i];
          try {
            const txt = String(c.innerText || '').trim();
            if (!txt) continue;
            const firstLine = clean(txt.split('\n')[0] || '') || null;
            const serviceHit = (txt.match(/(Takipçi|İzlenme|Beğeni|Yorum|Kaydet|Paylaş|Hesap)/i) || [, ''])[1] || null;
            const shopHit = (txt.match(/Mağaza\s*:?\s*([^\n]+)/i) || [, ''])[1] || null;
            const warrantyHit = (txt.match(/Garanti\s*:?\s*([^\n]+)/i) || [, ''])[1] || null;
            const priceHit = (txt.match(/([\d.,]+)\s*TL/i) || [, ''])[1] || null;
            const adHit = (txt.match(/(ÇOK SATAN|%\s*\d{1,3})/i) || [, ''])[1] || null;

            rows.push({
              platform: platform || null,
              ilanBasligi: firstLine,
              hizmet: serviceHit || service || null,
              magaza: clean(shopHit),
              garanti: clean(warrantyHit),
              fiyat: priceHit ? Number(String(priceHit).replace(/\./g, '').replace(',', '.')) : null,
              reklam: clean(adHit),
              _index: i
            });
          } catch (e) {
            rows.push({ _error: String(e?.message || e), _index: i, platform: platform || null, ilanBasligi: null, hizmet: service || null, magaza: null, garanti: null, fiyat: null, reklam: null });
          }
        }

        return {
          rows,
          itemCount: rows.length,
          snippet: String(document.documentElement?.outerHTML || '').slice(0, 2048)
        };
      }
    });
    return result || { rows: [], itemCount: 0, snippet: '' };
  }

  function selectedCombos() {
    const p = ui.selPlatform?.value || '';
    const s = ui.selService?.value || '';

    if (!p) throw new Error('Önce platform seçmelisin.');

    const platforms = p === 'hepsi' ? Object.keys(PLATFORM_SERVICE_MAP) : [p];
    const out = [];
    for (const pl of platforms) {
      const services = PLATFORM_SERVICE_MAP[pl] || [];
      if (s && s !== 'hepsi') {
        out.push({ platform: pl, hizmet: s });
      } else {
        for (const sv of services) out.push({ platform: pl, hizmet: sv });
      }
    }
    return out;
  }

  function validateFilters() {
    const min = parseNumericOptional(ui.inpQtyMin?.value, 'Min adet');
    const max = parseNumericOptional(ui.inpQtyMax?.value, 'Max adet');
    if (min != null && max != null && min > max) {
      throw new Error('Min adet, Max adetten büyük olamaz.');
    }
    const maxPage = Number(ui.inpPage?.value || 1);
    if (!Number.isFinite(maxPage) || maxPage < 1) throw new Error('Sayfa sayısı en az 1 olmalıdır.');
    return { min, max, maxPage: Math.floor(maxPage) };
  }

  function applyQtyFilter(row, min, max) {
    const num = Number(row.ilanBasligi?.match(/\b(\d{1,6})\b/)?.[1] || NaN);
    if (min != null && Number.isFinite(num) && num < min) return false;
    if (max != null && Number.isFinite(num) && num > max) return false;
    return true;
  }

  function setUiRunning(running) {
    state.running = running;
    if (ui.btnStart) ui.btnStart.disabled = running;
    if (ui.btnStop) ui.btnStop.disabled = !running;
    updateStatus(running ? 'çalışıyor' : (state.shouldStop ? 'durdu' : 'hazır'));
  }

  async function startScan() {
    if (state.running) return toast('Rakip tarama zaten çalışıyor.');

    const { min, max, maxPage } = validateFilters();
    const speed = parseSpeed();
    const combos = selectedCombos();

    state.shouldStop = false;
    setUiRunning(true);

    const tabId = await getActiveTabId();
    state.pageCounts = {};

    try {
      for (const combo of combos) {
        if (state.shouldStop) break;

        for (let page = 1; page <= maxPage; page++) {
          if (state.shouldStop) break; // [KANIT@KOD: KOŞUL/FİLTRE]

          const listingBase = `${BASE_URL}/${combo.platform}/${combo.hizmet}`;
          const pageUrl = buildPageUrl(listingBase, page);

          try {
            await gotoAndWait(tabId, pageUrl, speed);
            const ext = await extractPage(tabId, combo.platform, combo.hizmet);
            state.pageCounts[page] = (state.pageCounts[page] || 0) + Number(ext.itemCount || 0);

            if (Number(ext.itemCount || 0) < 40) {
              log('Uyarı', `selector/parse bozuldu olabilir page=${page} url=${pageUrl} count=${ext.itemCount}`);
              log('Uyarı', `HTML snippet(2KB): ${ext.snippet || ''}`);
              toast('Sayfada ilan sayısı düşük görünüyor. Selector/DOM drift olabilir.');
            }

            if (!ext.rows.length) {
              log('Uyarı', `Site DOM değişti olabilir. url=${pageUrl}`);
              log('Uyarı', `HTML snippet(2KB): ${ext.snippet || ''}`);
            }

            for (let i = 0; i < ext.rows.length; i++) {
              if (state.shouldStop) break;
              const raw = ext.rows[i];
              try {
                if (raw._error) throw new Error(raw._error);

                const row = {
                  platform: raw.platform ?? null,
                  ilanBasligi: nSpace(raw.ilanBasligi) || null,
                  hizmet: nSpace(raw.hizmet) || null,
                  magaza: nSpace(raw.magaza) || null,
                  garanti: nSpace(raw.garanti) || null,
                  fiyat: Number.isFinite(raw.fiyat) ? raw.fiyat : null,
                  reklam: nSpace(raw.reklam) || null
                };

                if (!applyQtyFilter(row, min, max)) continue;

                const h = await hashRow(row);
                if (state.hashes.has(h)) { state.dropped += 1; continue; }
                state.hashes.add(h);
                state.rows.push(row);
                appendRow(row);
              } catch (e) {
                log('Hata', `İlan parse hatası page=${page} idx=${i} selector=listing-card: ${String(e?.message || e)}`);
              }
            }
          } catch (e) {
            log('Hata', `Sayfa fetch/parse hatası url=${pageUrl}: ${String(e?.message || e)}`);
          }

          updateStats();
          await wait(speedDelayMs(speed));
        }
      }
    } finally {
      setUiRunning(false);
      updateStats();
    }
  }

  function stopScan() {
    state.shouldStop = true;
    updateStatus('durduruluyor');
  }

  function clearTable() {
    if (!confirm('Rakip tablo ve sayaçlar temizlensin mi?')) return;
    state.rows = [];
    state.hashes.clear();
    state.dropped = 0;
    state.pageCounts = {};
    if (ui.tblBody) ui.tblBody.innerHTML = '';
    updateStats();
    updateStatus('hazır');
  }

  async function copyTableMarkdown() {
    const head = '| Platform | İlan Başlığı | Hizmet | Mağaza | Garanti | Fiyat | Reklam |\n|---|---|---|---|---|---:|---|';
    const body = state.rows.map((r) => `| ${r.platform ?? ''} | ${r.ilanBasligi ?? ''} | ${r.hizmet ?? ''} | ${r.magaza ?? ''} | ${r.garanti ?? ''} | ${r.fiyat ?? ''} | ${r.reklam ?? ''} |`).join('\n');
    try { await navigator.clipboard.writeText(`${head}\n${body}`); toast('Markdown kopyalandı.'); }
    catch { toast('Panoya kopyalama başarısız.'); }
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

  function exportJson() { dl(`rakip_${Date.now()}.json`, JSON.stringify(state.rows, null, 2), 'application/json'); }

  function exportCsv() {
    const cols = ['platform', 'ilanBasligi', 'hizmet', 'magaza', 'garanti', 'fiyat', 'reklam'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.join(',')].concat(state.rows.map((r) => cols.map((k) => esc(r[k])).join(',')));
    dl(`rakip_${Date.now()}.csv`, '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function validateRegexInput() {
    const txt = String(ui.regexInput?.value || '').trim();
    if (!txt) return null;
    try {
      return new RegExp(txt, 'i');
    } catch (e) {
      if (ui.regexPreview) ui.regexPreview.textContent = `Regex hatası: ${String(e?.message || e)}`;
      throw new Error('Geçersiz regex.');
    }
  }

  function testRegex() {
    try {
      const rx = validateRegexInput();
      if (!rx) {
        if (ui.regexPreview) ui.regexPreview.textContent = 'Regex boş. Önizleme yapılmadı.';
        return;
      }
      const sample = state.rows[0]?.ilanBasligi || 'örnek metin';
      const ok = rx.test(sample);
      if (ui.regexPreview) ui.regexPreview.textContent = `Regex test: ${ok ? 'eşleşti' : 'eşleşmedi'} (${sample})`;
    } catch (e) {
      toast(String(e?.message || e));
    }
  }

  function toggleFullscreen() {
    const root = byId('rakipRoot') || document.body;
    root.classList.toggle('rakip-fullscreen'); // [KANIT@KOD: UI] class toggle only
  }

  function bind() {
    ui.selPlatform = byId('selPlatform');
    ui.selService = byId('selService');
    ui.inpQtyMin = byId('inpQtyMin');
    ui.inpQtyMax = byId('inpQtyMax');
    ui.inpPage = byId('inpRakipPageCount');
    ui.inpSpeed = byId('inpScanSpeed');
    ui.tblBody = byId('tblRakipBody');
    ui.stats = byId('rakipStats');
    ui.empty = byId('marketEmpty');
    ui.statusLine = byId('rakipStatusLine');
    ui.btnStart = byId('btnRakipStart');
    ui.btnStop = byId('btnRakipStop');
    ui.regexInput = byId('inpRakipRegex');
    ui.regexPreview = byId('rakipRegexPreview');

    if (byId('rakipTestPreviewWrap')) byId('rakipTestPreviewWrap').textContent = '';

    bindOnce(ui.selPlatform, 'change', 'selPlatform', renderServiceOptions);
    bindOnce(ui.btnStart, 'click', 'btnRakipStart', () => startScan().catch((e) => toast(String(e?.message || e))));
    bindOnce(ui.btnStop, 'click', 'btnRakipStop', stopScan);
    bindOnce(byId('btnRakipClear'), 'click', 'btnRakipClear', clearTable);
    bindOnce(byId('btnRakipCopyMd'), 'click', 'btnRakipCopyMd', () => copyTableMarkdown());
    bindOnce(byId('btnRakipExportJson'), 'click', 'btnRakipExportJson', exportJson);
    bindOnce(byId('btnRakipExportCsv'), 'click', 'btnRakipExportCsv', exportCsv);
    bindOnce(byId('btnRakipRegexTest'), 'click', 'btnRakipRegexTest', testRegex);
    bindOnce(byId('btnRakipRegexPanel'), 'click', 'btnRakipRegexPanel', testRegex);
    bindOnce(byId('btnRakipFullscreen'), 'click', 'btnRakipFullscreen', toggleFullscreen);

    if (ui.inpSpeed && !ui.inpSpeed.value) ui.inpSpeed.value = '3';
    renderServiceOptions();
    updateStats();
    updateStatus('hazır');
    setUiRunning(false);
  }

  const Rakip = {
    init: bind,
    startScan,
    stopScan,
    clearTable,
    copyTableMarkdown,
    exportJson,
    exportCsv,
    buildPageUrl,
    speedDelayMs,
    hashRow
  };

  window.Patpat = window.Patpat || {};
  window.Patpat.Rakip = Rakip;

  if (document.body?.dataset?.page === 'sidepanel' || byId('btnRakipStart')) {
    Rakip.init();
  }
})();
