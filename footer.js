(() => {
  if (typeof window === 'undefined') return;

  const byId = (id) => document.getElementById(id);

  async function importFooterHtml() {
    const host = byId('footerAiSection');
    if (!host || host.children.length) return;

    const src = host.getAttribute('data-footer-import') || 'footer.html';
    try {
      const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL(src)
        : src;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`footer import failed: ${res.status}`);
      host.innerHTML = await res.text();
    } catch (err) {
      console.error('[footer] import error', err);
      host.innerHTML = '<div class="hint">Footer import yüklenemedi.</div>';
    }
  }

  function syncAiButtons() {
    const hasModel = Boolean(byId('modelSelect')?.value);
    ['btnAiAnalyze', 'btnAiPreviewPatch', 'btnAiApplyPatch', 'btnAiCopy', 'btnUseSelection', 'btnUseWholeFile']
      .forEach((id) => {
        const el = byId(id);
        if (el) el.disabled = !hasModel;
      });
    const hint = byId('aiResultHint');
    if (hint && !hasModel) hint.textContent = 'Henüz öneri yok. Model seçip “AI ile Analiz Et”e bas.';
  }

  async function initFooter() {
    await importFooterHtml();
    const model = byId('modelSelect');
    if (model) model.addEventListener('change', syncAiButtons);
    syncAiButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initFooter().catch(console.error); }, { once: true });
  } else {
    initFooter().catch(console.error);
  }
})();
