(() => {
  if (typeof window === 'undefined') return;
  if (window.__RAKIP_INIT__) return;
  window.__RAKIP_INIT__ = true;
  'use strict';

  const BASE_URL = 'https://hesap.com.tr/p';
  const SOLD_BASE_URL = 'https://hesap.com.tr/p/sattigim-ilanlar';
  const BOUND = new Set();

  const RX_TITLE_15 = [/^([^\n]{10,200})\n(?=[\s\S]*?\bSipariş\s*#\d+)/mi,/^([^\n]{10,200})\n[^\n]{0,200}\n\s*Sipariş\s*#\d+/mi,/(?:^|\n)([^\n]{10,200})\n(?:\1|\s*[^\n]{10,200})\n\s*Sipariş\s*#\d+/mi,/([^\n]{10,200})\s*\n\s*Sipariş\s*#\d+/mi,/([^\n]{10,200})\s*(?=\s*\n\s*\n\s*Sipariş\s*#\d+)/mi,/([^\n]{10,200})\s*\n\s*\n\s*Sipariş\s*#\d+/mi,/([A-ZÇĞİÖŞÜ0-9][^\n]{8,200})\n(?=Sipariş\s*#\d+)/m,/(?:YOUTUBE|TİKTOK|TikTok|Instagram|INSTAGRAM)\b[^\n]{5,200}/m,/^(.*(?:Beğeni|Takipçi|İzlenme|Yorum|Kaydet)[^\n]{0,160})$/mi,/^(.{10,200})$/m,/([^\n]{10,200})(?=\nSMM\s*ID:)/mi,/([^\n]{10,200})(?=\n\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/mi,/([^\n]{10,200})(?=\n(?:Teslim|İptal|Müşteri|Sorun))/mi,/([^\n]{10,200})(?=\nToplam\s*Tutar)/mi,/([^\n]{10,200})(?=\n[\s\S]*?TL)/mi];
  const RX_ORDER_15=[/\bSipariş\s*#(\d{5,12})\b/i,/\bSİPARİŞ\s*#(\d{5,12})\b/i,/#\s*(\d{5,12})\b/i,/\bSiparis\s*#(\d{5,12})\b/i,/\bSipariş\s*No[:\s]*#?(\d{5,12})\b/i,/\bSipariş[:\s]*#?(\d{5,12})\b/i,/\bOrder\s*#(\d{5,12})\b/i,/\bSipariş\s*ID[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*Numarası[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*-\s*#?(\d{5,12})\b/i,/\bSIPARIS\s*#(\d{5,12})\b/i,/\bSIPARIS[:\s]*#?(\d{5,12})\b/i,/\bSipariş\s*\n\s*#(\d{5,12})\b/i,/(?:^|\n)\s*Sipariş\s*#(\d{5,12})/i,/\b(\d{5,12})\b(?=[\s\S]*?SMM\s*ID:|\s*\n\s*\d{2}\.\d{2}\.\d{4})/i];
  const RX_SMM_15=[/\bSMM\s*ID:\s*(\d{4,12})\b/i,/\bSMMID:\s*(\d{4,12})\b/i,/\bSMM\s*No[:\s]*(\d{4,12})\b/i,/\bSMM\s*#\s*(\d{4,12})\b/i,/\bID:\s*(\d{4,12})\b(?=[\s\S]*?\d{2}\.\d{2}\.\d{4})/i,/\bSMM\s*Kimlik[:\s]*(\d{4,12})\b/i,/\bSMM\s*Numara[:\s]*(\d{4,12})\b/i,/\bSMM\s*[:\s]*(\d{4,12})\b/i,/(?:^|\n)\s*(\d{4,12})\s*(?=\n\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/m,/(?:^|\n)\s*SMM\s*\n\s*ID[:\s]*(\d{4,12})/mi,/\bSMM\s*I[D|d]\s*[:\-]\s*(\d{4,12})\b/i,/\bSMM\s*Id\s*[:\-]\s*(\d{4,12})\b/i,/\bSMM\s*IDENTIFIER[:\s]*(\d{4,12})\b/i,/\bSMM\s*CODE[:\s]*(\d{4,12})\b/i,/\b(\d{4,12})\b(?=[\s\S]*?Toplam\s*Tutar)/i];
  const RX_DATE_15=[/\b(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{1,2}\.\d{1,2}\.\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\b/,/\b(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\b/,/\b(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})\b/,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/m,/\b(\d{2}\.\d{2}\.\d{4})\b(?=[\s\S]*?\bTeslim|\bİptal|\bMüşteri|\bSorun)/i,/\b(\d{2}:\d{2})\b(?=[\s\S]*?Toplam\s*Tutar)/i,/\b(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2})\b/,/\b(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{1,2})\b/,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\s*$/m,/(?:^|\n)\s*(\d{2}\.\d{2}\.\d{4})\s*$/m,/\b(\d{2}\.\d{2}\.\d{4})\b/,/\b(\d{2}\/\d{2}\/\d{4})\b/,/\b(\d{4}-\d{2}-\d{2})\b/];
  const RX_STATUS_15=[/\bTeslim\s*Edildi\b/i,/\bİptal\s*Edildi\b/i,/\bMüşteriden\s*Onay\s*Bekleniyor\b/i,/\bSorun\s*Bildirildi\b/i,/\bIade\s*Sürecinde\b/i,/\bTeslimat\s*Bekleniyor\b/i,/\bİşlem\s*Sırasında\b/i,/\bBeklemede\b/i,/\bTamamlandı\b/i,/\bBaşarısız\b/i,/\bKısmi\s*Tamamlandı\b/i,/\bGeri\s*Ödeme\b/i,/\bOnay\s*Bekliyor\b/i,/(?:^|\n)([^\n]{3,60})(?=\nToplam\s*Tutar)/mi,/(?:^|\n)\d{2}:\d{2}\n([^\n]{3,60})/mi];
  const RX_AMOUNT_15=[/\bToplam\s*Tutar\s*\n\s*([\d.,]+\s*TL)\b/i,/\bToplam\s*Tutar\s*([\d.,]+\s*TL)\b/i,/\bTutar\s*\n\s*([\d.,]+\s*TL)\b/i,/\bTutar[:\s]*([\d.,]+\s*TL)\b/i,/\bToplam[:\s]*([\d.,]+\s*TL)\b/i,/\bTotal\s*Amount[:\s]*([\d.,]+\s*TL)\b/i,/\bToplam\s*Ücret[:\s]*([\d.,]+\s*TL)\b/i,/\bÜcret[:\s]*([\d.,]+\s*TL)\b/i,/(?:^|\n)\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/m,/\b([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/,/\b([\d]+(?:,[\d]{2})?)\s*TL\b/,/\b([\d]+(?:\.[\d]{3})*(?:,[\d]{2})?)\s*TL\b/,/TL\s*([\d.,]+)/i,/([\d.,]+)\s*(?:₺|TL)\b/i,/(?:Toplam\s*Tutar[\s\S]{0,40})\b([\d.,]+\s*(?:₺|TL))\b/i];
  const RX_PLATFORM_15=[/\bTik\s*Tok\b/i,/\bTİKTOK\b/i,/\btiktok\b/i,/\bInstagram\b/i,/\bINSTAGRAM\b/i,/\binstagram\b/i,/\bYou\s*Tube\b/i,/\bYouTube\b/i,/\bYOUTUBE\b/i,/\byoutube\b/i,/\bTwitter\b/i,/\bTWITTER\b/i,/\bX\s*\(Twitter\)\b|\bTwitter\s*\(X\)\b/i,/\bFacebook\b/i,/\bTwitch\b/i];
  const RX_SERVICE_TYPE_15=[/\bTakipçi\b/i,/\bBeğeni\b/i,/\bİzlenme\b/i,/\bYorum\b/i,/\bKaydet\b/i,/\bPaylaş\b/i,/\bAbone\b/i,/\bReels\b/i,/\bHikaye\b/i,/\bCanlı\b/i,/\bJeton\b/i,/\bGörüntülenme\b/i,/\bKeşfet\b/i,/\bAlgoritma\b/i,/\bService\b|\bServis\b/i];

  const state={rows:[],hashes:new Set(),dropped:0,running:false,shouldStop:false,pageCounts:{}}; const ui={};
  const byId=(id)=>document.getElementById(id); const toast=(m)=>window.__PatpatUI?.UI?.toast?.(m)||alert(m); const wait=(ms)=>new Promise((r)=>setTimeout(r,ms));
  function bindOnce(el,ev,key,fn){ if(!el)return; const k=`${key}:${ev}`; if(BOUND.has(k)) return; BOUND.add(k); el.addEventListener(ev,fn);} function pickFirstMatch(list,text,g=1){ for(const rx of list){ const m=String(text||'').match(rx); if(m) return g===2&&m[2]?`${m[1]} ${m[2]}`:(m[g]||m[0]||''); } return ''; }
  function splitBlocks(pageText){ return String(pageText||'').split(/(?=Sipariş\s*#\d+)/i).map((x)=>x.trim()).filter(Boolean); }
  function buildPageUrl(base,page){ return `${base}?page=${page}`; }
  function speedDelayMs(){ const n=Math.max(1,Math.min(100,Number(ui.inpSpeed?.value||3))); return Math.max(30,Math.round(1600/n)); }
  async function hashRow(r){ const src=`${r.platform}|${r.ilanBasligi}|${r.hizmet}|${r.magaza}|${r.garanti}|${r.fiyat}|${r.reklam}`; const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(src)); return Array.from(new Uint8Array(d)).map((b)=>b.toString(16).padStart(2,'0')).join(''); }
  function statusLine(t){ if(ui.statusLine) ui.statusLine.textContent=`Durum: ${t}`; }
  function updateStats(){ const pages=Object.keys(state.pageCounts).sort((a,b)=>a-b).map((k)=>`p${k}:${state.pageCounts[k]}`).join(' | '); if(ui.stats) ui.stats.textContent=`Toplam bulunan: ${state.rows.length} • Dedup atılan: ${state.dropped} • Sayfa başına: ${pages||'—'}`; if(ui.empty) ui.empty.hidden=state.rows.length>0; }
  function appendRow(r){ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.platform||''}</td><td>${r.ilanBasligi||''}</td><td>${r.hizmet||''}</td><td>${r.magaza||''}</td><td>${r.garanti||''}</td><td>${r.fiyat??''}</td><td>${r.reklam||''}</td>`; ui.tblBody?.appendChild(tr); }

  function parseSoldBlock_RAKIP(block){ const title=pickFirstMatch(RX_TITLE_15,block); return { platform: pickFirstMatch(RX_PLATFORM_15,title), ilanBasligi:title||null, hizmet:pickFirstMatch(RX_SERVICE_TYPE_15,title)||null, magaza:null, garanti:null, fiyat:(()=>{const t=pickFirstMatch(RX_AMOUNT_15,block); return Number(String(t).replace(/\./g,'').replace(',', '.').replace(/[^\d.]/g,''))||null;})(), reklam:pickFirstMatch(RX_STATUS_15,block)||null, orderNo:pickFirstMatch(RX_ORDER_15,block), smmId:pickFirstMatch(RX_SMM_15,block), dateTime:pickFirstMatch(RX_DATE_15,block), amountTl:pickFirstMatch(RX_AMOUNT_15,block), status:pickFirstMatch(RX_STATUS_15,block) };
  }

  async function getActiveTabId(){ const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true}); if(!tab?.id) throw new Error('Aktif sekme yok'); return tab.id; }
  async function navigate(tabId,url){ await chrome.tabs.update(tabId,{url}); await new Promise((res)=>{ const l=(id,info)=>{ if(id===tabId&&info.status==='complete'){ chrome.tabs.onUpdated.removeListener(l); res(true);} }; chrome.tabs.onUpdated.addListener(l);}); await wait(speedDelayMs()); }
  async function pageText(tabId){ const [{result}] = await chrome.scripting.executeScript({target:{tabId},func:()=>String(document.body.innerText||'')}); return String(result||''); }

  async function startScan(){
    if(state.running) return;
    const platform=String(ui.selPlatform?.value||'').trim(); if(!platform) return toast('Önce platform seç');
    const minTxt=String(ui.inpQtyMin?.value||'').trim(); const maxTxt=String(ui.inpQtyMax?.value||'').trim(); const min=minTxt?Number(minTxt):null; const max=maxTxt?Number(maxTxt):null; if((minTxt&&(!Number.isFinite(min)||min<0))||(maxTxt&&(!Number.isFinite(max)||max<0))||(min!=null&&max!=null&&min>max)) return toast('Min/Max adet geçersiz');
    const maxPage=Math.max(1,Number(ui.inpPage?.value||1));
    state.running=true; state.shouldStop=false; state.pageCounts={}; statusLine('çalışıyor');
    const tabId=await getActiveTabId();
    for(let page=1; page<=maxPage; page++){
      if(state.shouldStop) break;
      const soldMode = true;
      const url = soldMode ? buildPageUrl(SOLD_BASE_URL,page) : buildPageUrl(`${BASE_URL}/${platform}`,page);
      try {
        await navigate(tabId,url);
        const blocks = splitBlocks(await pageText(tabId));
        state.pageCounts[page] = blocks.length;
        if(blocks.length<40){ console.warn('selector/parse bozuldu olabilir',url,blocks.length,String((await pageText(tabId))).slice(0,2048)); toast('selector/parse bozuldu olabilir'); }
        if(!blocks.length){ console.warn('site DOM değişti',url,String((await pageText(tabId))).slice(0,2048)); }
        for(let i=0;i<blocks.length;i++){
          if(state.shouldStop) break;
          try{ const row=parseSoldBlock_RAKIP(blocks[i]); const h=await hashRow(row); if(state.hashes.has(h)){state.dropped++; continue;} state.hashes.add(h); state.rows.push(row); appendRow(row);}catch(e){ console.error(`listing parse page=${page} idx=${i} selector=block`,e); }
        }
      } catch(e){ console.error('page fetch/parse',url,e); }
      updateStats();
    }
    state.running=false; statusLine(state.shouldStop?'durdu':'hazır');
  }

  function stop(){ state.shouldStop=true; statusLine('durduruluyor'); }
  function clear(){ state.rows=[]; state.hashes.clear(); state.dropped=0; state.pageCounts={}; if(ui.tblBody) ui.tblBody.innerHTML=''; updateStats(); statusLine('hazır'); }
  function dl(n,t,m){ const b=new Blob([t],{type:m}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u;a.download=n;a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000);} function exportJson(){dl(`rakip_${Date.now()}.json`,JSON.stringify(state.rows,null,2),'application/json');} function exportCsv(){const cols=['platform','ilanBasligi','hizmet','magaza','garanti','fiyat','reklam']; const esc=(v)=>`"${String(v??'').replace(/"/g,'""')}"`; const lines=[cols.join(',')].concat(state.rows.map((r)=>cols.map((k)=>esc(r[k])).join(','))); dl(`rakip_${Date.now()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8');}
  function testRegex(){ try{ const t=String(ui.regexInput?.value||'').trim(); if(!t){ if(ui.regexPreview) ui.regexPreview.textContent='Regex boş'; return; } const rx=new RegExp(t,'i'); const s=state.rows[0]?.ilanBasligi||'örnek'; if(ui.regexPreview) ui.regexPreview.textContent=rx.test(s)?'Regex eşleşti':'Regex eşleşmedi'; }catch(e){ if(ui.regexPreview) ui.regexPreview.textContent=`Regex hatası: ${String(e?.message||e)}`; toast('Geçersiz regex'); }}
  function toggleFullscreen(){ (byId('rakipRoot')||document.body).classList.toggle('rakip-fullscreen'); }

  function bind(){ ui.selPlatform=byId('selPlatform'); ui.inpQtyMin=byId('inpQtyMin'); ui.inpQtyMax=byId('inpQtyMax'); ui.inpPage=byId('inpRakipPageCount'); ui.inpSpeed=byId('inpScanSpeed'); ui.tblBody=byId('tblRakipBody'); ui.stats=byId('rakipStats'); ui.empty=byId('marketEmpty'); ui.statusLine=byId('rakipStatusLine'); ui.regexInput=byId('inpRakipRegex'); ui.regexPreview=byId('rakipRegexPreview');
    bindOnce(byId('btnRakipStart'),'click','start',()=>startScan().catch((e)=>toast(String(e?.message||e)))); bindOnce(byId('btnRakipStop'),'click','stop',stop); bindOnce(byId('btnRakipClear'),'click','clear',clear); bindOnce(byId('btnRakipCopyMd'),'click','md',()=>{}); bindOnce(byId('btnRakipExportJson'),'click','json',exportJson); bindOnce(byId('btnRakipExportCsv'),'click','csv',exportCsv); bindOnce(byId('btnRakipRegexTest'),'click','regex',testRegex); bindOnce(byId('btnRakipRegexPanel'),'click','regex2',testRegex); bindOnce(byId('btnRakipFullscreen'),'click','full',toggleFullscreen); updateStats(); statusLine('hazır'); }

  const Rakip={init:bind,startScan,stopScan:stop,clearTable:clear,exportJson,exportCsv,buildPageUrl,hashRow,speedDelayMs}; window.Patpat=window.Patpat||{}; window.Patpat.Rakip=Rakip; if(document.body?.dataset?.page==='sidepanel'||byId('btnRakipStart')) Rakip.init();
})();
