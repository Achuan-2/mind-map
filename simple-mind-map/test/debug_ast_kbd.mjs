import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'

const md = 'Use <kbd>Ctrl</kbd>+<kbd>C</kbd>'
const tree = fromMarkdown(md, { extensions: [gfm()], mdastExtensions: [...gfmFromMarkdown] })
console.log(JSON.stringify(tree, null, 2))
