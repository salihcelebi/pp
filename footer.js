(() => {
  if (typeof window === 'undefined') return;

  const byId = (id) => document.getElementById(id);

  async function importFooterHtml() {
    const host = byId('footerAiSection');
    if (!host || host.children.length) return;

    const src = host.getAttribute('data-footer-import') || 'footer.html';
    const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL(src)
      : src;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`footer import failed: ${res.status}`);
    host.innerHTML = await res.text();
  }

  function syncAiButtons() {
    const hasModel = Boolean(byId('modelSelect')?.value);
    ['btnAiAnalyze', 'btnAiPreviewPatch', 'btnAiApplyPatch', 'btnAiCopy', 'btnUseSelection', 'btnUseWholeFile']
      .forEach((id) => {
        const el = byId(id);
        if (el) el.disabled = !hasModel;
      });

    const hint = byId('aiResultHint');
    if (hint && !hasModel) {
      hint.textContent = 'Henüz öneri yok. Model seçip “AI ile Analiz Et”e bas.';
    }
  }

  async function initFooter() {
    const host = byId('footerAiSection');
    if (!host) return;

    try {
      await importFooterHtml();
      const model = byId('modelSelect');
      if (model) model.addEventListener('change', syncAiButtons);
      syncAiButtons();
      host.setAttribute('data-footer-ready', '1');
      window.dispatchEvent(new CustomEvent('patpat:footer-ready'));
    } catch (err) {
      console.error('[footer] import error', err);
      host.innerHTML = '<div class="hint">Footer yüklenemedi.</div>';
      host.setAttribute('data-footer-ready', '0');
      throw err;
    }
  }

  window.__patpatFooterReady = (async () => {
    if (document.readyState === 'loading') {
      await new Promise((resolve) => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }
    await initFooter();
  })();
})();
