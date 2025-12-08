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
  const htmlToMarkdown = (html) => {
    if (!html && html !== '') return ''
    try {
      const div = document.createElement('div')
      div.innerHTML = html
      return convertToMarkdown(div)
    } catch (e) {
      // 回退:去掉标签
      return ('' + html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    }
  }
  const convertToMarkdown = (element) => {
    let result = ''
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase()
        const innerMarkdown = convertToMarkdown(child)
        switch (tagName) {
          case 'a':
            const href = child.getAttribute('href') || ''
            result += `[${innerMarkdown}](${href})`
            break
          case 'strong':
          case 'b':
            result += `**${innerMarkdown}**`
            break
          case 'em':
          case 'i':
            result += `*${innerMarkdown}*`
            break
          case 's':
          case 'del':
            result += `~~${innerMarkdown}~~`
            break
          case 'u':
            result += `<u>${innerMarkdown}</u>`
            break
          case 'span':
            // 处理数学公式
            if (child.classList.contains('ql-formula')) {
              const formula = child.getAttribute('data-value') || ''
              // 还原 HTML 实体
              const decodedFormula = formula
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
              result += `$${decodedFormula}$`
            } else {
              result += innerMarkdown
            }
            break
          default:
            result += innerMarkdown
            break
        }
      }
    }
    return result
  }
  const walk = (node, level) => {
    const raw = node.data && node.data.text != null ? node.data.text : ''
    const text = htmlToMarkdown(raw)
    const prefix = '  '.repeat(level) + '- '
    str += prefix + text
    if (node.data && node.data.hyperlink) {
      str += ` [🔗](${node.data.hyperlink})`
    }
    str += '\n'
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        walk(child, level + 1)
      })
    }
  }
  walk(root, 0)
  return str
}

// Convert dataURL to Blob
export const dataURLToBlob = (dataURL) => {
  if (!dataURL) return null
  const urlParts = dataURL.split(',')
  const mimeMatch = (urlParts[0] || '').match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : ''
  const base64 = urlParts[1] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}