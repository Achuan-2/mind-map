import { transformMarkdownTo } from '../src/parse/markdownTo.js'

const md = `- 1

  - ![image](assets/image-20251126095242-p3l8ghu.png)`

console.log('测试只有图片的列表项\n')
console.log('输入 Markdown:')
console.log(md)
console.log('\n' + '='.repeat(80) + '\n')

const result = transformMarkdownTo(md)

console.log('解析结果:')
console.log(JSON.stringify(result, null, 2))
