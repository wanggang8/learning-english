#!/usr/bin/env python3
"""
创建单词列表示例Excel文件的脚本
"""

import openpyxl
from pathlib import Path

def create_words_excel(filename, words):
    """创建单词Excel文件"""
    wb = openpyxl.Workbook()
    ws = wb.active
    
    # 设置表头
    ws['A1'] = '单词'
    ws['A1'].font = openpyxl.styles.Font(bold=True, size=12)
    
    # 写入单词列表
    for i, word in enumerate(words, start=2):
        ws[f'A{i}'] = word
    
    # 调整列宽
    ws.column_dimensions['A'].width = 20
    
    # 保存文件
    wb.save(filename)
    print(f'✓ 已创建: {filename}')

def main():
    # 确保data文件夹存在
    data_dir = Path('data')
    data_dir.mkdir(exist_ok=True)
    
    # 常用英语单词列表
    common_words = [
        'apple', 'banana', 'cat', 'dog', 'elephant',
        'fish', 'grape', 'house', 'ice', 'juice',
        'king', 'lion', 'monkey', 'nurse', 'orange',
        'pig', 'queen', 'rabbit', 'sun', 'tiger',
        'umbrella', 'violin', 'water', 'box', 'yellow',
        'zebra', 'book', 'chair', 'desk', 'egg',
        'flower', 'garden', 'hat', 'island', 'jacket',
        'kite', 'lamp', 'moon', 'nest', 'ocean',
        'pencil', 'quilt', 'river', 'star', 'tree',
        'uniform', 'vase', 'window', 'fox', 'zoo'
    ]
    
    # 创建单词Excel文件
    create_words_excel(data_dir / '单词列表.xlsx', common_words)
    
    print('\n✅ 单词列表Excel文件创建完成！')
    print(f'\n共 {len(common_words)} 个单词')
    print('\n使用方法：')
    print('  打开网页后，上传此文件作为单词列表')

if __name__ == '__main__':
    try:
        main()
    except ImportError:
        print('❌ 错误：未安装 openpyxl 库')
        print('\n请先安装依赖：')
        print('  pip install openpyxl')
    except Exception as e:
        print(f'❌ 错误：{e}')
