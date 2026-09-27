// 画布快捷键可能因鼠标位置或只读模式而停用，此时也不能全选页面 UI。
export const preventPageSelectAll = event => {
  if (
    !(event.ctrlKey || event.metaKey) ||
    event.altKey ||
    event.shiftKey ||
    event.isComposing ||
    event.key.toLowerCase() !== 'a'
  ) {
    return
  }

  const target = event.target
  if (
    target instanceof Element &&
    (target.matches('input, textarea') || target.isContentEditable)
  ) {
    return
  }

  // 只阻止浏览器默认全选，继续冒泡给导图已有的节点全选快捷键。
  event.preventDefault()
}
