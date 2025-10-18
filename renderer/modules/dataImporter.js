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
 * @returns {Promise<ArrayBuffer>} 文件内容
 */
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsArrayBuffer(file);
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
  
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel 文件中没有找到工作表');
  }
  
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
  
  return jsonData;
}

/**
 * 验证和清理解析后的数据
 * @param {Array} rawData - 原始数据数组
 * @param {string} dataType - 数据类型（students/words）
 * @returns {Object} 验证结果
 */
function validateAndCleanData(rawData, dataType) {
  if (!Array.isArray(rawData)) {
    return {
      valid: false,
      error: '数据格式不正确',
      data: []
    };
  }
  
  // 跳过表头（第一行）
  const result = [];
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && row[0]) {
      const value = row[0].toString().trim();
      if (value) {
        result.push(value);
      }
    }
  }
  
  if (result.length === 0) {
    return {
      valid: false,
      error: `${dataType === DATA_TYPES.STUDENTS ? '学生名单' : '单词列表'}中没有找到有效数据`,
      data: []
    };
  }
  
  return {
    valid: true,
    data: result,
    count: result.length
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
 * @returns {Promise<Object>} 导入结果
 */
async function importExcelFile(file, dataType) {
  try {
    console.log(`${MODULE_NAME} 开始导入 ${dataType} Excel:`, file.name);
    
    // 1. 读取文件
    const arrayBuffer = await readFile(file);
    
    // 2. 解析 Excel
    const rawData = parseExcelData(arrayBuffer);
    
    // 3. 验证和清理数据
    const validation = validateAndCleanData(rawData, dataType);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        data: []
      };
    }
    
    // 4. 保存到存储
    const metadata = {
      filename: file.name,
      filepath: file.path || null,
      sourceType: SOURCE_TYPES.EXCEL
    };
    
    await saveToStore(validation.data, dataType, metadata);
    
    console.log(`${MODULE_NAME} 成功导入 ${dataType}:`, validation.count);
    
    return {
      success: true,
      data: validation.data,
      count: validation.count,
      filename: file.name
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
 * @returns {Promise<Object>} 导入结果
 */
async function importBothFiles(studentsFile, wordsFile) {
  const results = {
    students: null,
    words: null,
    success: false,
    errors: []
  };
  
  try {
    // 并行导入两个文件
    const [studentsResult, wordsResult] = await Promise.all([
      importExcelFile(studentsFile, DATA_TYPES.STUDENTS),
      importExcelFile(wordsFile, DATA_TYPES.WORDS)
    ]);
    
    results.students = studentsResult;
    results.words = wordsResult;
    
    if (!studentsResult.success) {
      results.errors.push(`学生名单: ${studentsResult.error}`);
    }
    
    if (!wordsResult.success) {
      results.errors.push(`单词列表: ${wordsResult.error}`);
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

// 导出模块
window.DataImporter = Object.freeze({
  SOURCE_TYPES,
  DATA_TYPES,
  importExcelFile,
  importTestData,
  importBothFiles,
  getImportStats
});
