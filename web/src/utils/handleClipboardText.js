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
  // Markdown判断: 列表/标题/加粗/斜体/删除线/链接/图片/行内代码/思源块引用等
  const trimText = text.trim()
  const markdownDetect = /(^([\-\*]|\d+\.)\s)|(^#+\s)|(\*\*[^*\n]+\*\*)|(__[^\n_]+__)|(~{2}[^~\n]+~{2})|(`[^`\n]+`)|(!?\[[^\]]+\]\([^\)]+\))|(\(\([a-zA-Z0-9-]+\s+['"][^'"]+['"]\)\))/
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
