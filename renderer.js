// 导入持久化服务
import './services/persistence.js';
// 统一通知组件（必须尽早加载）
import './renderer/components/toast.js';
// Loading 覆盖层（尽早加载以便全局可用）
import './renderer/components/loadingOverlay.js';
// 导入模块
import './renderer/modules/feedback.js';
import './renderer/modules/ttsController.js';
import './renderer/modules/ttsManager.js';
// Uncomment to enable TTS extensions demo for development/testing
// import './renderer/modules/ttsExtensionsDemo.js';
import './renderer/modules/dataImporter.js';
import './renderer/modules/drawStrategy.js';
// 事件总线与命令
import './renderer/modules/eventBus.js';
import './renderer/modules/commands.js';
// 组件
import './renderer/components/historyPanel.js';
import './renderer/components/shortcutHelp.js';
import './renderer/components/Flashcard.js';
import './renderer/components/wordDetailModal.js';
// 键盘管理器（依赖于 AppCommands 与组件）
import './renderer/modules/keyboardManager.js';
// 导入主脚本逻辑
import './script.js';
// 启动管理（恢复对话）
import './renderer/modules/startupManager.js';
import './renderer/modules/dragDropUpload.js';

// 设置持久化服务的统一错误提示
try {
    window.PersistenceService?.setErrorHandler?.((op, err) => {
        const msg = err?.message || '未知错误';
        (window.Toast?.error || window.Feedback?.showError || console.error)(`存储失败：${op}（${msg}）`);
    });
} catch (e) {}

// 检查持久化服务是否可用
if (window.PersistenceService && window.PersistenceService.isStoreAvailable()) {
    console.log('持久化服务已启用');
    
    // 尝试加载之前保存的数据
    const loadResult = window.PersistenceService.loadData();
    if (loadResult.success && loadResult.data) {
        console.log('已加载持久化数据:', loadResult.data);
        
        // 如果有数据，显示统计信息
        if (window.DataImporter) {
            const stats = window.DataImporter.getImportStats();
            if (stats) {
                console.log('数据统计:', stats);
            }
        }
    }

    // 非阻塞运行启动恢复流程
    window.addEventListener('DOMContentLoaded', () => {
        window.StartupManager && window.StartupManager.runStartupFlow();
    });
} else {
    console.warn('持久化服务不可用，将使用内存存储');
}
