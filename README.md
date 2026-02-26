

# Patpat Ajan (Chrome Extension, Manifest V3)

> **Koddan doğrulanan ad:** `Patpat Ajan` (`manifest.json`)  
> **Sürüm:** `0.2.1` (`manifest.json`)  
> **Açıklama:** “Dosya tabanlı tarama, senkron ve yan panel yönetimi.” (`manifest.json`)

Bu repo, Chrome **Side Panel** tabanlı bir eklenti gibi çalışır: popup’tan yan panel açılır, yan panelde birden fazla “sekme/feature” ekranı bulunur; arka planda MV3 **Service Worker** (`sw.js`) çalışır; hedef sitelerde **content script** olarak `bundle.js` enjekte edilir (`manifest.json`).

---

## A) Proje Özeti

### Eklenti ne yapıyor? (koddan anlaşıldığı kadarıyla)
- **Yan panel üzerinden yönetilen** bir tarama/otomasyon aracı (side panel: `sidepanel.html`, background: `sw.js`).
- Hedef siteler üzerinde tarama/işlem yapmak için:
  - **Content script** (`bundle.js`) enjekte ediyor (`manifest.json -> content_scripts`).
  - Ayrıca bazı sayfalarda **chrome.scripting.executeScript** ile aktif sekmede metin/DOM çıkarımı yapıyor (ör. `siparis.js`, `rakip.js`, `sikayet.js`, `smm.js`, `ss.js` içinde `chrome.scripting` kullanımı).

### Temel özellikler (kanıtlı)
- **Popup → Side Panel açma**: `popup.html` + `bundle.js` içindeki `popup.js` modülü (“Yan Paneli Aç” launcher)  
- **Ayarlar sayfası**: `options.html` + `bundle.js` içindeki `options.js` modülü, tek bir ayar anahtarı `patpat_settings` altında saklanır (kodda `chrome.storage.*` anahtarı olarak sadece bu bulundu).
- **Service Worker ile iş yönetimi**:  
  - Yan panel ile `chrome.runtime.onConnect` port’u üzerinden canlı log/progress paylaşımı (`sw.js`, port adı: `patpat_sidepanel`).
  - Worker tab (active:false) açıp tarama komutu iletme (`sw.js` yorum amaç bölümü).
  - Offline queue + webhook senkron (Google Apps Script endpoint’i) (`sw.js` içinde `webhookUrl` sabiti).
- **Hedef domain izinleri**: `hesap.com.tr`, `anabayiniz.com`, `script.google.com` (`manifest.json`).

### Kullanım senaryoları (kanıtlı / sınırlı)
- `hesap.com.tr` ve `anabayiniz.com` üzerindeki belirli sayfalarda tarama/çıkarım yapmak (`manifest.json` match patternleri).
- Yan panelde “orders/complaints/market/files/reports/rules/system” gibi sekmelerle yönetim arayüzü var (`sidepanel.html` içinde `data-tab="..."` değerleri).

> **Bilinmiyor / Kodda bulunamadı:** “hangi veriler kesin olarak nereye yazılıyor / hangi rapor formatı kesin çıkıyor” gibi iş kuralları; çünkü bazı parsing/çıktı formatları çok sayıda helper + UI akışına dağıtılmış.

---

## B) Hızlı Kurulum

### Chrome’da “Load unpacked” ile kurulum
1. ZIP’i açın, **`manifest.json` bulunan klasörü** seçin (bu projede kök: `pp/`).
2. Chrome → `chrome://extensions`
3. Sağ üst “Developer mode” açın.
4. “Load unpacked” → `pp/` klasörünü seçin.
5. Eklenti ikonuna tıklayın → popup açılır → **Yan Paneli Aç**.

### Geliştirme sırasında reload akışı
- `manifest.json`, `sw.js`, `bundle.js` veya herhangi bir sayfayı değiştirince:
  - `chrome://extensions` → eklentide “Reload”
  - Side panel açıksa kapatıp yeniden açmak gerekebilir (MV3 SW ve sidePanel davranışı).

### Build/pack adımları
- Repo içinde **birleştirilmiş bir çıktı dosyası** var: `bundle.js` başında “generated local unified bundle…” yorumu bulunuyor.
- Kod içinde “bundle üretimi”ni çalıştıran bir npm script / build config **bulunamadı**.
- `pp.zip` dosyası repoda var ama manifest tarafından kullanılmıyor.  
- `icon.bat` yalnızca ikonları `icons/` klasörüne taşımak için (Windows path hardcode).

> **TODO / Bilinmiyor:** `bundle.js` hangi kaynaklardan/komutla üretiliyor? (Kodda build script yok.)

---

## C) Mimari Genel Bakış

### Manifest rolü (`manifest.json`)
- MV3 eklenti tanımı + izinler + hangi sayfada hangi script çalışacak.
- Popup: `popup.html`
- Side panel: `sidepanel.html`
- Background service worker: `sw.js`
- Content script: hedef domainlerde `bundle.js`

### Service Worker (`sw.js`) rolü
`sw.js` üst yorumuna göre:
- Sidepanel ile port üzerinden log/progress paylaşımı
- Worker tab ile hedef sayfalarda tarama komutu çalıştırma
- Offline queue + webhook senkron
- STOP/iptal mekanizması

