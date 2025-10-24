// Excel 数据导入模块：负责读取、解析、验证和保存 Excel 数据

const MODULE_NAME = '[DataImporter]';

// 数据源类型枚举
const SOURCE_TYPES = {
  EXCEL: 'excel',
  TEST: 'test',
  MANUAL: 'manual'
};

// 数据类型枚举
const DATA_TYPES = {
  STUDENTS: 'students',
  WORDS: 'words'
};

const WORD_DEFAULTS = Object.freeze({
  word: '',
  phonetic: null,
  definition: null,
  example: null,
  tags: [],
  imagePath: null,
  mastery: 0,
  lastReviewedAt: null,
  favorite: false
});

const STUDENT_HEADER_KEYWORDS = ['姓名', 'name', 'student', '学生', 'student name', '同学'];

const WORD_HEADER_ALIASES = Object.freeze({
  word: ['单词', 'word', '词汇', '词语', '英文', 'vocabulary', 'term'],
  phonetic: ['音标', 'phonetic', '发音', 'pronunciation'],
  definition: ['释义', 'definition', 'meaning', '中文释义', '解释'],
  example: ['例句', 'example', 'sentence', '示例', '用法'],
  tags: ['标签', 'tags', '分类', '类别', '主题'],
  image: ['图片', 'image', 'img', 'image path', '图片路径', 'picture']
});

function normalizeWhitespace(value, { preserveNewlines = false } = {}) {
  if (value == null) return '';
  let str = String(value);
  str = str.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ');
  if (!preserveNewlines) {
    return str.replace(/\s+/g, ' ').trim();
  }
  const lines = str.split('\n').map((line) => line.replace(/\s+/g, ' ').trim());
  return lines.join('\n').trim();
}

function normalizeOptionalString(value, options) {
  const normalized = normalizeWhitespace(value, options);
  return normalized ? normalized : null;
}

