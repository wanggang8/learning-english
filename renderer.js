// 导入持久化服务
import './services/persistence.js';
// 导入主脚本逻辑
import './script.js';

// 检查持久化服务是否可用
if (window.PersistenceService && window.PersistenceService.isStoreAvailable()) {
    console.log('持久化服务已启用');
    
    // 尝试加载之前保存的数据
    const loadResult = window.PersistenceService.loadData();
    if (loadResult.success && loadResult.data) {
        console.log('已加载持久化数据:', loadResult.data);
    }
} else {
    console.warn('持久化服务不可用，将使用内存存储');
}
