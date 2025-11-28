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