function sanitizeTags(value) {
  if (value == null) return [];
  const queue = Array.isArray(value) ? value.slice() : [value];
  const result = [];
  const seen = new Set();

  while (queue.length) {
    const item = queue.shift();
    if (item == null) continue;
    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }
    const raw = normalizeWhitespace(item, { preserveNewlines: true });
    if (!raw) continue;
    const parts = raw.split(/[\n,，;；|｜\/\\]+/);
    for (const part of parts) {
      const cleaned = normalizeWhitespace(part);
      if (!cleaned) continue;
      const trimmed = cleaned.replace(/^#/, '').trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

function findHeaderIndex(normalizedHeader, aliases) {
  if (!Array.isArray(normalizedHeader) || !Array.isArray(aliases)) return -1;
  for (let i = 0; i < normalizedHeader.length; i++) {
    const cell = normalizedHeader[i];
    if (!cell) continue;
    if (aliases.some((alias) => {
      const token = String(alias || '').toLowerCase();
      return cell === token || cell.includes(token);
    })) {
      return i;
    }
  }
  return -1;
}

function buildWordHeaderMap(headerRow) {
  const normalized = Array.isArray(headerRow)
    ? headerRow.map((cell) => normalizeWhitespace(cell).toLowerCase())
    : [];
  const map = {
    word: findHeaderIndex(normalized, WORD_HEADER_ALIASES.word),
    phonetic: findHeaderIndex(normalized, WORD_HEADER_ALIASES.phonetic),
    definition: findHeaderIndex(normalized, WORD_HEADER_ALIASES.definition),
    example: findHeaderIndex(normalized, WORD_HEADER_ALIASES.example),
    tags: findHeaderIndex(normalized, WORD_HEADER_ALIASES.tags),
    image: findHeaderIndex(normalized, WORD_HEADER_ALIASES.image)
  };
  if (map.word == null || map.word < 0) {
    map.word = normalized.length > 0 ? 0 : -1;
  }
  return map;
}

function getCellValue(row, index) {
  if (!Array.isArray(row) || typeof index !== 'number' || index < 0) return undefined;
  return row[index];
}

function normalizeWordEntry(entry) {
  if (entry == null) return null;
  if (typeof entry === 'string' || typeof entry === 'number') {
    const wordText = normalizeWhitespace(entry);
    if (!wordText) return null;
    return { ...WORD_DEFAULTS, word: wordText };
  }
  if (typeof entry === 'object') {
    const wordCandidate =
      entry.word ?? entry.text ?? entry.value ?? entry.term ?? entry.label ?? '';
    const wordText = normalizeWhitespace(wordCandidate);
    if (!wordText) return null;

    const normalized = {
      ...WORD_DEFAULTS,
      ...entry,
      word: wordText
    };

    normalized.phonetic = normalizeOptionalString(entry.phonetic ?? entry.pronunciation);
    normalized.definition = normalizeOptionalString(entry.definition ?? entry.meaning, { preserveNewlines: true });
    normalized.example = normalizeOptionalString(entry.example ?? entry.sentence, { preserveNewlines: true });
    const tagSource = entry.tags ?? entry.tag ?? entry.category ?? entry.categories;
    normalized.tags = sanitizeTags(tagSource);
    const imageSource = entry.imagePath ?? entry.image ?? entry.img ?? entry.picture ?? entry['image path'];
    normalized.imagePath = normalizeOptionalString(imageSource);

    const masteryValue = Number(entry.mastery);
    normalized.mastery = Number.isFinite(masteryValue) ? masteryValue : WORD_DEFAULTS.mastery;

    if (entry.lastReviewedAt != null) {
      normalized.lastReviewedAt = String(entry.lastReviewedAt);
    } else {
      normalized.lastReviewedAt = WORD_DEFAULTS.lastReviewedAt;
    }

    normalized.favorite = Boolean(entry.favorite);

    return normalized;
  }
  return null;
}

function rowHasOtherContent(row, excludeIndex) {
  if (!Array.isArray(row)) return false;
  for (let i = 0; i < row.length; i++) {
    if (i === excludeIndex) continue;
    if (normalizeWhitespace(row[i], { preserveNewlines: true })) {
      return true;
    }
  }
  return false;
}

function normalizeWordListForImport(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const entry = normalizeWordEntry(item);
    if (!entry || !entry.word) continue;
    const key = entry.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * 读取文件并返回 ArrayBuffer
 * @param {File} file - 要读取的文件
 * @param {(p:{phase:string,progress?:number,message?:string})=>void} [onProgress] - 进度回调
 * @returns {Promise<ArrayBuffer>} 文件内容
 */
function readFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    try {
      reader.onprogress = (e) => {
        try {
          if (onProgress) {
            if (e && e.lengthComputable) {
              onProgress({ phase: 'read', progress: e.total ? (e.loaded / e.total) : 0, message: `正在读取 ${file?.name || ''}...` });
            } else {
              onProgress({ phase: 'read', message: `正在读取 ${file?.name || ''}...` });
            }
          }
        } catch (_) {}
      };
    } catch (_) {}

    reader.onload = (e) => {
      try { onProgress && onProgress({ phase: 'read', progress: 1 }); } catch (_) {}
      resolve(e.target.result);
    };

    reader.onerror = () => {
      const reason = reader.error && reader.error.message ? reader.error.message : '未知错误';
      reject(new Error(`读取文件失败：${reason}`));
    };

    reader.onabort = () => {
      reject(new Error('读取已被取消'));
    };

    try {
      reader.readAsArrayBuffer(file);
    } catch (e) {
      reject(new Error(`无法读取文件：${e?.message || '未知错误'}`));
    }
  });
}

/**
 * 解析 Excel 文件内容
 * @param {ArrayBuffer} arrayBuffer - Excel 文件内容
 * @returns {Array<string>} 解析后的数据数组
 */
function parseExcelData(arrayBuffer) {
  if (typeof XLSX === 'undefined') {
    throw new Error('XLSX 库未加载');
  }
  try {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel 文件中没有找到工作表');
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    return jsonData;
  } catch (e) {
    throw new Error(`Excel 解析失败：${e?.message || '未知错误'}`);
  }
}

/**
 * 验证和清理解析后的数据
 * @param {Array} rawData - 原始数据数组
 * @param {string} dataType - 数据类型（students/words）
 * @returns {Object} 验证结果
 */
function validateAndCleanData(rawData, dataType) {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return { valid: false, error: '数据格式不正确或为空', data: [] };
  }

  const header = Array.isArray(rawData[0]) ? rawData[0] : null;
  if (!header) {
    return { valid: false, error: '未检测到表头行（第 1 行）', data: [] };
  }

  const normalizedHeader = header.map((cell) => normalizeWhitespace(cell).toLowerCase());
  const needStudents = dataType === DATA_TYPES.STUDENTS;
  const needWords = dataType === DATA_TYPES.WORDS;

  const hasStudentHeader = normalizedHeader.some((cell) =>
    STUDENT_HEADER_KEYWORDS.some((keyword) => cell.includes(String(keyword || '').toLowerCase()))
  );
  const hasWordHeader = normalizedHeader.some((cell) =>
    WORD_HEADER_ALIASES.word.some((keyword) => cell.includes(String(keyword || '').toLowerCase()))
  );

  if (needStudents && !hasStudentHeader) {
    return { valid: false, error: '未检测到表头“姓名”。请确认包含“姓名”列。', data: [] };
  }
  if (needWords && !hasWordHeader) {
    return { valid: false, error: '未检测到表头“单词”。请确认包含“单词”列。', data: [] };
  }

  const cleaned = [];
  const seen = new Set();
  let emptyRows = 0;
  let invalidRows = 0;
  let duplicateCount = 0;

  let headerMap = null;
  if (needWords) {
    headerMap = buildWordHeaderMap(header);
  }

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!Array.isArray(row)) {
      invalidRows++;
      continue;
    }

    if (needWords) {
      const wordCell = getCellValue(row, headerMap.word);
      const wordText = normalizeWhitespace(wordCell);
      if (!wordText) {
        if (rowHasOtherContent(row, headerMap.word)) {
          invalidRows++;
        } else {
          emptyRows++;
        }
        continue;
      }

      const entry = normalizeWordEntry({
        word: wordText,
        phonetic: getCellValue(row, headerMap.phonetic),
        definition: getCellValue(row, headerMap.definition),
        example: getCellValue(row, headerMap.example),
        tags: getCellValue(row, headerMap.tags),
        imagePath: getCellValue(row, headerMap.image)
      });

      if (!entry) {
        invalidRows++;
        continue;
      }

      const key = entry.word.toLowerCase();
      if (seen.has(key)) {
        duplicateCount++;
        continue;
      }
      seen.add(key);
      cleaned.push(entry);
    } else {
      const cell = getCellValue(row, 0);
      const value = normalizeWhitespace(cell);
      if (!value) {
        if (rowHasOtherContent(row, 0)) {
          invalidRows++;
        } else {
          emptyRows++;
        }
        continue;
      }
      if (seen.has(value)) {
        duplicateCount++;
        continue;
      }
      seen.add(value);
      cleaned.push(value);
    }
  }

  if (cleaned.length === 0) {
    return {
      valid: false,
      error: `${dataType === DATA_TYPES.STUDENTS ? '学生名单' : '单词列表'}中没有找到有效数据`,
      data: []
    };
  }

  const warnings = [];
  if (duplicateCount > 0) warnings.push(`已去重 ${duplicateCount} 个重复项`);
  if (invalidRows > 0) warnings.push(`检测到 ${invalidRows} 行格式异常，已跳过`);
  if (emptyRows > 0) warnings.push(`检测到 ${emptyRows} 行空白，已跳过`);

  return {
    valid: true,
    data: cleaned,
    count: cleaned.length,
    warnings
  };
}

