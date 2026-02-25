(() => {
  if (typeof window === 'undefined') return;
  if (window.__SIKAYET_INIT__) return; // [KANIT@KOD: DURUM/STATE] __SIKAYET_INIT__ gate
  window.__SIKAYET_INIT__ = true;
  'use strict';

  const STORAGE_KEY = 'patpat_complaints_v3';
  const BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar'; // [KANIT@KOD: DIŞ BAĞIMLILIK]
  const BOUND_EVENTS = new Set();
  const KEY = 'patpat_complaints_v2';
  const BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar';

  // [KANIT@KOD: DÖNÜŞÜM] En az 5 regex aktif kullanım
  const RX = Object.freeze({
    SERVICE: /^(.+?)\n(?=SİPARİŞ\s*#)/m,
    ORDER: /SİPARİŞ\s*#(\d+)/i,
    SMM: /SMM\s*ID:\s*(\d+)/i,
    DATE: /(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/,
    STATUS: /(SORUN\s+BİLDİRİLDİ)/i,
    REMAIN: /SORUN\s+BİLDİRİLDİ\s*\(([^)]+)\)/i,
    AMOUNT: /TOPLAM\s+TUTAR\s*\n\s*([\d.,]+\s*TL)/i,
    DATE_ONLY: /^\d{2}\.\d{2}\.\d{4}$/
  });

  const ui = {};
  const state = { rows: [], running: false, shouldStop: false, selectedId: '' };
    REGEX_1_SERVICE: /^(.+?)\n(?=SİPARİŞ\s*#)/m,
    REGEX_2_ORDER: /SİPARİŞ\s*#(\d+)/i,
    REGEX_3_SMM: /SMM\s*ID:\s*(\d+)/i,
    REGEX_4_DATE: /(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/,
    REGEX_5_STATUS: /(SORUN\s+BİLDİRİLDİ)/i,
    REGEX_6_REMAINING: /SORUN\s+BİLDİRİLDİ\s*\(([^)]+)\)/i,
    REGEX_7_AMOUNT: /TOPLAM\s+TUTAR\s*\n\s*([\d.,]+\s*TL)/i,
    HOURS_MINUTES: /(\d{1,2})\s*(?:saat|sa)\s*(\d{1,2})\s*(?:dk|dakika)/i
  });

  const ui = {};
  const state = { rows: [], stop: false, running: false, fullOnly: false };

  const byId = (id) => document.getElementById(id);
  const toast = (m) => window.__PatpatUI?.UI?.toast?.(m) || alert(m);
  const log = (m) => window.__PatpatUI?.UI?.log?.('Bilgi', m) || console.log(m);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const nText = (v) => String(v || '').replace(/\s+/g, ' ').trim();

  async function getLocal(key) { const x = await chrome.storage.local.get(key); return x[key]; }
  async function setLocal(key, val) { await chrome.storage.local.set({ [key]: val }); }

  function bindOnce(el, event, key, fn) {
    if (!el) return;
    const token = `${key}:${event}`;
    if (BOUND_EVENTS.has(token)) return;
    BOUND_EVENTS.add(token);
    el.addEventListener(event, fn);
  }

  function todayTrDate() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }

  function toIsoFromTrDateTime(dt) {
    const m = String(dt || '').match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`;
  }

  function buildPageUrl(baseUrl, page) {
    return `${baseUrl}?page=${page}`;
  }

  function normalizeSlaDate(baseDateText, remainingText) {
    const base = String(baseDateText || '').match(RX.DATE_ONLY) ? baseDateText : todayTrDate();
    const [dd, mm, yyyy] = base.split('.').map(Number);
    const ref = new Date(yyyy, (mm || 1) - 1, dd || 1);
    const txt = String(remainingText || '').toLowerCase();

    if (!txt) return '';
    if (txt.includes('yarın')) {
      const d = new Date(ref.getTime() + 24 * 3600 * 1000);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }
    const dm = txt.match(/(\d+)\s*gün/);
    if (dm) {
      const d = new Date(ref.getTime() + Number(dm[1]) * 24 * 3600 * 1000);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }
    const explicit = txt.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (explicit) return explicit[1];
    return 'SLA tarihi çözümlenemedi';
  }

  function parseAmountTl(text) {
    const raw = (String(text || '').match(RX.AMOUNT) || [, ''])[1] || '';
    const value = Number(raw.replace(/\./g, '').replace(',', '.').replace(/\s*TL/i, '')) || 0;
    return { amountText: raw, amountValue: value };
  }

  function parseComplaintBlock(blockText, idx, fallbackDate) {
    const block = String(blockText || '').trim();
    if (!block) return null;
    if (!block.toUpperCase().includes('SORUN')) return null; // [KANIT@KOD: KOŞUL/FİLTRE]

    const service = clean((block.match(RX.SERVICE) || [, ''])[1]);
    const orderNo = (block.match(RX.ORDER) || [, ''])[1] || '';
    const smmId = (block.match(RX.SMM) || [, ''])[1] || '';
    const dateText = (block.match(RX.DATE) || [, ''])[1] || `${fallbackDate} 00:00`;
    const status = (block.match(RX.STATUS) || [, ''])[1] || '';
    const remainingText = (block.match(RX.REMAIN) || [, ''])[1] || '';
    const amount = parseAmountTl(block);

    if (!status) return null;

    return {
      id: `${orderNo || smmId || 'x'}-${idx}`,
      service,
      orderNo,
      smmId,
      dateText,
      dateIso: toIsoFromTrDateTime(dateText),
      status,
      remainingText,
      slaDate: normalizeSlaDate(fallbackDate, remainingText),
      amountText: amount.amountText,
      amountValue: amount.amountValue,
      rawText: block,
      logs: []
    };
  }

  function splitBlocks(pageText) {
    return String(pageText || '').split(/(?=SİPARİŞ\s*#\d+)/i).map((x) => x.trim()).filter(Boolean);
  }

  function currentRow() {
    return state.rows.find((x) => x.id === state.selectedId) || null;
  }

  function renderDetail() {
    if (!ui.detail) return;
    const row = currentRow();
    if (!row) {
      ui.detail.textContent = 'Detay görmek için listeden bir şikayet seçin.';
      return;
    }
    ui.detail.innerHTML = `<div><b>Hizmet:</b> ${row.service || '—'}</div>
      <div><b>Sipariş:</b> ${row.orderNo || '—'}</div>
      <div><b>SMM ID:</b> ${row.smmId || '—'}</div>
      <div><b>Tarih:</b> ${row.dateText || '—'}</div>
      <div><b>Durum:</b> ${row.status || '—'}</div>
      <div><b>SLA:</b> ${row.slaDate || '—'}</div>
      <div><b>Tutar:</b> ${row.amountText || '—'}</div>`;
    if (ui.selStatus) ui.selStatus.value = row.status || 'SORUN BİLDİRİLDİ';
  }

  function renderList() {
    const q = clean(ui.search?.value || '').toLowerCase();
    const filtered = state.rows.filter((r) => !q || [r.smmId, r.orderNo, r.status, r.service].join(' ').toLowerCase().includes(q));

    if (ui.list) {
      ui.list.innerHTML = filtered.length ? filtered.map((r) => {
        const active = r.id === state.selectedId ? 'active' : '';
        return `<div class="item ${active}" data-id="${r.id}">${r.smmId || '—'} • ${r.orderNo || '—'} • ${r.status || '—'}</div>`;
      }).join('') : '';
      ui.list.querySelectorAll('[data-id]').forEach((el) => {
        el.addEventListener('click', () => {
          state.selectedId = el.getAttribute('data-id') || '';
          renderDetail();
          renderList();
        });
      });
    }

    if (ui.empty) ui.empty.hidden = filtered.length > 0;
    if (ui.stats) ui.stats.textContent = `Kayıt: ${filtered.length} • Durum: ${state.running ? 'taranıyor' : 'hazır'}`;
    renderDetail();
  }

  async function saveRowsAndRefresh() {
    await setLocal(STORAGE_KEY, state.rows); // [KANIT@KOD: DURUM/STATE] write
    const rows = await getLocal(STORAGE_KEY); // read+refresh
    state.rows = Array.isArray(rows) ? rows : [];
    renderList();
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
    await wait(250);
  }

  async function extractPageCards(tabId) {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const cards = Array.from(document.querySelectorAll('article, .card, .list-group-item, [class*="siparis"], [class*="order"]'));
        const blocks = cards.map((c) => String(c.innerText || '').trim()).filter(Boolean);
        const hasNext = Boolean(document.querySelector('a[rel="next"], .pagination .next:not(.disabled), .pagination [aria-label*="Sonraki"]'));
        return { blocks, hasNext, bodyText: String(document.body.innerText || '') };
      }
    });
    return result || { blocks: [], hasNext: false, bodyText: '' };
  }

  function validDateOrThrow() {
    const val = clean(ui.dateInput?.value || '');
    if (!RX.DATE_ONLY.test(val)) throw new Error('Tarih GG.AA.YYYY formatında olmalıdır.');
    return val;
  function todayTrDate() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  function toIsoFromTrDateTime(trDateTime) {
    const m = String(trDateTime || '').match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`;
  }

  function parseAmountTl(text) {
    const amountRaw = (String(text || '').match(RX.REGEX_7_AMOUNT) || [, ''])[1] || '';
    const value = Number(amountRaw.replace(/\./g, '').replace(',', '.').replace(/\s*TL/i, '')) || 0;
    return { amountRaw, amountValue: value };
  }

  function parseRemaining(text) {
    const rem = (String(text || '').match(RX.REGEX_6_REMAINING) || [, ''])[1] || '';
    const hm = rem.match(RX.HOURS_MINUTES) || [];
    return {
      remainingText: rem,
      remainingHours: Number(hm[1] || 0),
      remainingMinutes: Number(hm[2] || 0)
    };
  }

  // [KANIT@KOD: FONKSİYON/SÖZLEŞME] INPUT=block_text OUTPUT=matched_record
  function parseComplaintBlock(blockText, indexInfo) {
    const block = String(blockText || '').trim();
    if (!block) return null;
    if (!block.toUpperCase().includes('SORUN')) return null; // [KANIT@KOD: KOŞUL/FİLTRE]

    const service = nText((block.match(RX.REGEX_1_SERVICE) || [, ''])[1]);
    const orderNo = (block.match(RX.REGEX_2_ORDER) || [, ''])[1] || '';
    let smmId = (block.match(RX.REGEX_3_SMM) || [, ''])[1] || '';
    if (!smmId) {
      const lines = block.split('\n');
      const i = lines.findIndex((ln) => ln.toUpperCase().includes('SORUN'));
      if (i > 0) smmId = (lines[i - 1].match(RX.REGEX_3_SMM) || [, ''])[1] || '';
    }

    const dateText = (block.match(RX.REGEX_4_DATE) || [, ''])[1] || '';
    const status = (block.match(RX.REGEX_5_STATUS) || [, ''])[1] || '';
    const rem = parseRemaining(block);
    const amount = parseAmountTl(block);

    if (!status) return null;

    return {
      id: `${orderNo || smmId || 'unknown'}-${indexInfo}`,
      service,
      orderNo,
      smmId,
      dateText,
      dateIso: toIsoFromTrDateTime(dateText),
      status,
      remainingText: rem.remainingText,
      remainingHours: rem.remainingHours,
      remainingMinutes: rem.remainingMinutes,
      amountText: amount.amountRaw,
      amountValue: amount.amountValue,
      rawText: block
    };
  }

  // [KANIT@KOD: FONKSİYON/SÖZLEŞME] INPUT=page_html OUTPUT=blocks[]
  function splitBlocks(pageText) {
    const txt = String(pageText || '');
    return txt
      .split(/(?=SİPARİŞ\s*#\d+)/i)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function renderTable() {
    if (!ui.tbody) return;
    ui.tbody.innerHTML = state.rows.map((r) => `
      <tr>
        <td>${r.service || '—'}</td>
        <td>${r.orderNo || '—'}</td>
        <td>${r.smmId || '—'}</td>
        <td>${r.dateText || '—'}</td>
        <td>${r.status || '—'}</td>
        <td>${r.remainingText || '—'}</td>
        <td>${r.amountText || '—'}</td>
      </tr>
    `).join('');

    if (ui.stats) ui.stats.textContent = `Kayıt: ${state.rows.length} • Durum: ${state.running ? 'taranıyor' : 'hazır'}`;
    if (ui.empty) ui.empty.hidden = state.rows.length > 0;
  }

  async function saveRows() { await setLocal(KEY, state.rows); }
  async function loadRows() {
    const rows = await getLocal(KEY);
    state.rows = Array.isArray(rows) ? rows : [];
    renderTable();
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
    await wait(250);
  }

  async function extractPageCards(tabId) {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
        const cards = Array.from(document.querySelectorAll('article, .card, .list-group-item, [class*="siparis"], [class*="order"]'));
        const blocks = cards.map((c) => String(c.innerText || '').trim()).filter(Boolean);
        const hasNext = Boolean(document.querySelector('a[rel="next"], .pagination .next:not(.disabled), .pagination [aria-label*="Sonraki"]'));
        return { blocks, hasNext, cardCount: cards.length, bodyText: clean(document.body.innerText || '') };
      }
    });
    return result || { blocks: [], hasNext: false, cardCount: 0, bodyText: '' };
  }

  // [KANIT@KOD: DÖNGÜ/BİTİRME] page++ until end
  async function scanComplaints() {
    if (state.running) return toast('Tarama zaten çalışıyor.');
    const baseDate = validDateOrThrow();

    state.shouldStop = false;
    state.running = true; // [KANIT@KOD: HATA YAKALAMA/LOG] start enters
    log('scan start');
    renderList();

    const seen = new Set(state.rows.map((x) => `${x.orderNo}|${x.smmId}|${x.dateText}`));
    const tabId = await getActiveTabId();

    let page = 1;
    let loops = 0;
    while (!state.shouldStop && loops < 250) { // [KANIT@KOD: KOŞUL/FİLTRE] shouldStop break
      loops += 1;
      const url = buildPageUrl(BASE_URL, page);
      try {
        await navigateWait(tabId, url);
        const pageData = await extractPageCards(tabId);
        const blocks = pageData.blocks.length ? pageData.blocks : splitBlocks(pageData.bodyText);
        if (!blocks.length) break;

        let pageAdded = 0;
        for (let i = 0; i < blocks.length; i++) {
          if (state.shouldStop) break;
          const block = blocks[i];
          try {
            const parsed = parseComplaintBlock(block, `${page}-${i}`, baseDate);
            if (!parsed) continue;
            const key = `${parsed.orderNo}|${parsed.smmId}|${parsed.dateText}`;
            if (seen.has(key)) continue;
            seen.add(key);
            state.rows.push(parsed);
            pageAdded += 1;
          } catch (e) {
            console.error(`Blok parse hatası page=${page} url=${url}`, e); // [KANIT@KOD: HATA YAKALAMA/LOG]
          }
        }

        await saveRowsAndRefresh();
        if (!pageData.hasNext && pageAdded === 0) break;
        page += 1;
      } catch (e) {
        console.error(`Sayfa hatası url=${url}`, e); // [KANIT@KOD: HATA YAKALAMA/LOG]
        page += 1;
      }
    }

    state.running = false;
    renderList();
    toast(state.shouldStop ? 'Şikayet tarama durduruldu.' : `Şikayet tarama tamamlandı. ${state.rows.length} kayıt.`);
  }

  function ensureSelectedOrWarn() {
    const row = currentRow();
    if (!row) {
      toast('Önce listeden bir şikayet seçin.');
      return null;
    }
    return row;
  }

  function draftReply() {
    const row = ensureSelectedOrWarn();
    if (!row) return;
    if (ui.draft) ui.draft.value = `Merhaba, ${row.orderNo || 'siparişiniz'} için inceleme başlatıldı.`;
  }

  function suggestSolution() {
    const row = ensureSelectedOrWarn();
    if (!row) return;
    if (ui.draft) ui.draft.value = `Çözüm önerisi: ${row.status} kaydı için SLA tarihi ${row.slaDate}.`;
  }

  async function escalateComplaint() {
    const row = ensureSelectedOrWarn();
    if (!row) return;
    if (!confirm('Bu kaydı eskaleye göndermek istiyor musunuz?')) return; // confirm required
    row.status = 'ESKALE';
    row.logs.push('ESKALE');
    await saveRowsAndRefresh();
  }

  async function closeComplaint() {
    const row = ensureSelectedOrWarn();
    if (!row) return;
    if (!confirm('Bu kaydı kapatmak istiyor musunuz?')) return; // confirm required
    row.status = 'KAPALI';
    row.logs.push('KAPALI');
    await saveRowsAndRefresh();
  }

  async function saveStatusAtomic() {
    const row = ensureSelectedOrWarn();
    if (!row) return;
    const nextStatus = ui.selStatus?.value || row.status;
    const prev = row.status;

    try {
      row.status = nextStatus;
      const copy = JSON.parse(JSON.stringify(state.rows));
      await setLocal(STORAGE_KEY, copy);
      const refreshed = await getLocal(STORAGE_KEY);
      if (!Array.isArray(refreshed)) throw new Error('Storage okunamadı');
      state.rows = refreshed;
      renderList();
      toast('Durum kaydedildi.');
    } catch (e) {
      row.status = prev; // rollback
      renderList();
      console.error('Durum kaydetme hatası:', e);
      toast('Durum kaydedilemedi, işlem geri alındı.');
    }
  }

  async function stopScan() {
    state.shouldStop = true;
    log('scan stop requested');
  }

  async function loadRows() {
    const rows = await getLocal(STORAGE_KEY);
    state.rows = Array.isArray(rows) ? rows : [];
    renderList();

    state.stop = false;
    state.running = true;
    const tabId = await getActiveTabId();
    const startDate = ui.dateInput?.value || todayTrDate();
    const seen = new Set(state.rows.map((x) => `${x.orderNo}|${x.smmId}|${x.dateText}`));

    let page = 1;
    let safety = 0;

    while (!state.stop && safety < 250) {
      safety += 1;
      const url = `${BASE_URL}?page=${page}`;
      try {
        await navigateWait(tabId, url);
        const pageData = await extractPageCards(tabId);
        const sourceBlocks = pageData.blocks.length ? pageData.blocks : splitBlocks(pageData.bodyText);

        if (!sourceBlocks.length) break;

        let pageMatches = 0;
        for (let i = 0; i < sourceBlocks.length; i++) {
          const block = sourceBlocks[i];
          try {
            const parsed = parseComplaintBlock(block, `${page}-${i}`);
            if (!parsed) continue; // [KANIT@KOD: KOŞUL/FİLTRE] !hasSORUN => skip
            if (!parsed.dateText && startDate) parsed.dateText = `${startDate} 00:00`;
            const dedupKey = `${parsed.orderNo}|${parsed.smmId}|${parsed.dateText}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);
            state.rows.push(parsed); // stable order
            pageMatches += 1;
          } catch (e) {
            // [KANIT@KOD: HATA YAKALAMA/LOG] LOG+SAFE+continue
            console.error('Blok parse hatası, devam ediliyor:', e, block.slice(0, 240));
          }
        }

        renderTable();
        await wait(150);

        if (!pageData.hasNext && pageMatches === 0) break;
        if (!pageData.hasNext && pageData.cardCount > 0 && pageMatches > 0) {
          // next yoksa bir sonraki sayfa dene; boş gelirse döngü kırılır
          page += 1;
          continue;
        }

        page += 1;
      } catch (e) {
        // [KANIT@KOD: DIŞ BAĞIMLILIK] graceful message + partial results
        console.error(`HTTP/DOM hata p${page}:`, e);
        page += 1;
      }
    }

    state.running = false;
    await saveRows();
    renderTable();
    toast(state.stop ? 'Şikayet tarama durduruldu.' : `Şikayet tarama tamamlandı. ${state.rows.length} kayıt.`);
  }

  function stopScan() { state.stop = true; }

  function toggleOnlyFullscreen() {
    state.fullOnly = !state.fullOnly;
    document.body.classList.toggle('complaint-only-fullscreen', state.fullOnly);
    if (ui.btnOnlyFullscreen) ui.btnOnlyFullscreen.textContent = state.fullOnly ? 'NORMAL MODA DÖN' : 'SADECE TAM EKRAN';
  }

  async function toggleFullscreenPanel() {
    const panel = byId('complaintsAdvancedPanel');
    if (!panel) return;
    if (!document.fullscreenElement) {
      await panel.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }

  function bind() {
    ui.dateInput = byId('inpComplaintDate');
    ui.search = byId('inpComplaintSearch');
    ui.stats = byId('complaintStats');
    ui.list = byId('complaintsList');
    ui.empty = byId('complaintEmpty');
    ui.detail = byId('complaintDetail');
    ui.selStatus = byId('selComplaintStatus');
    ui.draft = byId('complaintDraftText');

    if (ui.dateInput && !ui.dateInput.value) ui.dateInput.value = todayTrDate(); // [KANIT@KOD: TARİH/SÜRE]

    bindOnce(byId('btnComplaintScan'), 'click', 'btnComplaintScan', () => {
      scanComplaints().catch((e) => toast(`Şikayet tarama hatası: ${String(e?.message || e)}`));
    });
    bindOnce(byId('btnComplaintStop'), 'click', 'btnComplaintStop', () => stopScan());
    bindOnce(byId('btnComplaintDraft'), 'click', 'btnComplaintDraft', draftReply);
    bindOnce(byId('btnComplaintSolution'), 'click', 'btnComplaintSolution', suggestSolution);
    bindOnce(byId('btnComplaintEscalate'), 'click', 'btnComplaintEscalate', () => { escalateComplaint().catch(() => toast('Eskale hatası')); });
    bindOnce(byId('btnComplaintClose'), 'click', 'btnComplaintClose', () => { closeComplaint().catch(() => toast('Kapatma hatası')); });
    bindOnce(byId('btnComplaintSaveStatus'), 'click', 'btnComplaintSaveStatus', () => { saveStatusAtomic().catch(() => toast('Kaydetme hatası')); });
    bindOnce(ui.search, 'input', 'inpComplaintSearch', renderList);
    ui.stats = byId('complaintStats');
    ui.tbody = byId('tblComplaintBody');
    ui.empty = byId('complaintEmpty');
    ui.btnOnlyFullscreen = byId('btnComplaintOnlyFullscreen');

    if (ui.dateInput && !ui.dateInput.value) ui.dateInput.value = todayTrDate();

    byId('btnComplaintScan')?.addEventListener('click', () => {
      scanComplaints().catch((e) => toast(`Şikayet tarama hatası: ${String(e?.message || e)}`));
    });
    byId('btnComplaintStop')?.addEventListener('click', stopScan);
    byId('btnComplaintFullscreen')?.addEventListener('click', () => {
      toggleFullscreenPanel().catch(() => toast('Tam ekran geçişi başarısız.'));
    });
    byId('btnComplaintOnlyFullscreen')?.addEventListener('click', toggleOnlyFullscreen);
  }

  const Sikayet = { init: async () => { bind(); await loadRows(); }, scanComplaints, stopScan, buildPageUrl };
  window.Patpat = window.Patpat || {};
  window.Patpat.Sikayet = Sikayet;

  if (document.body?.dataset?.page === 'sidepanel' || byId('btnComplaintScan')) {
    Sikayet.init();
  }
})();
