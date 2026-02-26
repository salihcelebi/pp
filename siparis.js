(() => {
  if (typeof window === 'undefined') return;
  if (window.__SIPARIS_INIT__) return;
  window.__SIPARIS_INIT__ = true;
  'use strict';

  const SOLD_BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar?';
  const BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar?';
  const ALLOWED_STATUSES = ['pending', 'processing', 'completed', 'cancelled', 'returnprocess', 'problematic'];
  const BOUND = new Set();

  const RX_TITLE_15 = [
    /^([^\n]{10,200})\n(?=[\s\S]*?\bSipariş\s*#\d+)/mi,
    /^([^\n]{10,200})\n[^\n]{0,200}\n\s*Sipariş\s*#\d+/mi,
    /(?:^|\n)([^\n]{10,200})\n(?:\1|\s*[^\n]{10,200})\n\s*Sipariş\s*#\d+/mi,
    /([^\n]{10,200})\s*\n\s*Sipariş\s*#\d+/mi,
    /([^\n]{10,200})\s*(?=\s*\n\s*\n\s*Sipariş\s*#\d+)/mi,
    /([^\n]{10,200})\s*\n\s*\n\s*Sipariş\s*#\d+/mi,
    /([A-ZÇĞİÖŞÜ0-9][^\n]{8,200})\n(?=Sipariş\s*#\d+)/m,
    /(?:YOUTUBE|TİKTOK|TikTok|Instagram|INSTAGRAM)\b[^\n]{5,200}/m,
    /^(.*(?:Beğeni|Takipçi|İzlenme|Yorum|Kaydet)[^\n]{0,160})$/mi,
    /^(.{10,200})$/m,
    /([^\n]{10,200})(?=\nSMM\s*ID:)/mi,
    /([^\n]{10,200})(?=\n\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/mi,
    /([^\n]{10,200})(?=\n(?:Teslim|İptal|Müşteri|Sorun))/mi,
    /([^\n]{10,200})(?=\nToplam\s*Tutar)/mi,
    /([^\n]{10,200})(?=\n[\s\S]*?TL)/mi
  ];
  const RX_ORDER_15 = [/\bSipariş\s*#(\d{5,12})\b/i,/\bSİPARİŞ\s*#(\d{5,12})\b/i,/#\s*(\d{5,12})\b/i,/\bSiparis\s*#(\d{5,12})\b/i,/\bSipariş\s*No[:\s]*#?(\d{5,12})\b/i,/\bSipariş[:\s]*#?(\d{5,12})\b/i,/\bOrder\s*#(\d{5,12})\b/i,/\bSipariş\s*ID[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*Numarası[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*-\s*#?(\d{5,12})\b/i,/\bSIPARIS\s*#(\d{5,12})\b/i,/\bSIPARIS[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*\n\s*#(\d{5,12})\b/i,/(?:^|\n)\s*Sipariş\s*#(\d{5,12})/i,/\b(\d{5,12})\b(?=[\s\S]*?SMM\s*ID:|\s*\n\s*\d{2}\.\d{2}\.\d{4})/i];
  const RX_SMM_15 = [/\bSMM\s*ID:\s*(\d{4,12})\b/i,/\bSMMID:\s*(\d{4,12})\b/i,/\bSMM\s*No[:\s]*(\d{4,12})\b/i,/\bSMM\s*#\s*(\d{4,12})\b/i,/\bID:\s*(\d{4,12})\b(?=[\s\S]*?\d{2}\.\d{2}\.\d{4})/i,/\bSMM\s*Kimlik[:\s]*(\d{4,12})\b/i,/\bSMM\s*Numara[:\s]*(\d{4,12})\b/i,/\bSMM\s*[:\s]*(\d{4,12})\b/i,/(?:^|\n)\s*(\d{4,12})\s*(?=\n\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/m,/(?:^|\n)\s*SMM\s*\n\s*ID[:\s]*(\d{4,12})/mi,/\bSMM\s*I[D|d]\s*[:\-]\s*(\d{4,12})\b/i,/\bSMM\s*Id\s*[:\-]\s*(\d{4,12})\b/i,/\bSMM\s*IDENTIFIER[:\s]*(\d{4,12})\b/i,/\bSMM\s*CODE[:\s]*(\d{4,12})\b/i,/\b(\d{4,12})\b(?=[\s\S]*?Toplam\s*Tutar)/i];
  const RX_DATE_15 = [/\b(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{1,2}\.\d{1,2}\.\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\b/,/\b(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})\b/,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/m,/\b(\d{2}\.\d{2}\.\d{4})\b(?=[\s\S]*?\bTeslim|\bİptal|\bMüşteri|\bSorun)/i,/\b(\d{2}:\d{2})\b(?=[\s\S]*?Toplam\s*Tutar)/i,/\b(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2})\b/,/\b(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{1,2})\b/,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\s*$/m,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4})\s*$/m,/\b(\d{2}\.\d{2}\.\d{4})\b/,/\b(\d{2}\/\d{2}\/\d{4})\b/,/\b(\d{4}-\d{2}-\d{2})\b/];
  const RX_STATUS_15 = [/\bTeslim\s*Edildi\b/i,/\bİptal\s*Edildi\b/i,/\bMüşteriden\s*Onay\s*Bekleniyor\b/i,/\bSorun\s*Bildirildi\b/i,/\bIade\s*Sürecinde\b/i,/\bTeslimat\s*Bekleniyor\b/i,/\bİşlem\s*Sırasında\b/i,/\bBeklemede\b/i,/\bTamamlandı\b/i,/\bBaşarısız\b/i,/\bKısmi\s*Tamamlandı\b/i,/\bGeri\s*Ödeme\b/i,/\bOnay\s*Bekliyor\b/i,/(?:^|\n)([^\n]{3,60})(?=\nToplam\s*Tutar)/mi,/(?:^|\n)\d{2}:\d{2}\n([^\n]{3,60})/mi];
  const RX_AMOUNT_15 = [/\bToplam\s*Tutar\s*\n\s*([\d.,]+\s*TL)\b/i,/\bToplam\s*Tutar\s*([\d.,]+\s*TL)\b/i,/\bTutar\s*\n\s*([\d.,]+\s*TL)\b/i,/\bTutar[:\s]*([\d.,]+\s*TL)\b/i,/\bToplam[:\s]*([\d.,]+\s*TL)\b/i,/\bTotal\s*Amount[:\s]*([\d.,]+\s*TL)\b/i,/\bToplam\s*Ücret[:\s]*([\d.,]+\s*TL)\b/i,/\bÜcret[:\s]*([\d.,]+\s*TL)\b/i,/(?:^|\n)\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/m,/\b([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/,/\b([\d]+(?:,[\d]{2})?)\s*TL\b/,/\b([\d]+(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/,/TL\s*([\d.,]+)/i,/([\d.,]+)\s*(?:₺|TL)\b/i,/(?:Toplam\s*Tutar[\s\S]{0,40})\b([\d.,]+\s*(?:₺|TL))\b/i];

  const state = { rows: [], hashes: new Set(), dropped: 0, running: false, stop: false, speed: 3, lastPageAdded: 0 };
  const ui = {};
  const byId = (id) => document.getElementById(id);
  const toast = (m) => window.__PatpatUI?.UI?.toast?.(m) || alert(m);
  const log = (lvl, m) => window.__PatpatUI?.UI?.log?.(lvl, m) || console.log(m);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function bindOnce(el, ev, key, fn){ if(!el) return; const k=`${key}:${ev}`; if(BOUND.has(k)) return; BOUND.add(k); el.addEventListener(ev,fn); }
  function pickFirstMatch(list, text, groupIndex = 1){ for (const rx of list){ const m = String(text||'').match(rx); if (m) return groupIndex===2&&m[2]?`${m[1]} ${m[2]}`:(m[groupIndex]||m[0]||''); } return ''; }
  function splitBlocks(pageText){ return String(pageText||'').split(/(?=Sipariş\s*#\d+)/i).map((x)=>x.trim()).filter(Boolean); }
  function speedDelayMs(){ return Math.max(40, Math.round(1800/Math.max(1,Math.min(100,Number(state.speed||3))))); }
  function parseSpeed(){ const n=Number(ui.inpSpeed?.value||3); if(!Number.isFinite(n)) throw new Error('Hız sayı olmalı'); state.speed=Math.max(1,Math.min(100,n)); if(ui.inpSpeed) ui.inpSpeed.value=String(state.speed); }
  function parseMax(){ const n=Number(ui.inpMaxPage?.value); if(!Number.isFinite(n)||n<1) throw new Error('Sayfa sayısı en az 1 olmalı'); return Math.floor(n); }
  function sanitizeStatus(status='pending'){ const s=String(status||'').trim().toLowerCase(); return ALLOWED_STATUSES.includes(s)?s:'pending'; }
  function buildPageUrl(baseUrl,page,status='pending'){ const safeStatus=sanitizeStatus(status); const safePage=Math.max(1,Math.floor(Number(page)||1)); return `${baseUrl}status=${safeStatus}&page=${safePage}`; }
  function normalizeStatus(v){ const s=String(v||'').trim(); const t=s.toLowerCase(); if(t.includes('müşteriden onay bekleniyor')) return 'processing'; if(t.includes('teslim edildi')) return 'completed'; if(t.includes('iptal edildi')) return 'cancelled'; if(t.includes('sorun bildirildi')) return 'problematic'; if(t.includes('iade sürecinde')||t.includes('returnprocess')) return 'returnprocess'; if(t.includes('beklemede')||t.includes('pending')) return 'pending'; return sanitizeStatus(t); }
  function normalizeTitleFromLines(block, title){ const lines=String(block||'').split('\n').map((x)=>x.trim()).filter(Boolean); if(lines[0]&&lines[1]&&lines[0]===lines[1]) return lines[0]; return title||lines[0]||''; }

  async function hashRow(r){ const src=`${r.orderNo}|${r.smmId}|${r.dateTime}|${r.amountTl}|${r.status}`; const d=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(src)); return Array.from(new Uint8Array(d)).map((b)=>b.toString(16).padStart(2,'0')).join(''); }
  function appendRow(r){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.title||''}</td><td>${r.orderNo||''}</td><td>${r.smmId||''}</td><td>${r.dateTime||''}</td><td>${r.status||''}</td><td>${r.amountTl??''}</td><td>${r.username||''}</td>`; ui.tbody?.appendChild(tr); }
  function updateStats(mode='beklemede'){ if(ui.stats) ui.stats.textContent=`Toplam: ${state.rows.length} • Dedup atılan: ${state.dropped} • Sayfa-başı son eklenen: ${state.lastPageAdded} • Hız: ${state.speed}x • Durum: ${mode}`; if(ui.empty) ui.empty.hidden=state.rows.length>0; }

  function parseOrderBlock_SIPARIS(blockText){
    const titleRaw = pickFirstMatch(RX_TITLE_15, blockText);
    const title = normalizeTitleFromLines(blockText, titleRaw);
    const orderNo = pickFirstMatch(RX_ORDER_15, blockText);
    const smmId = pickFirstMatch(RX_SMM_15, blockText);
    const dateTime = pickFirstMatch(RX_DATE_15, blockText) || '';
    const status = normalizeStatus(pickFirstMatch(RX_STATUS_15, blockText));
    const amountRaw = pickFirstMatch(RX_AMOUNT_15, blockText);
    const amountTl = Number(String(amountRaw).replace(/\./g,'').replace(',', '.').replace(/[^\d.]/g,'')) || 0;
    if (!orderNo && !smmId && !(dateTime && amountTl)) return null;
    return { title, orderNo, smmId, dateTime, status, amountTl, username: '' };
  }

  async function getActiveTabId(){ const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true}); if(!tab?.id) throw new Error('Aktif sekme yok'); return tab.id; }
  async function navigate(tabId,url){ await chrome.tabs.update(tabId,{url}); await new Promise((res)=>{ const l=(id,info)=>{ if(id===tabId&&info.status==='complete'){ chrome.tabs.onUpdated.removeListener(l); res(true);} }; chrome.tabs.onUpdated.addListener(l);}); await wait(speedDelayMs()); }
  async function extractPageText(tabId){ const [{result}] = await chrome.scripting.executeScript({target:{tabId},func:()=>String(document.body.innerText||'')}); return String(result||''); }

  async function scanStatus(tabId,status,maxPage){
    for(let page=1; page<=maxPage; page++){
      if(state.stop) break;
      state.lastPageAdded = 0;
      const url = buildPageUrl(SOLD_BASE_URL, page, status);
      try {
        await navigate(tabId, url);
        const text = await extractPageText(tabId);
        const blocks = splitBlocks(text);
        for (const b of blocks){
          if(state.stop) break;
          try {
            const row = parseOrderBlock_SIPARIS(b);
            if(!row) continue;
            const h = await hashRow(row);
            if(state.hashes.has(h)){ state.dropped += 1; continue; }
            state.hashes.add(h); state.rows.push(row); state.lastPageAdded += 1; appendRow(row);
          } catch (e){ log('Hata', `Blok parse hatası page=${page}: ${String(e?.message||e)}`); }
        }
      } catch (e){ log('Hata', `Sayfa parse hatası url=${url}: ${String(e?.message||e)}`); }
      updateStats(`${status||'genel'} p${page}/${maxPage}`);
      await wait(speedDelayMs());
    }
  }

  async function startScan({status,maxPages}){
    if(state.running) return toast('Tarama çalışıyor');
    state.running=true; state.stop=false;
    try {
      parseSpeed();
      const maxPage = Number(maxPages);
      if(!Number.isFinite(maxPage)||maxPage<1) throw new Error('maxPage geçersiz');
      updateStats('çalışıyor');
      const tabId = await getActiveTabId();
      const list = status==='all'?ALLOWED_STATUSES:[sanitizeStatus(status)];
      for(const st of list){ if(state.stop) break; await scanStatus(tabId, st, maxPage); }
      updateStats(state.stop?'durduruldu':'tamamlandı');
    } catch (e){ toast(String(e?.message||e)); }
    finally { state.running=false; }
  }

  function stopScan(){ state.stop=true; updateStats('durduruluyor'); }
  function clearTable(){ state.rows=[]; state.hashes.clear(); state.dropped=0; state.lastPageAdded=0; if(ui.tbody) ui.tbody.innerHTML=''; updateStats('temizlendi'); }
  function download(n,t,m){ const b=new Blob([t],{type:m}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u;a.download=n;a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000); }
  function exportJson(){ download(`siparis_${Date.now()}.json`, JSON.stringify(state.rows,null,2),'application/json'); }
  function exportCsv(){ const cols=['İlan Başlığı','Sipariş No','SMM ID','Tarih','Durum','Tutar (TL)','Kullanıcı']; const esc=(v)=>`"${String(v??'').replace(/"/g,'""')}"`; const lines=[cols.join(',')].concat(state.rows.map((r)=>[r.title,r.orderNo,r.smmId,r.dateTime,r.status,r.amountTl,r.username].map(esc).join(','))); download(`siparis_${Date.now()}.csv`, '\ufeff'+lines.join('\n'),'text/csv;charset=utf-8'); }
  async function copyTableMarkdown(){ const h='| İlan Başlığı | Sipariş No | SMM ID | Tarih | Durum | Tutar (TL) | Kullanıcı |\n|---|---|---|---|---|---:|---|'; const b=state.rows.map((r)=>`| ${r.title} | ${r.orderNo} | ${r.smmId} | ${r.dateTime} | ${r.status} | ${r.amountTl} | ${r.username||''} |`).join('\n'); try{ await navigator.clipboard.writeText(`${h}\n${b}`); }catch{} }

  function bind(){ ui.selStatus=byId('selSiparisStatus'); ui.inpMaxPage=byId('inpSiparisMaxPage'); ui.inpSpeed=byId('inpScanSpeed'); ui.tbody=byId('tblSiparisBody'); ui.stats=byId('siparisStats'); ui.empty=byId('ordersEmpty'); if(ui.inpSpeed&&!ui.inpSpeed.value) ui.inpSpeed.value='3';
    bindOnce(byId('btnSiparisStart'),'click','start',()=>startScan({status:ui.selStatus?.value||'all',maxPages:parseMax()}).catch((e)=>toast(String(e?.message||e))));
    bindOnce(byId('btnSiparisStop'),'click','stop',stopScan); bindOnce(byId('btnSiparisClear'),'click','clear',clearTable); bindOnce(byId('btnSiparisCopyMd'),'click','md',()=>copyTableMarkdown()); bindOnce(byId('btnSiparisExportJson'),'click','json',exportJson); bindOnce(byId('btnSiparisExportCsv'),'click','csv',exportCsv); bindOnce(ui.inpSpeed,'change','speed',()=>{try{parseSpeed();updateStats('hız güncellendi');}catch(e){toast(String(e?.message||e));}}); updateStats(); }

  const Siparis={init:bind,startScan,stopScan,clearTable,exportJson,exportCsv,copyTableMarkdown,buildPageUrl,hashRow};
  window.Patpat=window.Patpat||{}; window.Patpat.Siparis=Siparis;
  if(document.body?.dataset?.page==='sidepanel'||byId('btnSiparisStart')) Siparis.init();
})();