/**
 * 保存数据到持久化存储
 * @param {Array<string>} data - 要保存的数据
 * @param {string} dataType - 数据类型（students/words）
 * @param {Object} metadata - 元数据
 * @returns {Promise<Object>} 保存结果
 */
async function saveToStore(data, dataType, metadata) {
  if (!window.PersistenceService) {
    throw new Error('持久化服务不可用');
  }
  
  const updates = {
    [dataType]: data,
    importMetadata: {
      [dataType]: {
        filename: metadata.filename,
        filepath: metadata.filepath || null,
        importedAt: new Date().toISOString(),
        sourceType: metadata.sourceType,
        count: data.length
      }
    }
  };

  // 若导入的是学生名单，补全 studentStats 默认值
  if (dataType === DATA_TYPES.STUDENTS && Array.isArray(data)) {
    try {
      const state = window.PersistenceService.getState();
      const existing = state && state.success && state.data.studentStats ? state.data.studentStats : {};
      const next = { ...existing };
      let changed = false;
      data.forEach((name) => {
        if (!next[name] || typeof next[name] !== 'object') {
          next[name] = { drawCount: 0, lastDrawnAt: null, lastDrawMode: null };
          changed = true;
        } else {
          if (typeof next[name].drawCount !== 'number') { next[name].drawCount = 0; changed = true; }
          if (!('lastDrawnAt' in next[name])) { next[name].lastDrawnAt = null; changed = true; }
          if (!('lastDrawMode' in next[name])) { next[name].lastDrawMode = null; changed = true; }
        }
      });
      if (changed) {
        updates.studentStats = next;
      }
    } catch (e) {
      console.warn(`${MODULE_NAME} 初始化学生统计信息失败:`, e);
    }
  }
  
  const result = window.PersistenceService.updatePartial(updates);
  if (!result.success) {
    throw new Error(result.error || '保存数据失败');
  }
  
  console.log(`${MODULE_NAME} 成功保存 ${dataType}:`, {
    count: data.length,
    metadata: updates.importMetadata[dataType]
  });
  
  return {
    success: true,
    count: data.length
  };
}