### Popup / Sidepanel / Options akışı
- **Popup (`popup.html`)**: “Yan Paneli Aç” ve “Ayarlar” butonları (`bundle.js` içindeki `popup.js`).
- **Sidepanel (`sidepanel.html`)**: çok sekmeli ana UI. Sayfa ayrıca şu scriptleri yükler:
  - `https://js.puter.com/v2/` (3. parti)
  - `rakip.js`, `siparis.js`, `smm.js`, `sikayet.js`, `footer.js`, `bundle.js`
- **Options (`options.html`)**: ayar formu (`bundle.js` içindeki `options.js`).

### Content script var mı?
Evet. `manifest.json` içinde iki ayrı content script kuralı var:
- `https://*.hesap.com.tr/ilanlar/*` ve `.../p/sattigim-ilanlar*` → `bundle.js`
- `https://*.anabayiniz.com/orders*` → `bundle.js`

### Mesajlaşma / Storage / Permissions (koddan)
- Storage:
  - `chrome.storage.local`/`sync` anahtarlarında **kodda görülen tek anahtar:** `patpat_settings`
- Runtime messaging (sendMessage/onMessage):
  - `sw.js` `chrome.runtime.onMessage` ile şu `type` değerlerini işliyor:
    - `content_ready`, `content_log`, `crawl_progress`, `crawl_result`
    - `ui_stop`, `ui_clear_ui_state`, `ui_test_integration`
    - `ui_start_scan_hesap`, `ui_start_scan_smm`, `ui_sync_now`, `ui_market_start`
    - `rule_approval`
- Port (runtime.connect):
  - `port.name === "patpat_sidepanel"` ise sidepanel bağlı kabul ediliyor.
- Permissions (`manifest.json`):
  - `storage`, `unlimitedStorage`, `sidePanel`, `tabs`, `scripting`

### Veri akışı diyagramı (mermaid)

