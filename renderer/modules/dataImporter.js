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

  const firstHeaderCell = header[0] == null ? '' : String(header[0]).trim().toLowerCase();
  const needStudents = dataType === DATA_TYPES.STUDENTS;
  const needWords = dataType === DATA_TYPES.WORDS;

  const okStudents = ['姓名', 'name', 'student', '学生', 'student name'].some(k => firstHeaderCell.includes(k.toLowerCase()));
  const okWords = ['单词', 'word', 'vocabulary', '词汇'].some(k => firstHeaderCell.includes(k.toLowerCase()));

  if (needStudents && !okStudents) {
    return { valid: false, error: '未检测到表头“姓名”。请确认第一行第一列为“姓名”。', data: [] };
  }
  if (needWords && !okWords) {
    return { valid: false, error: '未检测到表头“单词”。请确认第一行第一列为“单词”。', data: [] };
  }

  const cleaned = [];
  const seen = new Set();
  let emptyRows = 0;
  let invalidRows = 0;
  let duplicateCount = 0;

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!Array.isArray(row)) { invalidRows++; continue; }
    const cell = row[0];
    if (cell == null) { emptyRows++; continue; }
    if (typeof cell !== 'string' && typeof cell !== 'number') { invalidRows++; continue; }

    const value = String(cell).trim();
    if (!value) { emptyRows++; continue; }

    if (seen.has(value)) { duplicateCount++; continue; }
    seen.add(value);
    cleaned.push(value);
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
    try { onProgress && onProgress({ phase: 'validate', progress: 0.75, message: '校验完成，正在保存...' }); } catch (_) {}

    // 4. 保存到存储
    const metadata = {
      filename: file.name,
      filepath: file.path || null,
      sourceType: SOURCE_TYPES.EXCEL
    };

    try { onProgress && onProgress({ phase: 'save', progress: 0.9, message: '正在保存...' }); } catch (_) {}
    await saveToStore(validation.data, dataType, metadata);

    console.log(`${MODULE_NAME} 成功导入 ${dataType}:`, validation.count);

    try { onProgress && onProgress({ phase: 'done', progress: 1, message: '完成' }); } catch (_) {}

    return {
      success: true,
      data: validation.data,
      count: validation.count,
      filename: file.name,
      warnings: validation.warnings || []
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
 * 导入测试数据
 * @param {Array<string>} data - 测试数据
 * @param {string} dataType - 数据类型（students/words）
 * @returns {Promise<Object>} 导入结果
 */
async function importTestData(data, dataType) {
  try {
    console.log(`${MODULE_NAME} 导入测试数据 ${dataType}:`, data.length);
    
    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: false,
        error: '测试数据为空',
        data: []
      };
    }
    
    const metadata = {
      filename: 'test-data',
      filepath: null,
      sourceType: SOURCE_TYPES.TEST
    };
    
    await saveToStore(data, dataType, metadata);
    
    return {
      success: true,
      data: data,
      count: data.length,
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
  detectFileType
});