/**
 * 导入 Excel 文件
 * @param {File} file - Excel 文件
 * @param {string} dataType - 数据类型（students/words）
 * @param {(p:{phase:string,progress?:number,message?:string})=>void} [onProgress] - 进度回调
 * @returns {Promise<Object>} 导入结果
 */
async function importExcelFile(file, dataType, onProgress) {
  try {
    console.log(`${MODULE_NAME} 开始导入 ${dataType} Excel:`, file?.name || '(未命名)');

    // 0. 初始化提示
    try { onProgress && onProgress({ phase: 'start', progress: 0, message: `开始导入：${file?.name || ''}` }); } catch (_) {}

    // 1. 读取文件
    const arrayBuffer = await readFile(file, onProgress);

    // 2. 解析 Excel
    try { onProgress && onProgress({ phase: 'parse-start', progress: 0.35, message: '正在解析 Excel...' }); } catch (_) {}
    const rawData = parseExcelData(arrayBuffer);
    try { onProgress && onProgress({ phase: 'parse', progress: 0.6, message: '解析完成，正在校验...' }); } catch (_) {}

    // 3. 验证和清理数据
    const validation = validateAndCleanData(rawData, dataType);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        data: []
      };
    }

    // 3.5 若为单词表，解析并复制图片资源
    let finalData = validation.data;
    const warnings = Array.isArray(validation.warnings) ? validation.warnings.slice() : [];
    if (dataType === DATA_TYPES.WORDS) {
      try { onProgress && onProgress({ phase: 'assets', progress: 0.8, message: '正在处理图片资源...' }); } catch (_) {}
      const res = await normalizeWordImages(finalData);
      finalData = res.list;
      if (Array.isArray(res.warnings) && res.warnings.length) warnings.push(...res.warnings);
    }

    try { onProgress && onProgress({ phase: 'validate', progress: 0.9, message: '校验完成，正在保存...' }); } catch (_) {}

    // 4. 保存到存储
    const metadata = {
      filename: file.name,
      filepath: file.path || null,
      sourceType: SOURCE_TYPES.EXCEL
    };

    try { onProgress && onProgress({ phase: 'save', progress: 0.95, message: '正在保存...' }); } catch (_) {}
    await saveToStore(finalData, dataType, metadata);

    console.log(`${MODULE_NAME} 成功导入 ${dataType}:`, Array.isArray(finalData) ? finalData.length : 0);

    try { onProgress && onProgress({ phase: 'done', progress: 1, message: '完成' }); } catch (_) {}

    return {
      success: true,
      data: finalData,
      count: Array.isArray(finalData) ? finalData.length : 0,
      filename: file.name,
      warnings
    };

  } catch (error) {
    console.error(`${MODULE_NAME} 导入失败:`, error);
    return {
      success: false,
      error: error.message || '导入失败',
      data: []
    };
  }
}

/**
 * 规范化单词对象中的图片字段：
 * - 本地路径通过 AssetService 复制到 assets/user 并返回相对路径
 * - 远程 URL 原样保留（提示离线不可用）
 * - 已在 assets/ 下的路径原样保留
 */