```mermaid id="gf7doa"
flowchart LR
  UI[sidepanel.html<br/>+ rakip.js/siparis.js/smm.js/sikayet.js/footer.js/bundle.js]
  POP[popup.html<br/>+ bundle.js(popup.js)]
  OPT[options.html<br/>+ bundle.js(options.js)]
  SW[sw.js<br/>Service Worker]
  CS[bundle.js<br/>Content Script (target sites)]
  SITE1[hesap.com.tr]
  SITE2[anabayiniz.com]
  GAS[script.google.com<br/>Apps Script webhook]

  POP -->|chrome.sidePanel.open| UI
  UI <-->|port: patpat_sidepanel<br/>log/progress| SW
  UI -->|chrome.runtime.sendMessage<br/>ui_*| SW
  SW -->|worker tab + ensure content| CS
  CS -->|sendMessage: crawl_progress/result| SW
  CS <-->|DOM/Fetch (site context)| SITE1
  CS <-->|DOM/Fetch (site context)| SITE2
  SW -->|fetch webhookUrl| GAS
  OPT -->|storage patpat_settings| SW
````

---

## D) Dizin ve Dosya Haritası

```text id="uezrd0"
pp/
  manifest.json              # MV3 tanımı: izinler, popup, sidepanel, SW, content_scripts
  sw.js                      # MV3 service worker: job/queue, port log, messaging, sync
  bundle.js                  # Birleştirilmiş çıktı: UI shared + sidepanel + content + popup + options + AI
  popup.html                 # Eklenti popup UI (Yan panel aç / ayarlar)
  sidepanel.html             # Yan panel ana UI (çok sekme)
  options.html               # Ayarlar UI (patpat_settings)
  footer.html                # Sidepanel AI/footer UI parçası (fetch ile içeri alınır)
  footer.js                  # footer.html’i içe alır, AI butonlarını enable/disable eder
  siparis.html               # Standalone “Sipariş” sayfası UI
  siparis.js                 # Sipariş tarama/çıkarım: executeScript + tablo/export
  sikayet.html               # Standalone “Şikayet” sayfası UI
  sikayet.js                 # Şikayet tarama/aksiyon: close/escalate/draft
  rakip.html                 # Standalone “Rakip” sayfası UI
  rakip.js                   # Rakip tarama/regex/çıkarım + export
  smm.html                   # Standalone SMM sayfası UI (minimal)
  smm.js                     # SMM order tarama + filtre + stats
  ss.html                    # Sidepanel benzeri bir sayfa (body data-page="sidepanel")
  ss.js                      # Büyük “super” script: platform tespit, url builder, complaint actions, draft
  icons/*.png                # Eklenti ikonları
  icon.bat                   # İkonları icons/ klasörüne taşıyan yardımcı script (Windows)
  MASTER_PROMPT_7_TAB_UI.md  # UI sekme spesifikasyonu dokümanı (kod değil)
  pp.zip                     # Paket dosyası (manifestte kullanılmıyor)
  README.md                  # (Eski/var olan) README — bu dosya yeniden üretiliyor
```

---

## E) Dosya Bazlı Detay Dokümantasyon (Ana Kısım)

> Not: `bundle.js` bir “unified bundle” çıktısı (başındaki yorum + “BEGIN ...” blokları). **Fonksiyon sayısı çok yüksek** olduğu için bu dosyada “tek tek tüm fonksiyonlar” yerine **modül bazlı** dokümantasyon yapıldı (talimattaki “bundle.js istisnası”na göre).

---

### `manifest.json`

* **Amaç:** Eklentiyi MV3 olarak tanımlar; popup, sidepanel, SW, content script ve izinleri kurar.
* **Ne Zaman Çalışır:** Chrome eklenti yüklenince.
* **Bağımlılıklar:** `sw.js`, `popup.html`, `sidepanel.html`, `options.html`, `bundle.js`
* **Güvenlik/İzinler (kanıtlı):**

  * `permissions`: `storage`, `unlimitedStorage`, `sidePanel`, `tabs`, `scripting`
  * `host_permissions`: `https://hesap.com.tr/*`, `https://*.hesap.com.tr/*`, `https://anabayiniz.com/*`, `https://*.anabayiniz.com/*`, `https://script.google.com/*`
* **content_scripts (kanıtlı):**

  * hesap.com.tr ilanlar ve sattigim-ilanlar sayfalarında `bundle.js`
  * anabayiniz orders sayfalarında `bundle.js`

#### Manifest Analizi (Zorunlu)

* `manifest_version`: `3`
* `name`: `Patpat Ajan`
* `version`: `0.2.1`
* `description`: “Dosya tabanlı tarama, senkron ve yan panel yönetimi.”
* `permissions`: yukarıdaki liste
* `host_permissions`: yukarıdaki liste
* `action`: `default_popup: popup.html`
* `background.service_worker`: `sw.js`
* `side_panel.default_path`: `sidepanel.html`
* `options_ui.page`: `options.html` (tab’da açılır: `open_in_tab: true`)
* `content_scripts`: var (2 kural)
* `web_accessible_resources`: **Yok**
* `commands`: **Yok**

---

### `sw.js`

* **Amaç:** (dosya üst yorumuna göre) sidepanel port’u, worker tab tarama, offline queue + webhook sync, iptal mekanizması.
* **Ne Zaman Çalışır:** MV3 service worker event döngüsünde; mesaj/port/tab eventleri geldiğinde.
* **Bağımlılıklar:** Chrome APIs (`runtime`, `tabs`, `storage`, vs.), webhook endpoint (Google Apps Script).
* **Dış Kaynaklar (kodda görünen):**

  * `https://script.google.com/macros/s/AKfycbxgsP85wiwCJ_9-p9mpJymE1euSfsQAPiZWiCTURCrucWRtWOKqT7n14NXZs_i1-Qs/exec` (webhookUrl default)
* **Güvenlik/İzinler:** `tabs`, `scripting`, `storage` izinlerine dayanır.

#### Event Listener’lar ve Akış

* `chrome.runtime.onConnect`:

  * `port.name === "patpat_sidepanel"` ise `ports` set’ine ekler, disconnect’te çıkarır.
* `chrome.runtime.onMessage`:

  * `type` alanına göre content’ten gelen progress/result ve UI komutlarını işler.
* `chrome.tabs.onUpdated`:

  * Tab tamamlanma bekleme yardımcılarında kullanılır (waitTabComplete akışı).

#### Storage Keys & Message Contracts

* **Storage Key:**

  * `patpat_settings` (varsayılanları ensure eden akış var).
* **Message Types (sw.js tarafından işlenen):**

  * Content → SW:

    * `content_ready` `{ href? }`
    * `content_log` `{ level?, message? }`
    * `crawl_progress` `{ mode?, progress: { pct?, step? } }`
    * `crawl_result` (payload: **Bilinmiyor / detay handleCrawlResult içinde**)
  * UI → SW:

    * `ui_stop` → tüm işleri iptal eder
    * `ui_clear_ui_state` → UI preview state temizler
    * `ui_test_integration` → “dry run” test döndürür
    * `ui_start_scan_hesap` `{ options? }` → job başlatır
    * `ui_start_scan_smm` `{ options? }` → job başlatır
    * `ui_sync_now` → offline queue flush
    * `ui_market_start` `{ platform?, maxPages? }`
    * `rule_approval` (kural onay/override)

#### Fonksiyonlar (özet, çok sayıda)

Aşağıda `sw.js` içindeki fonksiyonlar **tek tek** listelenmiştir.

> Parametre/return tipleri, satırda açık değilse “Bilinmiyor” olarak işaretlendi.

* `appendPreviewRows(...)` — **Konum:** ~`sw.js:??` — Amaç: UI preview listesine satır ekleme (isimden). **Detay:** Bilinmiyor.
* `broadcast(payload)` — Konum: (dosyada `broadcast` tanımı) — Port’lara mesaj yayma.
* `broadcastProgress(data)` — Konum: (dosyada `broadcastProgress`) — Sidepanel’e progress güncellemesi gönderme.
* `broadcastStatus(level, message)` — Konum: (dosyada `broadcastStatus`) — Sidepanel’e durum/log mesajı.
* `cancelAllJobs()` — Konum: (dosyada `cancelAllJobs`) — Tüm job’ları iptal eder, worker tab’ları temizler.
* `clearUiPreviewState()` — Konum: (dosyada `clearUiPreviewState`) — UI preview state’i temizler.
* `createJob(name)` — Konum: (dosyada `createJob`) — Yeni job kaydı oluşturur.
* `current()` — Konum: (dosyada `current`) — “şu anki state/job” yardımcı getter gibi kullanılıyor (isimden).
* `dedupeRows(rows)` — Konum: (dosyada `dedupeRows`) — Satırları hash/dedup eder (isimden).
* `enqueueOffline(item)` — Konum: (dosyada `enqueueOffline`) — Offline kuyruğa ekler.
* `ensureContentScripts(tabId)` — Konum: (dosyada `ensureContentScripts`) — Tab’da content script hazır mı kontrol/ensure.
* `ensureDefaults()` — Konum: (dosyada `ensureDefaults`) — `patpat_settings` defaultlarını kurar.
* `flushOfflineQueue(jobId)` — Konum: (dosyada `flushOfflineQueue`) — Offline queue’yu webhook’a gönderir.
* `formatErr(e)` — Konum: (dosyada `formatErr`) — Hata formatlama.
* `getLocal(key)` — Konum: (dosyada `getLocal`) — Storage get wrapper.
* `handleCrawlResult(msg, sender)` — Konum: (dosyada `handleCrawlResult`) — Content tarama sonucunu işler.
* `handleRuleApproval(msg)` — Konum: (dosyada `handleRuleApproval`) — Kural onayını işler.
* `instruction(...)` — Konum: (dosyada `instruction`) — İş talimatı/prompt benzeri yapı (isimden).
* `integrationDryRun()` — Konum: (dosyada `integrationDryRun`) — Entegrasyon testini çalıştırır.
* `isCancelled(jobId)` — Konum: ~`sw.js:180` — Job iptal mi?
* `lockOrWait(...)` — **Bilinmiyor / Kodda bulunamadı** (isim listesinde yoksa yoktur)
* `openWorkerTab(jobId, url)` — Konum: (dosyada `openWorkerTab`) — `active:false` tab açar, load bekler.
* `queueCount()` — Konum: (dosyada `queueCount`) — Kuyruk uzunluğu.
* `runMarketJob(jobId, platform, maxPages)` — Konum: (dosyada `runMarketJob`) — Market tarama job’u.
* `runScanJob(jobId, mode, targets, options)` — Konum: (dosyada `runScanJob`) — Hedeflere göre tarama job’u.
* `safeLog(level, message)` — Konum: (dosyada `safeLog`) — Sidepanel’e log + console/log.
* `waitContentReady(tabId, timeoutMs)` — Konum: (dosyada `waitContentReady`) — Content “ready” sinyali bekler.
* `waitTabComplete(tabId)` — Konum: (dosyada `waitTabComplete`) — Tab load tamamlanmasını bekler.
* `...` — Bu dosyada toplam fonksiyon sayısı yüksek; yukarıdaki isimler `sw.js` içindeki function listesinden türetilmiştir. (Detaylar için dosya içinde arama önerilir.)

> **Troubleshooting ipucu (koddan):** Content hazır sinyali beklerken “zaman aşımı” hatası üretilebiliyor:
> `Content script hazır sinyali beklenirken zaman aşımı.` (sw.js içinde).

---

### `bundle.js` (unified bundle)

* **Amaç:** Sidepanel + Popup + Options + Content script için ortak, birleştirilmiş JS.
* **Ne Zaman Çalışır:**

  * Extension sayfalarında: `popup.html`, `sidepanel.html`, `options.html` script olarak yükler.
  * Hedef sitelerde: `manifest.json content_scripts` ile enjekte edilir.
* **Bağımlılıklar:** İçinde 10 modül “BEGIN ...” bloklarıyla gömülü.
* **Dış Kaynaklar:** Bu dosyanın kendisi dış URL kullanmıyor; ancak `sidepanel.html` içinde Puter CDN var.

#### İç Modül Haritası (kanıt: bundle içindeki “BEGIN” blokları)

* `ui-shared.js` — `window.Patpat.Shared` altında ortak yardımcılar (toast/modal/storage wrapper/messaging wrapper).
* `ai-puter.js` — model listesi, prompt paketleme, PII maskeleme, injection guard, patch/diff üretimi.
* `sidepanel.js` — sidepanel UI init, tab/sekme yönetimi, progress/log render, UI→SW mesajları.
* `page-ops.js`, `page-support.js`, `page-tools.js` — sayfa operasyonları/yardımcıları (isimden).
* `content-crawler.js` — content tarafı tarama çekirdeği.
* `content.js` — SW/UI komutlarını alıp crawler’a yönlendiren wrapper; `content_ready` el sıkışması.
* `popup.js` — popup buton akışları.
* `options.js` — ayar formu + import/export/reset.

> **Not:** `bundle.js` kaynak değil “generated bundle” olarak işaretlenmiş. Bu yüzden tek tek tüm fonksiyonlar yerine **modül bazlı** anlatım yapıldı.

---

### `sidepanel.html`

* **Sayfa Amacı:** Chrome Side Panel içinde çok sekmeli ana kontrol paneli.
* **Bağlı Scriptler:**

  * `https://js.puter.com/v2/` (3. parti)
  * `rakip.js`, `siparis.js`, `smm.js`, `sikayet.js`, `footer.js`, `bundle.js`
* **UI Bileşenleri (seçilmiş kritik id’ler):**

  * Global kontrol: `#globalSearch`, `#btnClear`, `#btnStop`
  * Progress: `#progressLabel`, `#jobLabel`, `#progressFill`, `#stepText`, `#queueText`
  * Sipariş tabı: `#selSiparisStatus`, `#inpSiparisMaxPage`, `#inpScanSpeed`, `#btnSiparisStart`, `#btnSiparisStop`, `#tblSiparisBody`
  * Şikayet tabı: `#btnComplaintScan`, `#btnComplaintStop`, `#complaintsList`, `#complaintDetail`
  * Footer/AI: `#footerAiSection` (footer.js bunu doldurur)
* **Kullanıcı Akışı (yüksek seviye):**

  1. Side panel açılır → `bundle.js(sidepanel.js)` init + `rakip/siparis/sikayet/smm` init koşulları çalışır.
  2. Kullanıcı sekme seçer (`data-tab="orders" | "complaints" | ...`) → ilgili panel render edilir.
  3. Kullanıcı “başlat” vb. aksiyonlar → ilgili JS (siparis.js/sikayet.js/...) chrome.scripting ile aktif sekmede veri çıkarır veya SW’ye mesaj/port üzerinden durum alır.
* **Inline script:** Yok (scriptler external).

---

### `popup.html`

* **Sayfa Amacı:** Küçük launcher UI: Yan paneli aç + ayarlara git.
* **UI Bileşenleri:** `#btnOpenPanel`, `#btnOpenOptions`, `#msg`
* **Event akışı (bundle.js / popup.js):**

  * `click #btnOpenPanel` → `chrome.sidePanel.open` denenir; destek yoksa `#msg`’ye açıklama basar.
  * `click #btnOpenOptions` → options sayfası açılır (kodda).

---

### `options.html`

* **Sayfa Amacı:** Ayarları düzenleme (tek storage objesi: `patpat_settings`).
* **UI Bileşenleri (örnek):**

  * AI: `#aiModel`, `#aiMaskPII`, `#aiInjectionGuard`, `#aiAutoSuggest`
  * Retry/backoff: `#retryCount`, `#backoffEnabled`
  * Export/Import/Reset: `#btnExport`, `#btnImport`, `#btnReset`, `#btnSaveAll`
* **Event akışı (bundle.js / options.js):**

  * Save/Reset/Import/Export gibi butonlar storage’a yazar/okur.
* **Bağlı Script:** `bundle.js`

---

### `footer.html`

* **Amaç:** Sidepanel içinde AI footer alanının HTML parçası.
* **Ne Zaman Çalışır:** Doğrudan çalışmaz; `footer.js` bunu fetch edip DOM’a yazar.
* **Bilinmiyor:** İçerik detayları (bu README’de uzun kopya yapılmadı).

---

### `footer.js`

* **Amaç:** `#footerAiSection` içine `footer.html` import eder; AI butonlarını model seçimine göre enable/disable eder.
* **Ne Zaman Çalışır:** Sidepanel’de DOM hazır olunca (DOMContentLoaded bekleyerek).
* **Bağımlılıklar:** `fetch`, `chrome.runtime.getURL` (varsa), DOM id’leri.

#### Fonksiyonlar

* `byId(id)`

  * **Konum:** `footer.js:4`
  * **Amaç:** `document.getElementById` kısayolu.
  * **Parametreler:** `id` — *string* — DOM id
  * **Dönüş:** *Element|null* — Bilinmiyor (DOM’a bağlı)
  * **Yan Etkiler:** Yok
  * **Örnek:** `byId('footerAiSection')` — footer host elementini bulur.

* `importFooterHtml()`

  * **Konum:** `footer.js:6`
  * **Amaç:** `footer.html`’i fetch edip `#footerAiSection` içine yazar.
  * **Parametreler:** Yok
  * **Dönüş:** *Promise<void>* (async)
  * **Yan Etkiler:** DOM günceller; network fetch yapar.
  * **Örnek:** `await importFooterHtml()` — footer parçacığını yükler.

* `syncAiButtons()`

  * **Konum:** `footer.js:20`
  * **Amaç:** Model seçilmemişse AI butonlarını disable eder.
  * **Parametreler:** Yok
  * **Dönüş:** *void*
  * **Yan Etkiler:** DOM’da `disabled` ve hint text değişir.
  * **Örnek:** `syncAiButtons()` — model seçimine göre UI’yı günceller.

* `initFooter()`

  * **Konum:** `footer.js:34`
  * **Amaç:** Footer import + event bind + custom event (`patpat:footer-ready`).
  * **Parametreler:** Yok
  * **Dönüş:** *Promise<void>* (async)
  * **Yan Etkiler:** DOM değişimi, event listener ekleme.
  * **Örnek:** `await initFooter()` — footer’ı başlatır.

#### Event Listener’lar

* `DOMContentLoaded` (gizli bekleme) → `initFooter()`
* `change #modelSelect` → `syncAiButtons()`

---

### `siparis.html`

* **Sayfa Amacı:** “Sipariş” tablosunu standalone sayfada göstermek/çalıştırmak.
* **UI Bileşenleri (kritik):**

  * `#btnSiparisStart`, `#btnSiparisStop`, `#btnSiparisClear`
  * `#btnSiparisCopyMd`, `#btnSiparisExportJson`, `#btnSiparisExportCsv`
  * `#selSiparisStatus`, `#inpSiparisMaxPage`, `#inpScanSpeed`
  * `#tblSiparisBody`, `#ordersEmpty`, `#siparisStats`
* **Bağlı Script:** `siparis.js`
* **Inline script:** Yok

---

### `siparis.js`

* **Amaç:** `hesap.com.tr/p/sattigim-ilanlar` üzerinde sayfa metninden sipariş satırları çıkarmak; tabloya basmak; export/copy sağlamak.
* **Ne Zaman Çalışır:**

  * `document.body.dataset.page === 'sidepanel'` **veya** `#btnSiparisStart` varsa `Siparis.init()` çağrılır (dosya sonunda).
* **Bağımlılıklar:** `chrome.tabs`, `chrome.scripting`, DOM id’leri.
* **Dış Kaynaklar:** `https://hesap.com.tr/p/sattigim-ilanlar` taban URL’leri.
* **Güvenlik/İzinler:** `tabs` + `scripting` izni gerekir.

#### Fonksiyonlar (tek tek)

> Bu dosyada çok sayıda helper var; her biri kısa açıklanmıştır.

* `byId(id)` — **Konum:** (dosyada) — DOM id helper.
* `bindOnce(el, ev, key, fn)` — Konum: ~`siparis.js:42` — Aynı event’i bir kez bağlamak için BOUND set kullanır.
* `bind()` — Konum: (dosyada) — UI elementlerini bulur ve event’leri bağlar.
* `getActiveTabId()` — Konum: (dosyada) — Aktif sekmenin tab id’sini alır.
* `navigate(url)` — Konum: (dosyada) — Aktif sekmeyi hedef URL’e yönlendirir.
* `buildPageUrl(status, page)` — Konum: (dosyada) — Status/page parametreleriyle URL kurar.
* `extractPageText(tabId)` — Konum: (dosyada) — `chrome.scripting.executeScript` ile sayfadan metin çeker.
* `normalizeStatus(x)` — Konum: (dosyada) — Status string normalize eder.
* `normalizeTitleFromLines(lines)` — Konum: (dosyada) — Başlık çıkarımı için metin satırlarını normalize eder.
* `parseMax()` — Konum: (dosyada) — UI’dan max page değerini parse eder.
* `startScan()` — Konum: (dosyada) — Tarama akışını başlatır (sayfalarda gezinerek veri toplar).
* `stopScan()` — Konum: (dosyada) — Tarama akışını durdurur.
* `clearTable()` — Konum: (dosyada) — UI tablosunu temizler.
* `appendRow(row)` — Konum: (dosyada) — Tabloya bir satır ekler.
* `hashRow(row)` — Konum: (dosyada) — Satırı dedup etmek için hash üretir.
* `updateStats(msg?)` — **Bilinmiyor / isimden** — Stats alanını günceller.
* `exportJson()` — Konum: (dosyada) — Tablo verisini JSON indirir.
* `exportCsv()` — Konum: (dosyada) — Tablo verisini CSV indirir.
* `copyTableMarkdown()` — Konum: (dosyada) — Tabloyu Markdown olarak kopyalar.
* `download(name, content, mime)` — Konum: (dosyada) — Dosya indirme helper’ı.
* `esc(s)` / `l(...)` / `log(...)` — Konum: (dosyada) — escape/log helpers.

#### Event Listener’lar (bindOnce üzerinden)

* `click #btnSiparisStart` → `startScan()`
* `click #btnSiparisStop` → `stopScan()`
* `click #btnSiparisClear` → `clearTable()`
* `click #btnSiparisCopyMd` → `copyTableMarkdown()`
* `click #btnSiparisExportJson` → `exportJson()`
* `click #btnSiparisExportCsv` → `exportCsv()`
* `change #inpScanSpeed` → parseSpeed + `updateStats(...)` (kodda inline lambda)

---

### `sikayet.html`

* **Sayfa Amacı:** Şikayet listesi + detay/aksiyon ekranı.
* **UI Bileşenleri (kritik):**

  * Liste: `#complaintsList`, boş durum: `#complaintEmpty`
  * Tarama: `#btnComplaintScan`, durdur: `#btnComplaintStop`
  * Detay: `#complaintDetail`, taslak: `#complaintDraftText`
  * Aksiyonlar: `#btnComplaintClose`, `#btnComplaintEscalate`, `#btnComplaintDraft`, `#btnComplaintSolution`, `#btnComplaintSaveStatus`
* **Bağlı Script:** `sikayet.js`

---

### `sikayet.js`

* **Amaç:** Şikayetleri taramak/filtrelemek ve bazı aksiyonları (kapatma, escalate, draft vb.) çalıştırmak.
* **Ne Zaman Çalışır:** UI mevcutsa init/render akışı.
* **Bağımlılıklar:** `chrome.tabs`, `chrome.scripting`, DOM.
* **Dış Kaynaklar:** (URL builder’lar dosyada) `hesap.com.tr` sayfaları.
* **Event Listener’lar:** `click` (dosyada `addEventListener('click', ...)` bulundu).

#### Fonksiyonlar (seçilmiş, tek tek)

* `byId(id)` — DOM helper.
* `bindOnce(el, ev, key, fn)` — Tek seferlik bind.
* `bind()` — UI event bağlama.
* `getActiveTabId()` — Aktif tab id.
* `navigate(url)` — Aktif tab yönlendirme.
* `pageText(tabId)` — executeScript ile sayfa metni alma.
* `parseComplaintBlock_SIKAYET(text)` — Metinden şikayet bloklarını parse etmeye yönelik.
* `parseStrictDateTime(s)` — Tarih/saat parse helper.
* `render(items)` — Listeyi UI’da render.
* `ensureSelected()` — Seçili öğe state kontrol.
* `current()` — Mevcut şikayet/selection getter (isimden).
* `draft()` — Taslak üretme/çekme (isimden).
* `closeComplaint()` — Şikayeti kapatma aksiyonu.
* `escalate()` — Şikayeti escalate aksiyonu.
* `saveAndRefresh()` — Durumu kaydet + yeniden yükle.
* `load()` — Listeyi yükle.
* `getLocal(key)` — local storage wrapper (isimden).

> **Bilinmiyor:** Şikayet kapatma/escalate işlemi hedef sitede hangi endpoint/UI aksiyonu ile yapılıyor (detaylar code path içinde).

---

### `rakip.html`

* **Sayfa Amacı:** Rakip tarama/analiz UI (regex test, fullscreen, export).
* **UI Bileşenleri (kritik):**

  * Başlat/durdur: `#btnRakipStart`, `#btnRakipStop`
  * Regex: `#inpRakipRegex`, preview: `#rakipRegexPreview`, test: `#btnRakipRegexTest`
  * Sayfa sayısı/limit: `#inpRakipPageCount`, `#inpQtyMin`, `#inpQtyMax`
  * Export: `#btnRakipExportJson`, `#btnRakipExportCsv`, copy: `#btnRakipCopyMd`
* **Bağlı Script:** `rakip.js`

---

### `rakip.js`

* **Amaç:** Rakip sayfalarını gezip metinden bloklar çıkarma; regex ile test/filtre; tablo/export.
* **Ne Zaman Çalışır:** Sidepanel context veya UI elementleri varsa init.
* **Bağımlılıklar:** `chrome.tabs`, `chrome.scripting`, DOM.
* **Dış Kaynaklar:** `hesap.com.tr/ilanlar/...` gibi URL builder’lar.

#### Fonksiyonlar (tek tek, kısa)

* `byId(id)` — DOM helper.
* `bindOnce(el, ev, key, fn)` — Tek seferlik bind.
* `buildPageUrl(p, page)` — Liste sayfası URL üretir.
* `getActiveTabId()` — Aktif tab id.
* `navigate(url)` — Aktif tab yönlendirme.
* `pageText(tabId)` — Sayfa metni alma.
* `parseSoldBlock_RAKIP(text)` — Rakip blok parse.
* `splitBlocks(text)` — Metni bloklara ayırma.
* `pickFirstMatch(regexes, text)` — Regex listesinde ilk match.
* `renderServiceOptions(...)` — UI select vs doldurma.
* `appendRow(row)` — Tabloya satır ekleme.
* `hashRow(row)` — Dedup hash.
* `exportJson()` / `exportCsv()` — Export.
* `dl(...)` — Download helper.
* `esc(s)` — Escape helper.
* `clear()` — UI temizleme.
* `speedDelayMs()` — Hıza göre bekleme süresi.
* `navigate(...)` — URL’e geçiş.
* `l(...)` — Log helper.

---

### `smm.html`

* **Sayfa Amacı:** Standalone SMM UI (dosyada minimal; ana panel `#smmPanel`).
* **Bağlı Script:** `smm.js`

---

### `smm.js`

* **Amaç:** `anabayiniz.com/orders*` üzerinde siparişleri çekip filtrelemek ve tablo/stat göstermek.
* **Ne Zaman Çalışır:** UI varlığında init/start/stop.
* **Bağımlılıklar:** `chrome.tabs`, `chrome.scripting`
* **Dış Kaynaklar (kodda görünen):**

  * `https://anabayiniz.com/orders` + durum sayfaları:

    * `/pending`, `/inprogress`, `/completed`, `/canceled`
    * `orders?search=...`
* **Fonksiyonlar (tek tek, kısa):**

  * `byId(id)` — DOM helper
  * `bindOnce(el, ev, key, fn)` — Tek sefer bind
  * `getActiveTabId()` — aktif tab id
  * `navigate(url)` — yönlendirme
  * `buildOrdersUrl(filters)` — URL üretimi
  * `getFiltersFromUI()` — UI’dan filtre okuma
  * `startScan()` / `stopScan()` — taramayı başlat/durdur
  * `extractRows(text)` — sayfa metninden satır çıkarma
  * `matchesStatusFilter(row, filter)` — filtreleme
  * `appendRow(row)` / `clearTable()` — tablo işlemleri
  * `hashRow(row)` — dedup
  * `updateStats()` — stats güncelleme
  * `wait(ms)` — delay helper
  * `toast(msg)` — kullanıcı mesajı

---

### `ss.html`

* **Sayfa Amacı:** `body data-page="sidepanel"` olduğu için sidepanel benzeri/aynı init koşullarını tetikleyebilen bir sayfa.
* **Bağlı Script:** `ss.js`

---

### `ss.js`

* **Amaç:** Çok amaçlı büyük script: platform tespiti, URL builder’lar, complaint aksiyonları, draft üretimi, seçili içerik kopyalama vb.
* **Ne Zaman Çalışır:** `ss.html` içinde; ayrıca sidepanel dataset’i ile koşullu init olabilir.
* **Bağımlılıklar:** `chrome.tabs`, `chrome.scripting`, DOM.
* **Dış Kaynaklar (kodda görünen):**

  * `hesap.com.tr` profil/mesaj/sattigim-ilanlar URL’leri
  * `anabayiniz.com/orders...` URL’leri

#### Fonksiyonlar (tek tek, kısa; çok sayıda)

> Bu dosyada ~60+ fonksiyon var; aşağıdaki liste isimlerden çıkarılmış kısa amaç cümleleri içerir. Parametre/tip detayları açık değilse “Bilinmiyor”.

* `byId(id)` — DOM helper
* `bind(el, ev, fn)` — Event bind helper
* `detectPlatform()` — Hangi platform/sayfada olunduğunu tespit (isimden)
* `classify(text)` — Metni sınıflandırma (isimden)
* `date(...)` — Tarih helper
* URL builder’lar:

  * `buildProfileUrl(...)`
  * `buildMessageUrl(username)`
  * `buildListPageUrl(p, page)`
  * `buildAnabayiSearchUrl(q)`
  * `buildCozumBildirUrl(...)`
* Draft/yanıt:

  * `buildDraft(...)`
  * `draftReply(...)`
  * `copyDraft()` — Taslağı panoya kopyalama
* Complaint aksiyonları:

  * `closeComplaint(...)`
  * `escalate(...)`
* Sekme içi çalıştırma:

  * `execInTab(tabId, fn, args)` — `chrome.scripting.executeScript` wrapper (isimden)
* Dedup:

  * `buildSeenSet(...)`
  * `buildDedupSmmSet(...)`
* Temizlik/normalize:

  * `cleanService(...)`

> **Bilinmiyor:** `ss.js` hangi “ana akış”la çalışıyor (dosya büyük; entrypoint/koşullu init detayını açmadan kesin konuşmak riskli).

---

### `icon.bat`

* **Amaç:** Belirli bir yerden PNG ikonları `icons/` klasörüne taşır.
* **Ne Zaman Çalışır:** Manuel çalıştırılır (Windows).
* **Güvenlik:** Lokal dosya operasyonu; path hardcode: `C:\Users\salih\Desktop\33\DATDAT\dd\pp`

---

### `MASTER_PROMPT_7_TAB_UI.md`

* **Amaç:** “7 sekme UI spesifikasyonu” dokümanı.
* **Ne Zaman Çalışır:** Çalışmaz; dokümantasyon.
* **Not:** Bu dosya **kod kanıtı değil**; davranış iddiaları için tek başına yeterli değildir.

---

## Sık Karşılaşılan Sorunlar (Troubleshooting)

* **“Yan panel açılmıyor”**

  * Popup tarafında `chrome.sidePanel.open` desteği yoksa kullanıcıya mesaj gösterme akışı var (`bundle.js/popup.js` yorumuna göre).
  * Çözüm: Chrome sürümünüzün Side Panel API’yi desteklediğinden emin olun.

* **“Service worker uyanmıyor / content hazır değil”**

  * `sw.js` içinde content ready beklerken timeout hatası üretilebiliyor (“Content script hazır sinyali beklenirken zaman aşımı.”).
  * Çözüm:

    1. Eklentiyi reload edin.
    2. Hedef tab URL’sinin `manifest.json` match pattern’lerine uyduğunu kontrol edin.
    3. Hedef sitede eklentinin çalışmasına engel CSP/redirect olup olmadığını kontrol edin.

* **“Permission hatası (tabs/scripting)”**

  * Bu proje aktif sekmede `chrome.scripting.executeScript` kullanıyor (siparis/rakip/sikayet/smm/ss).
  * Çözüm: `manifest.json` permissions doğru yüklendi mi? (Reload sonrası kontrol.)

* **“Webhook / senkron çalışmıyor”**

  * `sw.js` içinde default `webhookUrl` Google Apps Script endpoint’i var. Endpoint erişimi/izinleri dış sistem kaynaklı olabilir.
  * Çözüm: Options içinden webhook ayarı var mı (koddan kesin değil) / endpoint loglarını kontrol edin.

---

## Geliştirme Notları

* `bundle.js` içinde modüller “BEGIN …” şeklinde birleştirilmiş; repo içinde build config yok.
  → **Bilinmiyor:** Bu bundle’ı üreten komut/araç.
* Tek bir storage anahtarı kullanma yaklaşımı var: `patpat_settings`.

---

## Roadmap / TODO

* **TODO (kanıtlı):** Kodda `TODO`/`FIXME` etiketi bulunamadı.
* **Önerilen TODO (koddan eksik görünen):**

  * `bundle.js` build sürecini repo içine eklemek (script/config).
  * `ss.js` gibi büyük dosyalar için entrypoint ve modüler ayrım dokümantasyonu.

---

## Lisans

* **Bilinmiyor / Kodda bulunamadı:** Repo içinde `LICENSE` dosyası bulunmuyor.
  Öneri: Kullanım koşullarına göre bir lisans dosyası ekleyin (MIT/Apache-2.0/proprietary vb.).

```
```
