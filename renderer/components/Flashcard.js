// Flashcard component: manages a simple front/back card UI and deck navigation
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
    OPEN_BTN: 'flashcardOpenBtn'
  });

  const DEFAULT_PREFS = Object.freeze({
    order: 'shuffled', // 'shuffled' | 'ordered'
    defaultFace: 'front', // 'front' | 'back'
    includeImages: true
  });

  let deck = [];
  let index = 0;
  let flipped = false; // true means back side currently visible
  let prefs = { ...DEFAULT_PREFS };

  function getEl(id){ return document.getElementById(id); }

  function getSettings() {
    try {
      const r = window.PersistenceService?.getSettings();
      if (r && r.success) {
        const s = r.data || {};
        const fc = s.flashcard || {};
        return {
          order: (fc.order === 'ordered' || fc.order === 'shuffled') ? fc.order : DEFAULT_PREFS.order,
          defaultFace: (fc.defaultFace === 'front' || fc.defaultFace === 'back') ? fc.defaultFace : DEFAULT_PREFS.defaultFace,
          includeImages: typeof fc.includeImages === 'boolean' ? fc.includeImages : DEFAULT_PREFS.includeImages
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

  function buildDeck(words, order) {
    const normalized = Array.isArray(words) ? words.filter(w => w && typeof w === 'object' && w.word) : [];
    return order === 'ordered' ? normalized.slice() : shuffle(normalized);
  }

  function updateControlsUI() {
    const orderSel = getEl(IDS.ORDER_SELECT);
    if (orderSel) orderSel.value = prefs.order;
    const faceSel = getEl(IDS.DEFAULT_FACE_SELECT);
    if (faceSel) faceSel.value = prefs.defaultFace;
    const includeChk = getEl(IDS.INCLUDE_IMG_CHECK);
    if (includeChk) includeChk.checked = !!prefs.includeImages;
  }

  function setFaceByDefault() {
    flipped = prefs.defaultFace === 'back';
    const card = getEl(IDS.CARD);
    if (card) {
      card.classList.toggle('flipped', flipped);
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
    if (prevBtn) prevBtn.disabled = count === 0 || index <= 0;
    if (nextBtn) nextBtn.disabled = count === 0 || index >= (count - 1);
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
          </div>
          <div class="fc-footer">
            <button class="btn-back" onclick="window.AppCommands?.uiBack?.()">返回</button>
          </div>
        </div>`;
      const main = document.querySelector('.main-content');
      main && main.appendChild(screen);
    }

    // Bind events once
    getEl(IDS.PREV_BTN)?.addEventListener('click', prev);
    getEl(IDS.NEXT_BTN)?.addEventListener('click', next);
    getEl(IDS.FLIP_BTN)?.addEventListener('click', flip);
    getEl(IDS.ORDER_SELECT)?.addEventListener('change', (e) => {
      const val = e.target.value === 'ordered' ? 'ordered' : 'shuffled';
      prefs.order = val;
      saveSettings({ order: val });
      // rebuild deck preserving current card word if possible
      const currentWord = deck[index]?.word;
      deck = buildDeck(getWords(), prefs.order);
      index = Math.max(0, currentWord ? deck.findIndex(w => w.word === currentWord) : 0);
      setFaceByDefault();
      renderCard();
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
    ensureScreen();
    prefs = getSettings();
    deck = buildDeck(getWords(), prefs.order);
    index = 0;
    setFaceByDefault();
    updateControlsUI();
    renderCard();
    activateScreen(IDS.SCREEN);
  }

  function flip() {
    const card = getEl(IDS.CARD);
    if (!card) return;
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
  }

  function next() {
    if (!deck.length) return;
    if (index < deck.length - 1) {
      index += 1;
      setFaceByDefault();
      renderCard();
    }
  }

  function prev() {
    if (!deck.length) return;
    if (index > 0) {
      index -= 1;
      setFaceByDefault();
      renderCard();
    }
  }

  function init() {
    ensureScreen();
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
