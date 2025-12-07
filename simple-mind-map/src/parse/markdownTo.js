import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'

// HTML 转义函数
const escapeHtml = (s) => {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// KaTeX 渲染（用于在导入时把 $...$ / $$...$$ 转为 HTML/MathML）
import katex from 'katex'

const renderLatex = (expr, displayMode = false) => {
  try {
    // 使用 mathml 输出以兼容原有渲染（Formula 插件也使用 mathml 输出）
    return katex.renderToString(expr, { throwOnError: false, displayMode, output: 'mathml' })
  } catch (e) {
    return escapeHtml(displayMode ? `$$${expr}$$` : `$${expr}$`)
  }
}

// 属性值转义（用于 data-value）
const escapeAttr = (s) => {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 生成 Quill 公式嵌入的 HTML：<span class="ql-formula" data-value="...">...</span>
const renderLatexWrapped = (expr, displayMode = false) => {
  try {
    const katexHtml = katex.renderToString(expr, { throwOnError: false, displayMode, output: 'mathml' })
    // 包裹为 Quill formula blot 的结构，保持 contenteditable=false 以匹配编辑器行为
    return `<span class="ql-formula" data-value="${escapeAttr(expr)}"><span contenteditable="false">${katexHtml}</span></span>`
  } catch (e) {
    return escapeHtml(displayMode ? `$$${expr}$$` : `$${expr}$`)
  }
}

// 在一段纯文本中查找并渲染 LaTeX，返回 { text, replaced }
// $$...$$ 和 $...$ 都处理为行内公式（inline mode）
const processTextWithLatex = (text) => {
  if (!text || text.indexOf('$') === -1) return { text: escapeHtml(text), replaced: false }

  let replaced = false
  let out = ''
  let lastIndex = 0

  // 先匹配 $$...$$，转换为行内公式（与 $...$ 相同处理）
  const displayRegex = /\$\$([\s\S]+?)\$\$/g
  let m
  while ((m = displayRegex.exec(text)) !== null) {
    const idx = m.index
    const expr = m[1]
    if (idx > lastIndex) {
      out += escapeHtml(text.substring(lastIndex, idx))
    }
    out += renderLatexWrapped(expr, false)
    replaced = true
    lastIndex = displayRegex.lastIndex
  }
  // 如果有 $$...$$ 且已经处理过，则把剩余尾部加入并返回
  if (lastIndex > 0) {
    if (lastIndex < text.length) out += escapeHtml(text.substring(lastIndex))
    return { text: out, replaced }
  }

  // 否则处理行内 $...$
  lastIndex = 0
  const inlineRegex = /\$([^\$\n]+?)\$/g
  while ((m = inlineRegex.exec(text)) !== null) {
    const idx = m.index
    const expr = m[1]
    if (idx > lastIndex) {
      out += escapeHtml(text.substring(lastIndex, idx))
    }
    out += renderLatexWrapped(expr, false)
    replaced = true
    lastIndex = inlineRegex.lastIndex
  }
  if (lastIndex > 0) {
    if (lastIndex < text.length) out += escapeHtml(text.substring(lastIndex))
    return { text: out, replaced }
  }

  // 没有匹配到 LaTeX，直接转义
  return { text: escapeHtml(text), replaced: false }
}

// 思源块引用正则: ((blockId 'title')) 或 ((blockId "title"))
// 标题部分匹配:不包含 ")) 序列的任意字符
const siyuanBlockRefRegex = /\(\(([a-zA-Z0-9-]+)\s+['"](.+?)['"]\)\)/g

// 将思源块引用格式转换为 siyuan:// 链接
const convertSiyuanBlockRef = (text) => {
  // 使用更严格的正则:标题部分不能包含 ")) 序列
  const singleMatch = /^\(\(([a-zA-Z0-9-]+)\s+['"]((?:(?!\)\)).)+)['"]\)\)$/.test(text)
  if (singleMatch) {
    const match = text.match(/^\(\(([a-zA-Z0-9-]+)\s+['"]((?:(?!\)\)).)+)['"]\)\)$/)
    return {
      url: `siyuan://blocks/${match[1]}`,
      title: match[2]
    }
  }
  return null
}

// 将文本中的思源块引用转换为 HTML 链接，同时渲染 LaTeX（如果有）
const convertInlineBlockRefs = (text) => {
  // 快速路径：没有块引用也没有 $ 时，直接返回转义文本
  if (!text.includes('((') && text.indexOf('$') === -1) return { text: escapeHtml(text), hasRichText: false }

  // 先用正则替换块引用为临时占位 HTML（链接）
  let hasBlockRef = false
  const result = text.replace(siyuanBlockRefRegex, (match, blockId, title) => {
    hasBlockRef = true
    const url = `siyuan://blocks/${blockId}`
    return `<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(title)}</a>`
  })

  // 如果包含块引用，逐段处理：对普通文本段落做转义并渲染 LaTeX，块引用保持为链接 HTML
  if (hasBlockRef) {
    const blockRefRegex = /\(\(([a-zA-Z0-9-]+)\s+['"](.+?)['"]\)\)/g
    const blockRefMatches = []
    let blockRefMatch
    while ((blockRefMatch = blockRefRegex.exec(text)) !== null) {
      blockRefMatches.push({
        start: blockRefMatch.index,
        end: blockRefMatch.index + blockRefMatch[0].length,
        blockId: blockRefMatch[1],
        title: blockRefMatch[2]
      })
    }

    let finalResult = ''
    let lastIndex = 0
    blockRefMatches.forEach(ref => {
      if (ref.start > lastIndex) {
        const seg = text.substring(lastIndex, ref.start)
        const processed = processTextWithLatex(seg)
        finalResult += processed.text
      }
      const url = `siyuan://blocks/${ref.blockId}`
      finalResult += `<a href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(ref.title)}</a>`
      lastIndex = ref.end
    })
    if (lastIndex < text.length) {
      const seg = text.substring(lastIndex)
      const processed = processTextWithLatex(seg)
      finalResult += processed.text
    }

    return { text: finalResult, hasRichText: true }
  }

  // 没有块引用但可能包含 LaTeX
  const processed = processTextWithLatex(text)
  return { text: processed.text, hasRichText: processed.replaced }
}

// 从节点中提取链接信息(仅当节点只包含一个链接时)
const getNodeLink = node => {
  if (!node.children) return null
  
  // 检查是否只有一个子节点且为链接
  const children = node.children.filter(item => item.type !== 'text' || (item.value && item.value.trim()))
  
  if (children.length === 1 && children[0].type === 'link') {
    const linkNode = children[0]
    // 获取链接文本
    let linkText = ''
    if (linkNode.children) {
      linkNode.children.forEach(child => {
        if (child.type === 'text') {
          linkText += child.value || ''
        }
      })
    }
    return {
      url: linkNode.url,
      title: linkText || linkNode.title || ''
    }
  }
  
  // 检查是否是思源块引用格式的纯文本
  if (children.length === 1 && children[0].type === 'text') {
    const blockRef = convertSiyuanBlockRef(children[0].value.trim())
    if (blockRef) {
      return blockRef
    }
  }
  
  return null
}

// 从节点中提取文本,支持行内样式(emphasis, strong, delete, link)
const getNodeText = (node) => {
  if (node.type === 'list') return { text: '', hasRichText: false }
  
  let textStr = ''
  let hasRichText = false

  ;(node.children || []).forEach(item => {
    if (item.type === 'text') {
      // 普通文本,需要转义并处理块引用
      let value = item.value || ''
      // (之前有将 $$...$$ 转换为 $...$ 的处理，已移除，改为使用 katex 渲染)
      // 移除文本中的 <kbd>...</kbd> 标签，保留并转义内部文本
      value = value.replace(/<kbd>([\s\S]*?)<\/kbd>/gi, (m, g1) => escapeHtml(g1))
      // 首先检查是否是纯块引用格式
      const blockRef = convertSiyuanBlockRef(value.trim())
      if (blockRef) {
        // 纯块引用,直接使用标题
        textStr += escapeHtml(blockRef.title)
      } else {
        // 检查文本中是否包含块引用
        const result = convertInlineBlockRefs(value)
        textStr += result.text
        if (result.hasRichText) hasRichText = true
      }
    } else if (item.type === 'inlineCode') {
      // 行内代码
      textStr += escapeHtml(item.value || '')
    } else if (item.type === 'link') {
      const childResult = getNodeText(item)
      // 行内链接: 生成 <a> 标签保留超链接
      hasRichText = true
      const linkUrl = item.url || ''
      textStr += `<a href="${escapeHtml(linkUrl)}" target="_blank">${childResult.text}</a>`
    } else if (item.type === 'emphasis') {
      // 斜体 *text*
      hasRichText = true
      const childResult = getNodeText(item)
      textStr += `<em>${childResult.text}</em>`
    } else if (item.type === 'strong') {
      // 加粗 **text**
      hasRichText = true
      const childResult = getNodeText(item)
      textStr += `<strong>${childResult.text}</strong>`
    } else if (item.type === 'delete') {
      // 删除线 ~~text~~
      hasRichText = true
      const childResult = getNodeText(item)
      textStr += `<del>${childResult.text}</del>`
    } else if (item.type === 'underline') {
      // 下划线 (如果有 underline 类型)
      hasRichText = true
      const childResult = getNodeText(item)
      textStr += `<u>${childResult.text}</u>`
    } else if (item.type === 'html' && item.value) {
      // 处理 HTML 节点：移除所有 <kbd>...</kbd> 标签，保留标签内的纯文本（并转义）
      const htmlValue = item.value.trim()
      // 如果是单独的 <kbd> 或 </kbd> 节点，则跳过（kbd 内容通常作为相邻的 text 节点出现）
      if (/^<\s*kbd\s*>$/i.test(htmlValue) || /^<\s*\/\s*kbd\s*>$/i.test(htmlValue)) {
        // 跳过，不添加任何文本
      } else {
        // 全局替换所有 <kbd>...</kbd> 内容为转义后的文本（处理可能在同一节点内的情形）
        const processedHtml = htmlValue.replace(/<kbd>([\s\S]*?)<\/kbd>/gi, (m, g1) => {
          return escapeHtml(g1)
        })

        // 保留之前对下划线 <u> 的特殊处理
        if (processedHtml.startsWith('<u>') && processedHtml.endsWith('</u>')) {
          hasRichText = true
          const innerText = processedHtml.slice(3, -4) // 移除 <u> 和 </u>
          textStr += `<u>${escapeHtml(innerText)}</u>`
        } else {
          // 其他 HTML 片段，直接输出处理后的字符串
          textStr += processedHtml
        }
      }
    } else {
      // 其他类型,递归处理
      const childResult = getNodeText(item)
      textStr += childResult.text
      if (childResult.hasRichText) hasRichText = true
    }
  })

  return { text: textStr, hasRichText }
}

// 从节点中提取图片信息
const getNodeImage = node => {
  if (!node.children) return null
  
  for (let item of node.children) {
    if (item.type === 'image') {
      return {
        url: item.url,
        alt: item.alt || ''
      }
    }
    // 递归查找
    const childImage = getNodeImage(item)
    if (childImage) return childImage
  }
  
  return null
}

// 将 Blob 转换为 DataURL
const blobToDataURL = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(e)
    reader.readAsDataURL(blob)
  })
}

// 获取思源图片并转换为 base64
const getSiyuanImage = async (imageURL, reload) => {
  if (imageURL.startsWith('assets/')) {
    imageURL = 'http://127.0.0.1:6806/' + imageURL
  }
  try {
    const response = await fetch(imageURL, { cache: reload ? 'reload' : 'default' })
    if (!response.ok) return ""
    const blob = await response.blob()
    const base64 = await blobToDataURL(blob)
    return base64
  } catch (e) {
    console.error('Failed to fetch Siyuan image:', e)
    return ""
  }
}

// 获取图片尺寸
const getImageSize = (src) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
    }
    img.onerror = () => {
      resolve({ width: 100, height: 100 })
    }
    img.src = src
  })
}

// 处理思源图片:将图片 URL 转换为 base64 并获取实际尺寸
const processSiyuanImages = async (node) => {
  const promises = []
  const walk = (n) => {
    if (n.data && n.data.image && !n.data.image.startsWith('data:')) {
      promises.push((async () => {
        const base64 = await getSiyuanImage(n.data.image, false)
        if (base64) {
          n.data.image = base64
          const size = await getImageSize(base64)
          n.data.imageSize = {
            width: size.width,
            height: size.height
          }
        }
      })())
    }
    if (n.children && n.children.length > 0) {
      n.children.forEach(child => walk(child))
    }
  }
  walk(node)
  await Promise.all(promises)
}

// 处理list的情况
const handleList = node => {
  let list = []
  let walk = (arr, newArr) => {
    for (let i = 0; i < arr.length; i++) {
      let cur = arr[i]
      let node = {}
      
      // 只从第一个段落获取节点文本,其他段落作为子节点处理
      let textResult = { text: '', hasRichText: false }
      if (cur.children.length > 0 && cur.children[0].type === 'paragraph') {
        textResult = getNodeText(cur.children[0])
      }
      
      node.data = {
        text: textResult.text
      }
      
      // 如果包含富文本样式,需要包裹在 <p><span> 中
      if (textResult.hasRichText) {
        node.data.richText = true
        node.data.text = `<p><span>${textResult.text}</span></p>`
      } else {
        node.data.richText = false
      }
      
      node.children = []
      newArr.push(node)
      
      // 检查第一个子节点是否包含图片
      if (cur.children.length > 0 && cur.children[0].type === 'paragraph') {
        const imageInfo = getNodeImage(cur.children[0])
        if (imageInfo) {
          console.log('Found image in list (first child):', imageInfo.url)
          node.data.image = imageInfo.url
          node.data.imageTitle = imageInfo.alt
          node.data.imageSize = { width: 100, height: 100 }
        }
      }
      
      // 处理子节点(从索引1开始,跳过第一个已处理的段落)
      if (cur.children.length > 1) {
        for (let j = 1; j < cur.children.length; j++) {
          let cur2 = cur.children[j]
          if (cur2.type === 'list') {
            // 检查前一个节点是否是段落节点
            // 如果是,将列表作为该段落节点的子节点
            const prev = cur.children[j - 1]
            if (prev && prev.type === 'paragraph') {
              // 如果之前的段落还没有被处理
              if (!prev.__handled) {
                // 如果该段落是当前 list item 的第一个段落（用于 node.data），
                // 则不要再创建一个重复的段落子节点，直接把子列表作为当前节点的子节点
                const isFirstParagraph = (prev === cur.children[0])
                if (isFirstParagraph) {
                  // 直接把子列表项并入当前节点的 children
                  walk(cur2.children, node.children)
                  prev.__handled = true
                } else {
                  const paragraphNode = {}
                  const paragraphTextResult = getNodeText(prev)
                  paragraphNode.data = {
                    text: paragraphTextResult.text
                  }
                  if (paragraphTextResult.hasRichText) {
                    paragraphNode.data.richText = true
                    paragraphNode.data.text = `<p><span>${paragraphTextResult.text}</span></p>`
                  } else {
                    paragraphNode.data.richText = false
                  }
                  paragraphNode.children = []
                  node.children.push(paragraphNode)
                  prev.__handled = true
                  const lastChild = node.children[node.children.length - 1]
                  walk(cur2.children, lastChild.children)
                }
              } else {
                const lastChild = node.children[node.children.length - 1]
                walk(cur2.children, lastChild.children)
              }
            } else {
              walk(cur2.children, node.children)
            }
          } else if (cur2.type === 'paragraph') {
            // 跳过已由之前的 list 分支创建的段落
            if (cur2.__handled) continue
            // 检查段落中是否有图片(如果第一个子节点还没有设置图片)
            const imageInfo = getNodeImage(cur2)
            if (imageInfo && !node.data.image) {
              console.log('Found image in list (subsequent child):', imageInfo.url)
              node.data.image = imageInfo.url
              node.data.imageTitle = imageInfo.alt
              node.data.imageSize = { width: 100, height: 100 }
            } else if (!imageInfo) {
              // 如果段落没有图片,将段落作为子节点添加
              const paragraphNode = {}
              const paragraphTextResult = getNodeText(cur2)
              paragraphNode.data = {
                text: paragraphTextResult.text
              }
              if (paragraphTextResult.hasRichText) {
                paragraphNode.data.richText = true
                paragraphNode.data.text = `<p><span>${paragraphTextResult.text}</span></p>`
              } else {
                paragraphNode.data.richText = false
              }
              paragraphNode.children = []
              node.children.push(paragraphNode)
              // 标记该段落已被处理，避免后续子列表分支再次创建重复段落
              cur2.__handled = true
            }
          }
        }
      }
    }
  }
  walk(node.children, list)
  return list
}

// 将markdown转换成节点树
export const transformMarkdownTo = md => {
  const tree = fromMarkdown(md, {
    extensions: [gfm()],
    mdastExtensions: [...gfmFromMarkdown]
  })
  let root = {
    children: []
  }
  let childrenQueue = [root.children]
  let currentChildren = root.children
  let depthQueue = [-1]
  let currentDepth = -1
    for (let i = 0; i < tree.children.length; i++) {
    let cur = tree.children[i]
    if (cur.type === 'heading') {
      if (!cur.children[0]) continue
      // 创建新节点
      let node = {}
      
      // 获取节点文本和富文本标记
      const textResult = getNodeText(cur)
      node.data = {
        text: textResult.text
      }
      
      // 如果包含富文本样式,需要包裹在 <p><span> 中
      if (textResult.hasRichText) {
        node.data.richText = true
        node.data.text = `<p><span>${textResult.text}</span></p>`
      } else {
        node.data.richText = false
      }
      
      // 检查下一个块是否是段落且包含图片
      if (i + 1 < tree.children.length) {
        const nextNode = tree.children[i + 1]
        if (nextNode.type === 'paragraph') {
          const imageInfo = getNodeImage(nextNode)
          if (imageInfo) {
            node.data.image = imageInfo.url
            node.data.imageTitle = imageInfo.alt
            node.data.imageSize = { width: 100, height: 100 }
            // 跳过下一个段落节点,因为它已经被处理为图片
            i++
          }
        }
      }
      
      node.children = []
      // 如果当前的层级大于上一个节点的层级，那么是其子节点
      if (cur.depth > currentDepth) {
        // 添加到上一个节点的子节点列表里
        currentChildren.push(node)
        // 更新当前栈和数据
        childrenQueue.push(node.children)
        currentChildren = node.children
        depthQueue.push(cur.depth)
        currentDepth = cur.depth
      } else if (cur.depth === currentDepth) {
        // 如果当前层级等于上一个节点的层级，说明它们是同级节点
        // 将上一个节点出栈
        childrenQueue.pop()
        currentChildren = childrenQueue[childrenQueue.length - 1]
        depthQueue.pop()
        currentDepth = depthQueue[depthQueue.length - 1]
        // 追加到上上个节点的子节点列表里
        currentChildren.push(node)
        // 更新当前栈和数据
        childrenQueue.push(node.children)
        currentChildren = node.children
        depthQueue.push(cur.depth)
        currentDepth = cur.depth
      } else {
        // 如果当前层级小于上一个节点的层级，那么一直出栈，直到遇到比当前层级小的节点
        while (depthQueue.length) {
          childrenQueue.pop()
          currentChildren = childrenQueue[childrenQueue.length - 1]
          depthQueue.pop()
          currentDepth = depthQueue[depthQueue.length - 1]
          if (currentDepth < cur.depth) {
            // 追加到该节点的子节点列表里
            currentChildren.push(node)
            // 更新当前栈和数据
            childrenQueue.push(node.children)
            currentChildren = node.children
            depthQueue.push(cur.depth)
            currentDepth = cur.depth
            break
          }
        }
      }
    } else if (cur.type === 'list') {
      // 如果前一个 AST 节点是段落，则把列表作为该段落节点的子节点
      const prevTreeNode = tree.children[i - 1]
      if (prevTreeNode && prevTreeNode.type === 'paragraph' && currentChildren.length > 0) {
        const lastChild = currentChildren[currentChildren.length - 1]
        if (lastChild) {
          lastChild.children.push(...handleList(cur))
        } else {
          currentChildren.push(...handleList(cur))
        }
      } else {
        currentChildren.push(...handleList(cur))
      }
    } else if (cur.type === 'paragraph') {
      // 处理段落: 把段落作为单独的节点加入当前层级
      if (!cur.children || !cur.children.length) continue
      
      let node = {}
      const textResult = getNodeText(cur)
      node.data = {
        text: textResult.text
      }
      if (textResult.hasRichText) {
        node.data.richText = true
        node.data.text = `<p><span>${textResult.text}</span></p>`
      } else {
        node.data.richText = false
      }
      node.children = []
      // 检查段落中是否包含图片
      const imageInfo = getNodeImage(cur)
      if (imageInfo) {
        node.data.image = imageInfo.url
        node.data.imageTitle = imageInfo.alt
        node.data.imageSize = { width: 100, height: 100 }
      }
      currentChildren.push(node)
    }
  }
  // 返回 root 对象,包含所有顶级节点
  return root
}

// 将 markdown 转换成节点树并处理思源图片
export const transformMarkdownToWithImages = async (md) => {
  const result = transformMarkdownTo(md)
  if (result && result.children) {
    // 处理所有子节点的图片
    for (const node of result.children) {
      await processSiyuanImages(node)
    }
  }
  return result
}
