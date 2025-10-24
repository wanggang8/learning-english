#!/usr/bin/env python3
"""
创建单词列表示例Excel文件的脚本
支持 Phase 2.1.1 扩展列：音标、释义、例句、标签、图片
"""

import openpyxl
from pathlib import Path

HEADERS = ['单词', '音标', '释义', '例句', '标签', '图片']

def create_words_excel(filename, words):
    """创建带有扩展字段的单词Excel文件"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Vocabulary'

    ws.append(HEADERS)

    for word_info in words:
        tags = word_info.get('tags')
        if isinstance(tags, (list, tuple)):
            tags_text = ', '.join(str(tag) for tag in tags if tag is not None)
        elif tags is None:
            tags_text = None
        else:
            tags_text = str(tags)
        ws.append([
            word_info.get('word'),
            word_info.get('phonetic'),
            word_info.get('definition'),
            word_info.get('example'),
            tags_text,
            word_info.get('image')
        ])

    column_widths = {
        'A': 18,
        'B': 18,
        'C': 40,
        'D': 60,
        'E': 24,
        'F': 28
    }
    for col, width in column_widths.items():
        ws.column_dimensions[col].width = width

    header_font = openpyxl.styles.Font(bold=True, size=12)
    for cell in ws[1]:
        cell.font = header_font

    wb.save(filename)
    print(f'✓ 已创建: {filename}')

def main():
    data_dir = Path('data')
    data_dir.mkdir(exist_ok=True)

    words_data = [
        {
            'word': 'apple',
            'phonetic': '/ˈæpl/',
            'definition': 'n. 苹果；苹果树',
            'example': 'An apple a day keeps the doctor away.',
            'tags': ['水果', '基础词汇'],
            'image': ''
        },
        {
            'word': 'brave',
            'phonetic': '/breɪv/',
            'definition': 'adj. 勇敢的；无畏的',
            'example': 'The brave student volunteered to lead the team.',
            'tags': ['品格', '励志'],
            'image': ''
        },
        {
            'word': 'lantern',
            'phonetic': '/ˈlæntərn/',
            'definition': 'n. 灯笼；提灯',
            'example': 'We made a paper lantern for the Mid-Autumn Festival.',
            'tags': ['节日', '手工制作'],
            'image': ''
        },
        {
            'word': 'ocean',
            'phonetic': '/ˈoʊʃn/',
            'definition': 'n. 海洋；大海',
            'example': 'Whales live in the deep ocean.',
            'tags': ['自然', '动物'],
            'image': ''
        },
        {
            'word': 'puzzle',
            'phonetic': '/ˈpʌzl/',
            'definition': 'n. 谜题；拼图游戏',
            'example': 'This English word puzzle is so much fun!',
            'tags': ['游戏', '课堂活动'],
            'image': ''
        }
    ]

    create_words_excel(data_dir / '单词列表.xlsx', words_data)

    print('\n✅ 单词列表Excel文件创建完成！')
    print(f'\n共 {len(words_data)} 个示例单词')
    print('\n列说明：')
    print('  - 单词：必填；用于抽取与展示')
    print('  - 音标：可选；示例采用英式音标')
    print('  - 释义：可选；用于闪卡背面内容')
    print('  - 例句：可选；支持多行文本')
    print('  - 标签：可选；多个标签使用逗号分隔')
    print('  - 图片：可选；填写本地图片路径或网络地址')

if __name__ == '__main__':
    try:
        main()
    except ImportError:
        print('❌ 错误：未安装 openpyxl 库')
        print('\n请先安装依赖：')
        print('  pip install openpyxl')
    except Exception as e:
        print(f'❌ 错误：{e}')
