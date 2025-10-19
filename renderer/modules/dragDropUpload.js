// 拖拽上传 Excel 覆盖层与导入逻辑
(function(){
  const NS = '[DragDropUpload]';
  let dragCounter = 0;
  let overlayEl = null;

  function ensureOverlay() {
    overlayEl = document.getElementById('dragOverlay');
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'dragOverlay';
      overlayEl.className = 'drag-overlay';
      overlayEl.innerHTML = `
        <div class="drag-box">
          <div class="drag-icon">📥</div>
          <div class="drag-text">拖拽 Excel 文件到此处导入</div>
          <div class="drag-subtext">支持 .xlsx/.xls；可同时拖入学生名单与单词列表</div>
        </div>
      `;
      document.body.appendChild(overlayEl);
    }
    return overlayEl;
  }

  function showOverlay() {
    ensureOverlay();
    overlayEl?.classList.add('visible');
  }
  function hideOverlay() {
    overlayEl?.classList.remove('visible');
    overlayEl?.classList.remove('over');
    dragCounter = 0;
  }

  function markOver(isOver) {
    ensureOverlay();
    overlayEl?.classList.toggle('over', !!isOver);
  }

  function hasFiles(evt) {
    try {
      const types = evt?.dataTransfer?.types;
      return types && (Array.from(types).includes('Files') || Array.from(evt.dataTransfer.items || []).some(it => it.kind === 'file'));
    } catch (e) { return false; }
  }

  function isExcelFile(file) {
    if (!file || !file.name) return false;
    return /(\.xlsx|\.xls)$/i.test(file.name);
  }

  async function handleDroppedFiles(files) {
    const excelFiles = Array.from(files || []).filter(isExcelFile);
    if (!excelFiles.length) {
      window.Feedback?.showError('未检测到 Excel 文件（仅支持 .xlsx/.xls）');
      return;
    }
    if (!window.DataImporter) {
      window.Feedback?.showError('数据导入模块未加载，请稍后重试');
      return;
    }

    try {
      // 先识别类型
      const detections = await Promise.all(excelFiles.map(async (f) => {
        try {
          const res = await window.DataImporter.detectFileType(f);
          return { file: f, type: res?.type || 'unknown', basis: res?.basis, reason: res?.reason };
        } catch (e) {
          return { file: f, type: 'unknown', basis: 'failed', reason: e?.message || '识别失败' };
        }
      }));

      const studentsFile = detections.find(d => d.type === window.DataImporter.DATA_TYPES.STUDENTS)?.file || null;
      const wordsFile = detections.find(d => d.type === window.DataImporter.DATA_TYPES.WORDS)?.file || null;

      if (excelFiles.length === 1) {
        const d = detections[0];
        if (d.type === 'unknown') {
          showChooseTypeDialog(d.file, async (chosenType) => {
            await importSingle(d.file, chosenType);
          });
        } else {
          await importSingle(d.file, d.type);
        }
        return;
      }

      // 多文件：尽量导入学生+单词各一个
      if (studentsFile && wordsFile) {
        const others = excelFiles.filter(f => f !== studentsFile && f !== wordsFile);
        await importBoth(studentsFile, wordsFile, others.length);
        return;
      }

      // 仅识别到一种类型
      if (studentsFile || wordsFile) {
        const file = studentsFile || wordsFile;
        const type = studentsFile ? window.DataImporter.DATA_TYPES.STUDENTS : window.DataImporter.DATA_TYPES.WORDS;
        const others = excelFiles.filter(f => f !== file);
        await importSingle(file, type, others.length);
        return;
      }

      // 多个但都无法识别：让用户选择第一个
      showChooseTypeDialog(excelFiles[0], async (chosenType) => {
        await importSingle(excelFiles[0], chosenType, excelFiles.length - 1);
      });
    } catch (e) {
      console.error(NS, '处理拖拽文件失败:', e);
      window.Feedback?.showError(`导入失败：${e.message || '未知错误'}`);
    }
  }

  async function importSingle(file, type, ignoredCount = 0) {
    if (!file || !type) return;
    const tipType = type === window.DataImporter.DATA_TYPES.STUDENTS ? '学生' : '单词';
    try {
      const task = async () => {
        const res = await window.DataImporter.importExcelFile(file, type, (p) => {
          try {
            const msg = (() => {
              switch (p?.phase) {
                case 'read': return `正在读取${tipType}文件...`;
                case 'parse-start':
                case 'parse': return `正在解析${tipType}数据...`;
                case 'validate': return `正在校验${tipType}数据...`;
                case 'save': return `正在保存${tipType}数据...`;
                case 'done': return `${tipType}导入完成`;
                default: return `正在导入${tipType}...`;
              }
            })();
            if (typeof p?.progress === 'number') window.LoadingOverlay?.setProgress(p.progress);
            window.LoadingOverlay?.setMessage(msg);
          } catch (_) {}
        });
        return res;
      };

      const res = window.LoadingOverlay
        ? await window.LoadingOverlay.run(task, { message: `正在导入${tipType}...`, determinate: true })
        : await task();

      if (res && res.success) {
        if (type === window.DataImporter.DATA_TYPES.STUDENTS) {
          try { window.setStudents && window.setStudents(res.data); } catch (e) {}
        } else if (type === window.DataImporter.DATA_TYPES.WORDS) {
          try { window.setWords && window.setWords(res.data); } catch (e) {}
        }
        const suffix = ignoredCount > 0 ? `（已忽略 ${ignoredCount} 个额外文件）` : '';
        window.Feedback?.showSuccess(`✅ 已导入${tipType}：${res.count} ${suffix}`);
        if (Array.isArray(res.warnings) && res.warnings.length) {
          window.Feedback?.showWarning(`注意：\n${res.warnings.join('\n')}`);
        }
      } else {
        window.Feedback?.showError(`❌ 导入失败：${res?.error || '未知错误'}`);
      }
    } catch (e) {
      window.Feedback?.showError(`❌ 导入异常：${e?.message || '未知错误'}`);
    }
  }

  async function importBoth(studentsFile, wordsFile, ignoredCount = 0) {
    try {
      const task = async () => {
        const results = await window.DataImporter.importBothFiles(studentsFile, wordsFile, (p) => {
          try {
            if (typeof p?.progress === 'number') window.LoadingOverlay?.setProgress(p.progress);
            const msg = p?.message || '正在导入 2 个文件...';
            window.LoadingOverlay?.setMessage(msg);
          } catch (_) {}
        });
        return results;
      };

      const results = window.LoadingOverlay
        ? await window.LoadingOverlay.run(task, { message: '正在导入 2 个文件...', determinate: true })
        : await task();

      if (results && results.success) {
        if (results.students?.success) {
          try { window.setStudents && window.setStudents(results.students.data); } catch (e) {}
        }
        if (results.words?.success) {
          try { window.setWords && window.setWords(results.words.data); } catch (e) {}
        }
        let msg = `✅ 数据已自动保存！\n学生: ${results.students?.count || 0} 名\n单词: ${results.words?.count || 0} 个`;
        if (ignoredCount > 0) msg += `\n已忽略 ${ignoredCount} 个额外文件`;
        window.Feedback?.showSuccess(msg);
        if (Array.isArray(results?.warnings) && results.warnings.length) {
          window.Feedback?.showWarning(`注意：\n${results.warnings.join('\n')}`);
        }
      } else {
        const errorMsg = Array.isArray(results?.errors) && results.errors.length ? results.errors.join('\n') : '导入失败';
        window.Feedback?.showError(`❌ 导入失败：\n${errorMsg}`);
      }
    } catch (e) {
      window.Feedback?.showError(`❌ 导入异常：${e?.message || '未知错误'}`);
    }
  }

  function showChooseTypeDialog(file, onChoose) {
    if (document.getElementById('chooseTypeModal')) return;
    const modal = document.createElement('div');
    modal.id = 'chooseTypeModal';
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>请选择文件类型</h3>
        <p>无法自动识别 “${file?.name || '未命名'}” 的类型，请选择：</p>
        <div class="modal-buttons">
          <button id="chooseStudentsBtn" class="btn-secondary">学生名单</button>
          <button id="chooseWordsBtn" class="btn-secondary">单词列表</button>
          <button id="chooseCancelBtn" class="btn-primary">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const cleanup = () => { try { modal.remove(); } catch (e) {} };
    document.getElementById('chooseStudentsBtn')?.addEventListener('click', async () => {
      try { await onChoose(window.DataImporter.DATA_TYPES.STUDENTS); } finally { cleanup(); }
    });
    document.getElementById('chooseWordsBtn')?.addEventListener('click', async () => {
      try { await onChoose(window.DataImporter.DATA_TYPES.WORDS); } finally { cleanup(); }
    });
    document.getElementById('chooseCancelBtn')?.addEventListener('click', cleanup);
  }

  function bindDragDropEvents() {
    // 阻止默认浏览器行为（如在 Electron 中打开文件）
    window.addEventListener('dragover', (e) => { e.preventDefault(); });
    window.addEventListener('drop', (e) => { e.preventDefault(); });

    document.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounter++;
      showOverlay();
    });

    document.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      markOver(true);
    });

    document.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) {
        hideOverlay();
      }
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = e?.dataTransfer?.files || [];
      hideOverlay();
      if (files && files.length) {
        await handleDroppedFiles(files);
      }
    });
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        ensureOverlay();
        bindDragDropEvents();
        console.log(NS, '已初始化');
      }, { once: true });
    } else {
      ensureOverlay();
      bindDragDropEvents();
      console.log(NS, '已初始化');
    }
  }

  init();
})();