async function normalizeWordImages(list) {
  if (!Array.isArray(list)) return { list: [], warnings: [] };
  const out = [];
  const warnings = [];
  const offlineWarned = new Set();

  const isHttp = (s) => /^https?:\/\//i.test(s);
  const isAssetsPath = (s) => /^assets\//i.test(s);

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') { continue; }
    const cur = { ...entry };
    const raw = typeof cur.imagePath === 'string' ? cur.imagePath.trim() : '';
    if (raw) {
      if (isAssetsPath(raw)) {
        // 已经是 assets 内部资源
        cur.imagePath = raw.replace(/\\/g, '/');
      } else if (isHttp(raw)) {
        cur.imagePath = raw;
        if (!offlineWarned.has('remote')) {
          warnings.push('检测到远程图片 URL，离线模式下可能无法显示');
          offlineWarned.add('remote');
        }
      } else if (window.AssetService && typeof window.AssetService.copyImage === 'function') {
        try {
          const res = await window.AssetService.copyImage(raw);
          if (res && res.success && res.url) {
            cur.imagePath = res.url;
          } else {
            cur.imagePath = null;
            warnings.push(`图片未找到或无法复制：${raw}`);
          }
        } catch (e) {
          cur.imagePath = null;
          warnings.push(`图片处理失败：${raw}`);
        }
      } else {
        // 资源服务不可用，保留原始值但提示
        warnings.push('图片资源服务不可用，已保留原始路径，可能无法访问');
        cur.imagePath = raw;
      }
    } else {
      cur.imagePath = null;
    }
    out.push(cur);
  }

  return { list: out, warnings };
}

/**
 * 导入测试数据
 * @param {Array} data - 测试数据
 * @param {string} dataType - 数据类型（students/words）
 * @returns {Promise<Object>} 导入结果
 */
async function importTestData(data, dataType) {
  try {
    console.log(`${MODULE_NAME} 导入测试数据 ${dataType}:`, Array.isArray(data) ? data.length : 0);
    
    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: false,
        error: '测试数据为空',
        data: []
      };
    }
    
    let prepared = data;
    if (dataType === DATA_TYPES.WORDS) {
      prepared = normalizeWordListForImport(data);
      if (!prepared.length) {
        return {
          success: false,
          error: '测试数据为空',
          data: []
        };
      }
    } else if (dataType === DATA_TYPES.STUDENTS) {
      const deduped = [];
      const seen = new Set();
      for (const item of data) {
        const name = normalizeWhitespace(item);
        if (!name || seen.has(name)) {
          continue;
        }
        seen.add(name);
        deduped.push(name);
      }
      prepared = deduped;
      if (!prepared.length) {
        return {
          success: false,
          error: '测试数据为空',
          data: []
        };
      }
    }
    
    const metadata = {
      filename: 'test-data',
      filepath: null,
      sourceType: SOURCE_TYPES.TEST
    };
    
    await saveToStore(prepared, dataType, metadata);
    
    return {
      success: true,
      data: prepared,
      count: prepared.length,
      filename: 'test-data'
    };
    
  } catch (error) {
    console.error(`${MODULE_NAME} 导入测试数据失败:`, error);
    return {
      success: false,
      error: error.message || '导入测试数据失败',
      data: []
    };
  }
}

/**
 * 批量导入两个 Excel 文件（学生和单词）
 * @param {File} studentsFile - 学生名单文件
 * @param {File} wordsFile - 单词列表文件
 * @param {(p:{phase:string,progress?:number,message?:string})=>void} [onProgress] - 总进度回调
 * @returns {Promise<Object>} 导入结果
 */
async function importBothFiles(studentsFile, wordsFile, onProgress) {
  const results = {
    students: null,
    words: null,
    success: false,
    errors: [],
    warnings: []
  };
  
  try {
    let progA = 0, progB = 0;
    const update = () => {
      try { onProgress && onProgress({ phase: 'batch', progress: (progA + progB) / 2, message: '正在导入 2 个文件...' }); } catch (_) {}
    };
    const mkCb = (label, setter) => (p) => {
      const m = (() => {
        switch (p?.phase) {
          case 'read': return `正在读取${label}文件...`;
          case 'parse-start':
          case 'parse': return `正在解析${label}数据...`;
          case 'validate': return `正在校验${label}数据...`;
          case 'save': return `正在保存${label}数据...`;
          case 'done': return `${label}导入完成`;
          default: return `正在导入${label}...`;
        }
      })();
      const v = typeof p?.progress === 'number' ? p.progress : (p?.phase === 'done' ? 1 : 0);
      setter(v);
      try { onProgress && onProgress({ phase: 'batch', progress: (progA + progB) / 2, message: m }); } catch (_) {}
    };

    // 并行导入两个文件
    const [studentsResult, wordsResult] = await Promise.all([
      importExcelFile(studentsFile, DATA_TYPES.STUDENTS, mkCb('学生', (v)=>{ progA = Math.max(progA, v); update(); })),
      importExcelFile(wordsFile, DATA_TYPES.WORDS, mkCb('单词', (v)=>{ progB = Math.max(progB, v); update(); }))
    ]);
    
    results.students = studentsResult;
    results.words = wordsResult;
    
    if (!studentsResult.success) {
      results.errors.push(`学生名单: ${studentsResult.error}`);
    } else if (Array.isArray(studentsResult.warnings) && studentsResult.warnings.length) {
      results.warnings.push(...studentsResult.warnings.map(w => `学生名单：${w}`));
    }
    
    if (!wordsResult.success) {
      results.errors.push(`单词列表: ${wordsResult.error}`);
    } else if (Array.isArray(wordsResult.warnings) && wordsResult.warnings.length) {
      results.warnings.push(...wordsResult.warnings.map(w => `单词列表：${w}`));
    }
    
    results.success = studentsResult.success && wordsResult.success;
    
    return results;
    
  } catch (error) {
    console.error(`${MODULE_NAME} 批量导入失败:`, error);
    results.errors.push(error.message || '导入失败');
    return results;
  }
}

