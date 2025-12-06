import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'

const md = `- 插件开源在Github：[Achuan-2/illustrator_sci_toolbox](https://github.com/Achuan-2/illustrator_sci_toolbox)

  目前插件还具有其他功能

  - 复制粘贴相对位置
  - 形状大小批量复制
  - 一键排列图片：可以批量调整图片宽高、一键排列整齐
  - 交换两个形状的位置
  - 一键添加label，一键更新label编号`

const tree = fromMarkdown(md, {
  extensions: [gfm()],
  mdastExtensions: [...gfmFromMarkdown]
})

console.log(JSON.stringify(tree, null, 2))
