// 抽取策略模块：支持完全随机与公平模式（基于权重）

(function () {
  const NS = '[DrawStrategy]';

  const MODES = Object.freeze({
    RANDOM: 'random',
    FAIR: 'fair'
  });

  // 计算公平权重：权重与抽取次数成反比，并考虑最近抽取时间
  // - 基础权重：1 / (drawCount + 1)
  // - 时间因子：时间越久权重越接近 1；最近被抽中过的适当衰减
  // - 保护：确保所有候选权重大于 0
  function computeWeights(candidates, statsMap, nowISO = new Date().toISOString()) {
    const now = Date.parse(nowISO);
    const weights = [];

    for (const name of candidates) {
      const stats = statsMap && statsMap[name] ? statsMap[name] : null;
      const drawCount = stats && Number.isFinite(stats.drawCount) ? stats.drawCount : 0;
      const last = stats && stats.lastDrawnAt ? Date.parse(stats.lastDrawnAt) : null;

      // 基础权重（次数越多，越小）
      let base = 1 / (drawCount + 1);

      // 时间衰减：最近被抽中过的，降低概率；时间越久，趋近 1
      let timeFactor = 1;
      if (Number.isFinite(last)) {
        const deltaSec = Math.max(0, (now - last) / 1000);
        // 半衰时间约 10 分钟（600s）：delta=0 -> 0.3； 5m -> ~0.5；10m -> ~0.65；30m -> ~0.9
        const HALF_LIFE = 600;
        const MIN_FACTOR = 0.3; // 避免完全为 0
        const k = Math.log(2) / HALF_LIFE;
        const decay = 1 - Math.exp(-k * deltaSec);
        timeFactor = MIN_FACTOR + (1 - MIN_FACTOR) * decay;
      }

      let w = base * timeFactor;
      if (!Number.isFinite(w) || w <= 0) w = 0.000001; // 保护
      weights.push(w);
    }

    // 归一化，避免极端值
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      // 所有是 0？退化为均匀分布
      return new Array(candidates.length).fill(1 / candidates.length);
    }
    return weights.map((w) => w / sum);
  }

  function pickByWeights(candidates, weights) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    if (!Array.isArray(weights) || weights.length !== candidates.length) {
      // 退化为平均随机
      const i = Math.floor(Math.random() * candidates.length);
      return { index: i, value: candidates[i], debug: { mode: 'fallback' } };
    }
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r <= acc) {
        return { index: i, value: candidates[i], debug: { r, accAtPick: acc } };
      }
    }
    // 由于浮点误差，可能没有命中，返回最后一个
    const lastIndex = candidates.length - 1;
    return { index: lastIndex, value: candidates[lastIndex], debug: { r, accAtPick: 1 } };
  }

  function pickStudent(candidates, options = {}) {
    const mode = options.mode || MODES.RANDOM;
    const stats = options.stats || {};

    console.assert(Array.isArray(candidates) && candidates.length > 0, `${NS} 候选列表为空`);

    if (mode === MODES.RANDOM) {
      const index = Math.floor(Math.random() * candidates.length);
      return { index, value: candidates[index], mode, weights: null };
    }

    // 公平模式
    const weights = computeWeights(candidates, stats);
    const picked = pickByWeights(candidates, weights);
    return { index: picked.index, value: picked.value, mode: MODES.FAIR, weights };
  }

  // 断言函数：用简单场景校验加权是否符合直觉
  function runAssertions() {
    const cands = ['A', 'B', 'C'];
    const stats = {
      A: { drawCount: 5, lastDrawnAt: new Date(Date.now() - 60 * 1000).toISOString() },
      B: { drawCount: 1, lastDrawnAt: new Date(Date.now() - 3600 * 1000).toISOString() },
      C: { drawCount: 0, lastDrawnAt: null }
    };
    const ws = computeWeights(cands, stats);
    console.assert(ws.length === 3, `${NS} 权重长度异常`);
    // 次数多的 A 应该小于 C
    console.assert(ws[0] < ws[2], `${NS} 权重期望 C > A 失败: ${ws}`);
  }

  window.DrawStrategy = Object.freeze({
    MODES,
    computeWeights,
    pickStudent,
    runAssertions
  });
})();
