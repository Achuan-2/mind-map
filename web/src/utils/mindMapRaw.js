import { markRaw } from 'vue'
import MindMap from 'simple-mind-map'
import MindMapNode from 'simple-mind-map/src/core/render/node/MindMapNode'

const rawMindMaps = new WeakSet()

// 侧边栏会把实例和选中节点存入响应式数据；始终保留这些对象的可变性，
// 并阻止 Vue 沿节点上的 mindMap、renderer 和 parent 引用观察整棵导图。
export const markMindMapRaw = value => {
  if (value instanceof MindMap || value instanceof MindMapNode) {
    if (!value.__v_skip) markRaw(value)
    if (value instanceof MindMap && !rawMindMaps.has(value)) {
      rawMindMaps.add(value)
      // 同时覆盖组件直接订阅的备注、标签等事件，不能只处理转发到 $bus 的事件。
      const emit = value.emit
      value.emit = function (event, ...args) {
        args.forEach(markMindMapRaw)
        return emit.call(this, event, ...args)
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach(markMindMapRaw)
  }
  return value
}
