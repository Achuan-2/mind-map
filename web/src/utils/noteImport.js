import markdown from 'simple-mind-map/src/parse/markdown.js'

// 思源API调用
export async function fetchSyncPost(url, data, returnType = 'json') {
  const init = {
    method: "POST",
  };
  if (data) {
    if (data instanceof FormData) {
      init.body = data;
    } else {
      init.body = JSON.stringify(data);
    }
  }
  try {
    const res = await fetch(url, init);
    const res2 = returnType === 'json' ? await res.json() : await res.text();
    return res2;
  } catch (e) {
    console.log(e);
    return returnType === 'json' ? { code: e.code || 1, msg: e.message || "", data: null } : "";
  }
}

// 清理文本：转换思源特有的 HTML 标签，保留富文本样式
export function cleanText(text) {
  if (!text) return ''
  
  let result = text
  
  // 转换 HTML 实体
  result = result
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
  
  // 转换思源富文本标签为标准 HTML
  result = result.replace(/<span\s+data-type="strong"[^>]*>([\s\S]*?)<\/span>/gi, '<strong>$1</strong>')
  result = result.replace(/<span\s+data-type="em"[^>]*>([\s\S]*?)<\/span>/gi, '<em>$1</em>')
  result = result.replace(/<span\s+data-type="s"[^>]*>([\s\S]*?)<\/span>/gi, '<del>$1</del>')
  result = result.replace(/<span\s+data-type="u"[^>]*>([\s\S]*?)<\/span>/gi, '<u>$1</u>')
  result = result.replace(/<span\s+data-type="mark"[^>]*>([\s\S]*?)<\/span>/gi, '<mark>$1</mark>')
  result = result.replace(/<span\s+data-type="sup"[^>]*>([\s\S]*?)<\/span>/gi, '<sup>$1</sup>')
  result = result.replace(/<span\s+data-type="sub"[^>]*>([\s\S]*?)<\/span>/gi, '<sub>$1</sub>')
  
  // 移除带有 style 属性的 span 标签，只保留内容
  result = result.replace(/<span\s+[^>]*style="[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  
  // 移除思源特有的其他标签，只保留内容
  result = result.replace(/<span\s+data-type="(?:code|tag|kbd|text|block-ref|a)"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  
  // 移除剩余的空 span 标签
  result = result.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  
  // 移除其他思源特有标签
  result = result.replace(/<[^>]*data-type[^>]*>([\s\S]*?)<\/[^>]+>/gi, '$1')
  
  // 清理多余空格
  result = result.replace(/\s+/g, ' ').trim()
  
  return result
}

// 检查文本是否包含富文本标签
export function hasRichTextTags(text) {
  return /<(strong|em|del|u|mark|sup|sub)>/i.test(text)
}

// 递归清理所有节点的文本，并处理富文本
export function cleanNodeText(node) {
  if (node.data && node.data.text) {
    const cleanedText = cleanText(node.data.text)
    // 检查清理后的文本是否包含富文本标签
    if (hasRichTextTags(cleanedText)) {
      node.data.richText = true
      node.data.text = `<p><span>${cleanedText}</span></p>`
    } else {
      node.data.text = cleanedText
    }
  }
  if (node.children && node.children.length > 0) {
    // 过滤掉空节点(文本为空、只有空白字符或只有零宽字符)
    // 但保留有图片或其他数据的节点
    node.children = node.children.filter(child => {
      // 如果有图片、链接等数据，保留节点
      if (child.data?.image || child.data?.hyperlink || child.data?.note) {
        return true
      }
      
      const text = child.data?.text || ''
      // 移除 HTML 标签和零宽字符后检查是否为空
      const stripped = text
        .replace(/<[^>]+>/g, '') // 移除 HTML 标签
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零宽字符
        .trim()
      return stripped.length > 0
    })
    node.children.forEach(cleanNodeText)
  }
}

// 按层级限制裁剪节点树
export function trimByLevel(node, currentLevel = 1, maxLevel = 0) {
  if (maxLevel > 0 && currentLevel >= maxLevel) {
    node.children = []
  } else if (node.children && node.children.length > 0) {
    node.children.forEach(child => trimByLevel(child, currentLevel + 1, maxLevel))
  }
}

// 转换大纲数据为思维导图格式
export function convertOutlineToMindmap(outline, currentLevel = 1, maxLevel = 0) {
  if (!outline || !Array.isArray(outline)) return []
  
  // 如果设置了最大层级且当前层级超过限制，返回空数组
  if (maxLevel > 0 && currentLevel > maxLevel) {
    return []
  }

  return outline.map(item => {
    const text = cleanText(item.name || item.content || '')
    const node = {
      data: {
        hyperlink: `siyuan://blocks/${item.id}`,
        hyperlinkTitle: text.replace(/<[^>]+>/g, '') // 链接标题使用纯文本
      },
      children: []
    }

    // 处理富文本
    if (hasRichTextTags(text)) {
      node.data.richText = true
      node.data.text = `<p><span>${text}</span></p>`
    } else {
      node.data.text = text
    }

    // 处理子节点 (blocks 或 children)
    if (item.blocks && item.blocks.length > 0) {
      node.children = convertOutlineToMindmap(item.blocks, currentLevel + 1, maxLevel)
    }
    if (item.children && item.children.length > 0) {
      node.children = node.children.concat(convertOutlineToMindmap(item.children, currentLevel + 1, maxLevel))
    }

    return node
  })
}

// 导入文档大纲
export async function importOutline(blockId, blockInfo, maxLevel = 0) {
  const res = await fetchSyncPost('/api/outline/getDocOutline', {
    id: blockId
  })

  if (res.code !== 0 || !res.data) {
    throw new Error('Get outline failed')
  }

  const outline = res.data
  const docTitle = cleanText(blockInfo.content || blockInfo.name || '文档')

  return {
    data: {
      text: docTitle,
      hyperlink: `siyuan://blocks/${blockId}`,
      hyperlinkTitle: docTitle
    },
    children: convertOutlineToMindmap(outline, 1, maxLevel)
  }
}

// 导入内容
export async function importContent(blockId, blockInfo, maxLevel = 0, currentImageUrl = '') {
  const res = await fetchSyncPost('/api/export/exportMdContent', {
    id: blockId,
    yfm: false,
    fillCSSVar: true,
    adjustHeadingLevel: true,
    imgTag: false
  })

  if (!res?.data?.content) {
    throw new Error('Export markdown content failed')
  }

  // 清理 Markdown 内容中的 HTML 实体
  let mdContent = res.data.content
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")

  // 过滤掉当前思维导图图片的引用（避免循环引用）
  if (currentImageUrl) {
    console.log('[NoteImport] Current image URL:', currentImageUrl)
    console.log('[NoteImport] Content before filter (first 500 chars):', mdContent.substring(0, 500))
    
    // 提取图片文件名（支持 assets/xxx.png 和 /assets/xxx.png 格式）
    const imageFileName = currentImageUrl.split('/').pop()
    
    // 匹配多种可能的图片引用格式
    const patterns = [
      new RegExp(`!\\[.*?\\]\\([^)]*${imageFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
      new RegExp(`!\\[.*?\\]\\(/?assets/${imageFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
      new RegExp(`!\\[.*?\\]\\(\\./assets/${imageFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g')
    ]
    
    patterns.forEach(pattern => {
      mdContent = mdContent.replace(pattern, '')
    })
    
    console.log('[NoteImport] Content after filter (first 500 chars):', mdContent.substring(0, 500))
    
    // 清理连续的空行（过滤图片后可能产生）
    mdContent = mdContent.replace(/\n{3,}/g, '\n\n')
  }

  const title = cleanText(blockInfo.content || blockInfo.name || '内容')

  // 使用 markdown 解析器转换
  const parsed = await markdown.transformMarkdownToWithImages(mdContent)

  let root
  if (parsed.children && parsed.children.length > 0) {
    if (parsed.children.length === 1) {
      root = parsed.children[0]
    } else {
      root = {
        data: {
          text: title,
          hyperlink: `siyuan://blocks/${blockId}`,
          hyperlinkTitle: title
        },
        children: parsed.children
      }
    }
  } else {
    root = {
      data: {
        text: title,
        hyperlink: `siyuan://blocks/${blockId}`,
        hyperlinkTitle: title
      },
      children: []
    }
  }

  // 清理所有节点文本
  cleanNodeText(root)

  // 应用层级限制
  if (maxLevel > 0) {
    trimByLevel(root, 1, maxLevel)
  }

  // 为根节点添加链接（如果还没有）
  if (!root.data.hyperlink) {
    root.data.hyperlink = `siyuan://blocks/${blockId}`
    root.data.hyperlinkTitle = title
  }

  return root
}

// 应用自动编号
export function applyAutoNumber(node, prefix = '') {
  if (!node.children || node.children.length === 0) return

  node.children.forEach((child, index) => {
    const num = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
    const text = child.data.text || ''
    
    // 检查是否已有编号，避免重复添加
    if (!/^\d+(\.\d+)*\s/.test(text)) {
      child.data.text = `${num} ${text}`
    }

    // 递归处理子节点
    applyAutoNumber(child, num)
  })
}
