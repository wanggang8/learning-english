// Flashcard component: favorites, mastery, filters, and persistence
(function(){
  const IDS = Object.freeze({
    SCREEN: 'flashcardScreen',
    CARD: 'flashcard',
    WORD: 'fcWord',
    PHONETIC: 'fcPhonetic',
    DEF: 'fcDefinition',
    EX: 'fcExample',
    IMG: 'fcImage',
    INDEX: 'fcIndex',
    COUNT: 'fcCount',
    ORDER_SELECT: 'fcOrderSelect',
    DEFAULT_FACE_SELECT: 'fcDefaultFace',
    INCLUDE_IMG_CHECK: 'fcIncludeImages',
    PREV_BTN: 'fcPrevBtn',
    NEXT_BTN: 'fcNextBtn',
    FLIP_BTN: 'fcFlipBtn',
    OPEN_BTN: 'flashcardOpenBtn',
    // new controls
    FAV_BTN: 'fcFavBtn',
    ACTIONS_WRAP: 'fcActions',
    MASTERY_WRAP: 'fcMastery',
    MASTERY_BTN_PREFIX: 'fcM', // will be suffixed with 0..3
    FILTER_MODE: 'fcFilterMode',
    FILTER_RANGE_WRAP: 'fcFilterRange',
    FILTER_MIN: 'fcFilterMin',
    FILTER_MAX: 'fcFilterMax',
    SUMMARY: 'fcSummary'
  });

  const DEFAULT_PREFS = Object.freeze({
    order: 'shuffled', // 'shuffled' | 'ordered'
    defaultFace: 'front', // 'front' | 'back'
    includeImages: true,
    filters: { mode: 'all', masteryMin: 0, masteryMax: 3 }
  });

  let deck = [];
  let index = 0;
  let flipped = false; // true means back side currently visible
  let prefs = { ...DEFAULT_PREFS };

  function getEl(id){ return document.getElementById(id); }

  function clamp(num, min, max) { return Math.min(Math.max(Number(num), min), max); }

  function getSettings() {
    try {
      const r = window.PersistenceService?.getSettings();
      if (r && r.success) {
        const s = r.data || {};
        const fc = s.flashcard || {};
        const f = fc.filters || {};
        return {
          order: (fc.order === 'ordered' || fc.order === 'shuffled') ? fc.order : DEFAULT_PREFS.order,
          defaultFace: (fc.defaultFace === 'front' || fc.defaultFace === 'back') ? fc.defaultFace : DEFAULT_PREFS.defaultFace,
          includeImages: typeof fc.includeImages === 'boolean' ? fc.includeImages : DEFAULT_PREFS.includeImages,
          filters: {
            mode: (f.mode === 'favorites' || f.mode === 'mastery' || f.mode === 'all') ? f.mode : DEFAULT_PREFS.filters.mode,
            masteryMin: Number.isFinite(Number(f.masteryMin)) ? clamp(f.masteryMin, 0, 3) : DEFAULT_PREFS.filters.masteryMin,
            masteryMax: Number.isFinite(Number(f.masteryMax)) ? clamp(f.masteryMax, 0, 3) : DEFAULT_PREFS.filters.masteryMax,
          }
        };
      }
    } catch (e) {}
    return { ...DEFAULT_PREFS };
  }

  function saveSettings(next) {
    try {
      const cur = getSettings();
      const fc = { ...cur, ...next };
      window.PersistenceService?.updateSettings({ flashcard: fc });
    } catch (e) {}
  }

  function getWords() {
    try {
      const r = window.PersistenceService?.getState();
      if (r && r.success && Array.isArray(r.data?.words)) {
        return r.data.words;
      }
    } catch (e) {}
    return [];
  }

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1; i>0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function applyFilters(words, filters) {
    const f = filters || DEFAULT_PREFS.filters;
    const min = clamp(f.masteryMin ?? 0, 0, 3);
    const max = clamp(f.masteryMax ?? 3, 0, 3);
    const mode = f.mode || 'all';
    return (Array.isArray(words) ? words : []).filter((w) => {
      if (!w || typeof w !== 'object') return false;
      if (!w.word) return false;
      switch (mode) {
        case 'favorites':
          return !!w.favorite;
        case 'mastery':
          {
            const m = Number(w.mastery) || 0;
            return m >= Math.min(min, max) && m <= Math.max(min, max);
          }
        case 'all':
        default:
          return true;
      }
    });
  }

  function buildDeck(words, order) {
    const normalized = Array.isArray(words) ? words.filter(w => w && typeof w === 'object' && w.word) : [];
    return order === 'ordered' ? normalized.slice() : shuffle(normalized);
  }

  function rebuildDeck({ preserveCurrent = true, reshuffle = false } = {}) {
    const currentWord = deck[index]?.word;
    const all = getWords();
    const filtered = applyFilters(all, prefs.filters);
    if (prefs.order === 'ordered') {
      deck = filtered.slice();
    } else {
      if (!reshuffle && Array.isArray(deck) && deck.length) {
        const allowed = new Set(filtered.map(w => w.word));
        deck = deck.filter((w) => allowed.has(w.word));
      } else {
        deck = shuffle(filtered);
      }
    }
    // reset index and try to preserve current if possible
    index = 0;
    if (preserveCurrent && currentWord) {
      const idx = deck.findIndex((w) => w.word === currentWord);
      index = idx >= 0 ? idx : 0;
    }
    setFaceByDefault();
    renderCard();
  }

  function updateControlsUI() {
    const orderSel = getEl(IDS.ORDER_SELECT);
    if (orderSel) orderSel.value = prefs.order;
    const faceSel = getEl(IDS.DEFAULT_FACE_SELECT);
    if (faceSel) faceSel.value = prefs.defaultFace;
    const includeChk = getEl(IDS.INCLUDE_IMG_CHECK);
    if (includeChk) includeChk.checked = !!prefs.includeImages;

    // filters
    const mSel = getEl(IDS.FILTER_MODE);
    if (mSel) mSel.value = prefs.filters.mode;
    const rWrap = getEl(IDS.FILTER_RANGE_WRAP);
    const minSel = getEl(IDS.FILTER_MIN);
    const maxSel = getEl(IDS.FILTER_MAX);
    if (minSel) minSel.value = String(prefs.filters.masteryMin);
    if (maxSel) maxSel.value = String(prefs.filters.masteryMax);
    if (rWrap) rWrap.style.display = (prefs.filters.mode === 'mastery') ? '' : 'none';
  }

  function setFaceByDefault() {
    flipped = prefs.defaultFace === 'back';
    const card = getEl(IDS.CARD);
    if (card) {
      card.classList.toggle('flipped', flipped);
    }
  }

  function updateActionsUI(wordObj) {
    const favBtn = getEl(IDS.FAV_BTN);
    if (favBtn) {
      const fav = !!wordObj?.favorite;
      favBtn.textContent = fav ? '★' : '☆';
      favBtn.classList.toggle('active', fav);
      favBtn.title = fav ? '取消收藏' : '收藏';
    }
    const level = Number(wordObj?.mastery) || 0;
    for (let i=0; i<=3; i++) {
      const btn = getEl(IDS.MASTERY_BTN_PREFIX + i);
      if (btn) btn.classList.toggle('active', i === level);
    }
  }

  function renderCard() {
    const count = deck.length;
    const iEl = getEl(IDS.INDEX);
    const cEl = getEl(IDS.COUNT);
    if (iEl) iEl.textContent = count ? (index + 1) : 0;
    if (cEl) cEl.textContent = count;

    const wordObj = deck[index] || null;
    const wordText = (wordObj && wordObj.word) || '';
    const phonetic = wordObj?.phonetic || '';
    const def = wordObj?.definition || '';
    const ex = wordObj?.example || '';
    const imgPath = wordObj?.imagePath || null;

    const wEl = getEl(IDS.WORD); if (wEl) wEl.textContent = wordText || '（无单词）';
    const pEl = getEl(IDS.PHONETIC); if (pEl) { pEl.textContent = phonetic ? `/${phonetic}/` : ''; pEl.style.display = phonetic ? '' : 'none'; }
    const dEl = getEl(IDS.DEF); if (dEl) { dEl.textContent = def || ''; dEl.style.display = def ? '' : 'none'; }
    const eEl = getEl(IDS.EX); if (eEl) { eEl.textContent = ex || ''; eEl.style.display = ex ? '' : 'none'; }

    const imgEl = getEl(IDS.IMG);
    if (imgEl) {
      if (prefs.includeImages && imgPath) {
        imgEl.src = imgPath;
        imgEl.style.display = '';
      } else {
        imgEl.removeAttribute('src');
        imgEl.style.display = 'none';
      }
    }

    const prevBtn = getEl(IDS.PREV_BTN);
    const nextBtn = getEl(IDS.NEXT_BTN);
    const flipBtn = getEl(IDS.FLIP_BTN);
    const hasCards = count > 0;
    if (prevBtn) prevBtn.disabled = !hasCards || index <= 0;
    if (nextBtn) nextBtn.disabled = !hasCards || index >= (count - 1);
    if (flipBtn) flipBtn.disabled = !hasCards;

    updateActionsUI(wordObj);
    updateSummary();
  }

  function ensureToolbarControls(screen) {
    const toolbar = screen.querySelector('.flashcard-toolbar');
    if (!toolbar) return;

    // Ensure actions (favorite + mastery) block
    if (!getEl(IDS.ACTIONS_WRAP)) {
      const actions = document.createElement('div');
      actions.className = 'fc-actions';
      actions.id = IDS.ACTIONS_WRAP;
      actions.innerHTML = `
        <button id="${IDS.FAV_BTN}" class="fc-fav-btn" title="收藏">☆</button>
        <div class="fc-mastery" id="${IDS.MASTERY_WRAP}">
          <button class="fc-m-btn" id="${IDS.MASTERY_BTN_PREFIX}0" data-level="0">M0</button>
          <button class="fc-m-btn" id="${IDS.MASTERY_BTN_PREFIX}1" data-level="1">M1</button>
          <button class="fc-m-btn" id="${IDS.MASTERY_BTN_PREFIX}2" data-level="2">M2</button>
          <button class="fc-m-btn" id="${IDS.MASTERY_BTN_PREFIX}3" data-level="3">M3</button>
        </div>`;
      toolbar.insertBefore(actions, toolbar.querySelector('.fc-prefs'));
    }

    // Ensure filter controls and summary
    const prefsWrap = toolbar.querySelector('.fc-prefs');
    if (prefsWrap && !getEl(IDS.FILTER_MODE)) {
      const filterHtml = `
        <label>筛选
          <select id="${IDS.FILTER_MODE}">
            <option value="all">全部</option>
            <option value="favorites">收藏</option>
            <option value="mastery">掌握度</option>
          </select>
        </label>
        <span class="fc-filter-range" id="${IDS.FILTER_RANGE_WRAP}">
          <select id="${IDS.FILTER_MIN}">
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <span class="fc-range-sep">~</span>
          <select id="${IDS.FILTER_MAX}">
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </span>`;
      const frag = document.createElement('span');
      frag.innerHTML = filterHtml;
      prefsWrap.appendChild(frag);
    }

    if (!getEl(IDS.SUMMARY)) {
      const div = document.createElement('div');
      div.className = 'fc-summary';
      div.id = IDS.SUMMARY;
      toolbar.appendChild(div);
    }

    // Bind events
    getEl(IDS.FAV_BTN)?.addEventListener('click', toggleFavorite);
    for (let i=0; i<=3; i++) {
      getEl(IDS.MASTERY_BTN_PREFIX + i)?.addEventListener('click', () => setMastery(i));
    }
    getEl(IDS.FILTER_MODE)?.addEventListener('change', (e) => {
      const val = e.target.value === 'favorites' || e.target.value === 'mastery' ? e.target.value : 'all';
      prefs.filters.mode = val;
      saveSettings({ filters: { ...prefs.filters, mode: val } });
      updateControlsUI();
      rebuildDeck({ preserveCurrent: false, reshuffle: false });
    });
    const onRangeChange = () => {
      const min = clamp(Number(getEl(IDS.FILTER_MIN)?.value ?? 0), 0, 3);
      const max = clamp(Number(getEl(IDS.FILTER_MAX)?.value ?? 3), 0, 3);
      prefs.filters.masteryMin = Math.min(min, max);
      prefs.filters.masteryMax = Math.max(min, max);
      saveSettings({ filters: { ...prefs.filters } });
      rebuildDeck({ preserveCurrent: true, reshuffle: false });
    };
    getEl(IDS.FILTER_MIN)?.addEventListener('change', onRangeChange);
    getEl(IDS.FILTER_MAX)?.addEventListener('change', onRangeChange);
  }

  function ensureScreen() {
    let screen = document.getElementById(IDS.SCREEN);
    if (!screen) {
      // In case HTML wasn't updated, build a minimal container dynamically
      screen = document.createElement('div');
      screen.id = IDS.SCREEN;
      screen.className = 'screen';
      screen.innerHTML = `
        <h2 class="subtitle">📚 学习卡片</h2>
        <div class="flashcard-container">
          <div class="flashcard" id="${IDS.CARD}">
            <div class="face front">
              <div class="fc-word" id="${IDS.WORD}"></div>
              <div class="fc-phonetic" id="${IDS.PHONETIC}"></div>
            </div>
            <div class="face back">
              <div class="fc-definition" id="${IDS.DEF}"></div>
              <div class="fc-example" id="${IDS.EX}"></div>
              <img class="fc-image" id="${IDS.IMG}" alt="" />
            </div>
          </div>
        </div>
        <div class="flashcard-toolbar">
          <div class="fc-status"><span id="${IDS.INDEX}">0</span>/<span id="${IDS.COUNT}">0</span></div>
          <div class="fc-controls">
            <button class="btn-secondary" id="${IDS.PREV_BTN}">⬅ 上一张</button>
            <button class="btn-primary" id="${IDS.FLIP_BTN}">翻面 (Space)</button>
            <button class="btn-secondary" id="${IDS.NEXT_BTN}">下一张 ➡</button>
          </div>
          <div class="fc-actions" id="${IDS.ACTIONS_WRAP}">
            <button id="${IDS.FAV_BTN}" class="fc-fav-btn" title="收藏">☆</button>
            <div class="fc-mastery" id="${IDS.MASTERY_WRAP}">
              <button class="fc-m-btn" id="${IDS.MASTERY_BTN_PREFIX}0" data-level="0">M0</button>
              <button class="fc-m-btn" id="${IDS.MASTERY_BTN_PREFIX}1" data-level="1">M1</button>
              <button class="fc-m-btn" id="${IDS.MASTERY_BTN_PREFIX}2" data-level="2">M2</button>
              <button class="fc-m-btn" id="${IDS.MASTERY_BTN_PREFIX}3" data-level="3">M3</button>
            </div>
          </div>
          <div class="fc-prefs">
            <label>排列
              <select id="${IDS.ORDER_SELECT}">
                <option value="shuffled">随机</option>
                <option value="ordered">顺序</option>
              </select>
            </label>
            <label>默认面
              <select id="${IDS.DEFAULT_FACE_SELECT}">
                <option value="front">正面</option>
                <option value="back">背面</option>
              </select>
            </label>
            <label class="fc-checkbox"><input type="checkbox" id="${IDS.INCLUDE_IMG_CHECK}" checked> 显示图片</label>
            <label>筛选
              <select id="${IDS.FILTER_MODE}">
                <option value="all">全部</option>
                <option value="favorites">收藏</option>
                <option value="mastery">掌握度</option>
              </select>
            </label>
            <span class="fc-filter-range" id="${IDS.FILTER_RANGE_WRAP}">
              <select id="${IDS.FILTER_MIN}">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
              <span class="fc-range-sep">~</span>
              <select id="${IDS.FILTER_MAX}">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </span>
          </div>
          <div class="fc-summary" id="${IDS.SUMMARY}"></div>
          <div class="fc-footer">
            <button class="btn-back" onclick="window.AppCommands?.uiBack?.()">返回</button>
          </div>
        </div>`;
      const main = document.querySelector('.main-content');
      main && main.appendChild(screen);
    }

    // ensure new controls exist if HTML is older
    ensureToolbarControls(screen);

    // Bind events once
    getEl(IDS.PREV_BTN)?.addEventListener('click', prev);
    getEl(IDS.NEXT_BTN)?.addEventListener('click', next);
    getEl(IDS.FLIP_BTN)?.addEventListener('click', flip);
    getEl(IDS.ORDER_SELECT)?.addEventListener('change', (e) => {
      const val = e.target.value === 'ordered' ? 'ordered' : 'shuffled';
      prefs.order = val;
      saveSettings({ order: val });
      // rebuild deck preserving current card word if possible
      rebuildDeck({ preserveCurrent: true, reshuffle: val === 'shuffled' });
    });
    getEl(IDS.DEFAULT_FACE_SELECT)?.addEventListener('change', (e) => {
      const val = e.target.value === 'back' ? 'back' : 'front';
      prefs.defaultFace = val;
      saveSettings({ defaultFace: val });
      setFaceByDefault();
    });
    getEl(IDS.INCLUDE_IMG_CHECK)?.addEventListener('change', (e) => {
      const val = !!e.target.checked;
      prefs.includeImages = val;
      saveSettings({ includeImages: val });
      renderCard();
    });

    // Optional open button on start screen
    const openBtn = getEl(IDS.OPEN_BTN);
    if (openBtn && !openBtn._fcBound) {
      openBtn.addEventListener('click', open);
      openBtn._fcBound = true;
    }

    return screen;
  }

  function activateScreen(screenId) {
    document.querySelectorAll('.screen').forEach((el)=> el.classList.remove('active'));
    const sc = document.getElementById(screenId);
    sc && sc.classList.add('active');
  }

  function open() {
    const sc = ensureScreen();
    prefs = getSettings();
    // initial deck with filters applied
    const initial = applyFilters(getWords(), prefs.filters);
    deck = buildDeck(initial, prefs.order);
    index = 0;
    setFaceByDefault();
    updateControlsUI();
    renderCard();
    activateScreen(IDS.SCREEN);
    // ensure actions are bound (in case screen existed in HTML)
    ensureToolbarControls(sc);
  }

  function markReviewedForCurrent() {
    const cur = deck[index];
    if (!cur || !cur.word) return;
    updateWordFields(cur.word, { lastReviewedAt: new Date().toISOString() }, { silent: true });
  }

  function flip() {
    const card = getEl(IDS.CARD);
    if (!card) return;
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
    // mark reviewed when flipped
    markReviewedForCurrent();
  }

  function next() {
    if (!deck.length) return;
    if (index < deck.length - 1) {
      index += 1;
      setFaceByDefault();
      renderCard();
      markReviewedForCurrent();
    }
  }

  function prev() {
    if (!deck.length) return;
    if (index > 0) {
      index -= 1;
      setFaceByDefault();
      renderCard();
      markReviewedForCurrent();
    }
  }

  function toggleFavorite() {
    const cur = deck[index];
    if (!cur || !cur.word) return;
    const nextFav = !cur.favorite;
    const patched = updateWordFields(cur.word, { favorite: nextFav });
    if (patched) {
      // update in-memory deck object
      cur.favorite = nextFav;
      // if filter is favorites-only and unfavorited, remove from deck
      if (prefs.filters.mode === 'favorites' && !nextFav) {
        rebuildDeck({ preserveCurrent: false, reshuffle: false });
      } else {
        renderCard();
      }
    }
  }

  function setMastery(level) {
    const lv = clamp(level, 0, 3);
    const cur = deck[index];
    if (!cur || !cur.word) return;
    const patched = updateWordFields(cur.word, { mastery: lv, lastReviewedAt: new Date().toISOString() });
    if (patched) {
      cur.mastery = lv;
      // If current filter is mastery-range and this card moves out of range, rebuild deck
      if (prefs.filters.mode === 'mastery') {
        const min = Math.min(prefs.filters.masteryMin, prefs.filters.masteryMax);
        const max = Math.max(prefs.filters.masteryMin, prefs.filters.masteryMax);
        if (!(lv >= min && lv <= max)) {
          rebuildDeck({ preserveCurrent: false, reshuffle: false });
          return;
        }
      }
      renderCard();
    }
  }

  function updateWordFields(wordKey, patch, { silent = false } = {}) {
    try {
      const state = window.PersistenceService?.getState();
      if (!state || !state.success) return false;
      const words = Array.isArray(state.data?.words) ? state.data.words.slice() : [];
      const idx = words.findIndex((w) => w && w.word === wordKey);
      if (idx < 0) return false;
      const next = { ...words[idx], ...patch };
      words[idx] = next;
      const res = window.PersistenceService?.updatePartial({ words });
      if (res && res.success) {
        if (!silent) { try { window.Feedback?.showToast('已保存', window.Feedback?.TOAST_TYPES?.INFO || 'info', 1200); } catch (_) {} }
        return next;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function updateSummary() {
    // Show favorites count and mastery distribution
    try {
      const all = getWords();
      const favCount = all.filter(w => w && w.favorite).length;
      const mCounts = [0,0,0,0];
      for (const w of all) {
        const lv = clamp(Number(w?.mastery) || 0, 0, 3);
        mCounts[lv] += 1;
      }
      const el = getEl(IDS.SUMMARY);
      if (el) {
        el.textContent = `★${favCount} · M0:${mCounts[0]} M1:${mCounts[1]} M2:${mCounts[2]} M3:${mCounts[3]}`;
      }
    } catch (e) {}
  }

  function init() {
    const sc = ensureScreen();
    ensureToolbarControls(sc);
  }

  // expose API
  window.Flashcard = Object.freeze({ open, flip, next, prev, init });
  // convenience global for inline onclick if needed
  window.openFlashcards = open;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
