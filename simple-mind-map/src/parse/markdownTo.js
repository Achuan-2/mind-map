import { fromMarkdown } from 'mdast-util-from-markdown'

// HTML 转义函数
const escapeHtml = (s) => {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// 从节点中提取文本,支持行内样式(emphasis, strong)
const getNodeText = node => {
  if (node.type === 'list') return { text: '', hasRichText: false }
  
  let textStr = ''
  let hasRichText = false

  ;(node.children || []).forEach(item => {
    if (item.type === 'text') {
      // 普通文本,需要转义
      textStr += escapeHtml(item.value || '')
    } else if (item.type === 'inlineCode') {
      // 行内代码
      textStr += escapeHtml(item.value || '')
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
      
      // 处理子节点
      if (cur.children.length > 1) {
        for (let j = 1; j < cur.children.length; j++) {
          let cur2 = cur.children[j]
          if (cur2.type === 'list') {
            walk(cur2.children, node.children)
          } else if (cur2.type === 'paragraph') {
            // 检查段落中是否有图片(如果第一个子节点还没有设置图片)
            if (!node.data.image) {
              const imageInfo = getNodeImage(cur2)
              if (imageInfo) {
                console.log('Found image in list (subsequent child):', imageInfo.url)
                node.data.image = imageInfo.url
                node.data.imageTitle = imageInfo.alt
                node.data.imageSize = { width: 100, height: 100 }
              }
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
  const tree = fromMarkdown(md)
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
      currentChildren.push(...handleList(cur))
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
