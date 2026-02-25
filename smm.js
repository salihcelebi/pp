(() => {
  if (typeof window === 'undefined') return;
  if (window.__SMM_INIT__) return;
  window.__SMM_INIT__ = true;
  'use strict';

  const BASE_URL = 'https://anabayiniz.com/orders';
  const SOLD_BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar';
  const BOUND = new Set();

  const RX_TITLE_15 = [/^([^\n]{10,200})\n(?=[\s\S]*?\bSipariş\s*#\d+)/mi,/^([^\n]{10,200})\n[^\n]{0,200}\n\s*Sipariş\s*#\d+/mi,/(?:^|\n)([^\n]{10,200})\n(?:\1|\s*[^\n]{10,200})\n\s*Sipariş\s*#\d+/mi,/([^\n]{10,200})\s*\n\s*Sipariş\s*#\d+/mi,/([^\n]{10,200})\s*(?=\s*\n\s*\n\s*Sipariş\s*#\d+)/mi,/([^\n]{10,200})\s*\n\s*\n\s*Sipariş\s*#\d+/mi,/([A-ZÇĞİÖŞÜ0-9][^\n]{8,200})\n(?=Sipariş\s*#\d+)/m,/(?:YOUTUBE|TİKTOK|TikTok|Instagram|INSTAGRAM)\b[^\n]{5,200}/m,/^(.*(?:Beğeni|Takipçi|İzlenme|Yorum|Kaydet)[^\n]{0,160})$/mi,/^(.{10,200})$/m,/([^\n]{10,200})(?=\nSMM\s*ID:)/mi,/([^\n]{10,200})(?=\n\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/mi,/([^\n]{10,200})(?=\n(?:Teslim|İptal|Müşteri|Sorun))/mi,/([^\n]{10,200})(?=\nToplam\s*Tutar)/mi,/([^\n]{10,200})(?=\n[\s\S]*?TL)/mi];
  const RX_ORDER_15 = [/\bSipariş\s*#(\d{5,12})\b/i,/\bSİPARİŞ\s*#(\d{5,12})\b/i,/#\s*(\d{5,12})\b/i,/\bSiparis\s*#(\d{5,12})\b/i,/\bSipariş\s*No[:\s]*#?(\d{5,12})\b/i,/\bSipariş[:\s]*#?(\d{5,12})\b/i,/\bOrder\s*#(\d{5,12})\b/i,/\bSipariş\s*ID[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*Numarası[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*-\s*#?(\d{5,12})\b/i,/\bSIPARIS\s*#(\d{5,12})\b/i,/\bSIPARIS[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*\n\s*#(\d{5,12})\b/i,/(?:^|\n)\s*Sipariş\s*#(\d{5,12})/i,/\b(\d{5,12})\b(?=[\s\S]*?SMM\s*ID:|\s*\n\s*\d{2}\.\d{2}\.\d{4})/i];
  const RX_SMM_15 = [/\bSMM\s*ID:\s*(\d{4,12})\b/i,/\bSMMID:\s*(\d{4,12})\b/i,/\bSMM\s*No[:\s]*(\d{4,12})\b/i,/\bSMM\s*#\s*(\d{4,12})\b/i,/\bID:\s*(\d{4,12})\b(?=[\s\S]*?\d{2}\.\d{2}\.\d{4})/i,/\bSMM\s*Kimlik[:\s]*(\d{4,12})\b/i,/\bSMM\s*Numara[:\s]*(\d{4,12})\b/i,/\bSMM\s*[:\s]*(\d{4,12})\b/i,/(?:^|\n)\s*(\d{4,12})\s*(?=\n\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/m,/(?:^|\n)\s*SMM\s*\n\s*ID[:\s]*(\d{4,12})/mi,/\bSMM\s*I[D|d]\s*[:\-]\s*(\d{4,12})\b/i,/\bSMM\s*Id\s*[:\-]\s*(\d{4,12})\b/i,/\bSMM\s*IDENTIFIER[:\s]*(\d{4,12})\b/i,/\bSMM\s*CODE[:\s]*(\d{4,12})\b/i,/\b(\d{4,12})\b(?=[\s\S]*?Toplam\s*Tutar)/i];
  const RX_DATE_15 = [/\b(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{1,2}\.\d{1,2}\.\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\b/,/\b(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})\b/,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/m,/\b(\d{2}\.\d{2}\.\d{4})\b(?=[\s\S]*?\bTeslim|\bİptal|\bMüşteri|\bSorun)/i,/\b(\d{2}:\d{2})\b(?=[\s\S]*?Toplam\s*Tutar)/i,/\b(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2})\b/,/\b(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{1,2})\b/,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\s*$/m,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4})\s*$/m,/\b(\d{2}\.\d{2}\.\d{4})\b/,/\b(\d{2}\/\d{2}\/\d{4})\b/,/\b(\d{4}-\d{2}-\d{2})\b/];
  const RX_STATUS_15 = [/\bTeslim\s*Edildi\b/i,/\bİptal\s*Edildi\b/i,/\bMüşteriden\s*Onay\s*Bekleniyor\b/i,/\bSorun\s*Bildirildi\b/i,/\bIade\s*Sürecinde\b/i,/\bTeslimat\s*Bekleniyor\b/i,/\bİşlem\s*Sırasında\b/i,/\bBeklemede\b/i,/\bTamamlandı\b/i,/\bBaşarısız\b/i,/\bKısmi\s*Tamamlandı\b/i,/\bGeri\s*Ödeme\b/i,/\bOnay\s*Bekliyor\b/i,/(?:^|\n)([^\n]{3,60})(?=\nToplam\s*Tutar)/mi,/(?:^|\n)\d{2}:\d{2}\n([^\n]{3,60})/mi];
  const RX_AMOUNT_15 = [/\bToplam\s*Tutar\s*\n\s*([\d.,]+\s*TL)\b/i,/\bToplam\s*Tutar\s*([\d.,]+\s*TL)\b/i,/\bTutar\s*\n\s*([\d.,]+\s*TL)\b/i,/\bTutar[:\s]*([\d.,]+\s*TL)\b/i,/\bToplam[:\s]*([\d.,]+\s*TL)\b/i,/\bTotal\s*Amount[:\s]*([\d.,]+\s*TL)\b/i,/\bToplam\s*Ücret[:\s]*([\d.,]+\s*TL)\b/i,/\bÜcret[:\s]*([\d.,]+\s*TL)\b/i,/(?:^|\n)\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/m,/\b([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/,/\b([\d]+(?:,[\d]{2})?)\s*TL\b/,/\b([\d]+(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/,/TL\s*([\d.,]+)/i,/([\d.,]+)\s*(?:₺|TL)\b/i,/(?:Toplam\s*Tutar[\s\S]{0,40})\b([\d.,]+\s*(?:₺|TL))\b/i];

  const RX_SMM_PLATFORM_15 = [/\bTik\s*Tok\b/i,/\bTİKTOK\b/i,/\btiktok\b/i,/\bInstagram\b/i,/\bINSTAGRAM\b/i,/\binstagram\b/i,/\bYou\s*Tube\b/i,/\bYouTube\b/i,/\bYOUTUBE\b/i,/\bTwitter\b/i,/\bX\s*\(Twitter\)\b|\bTwitter\s*\(X\)\b/i,/\bFacebook\b/i,/\bTelegram\b/i,/\bTwitch\b/i,/\bSpotify\b/i];
  const RX_SMM_SERVICE_NAME_15 = [/^(?:Hizmet|Servis)\s*Ad[ıi]\s*[:\-]\s*([^\n]{5,200})/mi,/^(?:Service)\s*Name\s*[:\-]\s*([^\n]{5,200})/mi,/^([^\n]{10,220})\n(?=[\s\S]*?(?:\bMin\b|\bMax\b|\bFiyat\b|\bTL\b|₺))/m,/^([^\n]{10,220})\n[^\n]{0,220}\n(?=[\s\S]*?(?:TL|₺))/m,/(?:^|\n)([^\n]{10,220})(?=\n(?:Min|MAX|Max|Fiyat|Ücret|Price)\b)/mi,/(?:^|\n)([^\n]{10,220})(?=\n(?:\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s*(?:TL|₺)))/m,/(?:^|\n)([^\n]{10,220})(?=[\s\S]*?\b(?:Takipçi|Beğeni|İzlenme|Yorum|Kaydet|Abone)\b)/mi,/(?:^|\n)([^\n]{10,220})(?=[\s\S]*?\b(?:Garantili|Telafi|Keşfet|Algoritma)\b)/mi,/(?:^|\n)•\s*([^\n]{10,220})/m,/(?:^|\n)-\s*([^\n]{10,220})/m,/(?:^|\n)\*\s*([^\n]{10,220})/m,/(?:^|\n)\d+\)\s*([^\n]{10,220})/m,/(?:^|\n)([A-ZÇĞİÖŞÜ0-9][^\n]{9,220})/m,/"serviceName"\s*:\s*"([^"]{5,220})"/i,/"name"\s*:\s*"([^"]{5,220})"/i];
  const RX_SMM_SERVICE_ID_15 = [/\bServis\s*ID[:\s]*#?(\d{2,12})\b/i,/\bHizmet\s*ID[:\s]*#?(\d{2,12})\b/i,/\bService\s*ID[:\s]*#?(\d{2,12})\b/i,/\bID[:\s]*#?(\d{2,12})\b(?=[\s\S]*?(?:TL|₺|Fiyat|Price))/i,/\bKod[:\s]*#?(\d{2,12})\b/i,/\bNo[:\s]*#?(\d{2,12})\b(?=[\s\S]*?(?:Min|Max|Fiyat|TL|₺))/i,/(?:^|\n)\s*#\s*(\d{2,12})\b/m,/(?:^|\n)\s*\[(\d{2,12})\]\s*/m,/(?:^|\n)\s*\((\d{2,12})\)\s*/m,/"serviceId"\s*:\s*"?(\d{2,12})"?/i,/"id"\s*:\s*"?(\d{2,12})"?/i,/data-service-id\s*=\s*"(\d{2,12})"/i,/\bSERVISID[:\s]*(\d{2,12})\b/i,/\bHIZMETID[:\s]*(\d{2,12})\b/i,/\b(\d{2,12})\b(?=[\s\S]*?(?:Min|Max|Fiyat|TL|₺))/i];
  const RX_SMM_PRICE_15 = [/\bFiyat[:\s]*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?\s*(?:TL|₺))\b/i,/\bÜcret[:\s]*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?\s*(?:TL|₺))\b/i,/\bPrice[:\s]*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?\s*(?:TL|₺))\b/i,/\bBirim\s*Fiyat[:\s]*([\d.,]+\s*(?:TL|₺))\b/i,/\bToplam[:\s]*([\d.,]+\s*(?:TL|₺))\b/i,/(?:^|\n)\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*(?:TL|₺)\b/m,/\b([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*(?:TL|₺)\b/,/\b([\d]+(?:,[\d]{2})?)\s*(?:TL|₺)\b/,/\b([\d]+(?:\.[\d]{3})*(?:,[\d]{2})?)\s*(?:TL|₺)\b/,/TL\s*([\d.,]+)/i,/₺\s*([\d.,]+)/i,/"price"\s*:\s*"([^"]+)"/i,/"amount"\s*:\s*"([^"]+)"/i,/\bFiyat\b[\s\S]{0,30}\b([\d.,]+\s*(?:TL|₺))\b/i,/\b([\d.,]+)\s*(?:TL|₺)\b/i];
  const RX_SMM_MIN_15 = [/\bMin(?:imum)?[:\s]*(\d{1,12})\b/i,/\bMinimum\s*Sipariş[:\s]*(\d{1,12})\b/i,/\bMin\s*Order[:\s]*(\d{1,12})\b/i,/\bEn\s*Az[:\s]*(\d{1,12})\b/i,/\bMin[:\s]*([0-9]{1,12})\b/i,/(?:^|\n)\s*Min\s*\n\s*(\d{1,12})\b/mi,/\bAlt\s*Limit[:\s]*(\d{1,12})\b/i,/\bBaşlangıç[:\s]*(\d{1,12})\b/i,/"min"\s*:\s*"?(\d{1,12})"?/i,/"minimum"\s*:\s*"?(\d{1,12})"?/i,/data-min\s*=\s*"(\d{1,12})"/i,/\b(\d{1,12})\b(?=[\s\S]*?\bMax\b)/i,/\bMin\b[\s\S]{0,10}\b(\d{1,12})\b/i,/\bMinimum\b[\s\S]{0,10}\b(\d{1,12})\b/i,/\bEn\s*Az\b[\s\S]{0,10}\b(\d{1,12})\b/i];
  const RX_SMM_MAX_15 = [/\bMax(?:imum)?[:\s]*(\d{1,12})\b/i,/\bMaks(?:imum)?[:\s]*(\d{1,12})\b/i,/\bMaximum\s*Sipariş[:\s]*(\d{1,12})\b/i,/\bMax\s*Order[:\s]*(\d{1,12})\b/i,/\bEn\s*Fazla[:\s]*(\d{1,12})\b/i,/(?:^|\n)\s*Max\s*\n\s*(\d{1,12})\b/mi,/\bÜst\s*Limit[:\s]*(\d{1,12})\b/i,/\bTavan[:\s]*(\d{1,12})\b/i,/"max"\s*:\s*"?(\d{1,12})"?/i,/"maximum"\s*:\s*"?(\d{1,12})"?/i,/data-max\s*=\s*"(\d{1,12})"/i,/\b(\d{1,12})\b(?=[\s\S]*?\bTL\b|₺)/i,/\bMax\b[\s\S]{0,10}\b(\d{1,12})\b/i,/\bMaks\b[\s\S]{0,10}\b(\d{1,12})\b/i,/\bEn\s*Fazla\b[\s\S]{0,10}\b(\d{1,12})\b/i];
  const RX_SMM_DELIVERY_15 = [/\bTeslimat[:\s]*([^\n]{2,60})/i,/\bTeslim\s*Süresi[:\s]*([^\n]{2,60})/i,/\bDelivery[:\s]*([^\n]{2,60})/i,/\bSpeed[:\s]*([^\n]{2,60})/i,/\bHız[:\s]*([^\n]{2,60})/i,/\bOrtalama[:\s]*([^\n]{2,60})/i,/\b(\d{1,3}\s*(?:dk|dakika))\b/i,/\b(\d{1,2}\s*(?:sa|saat))\b/i,/\b(\d{1,2}\s*(?:gün))\b/i,/\bAnında\b/i,/\bHemen\b/i,/\b24\/7\b/i,/\b(\d{1,2}\-\d{1,2}\s*(?:sa|saat))\b/i,/\b(\d{1,2}\-\d{1,2}\s*(?:gün))\b/i,/"delivery"\s*:\s*"([^"]{2,60})"/i];
  const RX_SMM_CATEGORY_15 = [/\bKategori[:\s]*([^\n]{3,80})/i,/\bCategory[:\s]*([^\n]{3,80})/i,/\bTür[:\s]*([^\n]{3,80})/i,/\bType[:\s]*([^\n]{3,80})/i,/\bGrup[:\s]*([^\n]{3,80})/i,/\bGroup[:\s]*([^\n]{3,80})/i,/(?:^|\n)\s*Kategori\s*\n\s*([^\n]{3,80})/mi,/\bSosyal\s*Medya\b/i,/\bBeğeni\b/i,/\bTakipçi\b/i,/\bİzlenme\b/i,/\bYorum\b/i,/\bKaydet\b/i,/\bAbone\b/i,/"category"\s*:\s*"([^"]{3,80})"/i];

  const state = { rows: [], hashes: new Set(), dropped: 0, running: false, stop: false };
  const ui = {};
  const byId = (id) => document.getElementById(id);
  const toast = (m) => window.__PatpatUI?.UI?.toast?.(m) || alert(m);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function bindOnce(el, ev, key, fn){ if(!el) return; const k=`${key}:${ev}`; if(BOUND.has(k)) return; BOUND.add(k); el.addEventListener(ev, fn); }
  function pickFirstMatch(list, text, groupIndex = 1){ for(const rx of list){ const m = String(text||'').match(rx); if(m) return (m[groupIndex] || m[0] || '').trim(); } return ''; }
  function buildPageUrl(baseUrl, page){ return `${baseUrl}?page=${page}`; }

  function splitBlocks(pageText){ return String(pageText||'').split(/(?=Sipariş\s*#\d+)/i).map((x)=>x.trim()).filter(Boolean); }
  function splitServiceBlocks(pageText){
    const text = String(pageText || '');
    const fromRows = text.split(/\n{2,}/).map((x) => x.trim()).filter((x) => x.split('\n').length >= 2);
    return fromRows.length ? fromRows : text.split(/(?=\b(?:Hizmet|Servis|Service)\b|\bMin\b|\bFiyat\b)/i).map((x)=>x.trim()).filter(Boolean);
  }

  function detectMode(url){ return String(url||'').includes('/p/sattigim-ilanlar') ? 'sold' : 'services'; }

  function normalizeServiceName(name, block){
    const lines = String(block||'').split('\n').map((x)=>x.trim()).filter(Boolean);
    if (lines[0] && lines[1] && lines[0] === lines[1]) return lines[0];
    return String(name||'').replace(/\s+/g, ' ').trim();
  }

  function parseServiceBlock(blockText){
    const name = normalizeServiceName(pickFirstMatch(RX_SMM_SERVICE_NAME_15, blockText), blockText);
    let platform = pickFirstMatch(RX_SMM_PLATFORM_15, blockText);
    if (!platform) platform = pickFirstMatch(RX_SMM_PLATFORM_15, name);
    const serviceId = pickFirstMatch(RX_SMM_SERVICE_ID_15, blockText);
    const price = pickFirstMatch(RX_SMM_PRICE_15, blockText);
    const min = pickFirstMatch(RX_SMM_MIN_15, blockText);
    const max = pickFirstMatch(RX_SMM_MAX_15, blockText);
    const delivery = pickFirstMatch(RX_SMM_DELIVERY_15, blockText);
    const category = pickFirstMatch(RX_SMM_CATEGORY_15, blockText);
    return { platform, name, serviceId, price, min, max, delivery, category, mode: 'services' };
  }

  function parseSoldBlock_SMM(blockText){
    const title = pickFirstMatch(RX_TITLE_15, blockText);
    const orderNo = pickFirstMatch(RX_ORDER_15, blockText);
    const smmId = pickFirstMatch(RX_SMM_15, blockText);
    const dateTime = pickFirstMatch(RX_DATE_15, blockText);
    const status = pickFirstMatch(RX_STATUS_15, blockText);
    const amount = pickFirstMatch(RX_AMOUNT_15, blockText);
    return { title, orderNo, smmId, dateTime, status, amount, mode: 'sold' };
  }

  async function hashRow(src){
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src));
    return Array.from(new Uint8Array(d)).map((b)=>b.toString(16).padStart(2,'0')).join('');
  }

  function appendRow(row){
    const tr = document.createElement('tr');
    if (row.mode === 'services') {
      tr.innerHTML = `<td>${row.serviceId || ''}</td><td>${row.category || ''}</td><td>${row.name || ''}</td><td>${row.price || ''}</td><td>${row.platform || ''}</td><td>${row.delivery || ''}</td><td>${row.min || ''}-${row.max || ''}</td>`;
    } else {
      tr.innerHTML = `<td>${row.orderNo || ''}</td><td>${row.dateTime || ''}</td><td>${SOLD_BASE_URL}</td><td>${row.amount || ''}</td><td>${row.title || ''}</td><td>${row.status || ''}</td><td>${row.smmId || ''}</td>`;
    }
    ui.tbody?.appendChild(tr);
  }

  function updateStats(mode='beklemede'){ if(ui.stats) ui.stats.textContent=`Kayıt: ${state.rows.length} • Dedup: ${state.dropped} • Durum: ${mode}`; if(ui.empty) ui.empty.hidden=state.rows.length>0; }
  async function getActiveTabId(){ const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true}); if(!tab?.id) throw new Error('Aktif sekme yok'); return tab.id; }
  async function navigate(tabId,url){ await chrome.tabs.update(tabId,{url}); await new Promise((res)=>{ const l=(id,info)=>{ if(id===tabId&&info.status==='complete'){ chrome.tabs.onUpdated.removeListener(l); res(true);} }; chrome.tabs.onUpdated.addListener(l);}); await wait(220); }

  async function extractContext(tabId){
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const nodes = Array.from(document.querySelectorAll('article,.card,.list-group-item,tr,[class*="service"],[class*="order"]'));
        const texts = nodes.map((n) => String(n.innerText || '').trim()).filter(Boolean);
        return { href: location.href, domText: texts.join('\n\n'), bodyText: String(document.body.innerText || '') };
      }
    });
    return result || { href: '', domText: '', bodyText: '' };
  }

  async function startScan(){
    if(state.running) return;
    state.running = true;
    state.stop = false;
    updateStats('çalışıyor');

    try {
      const tabId = await getActiveTabId();
      const maxPage = Math.max(1, Number(ui.maxPage?.value || 1));

      for (let page = 1; page <= maxPage; page++) {
        if (state.stop) break;

        const target = buildPageUrl(BASE_URL, page);
        await navigate(tabId, target);
        const ctx = await extractContext(tabId);
        const mode = detectMode(ctx.href);
        const sourceText = ctx.domText || ctx.bodyText;
        const blocks = mode === 'sold' ? splitBlocks(sourceText) : splitServiceBlocks(sourceText);

        for (const block of blocks) {
          if (state.stop) break;
          try {
            const row = mode === 'sold' ? parseSoldBlock_SMM(block) : parseServiceBlock(block);
            const key = mode === 'sold'
              ? `${row.orderNo}|${row.smmId}|${row.dateTime}|${row.amount}|${row.status}`
              : `${row.serviceId}|${row.name}|${row.price}|${row.min}|${row.max}`;
            const h = await hashRow(key);
            if (state.hashes.has(h)) { state.dropped += 1; continue; }
            state.hashes.add(h);
            state.rows.push(row);
            appendRow(row);
          } catch (e) {
            console.error('SMM blok parse hatası, devam:', e, block.slice(0, 260));
          }
        }

        updateStats(`p${page}/${maxPage}`);
      }
    } finally {
      state.running = false;
      updateStats(state.stop ? 'durduruldu' : 'tamamlandı');
    }
  }

  function stopScan(){ state.stop = true; }
  function clearTable(){ state.rows=[]; state.hashes.clear(); state.dropped=0; if(ui.tbody) ui.tbody.innerHTML=''; updateStats('temizlendi'); }

  function bind(){
    ui.maxPage = byId('inpSmmMaxPage');
    ui.tbody = byId('tblSmmBody');
    ui.stats = byId('smmStats');
    ui.empty = byId('smmEmpty');
    bindOnce(byId('btnSmmStart'), 'click', 'start', () => startScan().catch((e)=>toast(String(e?.message||e))));
    bindOnce(byId('btnSmmStop'), 'click', 'stop', stopScan);
    bindOnce(byId('btnSmmClear'), 'click', 'clear', clearTable);
    updateStats();
  }

  const SMM = { init: bind, startScan, stopScan, buildPageUrl, splitBlocks, splitServiceBlocks, parseSoldBlock_SMM, parseServiceBlock };
  window.Patpat = window.Patpat || {};
  window.Patpat.SMM = SMM;
  if (document.body?.dataset?.page === 'sidepanel' || byId('btnSmmStart')) SMM.init();
})();
