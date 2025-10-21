// WordDetailModal: view/edit full word record with session-only or global persist
(function(){
  const MODAL_ID = 'wordDetailModal';

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = MODAL_ID;
      modal.className = 'modal active';
      modal.innerHTML = `
        <div class="modal-content">
          <h3>编辑单词详情</h3>
          <div class="wdm-form">
            <div class="wdm-field">
              <label>单词</label>
              <div id="wdmWordText" class="wdm-wordtext"></div>
            </div>
            <div class="wdm-field">
              <label for="wdmPhonetic">音标</label>
              <input type="text" id="wdmPhonetic" placeholder="/ˈæpəl/">
            </div>
            <div class="wdm-field">
              <label for="wdmDefinition">释义</label>
              <textarea id="wdmDefinition" rows="3" placeholder="definition..."></textarea>
            </div>
            <div class="wdm-field">
              <label for="wdmExample">例句</label>
              <textarea id="wdmExample" rows="3" placeholder="example..."></textarea>
            </div>
            <div class="wdm-field">
              <label for="wdmTags">标签（用逗号分隔）</label>
              <input type="text" id="wdmTags" placeholder="tag1, tag2">
            </div>
            <div class="wdm-field">
              <label for="wdmImagePath">图片路径或 URL</label>
              <input type="text" id="wdmImagePath" placeholder="/path/to/image.png">
            </div>
            <div class="wdm-field">
              <label for="wdmMastery">掌握度</label>
              <select id="wdmMastery">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
          </div>
          <div class="modal-buttons">
            <button id="wdmApplySessionBtn" class="btn-secondary">仅本次会话生效</button>
            <button id="wdmSaveGlobalBtn" class="btn-primary">全局保存</button>
            <button id="wdmCancelBtn" class="btn-back">取消</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    return modal;
  }

  function cleanup(){
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.remove();
  }

  function normalizePatch(raw) {
    const patch = {};
    const strOrNull = (v) => {
      const t = (v == null ? '' : String(v)).trim();
      return t === '' ? null : t;
    };
    if (raw.phonetic !== undefined) patch.phonetic = strOrNull(raw.phonetic);
    if (raw.definition !== undefined) patch.definition = strOrNull(raw.definition);
    if (raw.example !== undefined) patch.example = strOrNull(raw.example);
    if (raw.imagePath !== undefined) patch.imagePath = strOrNull(raw.imagePath);
    if (raw.tags !== undefined) patch.tags = Array.isArray(raw.tags) ? raw.tags : [];
    if (raw.mastery !== undefined) {
      const m = Number(raw.mastery);
      patch.mastery = Number.isFinite(m) ? Math.max(0, Math.min(3, m)) : 0;
    }
    return patch;
  }

  function open(wordObj, callbacks = {}) {
    const modal = ensureModal();
    const word = (wordObj && wordObj.word) || '';

    // Fill fields
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? ''; };
    setText('wdmWordText', word);
    setVal('wdmPhonetic', wordObj?.phonetic || '');
    setVal('wdmDefinition', wordObj?.definition || '');
    setVal('wdmExample', wordObj?.example || '');
    setVal('wdmTags', Array.isArray(wordObj?.tags) ? wordObj.tags.join(', ') : '');
    setVal('wdmImagePath', wordObj?.imagePath || '');
    const mSel = document.getElementById('wdmMastery');
    if (mSel) mSel.value = String(Math.max(0, Math.min(3, Number(wordObj?.mastery) || 0)));

    const onCancel = () => cleanup();
    const applySession = () => {
      try {
        const patch = collectPatch();
        const p = normalizePatch(patch);
        if (typeof callbacks.onApplySession === 'function') callbacks.onApplySession(p);
        cleanup();
      } catch (e) {
        try { window.Feedback?.showError?.(e.message || '校验失败'); } catch(_) {}
      }
    };
    const saveGlobal = () => {
      try {
        const patch = collectPatch();
        const p = normalizePatch(patch);
        if (typeof callbacks.onPersistGlobal === 'function') callbacks.onPersistGlobal(p);
        cleanup();
      } catch (e) {
        try { window.Feedback?.showError?.(e.message || '校验失败'); } catch(_) {}
      }
    };

    // Bind buttons
    document.getElementById('wdmApplySessionBtn')?.addEventListener('click', applySession, { once: true });
    document.getElementById('wdmSaveGlobalBtn')?.addEventListener('click', saveGlobal, { once: true });
    document.getElementById('wdmCancelBtn')?.addEventListener('click', onCancel, { once: true });

    // Helper to collect form values
    function collectPatch() {
      const phonetic = document.getElementById('wdmPhonetic')?.value || '';
      const definition = document.getElementById('wdmDefinition')?.value || '';
      const example = document.getElementById('wdmExample')?.value || '';
      const tagsRaw = document.getElementById('wdmTags')?.value || '';
      const imagePath = document.getElementById('wdmImagePath')?.value || '';
      const masteryVal = document.getElementById('wdmMastery')?.value || '0';

      const tags = tagsRaw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
      const mastery = Math.max(0, Math.min(3, Number(masteryVal) || 0));
      return { phonetic, definition, example, tags, imagePath, mastery };
    }

    return modal;
  }

  window.WordDetailModal = Object.freeze({ open });
})();
