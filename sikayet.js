(() => {
  if (typeof window === 'undefined') return;
  if (window.__SIKAYET_INIT__) return;
  window.__SIKAYET_INIT__ = true;
  'use strict';

  const SOLD_BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar?';
  const BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar?';
  const ALLOWED_STATUSES = ['pending', 'processing', 'completed', 'cancelled', 'returnprocess', 'problematic'];
  const DEFAULT_SCAN_STATUS = 'returnprocess';
  const KEY = 'patpat_complaints_v4';
  const BOUND = new Set();

  const RX_TITLE_15 = [/^([^\n]{10,200})\n(?=[\s\S]*?\bSipariş\s*#\d+)/mi,/^([^\n]{10,200})\n[^\n]{0,200}\n\s*Sipariş\s*#\d+/mi,/(?:^|\n)([^\n]{10,200})\n(?:\1|\s*[^\n]{10,200})\n\s*Sipariş\s*#\d+/mi,/([^\n]{10,200})\s*\n\s*Sipariş\s*#\d+/mi,/([^\n]{10,200})\s*(?=\s*\n\s*\n\s*Sipariş\s*#\d+)/mi,/([^\n]{10,200})\s*\n\s*\n\s*Sipariş\s*#\d+/mi,/([A-ZÇĞİÖŞÜ0-9][^\n]{8,200})\n(?=Sipariş\s*#\d+)/m,/(?:YOUTUBE|TİKTOK|TikTok|Instagram|INSTAGRAM)\b[^\n]{5,200}/m,/^(.*(?:Beğeni|Takipçi|İzlenme|Yorum|Kaydet)[^\n]{0,160})$/mi,/^(.{10,200})$/m,/([^\n]{10,200})(?=\nSMM\s*ID:)/mi,/([^\n]{10,200})(?=\n\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/mi,/([^\n]{10,200})(?=\n(?:Teslim|İptal|Müşteri|Sorun))/mi,/([^\n]{10,200})(?=\nToplam\s*Tutar)/mi,/([^\n]{10,200})(?=\n[\s\S]*?TL)/mi];
  const RX_ORDER_15=[/\bSipariş\s*#(\d{5,12})\b/i,/\bSİPARİŞ\s*#(\d{5,12})\b/i,/#\s*(\d{5,12})\b/i,/\bSiparis\s*#(\d{5,12})\b/i,/\bSipariş\s*No[:\s]*#?(\d{5,12})\b/i,/\bSipariş[:\s]*#?(\d{5,12})\b/i,/\bOrder\s*#(\d{5,12})\b/i,/\bSipariş\s*ID[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*Numarası[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*-\s*#?(\d{5,12})\b/i,/\bSIPARIS\s*#(\d{5,12})\b/i,/\bSIPARIS[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*\n\s*#(\d{5,12})\b/i,/(?:^|\n)\s*Sipariş\s*#(\d{5,12})/i,/\b(\d{5,12})\b(?=[\s\S]*?SMM\s*ID:|\s*\n\s*\d{2}\.\d{2}\.\d{4})/i];
  const RX_SMM_15=[/\bSMM\s*ID:\s*(\d{4,12})\b/i,/\bSMMID:\s*(\d{4,12})\b/i,/\bSMM\s*No[:\s]*(\d{4,12})\b/i,/\bSMM\s*#\s*(\d{4,12})\b/i,/\bID:\s*(\d{4,12})\b(?=[\s\S]*?\d{2}\.\d{2}\.\d{4})/i,/\bSMM\s*Kimlik[:\s]*(\d{4,12})\b/i,/\bSMM\s*Numara[:\s]*(\d{4,12})\b/i,/\bSMM\s*[:\s]*(\d{4,12})\b/i,/(?:^|\n)\s*(\d{4,12})\s*(?=\n\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/m,/(?:^|\n)\s*SMM\s*\n\s*ID[:\s]*(\d{4,12})/mi,/\bSMM\s*I[D|d]\s*[:\-]\s*(\d{4,12})\b/i,/\bSMM\s*Id\s*[:\-]\s*(\d{4,12})\b/i,/\bSMM\s*IDENTIFIER[:\s]*(\d{4,12})\b/i,/\bSMM\s*CODE[:\s]*(\d{4,12})\b/i,/\b(\d{4,12})\b(?=[\s\S]*?Toplam\s*Tutar)/i];
  const RX_DATE_15=[/\b(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{1,2}\.\d{1,2}\.\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\b/,/\b(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})\b/,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/m,/\b(\d{2}\.\d{2}\.\d{4})\b(?=[\s\S]*?\bTeslim|\bİptal|\bMüşteri|\bSorun)/i,/\b(\d{2}:\d{2})\b(?=[\s\S]*?Toplam\s*Tutar)/i,/\b(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2})\b/,/\b(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{1,2})\b/,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\s*$/m,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4})\s*$/m,/\b(\d{2}\.\d{2}\.\d{4})\b/,/\b(\d{2}\/\d{2}\/\d{4})\b/,/\b(\d{4}-\d{2}-\d{2})\b/];
  const RX_STATUS_15=[/\bTeslim\s*Edildi\b/i,/\bİptal\s*Edildi\b/i,/\bMüşteriden\s*Onay\s*Bekleniyor\b/i,/\bSorun\s*Bildirildi\b/i,/\bIade\s*Sürecinde\b/i,/\bTeslimat\s*Bekleniyor\b/i,/\bİşlem\s*Sırasında\b/i,/\bBeklemede\b/i,/\bTamamlandı\b/i,/\bBaşarısız\b/i,/\bKısmi\s*Tamamlandı\b/i,/\bGeri\s*Ödeme\b/i,/\bOnay\s*Bekliyor\b/i,/(?:^|\n)([^\n]{3,60})(?=\nToplam\s*Tutar)/mi,/(?:^|\n)\d{2}:\d{2}\n([^\n]{3,60})/mi];
  const RX_AMOUNT_15=[/\bToplam\s*Tutar\s*\n\s*([\d.,]+\s*TL)\b/i,/\bToplam\s*Tutar\s*([\d.,]+\s*TL)\b/i,/\bTutar\s*\n\s*([\d.,]+\s*TL)\b/i,/\bTutar[:\s]*([\d.,]+\s*TL)\b/i,/\bToplam[:\s]*([\d.,]+\s*TL)\b/i,/\bTotal\s*Amount[:\s]*([\d.,]+\s*TL)\b/i,/\bToplam\s*Ücret[:\s]*([\d.,]+\s*TL)\b/i,/\bÜcret[:\s]*([\d.,]+\s*TL)\b/i,/(?:^|\n)\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/m,/\b([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/,/\b([\d]+(?:,[\d]{2})?)\s*TL\b/,/\b([\d]+(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/,/TL\s*([\d.,]+)/i,/([\d.,]+)\s*(?:₺|TL)\b/i,/(?:Toplam\s*Tutar[\s\S]{0,40})\b([\d.,]+\s*(?:₺|TL))\b/i];
  const RX_REMAINING_15=[/\bSorun\s*Bildirildi\s*\(([^)]+)\)/i,/\((\d{1,2}\s*(?:sa|saat)\s*\d{1,2}\s*(?:dk|dakika)\s*kaldı)\)/i,/\((\d{1,2}\s*(?:sa|saat)\s*kaldı)\)/i,/\((\d{1,2}\s*(?:dk|dakika)\s*kaldı)\)/i,/\bKalan\s*Süre[:\s]*([^\n]{1,40})/i,/\bKalan[:\s]*([^\n]{1,40})/i,/\bRemaining[:\s]*([^\n]{1,40})/i,/\bSüre[:\s]*([^\n]{1,40})/i,/\(([^)]*kaldı[^)]*)\)/i,/\b(\d{1,2}\s*sa\s*\d{1,2}\s*dk)\b/i,/\b(\d{1,2}\s*saat\s*\d{1,2}\s*dakika)\b/i,/\b(\d{1,2}\s*saat)\b/i,/\b(\d{1,2}\s*dakika)\b/i,/\b(\d{1,2}\s*dk)\b/i,/\b([0-9]{1,2}:[0-9]{2}\s*kaldı)\b/i];

  const state={rows:[],running:false,shouldStop:false,selectedId:''}; const ui={};
  const byId=(id)=>document.getElementById(id); const toast=(m)=>window.__PatpatUI?.UI?.toast?.(m)||alert(m); const wait=(ms)=>new Promise((r)=>setTimeout(r,ms));
  async function getLocal(k){const x=await chrome.storage.local.get(k); return x[k];} async function setLocal(k,v){await chrome.storage.local.set({[k]:v});}
  function bindOnce(el,ev,key,fn){ if(!el) return; const k=`${key}:${ev}`; if(BOUND.has(k)) return; BOUND.add(k); el.addEventListener(ev,fn); }
  function pickFirstMatch(list,text,group=1){ for(const rx of list){ const m=String(text||'').match(rx); if(m) return (group===2&&m[2])?`${m[1]} ${m[2]}`:(m[group]||m[0]||''); } return ''; }
  function splitBlocks(pageText){ return String(pageText||'').split(/(?=Sipariş\s*#\d+)/i).map((x)=>x.trim()).filter(Boolean); }
  function sanitizeStatus(status=DEFAULT_SCAN_STATUS){ const s=String(status||'').trim().toLowerCase(); return ALLOWED_STATUSES.includes(s)?s:DEFAULT_SCAN_STATUS; }
  function buildPageUrl(baseUrl,page,status=DEFAULT_SCAN_STATUS){ const safeStatus=sanitizeStatus(status); const safePage=Math.max(1,Math.floor(Number(page)||1)); return `${baseUrl}status=${safeStatus}&page=${safePage}`; }
  function todayTR(){ const d=new Date(); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; }
  function validateDate(v){ return /^\d{2}\.\d{2}\.\d{4}$/.test(String(v||'')); }

  const RX_STRICT_DATE_TIME = /\b(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})\b/;
  function parseStrictDateTime(text){
    const m = String(text||'').match(RX_STRICT_DATE_TIME);
    if(!m) return null;
    const iso = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`;
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return null;
    return d;
  }

  function parseComplaintBlock_SIKAYET(block, idx, baseDate){
    const status = pickFirstMatch(RX_STATUS_15, block);
    if(!/Sorun\s*Bildirildi/i.test(status)) return null;
    const title = pickFirstMatch(RX_TITLE_15, block);
    const orderNo = pickFirstMatch(RX_ORDER_15, block);
    const smmId = pickFirstMatch(RX_SMM_15, block);
    const dateTime = pickFirstMatch(RX_DATE_15, block) || `${baseDate} 00:00`;
    const amountText = pickFirstMatch(RX_AMOUNT_15, block);
    const remainingText = pickFirstMatch(RX_REMAINING_15, block);
    const amountValue = Number(String(amountText).replace(/\./g,'').replace(',', '.').replace(/[^\d.]/g,''))||0;
    return { id:`${orderNo||smmId||'x'}-${idx}`, service:title||null, orderNo:orderNo||'', smmId:smmId||'', dateTime, status, remainingText:remainingText||'', amountText, amountValue, raw:block };
  }

  function current(){ return state.rows.find((x)=>x.id===state.selectedId)||null; }
  function render(){ const q=String(ui.search?.value||'').toLowerCase().trim(); const list=state.rows.filter((r)=>!q||[r.service,r.orderNo,r.smmId,r.status].join(' ').toLowerCase().includes(q)); if(ui.list){ ui.list.innerHTML=list.map((r)=>`<div class="item ${r.id===state.selectedId?'active':''}" data-id="${r.id}">${r.smmId||'—'} • ${r.orderNo||'—'} • ${r.status}</div>`).join(''); ui.list.querySelectorAll('[data-id]').forEach((el)=>el.addEventListener('click',()=>{state.selectedId=el.getAttribute('data-id')||''; render();})); }
    if(ui.empty) ui.empty.hidden=list.length>0; if(ui.stats) ui.stats.textContent=`Kayıt: ${list.length} • Durum: ${state.running?'çalışıyor':'hazır'}`;
    const c=current(); if(ui.detail) ui.detail.innerHTML=c?`<b>HİZMET:</b> ${c.service||'—'}<br><b>SİPARİŞ:</b> ${c.orderNo||'—'}<br><b>SMM:</b> ${c.smmId||'—'}<br><b>TARİH:</b> ${c.dateTime||'—'}<br><b>DURUM:</b> ${c.status||'—'}<br><b>KALAN SÜRE:</b> ${c.remainingText||'—'}<br><b>TUTAR:</b> ${c.amountText||'—'}`:'Detay görmek için listeden bir şikayet seçin.';
    if(ui.selStatus&&c) ui.selStatus.value=c.status||'SORUN BİLDİRİLDİ';
  }
  async function saveAndRefresh(){ await setLocal(KEY,state.rows); const x=await getLocal(KEY); state.rows=Array.isArray(x)?x:[]; render(); }

  async function getActiveTabId(){ const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true}); if(!tab?.id) throw new Error('Aktif sekme yok'); return tab.id; }
  async function navigate(tabId,url){ await chrome.tabs.update(tabId,{url}); await new Promise((res)=>{ const l=(id,info)=>{ if(id===tabId&&info.status==='complete'){ chrome.tabs.onUpdated.removeListener(l); res(true);} }; chrome.tabs.onUpdated.addListener(l); }); await wait(220); }
  async function pageText(tabId){ const [{result}] = await chrome.scripting.executeScript({target:{tabId},func:()=>String(document.body.innerText||'')}); return String(result||''); }

  async function scanComplaints(){
    if(state.running) return toast('Tarama zaten çalışıyor');
    const dateVal = String(ui.dateInput?.value||'').trim();
    if(!validateDate(dateVal)) return toast('Tarih GG.AA.YYYY olmalı');
    const days = Math.max(1, Number(ui.daysInput?.value || 7));
    const [dd,mm,yy] = dateVal.split('.').map(Number);
    const today = new Date(yy, (mm||1)-1, dd||1, 23, 59, 59);
    const minDate = new Date(today.getTime() - (days * 24 * 3600 * 1000));

    state.running=true; state.shouldStop=false; console.log('scan start'); render();
    const tabId=await getActiveTabId();
    // zorunlu başlangıç ziyareti
    await navigate(tabId, buildPageUrl(SOLD_BASE_URL,1,DEFAULT_SCAN_STATUS));

    const seen=new Set(state.rows.map((r)=>`${r.orderNo}|${r.smmId}|${r.dateTime}|${r.amountText}`));
    let page=1; let loops=0;
    while(!state.shouldStop && loops<250){
      loops++;
      const url=buildPageUrl(SOLD_BASE_URL,page,DEFAULT_SCAN_STATUS);
      try{
        await navigate(tabId,url);
        const blocks=splitBlocks(await pageText(tabId));
        if(!blocks.length) break;
        let added=0;
        let olderSeen=0;
        for(let i=0;i<blocks.length;i++){
          if(state.shouldStop) break;
          try{
            const rec=parseComplaintBlock_SIKAYET(blocks[i],`${page}-${i}`,dateVal);
            if(!rec) continue;
            const dt = parseStrictDateTime(rec.dateTime);
            if(!dt){ console.error('Tarih parse fail', rec.dateTime); continue; }
            if(dt < minDate){ olderSeen += 1; continue; }
            const key=`${rec.orderNo}|${rec.smmId}|${rec.dateTime}|${rec.amountText}`;
            if(seen.has(key)) continue;
            seen.add(key);
            state.rows.push(rec);
            added++;
          }catch(e){ console.error(`Blok parse hatası url=${url}`,e); }
        }
        await saveAndRefresh();
        if(added===0 && olderSeen>0) break;
        page++;
      } catch(e){ console.error(`Sayfa parse hatası url=${url}`,e); page++; }
    }
    state.running=false; render(); toast(state.shouldStop?'Tarama durdu':`Tarama tamamlandı: ${state.rows.length}`);
  }

  function ensureSelected(){ const c=current(); if(!c){ toast('Önce listeden bir şikayet seçin.'); return null; } return c; }
  function draft(){ const c=ensureSelected(); if(!c) return; if(ui.draft) ui.draft.value=`Merhaba, ${c.orderNo||'siparişiniz'} inceleniyor.`; }
  function solution(){ const c=ensureSelected(); if(!c) return; if(ui.draft) ui.draft.value=`Çözüm: durum ${c.status}, kalan ${c.remainingText||'-'}.`; }
  async function escalate(){ const c=ensureSelected(); if(!c) return; if(!confirm('Eskaleye gönderilsin mi?')) return; c.status='ESKALE'; await saveAndRefresh(); }
  async function closeComplaint(){ const c=ensureSelected(); if(!c) return; if(!confirm('Kapatılsın mı?')) return; c.status='KAPALI'; await saveAndRefresh(); }
  async function saveStatus(){ const c=ensureSelected(); if(!c) return; const prev=c.status; try{ c.status=ui.selStatus?.value||c.status; const copy=JSON.parse(JSON.stringify(state.rows)); await setLocal(KEY,copy); const refresh=await getLocal(KEY); if(!Array.isArray(refresh)) throw new Error('storage fail'); state.rows=refresh; render(); } catch(e){ c.status=prev; render(); toast('Durum kaydı geri alındı.'); } }
  function stop(){ state.shouldStop=true; }

  async function load(){ const x=await getLocal(KEY); state.rows=Array.isArray(x)?x:[]; render(); }
  function bind(){ ui.dateInput=byId('inpComplaintDate'); ui.daysInput=byId('inpComplaintDays'); ui.search=byId('inpComplaintSearch'); ui.stats=byId('complaintStats'); ui.list=byId('complaintsList'); ui.empty=byId('complaintEmpty'); ui.detail=byId('complaintDetail'); ui.selStatus=byId('selComplaintStatus'); ui.draft=byId('complaintDraftText'); if(ui.dateInput&&!ui.dateInput.value) ui.dateInput.value=todayTR(); if(ui.daysInput&&!ui.daysInput.value) ui.daysInput.value='7';
    bindOnce(byId('btnComplaintScan'),'click','scan',()=>scanComplaints().catch((e)=>toast(String(e?.message||e)))); bindOnce(byId('btnComplaintStop'),'click','stop',stop); bindOnce(byId('btnComplaintDraft'),'click','draft',draft); bindOnce(byId('btnComplaintSolution'),'click','sol',solution); bindOnce(byId('btnComplaintEscalate'),'click','esc',()=>escalate().catch(()=>{})); bindOnce(byId('btnComplaintClose'),'click','close',()=>closeComplaint().catch(()=>{})); bindOnce(byId('btnComplaintSaveStatus'),'click','save',()=>saveStatus().catch(()=>{})); bindOnce(ui.search,'input','search',render); render(); }

  const Sikayet={init:async()=>{bind(); await load();},scanComplaints,stopScan:stop,buildPageUrl}; window.Patpat=window.Patpat||{}; window.Patpat.Sikayet=Sikayet; if(document.body?.dataset?.page==='sidepanel'||byId('btnComplaintScan')) Sikayet.init();
})();
