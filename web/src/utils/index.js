import { createUid } from 'simple-mind-map/src/utils'

// 全屏事件检测
const getOnfullscreEnevt = () => {
  if (document.documentElement.requestFullScreen) {
    return 'onfullscreenchange'
  } else if (document.documentElement.webkitRequestFullScreen) {
    return 'onwebkitfullscreenchange'
  } else if (document.documentElement.mozRequestFullScreen) {
    return 'onmozfullscreenchange'
  } else if (document.documentElement.msRequestFullscreen) {
    return 'onmsfullscreenchange'
  }
}

export const fullscrrenEvent = getOnfullscreEnevt()

// 全屏
export const fullScreen = element => {
  if (element.requestFullScreen) {
    element.requestFullScreen()
  } else if (element.webkitRequestFullScreen) {
    element.webkitRequestFullScreen()
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen()
  }
}

// 文件转buffer
export const fileToBuffer = file => {
  return new Promise(r => {
    const reader = new FileReader()
    reader.onload = () => {
      r(reader.result)
    }
    reader.readAsArrayBuffer(file)
  })
}

// 复制文本到剪贴板
export const copy = text => {
  // 使用textarea可以保留换行
  const input = document.createElement('textarea')
  // input.setAttribute('value', text)
  input.innerHTML = text
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

// 复制文本到剪贴板
export const setDataToClipboard = data => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(data)
  }
}

// 复制图片到剪贴板
export const setImgToClipboard = img => {
  if (navigator.clipboard && navigator.clipboard.write) {
    const data = [new ClipboardItem({ ['image/png']: img })]
    navigator.clipboard.write(data)
  }
}

// 打印大纲
export const printOutline = el => {
  const printContent = el.outerHTML
  const iframe = document.createElement('iframe')
  iframe.setAttribute('style', 'position: absolute; width: 0; height: 0;')
  document.body.appendChild(iframe)
  const iframeDoc = iframe.contentWindow.document
  // 将当前页面的所有样式添加到iframe中
  const styleList = document.querySelectorAll('style')
  Array.from(styleList).forEach(el => {
    iframeDoc.write(el.outerHTML)
  })
  // 设置打印展示方式 - 纵向展示
  iframeDoc.write('<style media="print">@page {size: portrait;}</style>')
  // 写入内容
  iframeDoc.write('<div>' + printContent + '</div>')
  setTimeout(function() {
    iframe.contentWindow?.print()
    document.body.removeChild(iframe)
  }, 500)
}

export const getParentWithClass = (el, className) => {
  if (el.classList.contains(className)) {
    return el
  }
  if (el.parentNode && el.parentNode !== document.body) {
    return getParentWithClass(el.parentNode, className)
  }
  return null
}

// 转换数据为Markdown列表格式
export const transformToMarkdownList = (root) => {
  let str = ''
  const htmlToPlain = (html) => {
    if (!html && html !== '') return ''
    // 使用 DOM 解析 HTML 并取出纯文本，兼容 <br> 和实体
    try {
      const div = document.createElement('div')
      div.innerHTML = html
      let txt = div.textContent || div.innerText || ''
      // 把换行和多空格合并为单个空格
      txt = txt.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()
      return txt
    } catch (e) {
      // 回退：去掉标签
      return ('' + html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    }
  }
  const walk = (node, level) => {
    const raw = node.data && node.data.text != null ? node.data.text : ''
    const text = htmlToPlain(raw)
    const prefix = '  '.repeat(level) + '- '
    str += prefix + text + '\n'
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        walk(child, level + 1)
      })
    }
  }
  walk(root, 0)
  return str
}

// 将 Markdown 列表转换为思维导图数据结构
export const transformMarkdownListToData = (md) => {
  const lines = md.split(/\r?\n/).filter(l => l.trim() !== '')
  const root = { data: { text: '', uid: createUid(), richText: false }, children: [] }
  const stack = [{ level: -1, node: root }]

  lines.forEach(line => {
    const match = line.match(/^(\s*)[-*]\s+(.*)$/)
    if (!match) return
    const spaces = match[1] || ''
    const text = match[2] || ''
    const level = Math.floor(spaces.length / 2)
    const newNode = {
      data: {
        text: text,
        uid: createUid(),
        richText: false
      },
      children: []
    }

    // 找到父节点：栈顶的 level < current level
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }
    const parent = stack[stack.length - 1].node
    parent.children.push(newNode)
    stack.push({ level, node: newNode })
  })

  return root
}

// 将 Markdown 行内格式（**bold**, *italic*) 转为简单的 HTML 富文本字符串
const escapeHtml = (s) => {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const mdInlineToHtml = (s) => {
  if (!s) return ''
  let t = escapeHtml(s)
  // 优先处理加粗 **text** 或 __text__
  t = t.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>')
  // 再处理斜体 *text* 或 _text_
  t = t.replace(/(\*|_)([^*_]+?)\1/g, '<em>$2</em>')
  return t
}

// 为 transformMarkdownListToData 提供富文本支持：如果行内包含 markdown 样式，设置 richText 并把 text 置为富文本 HTML
const originalTransform = transformMarkdownListToData
export const transformMarkdownListToDataWithRich = (md) => {
  const tree = originalTransform(md)
  const walk = (node) => {
    if (node && node.data && typeof node.data.text === 'string') {
      const raw = node.data.text
      // 简单检测是否包含行内 markdown 标记
      if (/\*\*.+?\*\*|__.+?__|\*[^\s].+?\*|_[^\s].+?_/.test(raw)) {
        node.data.richText = true
        node.data.text = `<p><span>${mdInlineToHtml(raw)}</span></p>`
      } else {
        node.data.richText = false
        node.data.text = escapeHtml(raw)
      }
    }
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => walk(child))
    }
  }
  walk(tree)
  return tree
}

// 将已解析的树（simple-mind-map 风格）中的行内 Markdown 转为富文本 HTML
export const applyInlineMarkdownToTree = (tree) => {
  const walk = (node) => {
    if (node && node.data && typeof node.data.text === 'string') {
      const raw = node.data.text
      if (/\*\*.+?\*\*|__.+?__|\*[^\s].+?\*|_[^\s].+?_/.test(raw)) {
        node.data.richText = true
        node.data.text = `<p><span>${mdInlineToHtml(raw)}</span></p>`
      } else {
        node.data.richText = false
        node.data.text = escapeHtml(raw)
      }
    }
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => walk(child))
    }
  }
  walk(tree)
  return tree
}