// 导入持久化服务
import './services/persistence.js';
// 导入模块
import './renderer/modules/feedback.js';
import './renderer/modules/dataImporter.js';
import './renderer/modules/drawStrategy.js';
// 导入主脚本逻辑
import './script.js';
// 启动管理（恢复对话）
import './renderer/modules/startupManager.js';

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
