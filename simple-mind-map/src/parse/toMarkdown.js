import { walk, nodeRichTextToTextWithWrap } from '../utils'

// 将HTML中的<a>标签转换为Markdown链接格式
const convertHtmlToMarkdownLinks = html => {
  if (!html) return ''
  // 使用正则表达式替换<a>标签
  return html.replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (match, url, title) => {
    return `[${title}](${url})`
  })
}

const getNodeText = data => {
  if (data.richText) {
    // 先转换为纯文本，然后转换链接
    const textWithLinks = convertHtmlToMarkdownLinks(data.text)
    // 如果还有HTML标签，使用nodeRichTextToTextWithWrap处理其他标签
    return nodeRichTextToTextWithWrap(textWithLinks)
  } else {
    return data.text
  }
}

const getTitleMark = level => {
  return new Array(level).fill('#').join('')
}

const getIndentMark = level => {
  return new Array(level - 6).fill('   ').join('') + '*'
}

// 转换成markdown格式
export const transformToMarkdown = root => {
  let content = ''
  walk(
    root,
    null,
    (node, parent, isRoot, layerIndex) => {
      const level = layerIndex + 1
      if (level <= 6) {
        content += getTitleMark(level)
      } else {
        content += getIndentMark(level)
      }
      content += ' ' + getNodeText(node.data)
      // 节点超链接
      if (node.data.hyperlink) {
        content += ` [🔗](${node.data.hyperlink})`
      }
      // 概要
      const generalization = node.data.generalization
      if (Array.isArray(generalization)) {
        content += generalization.map(item => {
          return ` [${getNodeText(item)}]`
        })
      } else if (generalization && generalization.text) {
        const generalizationText = getNodeText(generalization)
        content += ` [${generalizationText}]`
      }
      content += '\n\n'
      // 备注
      if (node.data.note) {
        content += node.data.note + '\n\n'
      }
    },
    () => {},
    true
  )
  return content
}
