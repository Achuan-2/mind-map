import { transformMarkdownTo } from '../src/parse/markdownTo.js'

const examples = [
  {
    name: '示例1 - 列表里的段落优化',
    md: `#### 列表里的段落优化

搜索

- 三所示
- 搜索
`
  },
  {
    name: '示例2 - 段落后面跟列表优化',
    md: `#### 段落后面跟列表优化

搜索

- 三所示
- 搜索
`
  }
]

for (const ex of examples) {
  console.log('====', ex.name, '====')
  try {
    const result = transformMarkdownTo(ex.md)
    console.log(JSON.stringify(result, null, 2))
  } catch (e) {
    console.error('Error parsing example:', e)
  }
  console.log('\n')
}

console.log('测试完成')
