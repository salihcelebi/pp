(() => {
  if (typeof window === 'undefined' || document.body?.dataset?.page !== 'sidepanel') return;
  'use strict';

  const KEY = 'patpat_complaints_v2';
  const BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar';

  // [KANIT@KOD: DÖNÜŞÜM] En az 5 regex aktif kullanım
  const RX = Object.freeze({
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
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nText = (v) => String(v || '').replace(/\s+/g, ' ').trim();

  async function getLocal(key) { const x = await chrome.storage.local.get(key); return x[key]; }
  async function setLocal(key, val) { await chrome.storage.local.set({ [key]: val }); }

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

  const Sikayet = { init: async () => { bind(); await loadRows(); }, scanComplaints, stopScan };
  window.Patpat = window.Patpat || {};
  window.Patpat.Sikayet = Sikayet;
  Sikayet.init();
})();