/**
 * 获取当前导入的数据统计
 * @returns {Object} 数据统计
 */
function getImportStats() {
  if (!window.PersistenceService) {
    return null;
  }
  
  const result = window.PersistenceService.getState();
  if (!result.success || !result.data) {
    return null;
  }
  
  const { students, words, importMetadata } = result.data;
  
  return {
    students: {
      count: Array.isArray(students) ? students.length : 0,
      metadata: importMetadata?.students || null
    },
    words: {
      count: Array.isArray(words) ? words.length : 0,
      metadata: importMetadata?.words || null
    }
  };
}

// 文件类型检测辅助函数
const HEADER_HINTS = {
  students: ['姓名', 'name', 'student', '学生', 'student name', '同学'],
  words: ['单词', 'word', 'vocabulary', '词汇', '词表', '英文', '英语']
};

const FILENAME_HINTS = {
  students: ['student', 'students', 'stu', '名单', '学生', 'class', '班', '花名册', 'roster'],
  words: ['word', 'words', 'vocabulary', 'vocab', '单词', '词汇', '词表', '英文', '英语']
};

function detectDataTypeFromHeaders(rawData) {
  if (!Array.isArray(rawData) || rawData.length === 0) return null;
  const headerRow = rawData[0];
  if (!Array.isArray(headerRow)) return null;
  const normalized = headerRow.map((cell) => (cell == null ? '' : String(cell).trim().toLowerCase()));
  const containsAny = (tokens) => tokens.some((t) => normalized.some((h) => h.includes(String(t).toLowerCase())));
  if (containsAny(HEADER_HINTS.students)) return DATA_TYPES.STUDENTS;
  if (containsAny(HEADER_HINTS.words)) return DATA_TYPES.WORDS;
  return null;
}

function detectDataTypeFromFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const name = filename.toLowerCase();
  const hitStudents = FILENAME_HINTS.students.some((k) => name.includes(k.toLowerCase()));
  const hitWords = FILENAME_HINTS.words.some((k) => name.includes(k.toLowerCase()));
  if (hitStudents && !hitWords) return DATA_TYPES.STUDENTS;
  if (hitWords && !hitStudents) return DATA_TYPES.WORDS;
  return null; // 模糊或无法判断
}

async function detectFileType(file) {
  const filename = file?.name || '';
  try {
    const arrayBuffer = await readFile(file);
    const rawData = parseExcelData(arrayBuffer);
    const typeFromHeader = detectDataTypeFromHeaders(rawData);
    if (typeFromHeader) {
      return { type: typeFromHeader, basis: 'header' };
    }
  } catch (e) {
    const byName = detectDataTypeFromFilename(filename);
    if (byName) {
      return { type: byName, basis: 'filename', reason: `Excel 解析失败，基于文件名推断：${e?.message || ''}` };
    }
    return { type: 'unknown', basis: 'failed', reason: e?.message || '解析失败' };
  }
  const byName = detectDataTypeFromFilename(filename);
  if (byName) {
    return { type: byName, basis: 'filename' };
  }
  return { type: 'unknown', basis: 'unknown', reason: '未能从表头或文件名识别' };
}

// 导出模块
window.DataImporter = Object.freeze({
  SOURCE_TYPES,
  DATA_TYPES,
  importExcelFile,
  importTestData,
  importBothFiles,
  getImportStats,
  detectFileType,
  utils: Object.freeze({
    normalizeWhitespace,
    sanitizeTags,
    normalizeWordEntry,
    normalizeWordListForImport
  })
});
