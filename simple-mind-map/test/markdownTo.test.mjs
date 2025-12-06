import { transformMarkdownTo } from '../src/parse/markdownTo.js'

const cases = [
  { name: 'paragraph - bold', md: '**加粗**' },
  { name: 'paragraph - strike', md: '~~删除线~~' },
  { name: 'list - bold', md: '- **加粗**' },
  { name: 'list - strike', md: '- ~~删除线~~' },
  { name: 'heading - bold', md: '# **加粗** 标题' },
  { name: 'nested list', md: '- 项目1\n  - **子项加粗**\n  - ~~子项删除线~~' }
  ,{ name: 'text with hyphen + strike', md: '粘贴 - ~~思源导图~~' }
  ,{ name: 'text with strike', md: '粘贴 ~~思源导图~~' }
  // 链接测试
  ,{ name: 'list - siyuan link', md: '- [思源笔记丨思维导图mindmap插件](siyuan://blocks/20251123204056-lsxs9hl)' }
  ,{ name: 'list - block ref', md: "- ((20251123204056-lsxs9hl '思源笔记丨思维导图mindmap插件'))" }
  ,{ name: 'list - web link', md: '- [网页链接](https://github.com/Achuan-2/siyuan-plugin-simplemindmap/issues/19)' }
  ,{ name: 'paragraph - web link', md: '[网页链接](https://github.com/Achuan-2/siyuan-plugin-simplemindmap/issues/19)' }
  ,{ name: 'paragraph - block ref', md: "((20251123204056-lsxs9hl '思源笔记丨思维导图mindmap插件'))" }
  ,{ name: 'mixed links', md: '- [思源笔记丨思维导图mindmap插件](siyuan://blocks/20251123204056-lsxs9hl)\n- ((20251123204056-lsxs9hl \'思源笔记丨思维导图mindmap插件\'))\n- [网页链接](https://github.com/Achuan-2/siyuan-plugin-simplemindmap/issues/19)\n[网页链接](https://github.com/Achuan-2/siyuan-plugin-simplemindmap/issues/19)' }
  // 列表段落层级测试
  ,{ name: 'list with paragraph children', md: `- 插件开源在Github：[Achuan-2/illustrator_sci_toolbox](https://github.com/Achuan-2/illustrator_sci_toolbox)

  目前插件还具有其他功能

  - 复制粘贴相对位置
  - 形状大小批量复制
  - 一键排列图片：可以批量调整图片宽高、一键排列整齐
  - 交换两个形状的位置
  - 一键添加label，一键更新label编号` }
]

for (const c of cases) {
  try {
    const res = transformMarkdownTo(c.md)
    console.log('***', c.name, '***')
    console.log(JSON.stringify(res, null, 2))
  } catch (e) {
    console.error('Error for', c.name, e)
  }
}

console.log('\nTest complete')

