import { imgToDataUrl } from 'simple-mind-map/src/utils/index'
import markdown from 'simple-mind-map/src/parse/markdown.js'
import { transformMarkdownListToDataWithRich } from './index.js'

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
  // Markdown列表
  const trimText = text.trim()
  if (/^(\-|\*|\d+\.)\s/.test(trimText) || /^#+\s/.test(trimText)) {
    try {
      // 优先使用简单的列表解析器，将列表项直接转换为子节点
      const parsed = transformMarkdownListToDataWithRich(text)
      if (parsed && parsed.children && parsed.children.length > 0) {
        return {
          simpleMindMap: true,
          data: parsed.children
        }
      }

      // 回退：使用原来的完整 Markdown 解析器
      const res = markdown.transformMarkdownTo(text)
      if (res) {
        let root = res.root || res
        if (root.children && root.children.length > 0) {
          return {
            simpleMindMap: true,
            data: root.children
          }
        } else if (root.data) {
          return {
            simpleMindMap: true,
            data: [root]
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }
  return ''
}

export default handleClipboardText
