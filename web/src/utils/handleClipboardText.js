import { imgToDataUrl } from 'simple-mind-map/src/utils/index'
import markdown from 'simple-mind-map/src/parse/markdown.js'

// 处理知犀
const handleZHIXI = async data => {
  try {
    try {
      if (!Array.isArray(data)) {
        data = String(data).replace('￿﻿', '')
        data = JSON.parse(data)
      }
    } catch (error) {
      console.log(error)
    }
    if (!Array.isArray(data)) {
      data = []
    }
    const newNodeList = []
    const waitLoadImageList = []
    const walk = (list, newList) => {
      list.forEach(async item => {
        let newRoot = {}
        newList.push(newRoot)
        newRoot.data = {
          text: item.data.text,
          hyperlink: item.data.hyperlink,
          hyperlinkTitle: item.data.hyperlinkTitle,
          note: item.data.note
        }
        // 图片
        if (item.data.image) {
          let resolve = null
          let promise = new Promise(_resolve => {
            resolve = _resolve
          })
          waitLoadImageList.push(promise)
          try {
            newRoot.data.image = await imgToDataUrl(item.data.image)
            newRoot.data.imageSize = item.data.imageSize
            resolve()
          } catch (error) {
            resolve()
          }
        }
        // 子节点
        newRoot.children = []
        if (item.children && item.children.length > 0) {
          const children = []
          item.children.forEach(item2 => {
            // 概要
            if (item2.data.type === 'generalize') {
              newRoot.data.generalization = [
                {
                  text: item2.data.text
                }
              ]
            } else {
              children.push(item2)
            }
          })
          walk(children, newRoot.children)
        }
      })
    }
    walk(data, newNodeList)
    await Promise.all(waitLoadImageList)
    return {
      simpleMindMap: true,
      data: newNodeList
    }
  } catch (error) {
    return ''
  }
}

const handleClipboardText = async text => {
  // 知犀数据格式1
  try {
    let parsedData = JSON.parse(text)
    if (parsedData.__c_zx_v !== undefined) {
      const res = await handleZHIXI(parsedData.children)
      return res
    }
  } catch (error) {}
  // 知犀数据格式2
  if (text.includes('￿﻿')) {
    const res = await handleZHIXI(text)
    return res
  }
  
  // 检测思源块链接: siyuan://blocks/xxx
  const trimText = text.trim()
  const siyuanLinkMatch = trimText.match(/^siyuan:\/\/blocks\/([a-zA-Z0-9-]+)$/)
  if (siyuanLinkMatch) {
    const blockId = siyuanLinkMatch[1]
    try {
      // 获取块信息
      const res = await fetch('/api/query/sql', {
        method: 'POST',
        body: JSON.stringify({
          stmt: `SELECT * FROM blocks WHERE id = '${blockId}'`
        })
      })
      const data = await res.json()
      
      let title = '未命名'
      if (data && data.code === 0 && data.data && data.data.length > 0) {
        const block = data.data[0]
        title = block.content || block.name || '未命名'
        // 移除HTML标签
        title = title.replace(/<[^>]+>/g, '')
      }
      
      // 返回特殊格式,指示应该添加超链接到当前节点
      return {
        simpleMindMap: true,
        addHyperlinkToActiveNode: true,
        hyperlink: trimText,
        hyperlinkTitle: title
      }
    } catch (error) {
      console.error('获取思源块信息失败:', error)
      // 即使获取失败,也返回链接
      return {
        simpleMindMap: true,
        addHyperlinkToActiveNode: true,
        hyperlink: trimText,
        hyperlinkTitle: '思源笔记'
      }
    }
  }
  
  // Markdown判断: 列表/标题/加粗/斜体/删除线/链接/图片/行内代码/思源块引用等
  // 使用多行模式 (m) 以便检测到非首行处的列表或标题（例如粘贴文本中第2行开始的列表）
  const markdownDetect = /(^([\-\*]|\d+\.)\s)|(^#+\s)|(\*\*[^*\n]+\*\*)|(__[^\n_]+__)|(~{2}[^~\n]+~{2})|(`[^`\n]+`)|(!?\[[^\]]+\]\([^\)]+\))|(\(\([a-zA-Z0-9-]+\s+['"][^'"]+['"]\)\))/m
  if (markdownDetect.test(trimText)) {
    try {
      const res = await markdown.transformMarkdownToWithImages(text)
      console.log(res)
      if (res && res.children && res.children.length > 0) {
        // 返回所有子节点,支持多节点粘贴
        return {
          simpleMindMap: true,
          data: res.children
        }
      }
    } catch (e) {
      console.error(e)
    }
  }
  return ''
}

export default handleClipboardText
