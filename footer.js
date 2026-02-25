(() => {
  if (typeof window === 'undefined') return;
  const byId = (id) => document.getElementById(id);
  function syncAiButtons() {
    const hasModel = Boolean(byId('modelSelect')?.value);
    ['btnAiAnalyze','btnAiPreviewPatch','btnAiApplyPatch','btnAiCopy','btnUseSelection','btnUseWholeFile']
      .forEach((id) => { const el = byId(id); if (el) el.disabled = !hasModel; });
    const hint = byId('aiResultHint');
    if (hint && !hasModel) hint.textContent = 'Henüz öneri yok. Model seçip “AI ile Analiz Et”e bas.';
  }
  const model = byId('modelSelect');
  if (model) model.addEventListener('change', syncAiButtons);
  syncAiButtons();
})();
