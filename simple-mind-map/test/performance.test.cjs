const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const { performance } = require('node:perf_hooks')

// 从当前源码打包，避免测试 pnpm 安装目录中的旧副本；不创建构建产物。
const projectRoot = path.resolve(__dirname, '../../..')
const webRequire = createRequire(path.resolve(__dirname, '../../web/package.json'))
const projectRequire = createRequire(path.join(projectRoot, 'package.json'))
const dependencyDir = path.resolve(path.dirname(projectRequire.resolve('simple-mind-map/package.json')), '..')
const bundle = webRequire('esbuild').buildSync({
  stdin: {
    contents: `
      export { bfsWalk, getNodeDataSnapshot } from './src/utils/index.js'
      export { default as Base } from './src/layouts/Base.js'
      export { default as MindMapNode } from './src/core/render/node/MindMapNode.js'
      export { default as NodeContents } from './src/core/render/node/nodeCreateContents.js'
      export { default as NodeLayout } from './src/core/render/node/nodeLayout.js'
      export { default as Render } from './src/core/render/Render.js'
      export { default as RenderQueue } from './src/utils/RenderQueue.js'
      export { default as MindMap } from './index.js'
      export { markMindMapRaw } from '../web/src/utils/mindMapRaw.js'
    `,
    resolveDir: path.resolve(__dirname, '..')
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  nodePaths: [dependencyDir],
  alias: { 'simple-mind-map': path.resolve(__dirname, '..') },
  external: ['vue'],
  write: false
}).outputFiles[0].text

let clock = 0
let scheduledCount = 0
let timerID = 0
const timers = new Map()
const context = {
  module: { exports: {} },
  require: webRequire,
  console,
  document: { documentElement: {} },
  performance: { now: () => clock },
  setTimeout: fn => { scheduledCount++; timers.set(++timerID, fn); return timerID },
  clearTimeout: id => timers.delete(id)
}
context.exports = context.module.exports
vm.runInNewContext(bundle, context)
const { bfsWalk, getNodeDataSnapshot, Base, MindMapNode, NodeContents, NodeLayout, Render, RenderQueue, MindMap, markMindMapRaw } = context.module.exports
const drainTimers = () => {
  while (timers.size) {
    const [id, fn] = timers.entries().next().value
    timers.delete(id)
    fn()
  }
}

test('node icons and spacing follow layer/custom font sizes and rich-text fonts', () => {
  const node = Object.create(MindMapNode.prototype)
  Object.assign(node, NodeContents)
  Object.assign(node, {
    nodeData: { data: { fontSize: 32 } },
    mindMap: { opt: { textContentMargin: 2, noteIcon: { style: {} } } },
    getStyle: prop => prop === 'iconSize' ? 20 : node.nodeData.data.fontSize
  })
  assert.equal(node.getNodeIconSize(), 32)
  assert.equal(node.getTextContentMargin(), 4)
  node.nodeData.data.fontSize = 48
  assert.equal(node.getNodeIconSize(), 48)
  node.nodeData.data.fontSize = 12
  assert.equal(node.getNodeIconSize(), 12)
  node.nodeData.data.richText = true
  node._textData = { fontSize: 36 }
  assert.equal(node.getNodeIconSize(), 36)
  assert.equal(node.getTextContentMargin(), 4.5)
  assert.equal(node.getNodeIconSize('noteIcon'), 36)
  node.mindMap.opt.noteIcon.style.size = 18
  assert.equal(node.getNodeIconSize('noteIcon'), 18)
})

test('node bounds include scaled icons and the same spacing used by layout', () => {
  const node = Object.create(MindMapNode.prototype)
  Object.assign(node, NodeContents, NodeLayout, {
    nodeData: { data: { fontSize: 32 } },
    mindMap: {
      opt: { textContentMargin: 2, imgTextMargin: 0 },
      nodeInnerPrefixList: [], nodeInnerPostfixList: []
    },
    getStyle: prop => ({ fontSize: 32, iconSize: 20 })[prop],
    _tagData: [], _rectInfo: {}, shapePadding: {},
    _textData: { width: 100, height: 38.4 },
    shapeInstance: { getShapePadding: () => ({ paddingX: 0, paddingY: 0 }) },
    getPaddingVale: () => ({ paddingX: 15, paddingY: 5 }),
    getBorderWidth: () => 0
  })
  const size = node.getNodeIconSize()
  node._iconData = [{ width: size, height: size }, { width: size, height: size }]
  const rect = node.getNodeRect()
  assert.equal(rect.width, 100 + size * 2 + node.getTextContentMargin() * 2 + 30)
  assert.equal(rect.height, 48.4)
})

test('text-only refresh rebuilds dependent icons after measuring the new font', () => {
  const node = Object.create(MindMapNode.prototype)
  const seen = []
  Object.assign(node, {
    mindMap: { opt: {}, nodeInnerPrefixList: [], nodeInnerPostfixList: [] },
    createTextNode: () => { seen.push('text'); return { fontSize: 48 } },
    createIconNode: () => { seen.push(['icon', node._textData.fontSize]); return [] },
    createHyperlinkNode: () => seen.push('hyperlink'),
    createNoteNode: () => seen.push('note'),
    createAttachmentNode: () => seen.push('attachment')
  })
  node.createNodeData(['text'])
  assert.deepEqual(seen, ['text', ['icon', 48], 'hyperlink', 'note', 'attachment'])
})
const makeTree = count => ({
  data: { uid: 'root', text: 'root', isActive: false, expand: true },
  children: Array.from({ length: count }, (_, i) => ({
    data: { uid: `node-${i}`, text: `node-${i}`, isActive: false, expand: true }, children: []
  }))
})

test('BFS preserves parent/order and stops before visiting later siblings', () => {
  const tree = makeTree(3)
  tree.children[0].children = [{ data: { uid: 'grandchild' }, children: [] }]
  const seen = []
  bfsWalk(tree, (node, parent) => seen.push([node.data.uid, parent?.data.uid]))
  assert.deepEqual(seen, [['root', undefined], ['node-0', 'root'], ['node-1', 'root'], ['node-2', 'root'], ['grandchild', 'node-0']])
  const stopped = []
  bfsWalk(tree, node => { stopped.push(node.data.uid); if (node.data.uid === 'node-1') return 'stop' })
  assert.deepEqual(stopped, ['root', 'node-0', 'node-1'])
})

test('node snapshots ignore active/expand but detect content, style and nested changes', () => {
  const data = { text: 'test', isActive: false, expand: true, style: { color: 'red' }, tags: ['one'] }
  const snapshot = getNodeDataSnapshot(data)
  const compare = current => Base.prototype.checkIsNodeDataChange(snapshot, current)
  assert.equal(compare({ ...data, isActive: true, expand: false }), false)
  assert.equal(compare({ ...data, text: 'changed' }), true)
  assert.equal(compare({ ...data, style: { color: 'blue' } }), true)
  assert.equal(compare({ ...data, tags: ['two'] }), true)
  assert.equal(data.isActive, false)
})

test('viewport bounds account for zoom, padding and flipped transforms', () => {
  const node = Object.create(MindMapNode.prototype)
  Object.assign(node, { left: -30, top: 0, width: 20, height: 20, mindMap: { width: 100, height: 100 } })
  const zoom = scale => ({ scaleX: scale, scaleY: scale, translateX: 0, translateY: 0 })
  assert.equal(node.checkIsInClient(0, zoom(0.5)), false, 'Zooming out must not use the unscaled node width')
  node.left = -15
  assert.equal(node.checkIsInClient(0, zoom(2)), true, 'A partially visible magnified node must remain mounted')
  node.left = -30
  assert.equal(node.checkIsInClient(6, zoom(0.5)), true)
  assert.equal(node.checkIsInClient(0, zoom(-1)), false)
})

test('UID lookup uses the layout cache and still finds generalizations', () => {
  const renderer = Object.create(Render.prototype)
  const node = uid => ({ getData: () => uid, children: [], _generalizationList: [] })
  renderer.root = node('root')
  const cached = node('cached')
  renderer.nodeCache = { cached }
  assert.equal(renderer.findNodeByUid('cached'), cached)
  const generalization = node('summary')
  renderer.root.children = [node('first'), node('last')]
  renderer.root.children[0]._generalizationList = [{ generalizationNode: generalization }]
  assert.equal(renderer.findNodeByUid('summary'), generalization)
  assert.equal(renderer.findNodeByUid('missing'), null)
})

test('expanding a target preserves ancestor and generalization behavior', () => {
  const renderer = Object.create(Render.prototype)
  renderer.renderTree = makeTree(2)
  const [parent, sibling] = renderer.renderTree.children
  parent.data.expand = false
  sibling.data.expand = false
  parent.children = [{ data: { uid: 'target', expand: false }, children: [] }]
  let renders = 0
  let completed = 0
  renderer.mindMap = { render(callback) { renders++; callback() } }
  renderer.expandToNodeUid('target', () => completed++)
  assert.equal(parent.data.expand, true)
  assert.equal(sibling.data.expand, false)
  assert.equal(parent.children[0].data.expand, false)
  assert.equal(renders, 1)
  sibling.data.generalization = [{ uid: 'summary', text: 'summary' }]
  sibling.children = [{ data: { uid: 'summary-child', expand: false }, children: [] }]
  renderer.expandToNodeUid('summary', () => completed++)
  assert.equal(sibling.data.expand, true)
  assert.equal(sibling.children[0].data.expand, true)
  assert.equal(renders, 2)
  renderer.expandToNodeUid('missing', () => completed++)
  assert.equal(renders, 2)
  assert.equal(completed, 3)
})

test('async rendering batches timers, refreshes transforms and completes once', () => {
  let transformReads = 0
  let updates = 0
  let completed = 0
  const renderer = { isDestroyed: false, nodeRenderQueues: new Set(), createNodeRenderQueue: Render.prototype.createNodeRenderQueue }
  const mindMap = {
    opt: { openPerformance: true, performanceConfig: { padding: 100, removeNodeWhenOutCanvas: true } },
    width: 1000, height: 1000,
    draw: { transform: () => { transformReads++; return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 } } }
  }
  const node = children => Object.assign(Object.create(MindMapNode.prototype), {
    renderer, mindMap, children, nodeData: {}, left: 0, top: 0, width: 10, height: 10,
    group: {}, nodeDraw: { has: () => true }, getData: () => true,
    renderLine() {}, updateExpandBtnPlaceholderRect() {},
    update() { updates++; clock++ }
  })
  const root = node(Array.from({ length: 1000 }, () => node([])))
  const before = scheduledCount
  root.render(() => completed++, false, true)
  drainTimers()
  assert.equal(updates, 1001)
  assert.equal(completed, 1)
  assert.equal(renderer.nodeRenderQueues.size, 0)
  assert(scheduledCount - before < 150, '1000 children should not create 1000 timers')
  assert(transformReads < 150, 'Each chunk should share one transform read')
  console.log(`1001 nodes: ${scheduledCount - before} timers, ${transformReads} transform reads`)

  root.render(() => completed++, false, true)
  const beforeCancel = updates
  renderer.nodeRenderQueues.forEach(queue => queue.cancel())
  renderer.nodeRenderQueues.clear()
  renderer.isDestroyed = true
  drainTimers()
  assert.equal(updates, beforeCancel)
  assert.equal(completed, 1)
})

test('render queue accepts nested tasks and yields instead of monopolizing a turn', () => {
  const seen = []
  let idleCount = 0
  const queue = new RenderQueue(() => {}, () => idleCount++, 2)
  queue.push(() => { seen.push(1); clock += 2; queue.push(() => seen.push(3)) })
  queue.push(() => seen.push(2))
  const [id, fn] = timers.entries().next().value
  timers.delete(id)
  fn()
  assert.deepEqual(seen, [1])
  drainTimers()
  assert.deepEqual(seen, [1, 2, 3])
  assert.equal(idleCount, 1)
})

test('Vue observes the holder reference without observing the mutable mindmap', () => {
  const Vue = webRequire('vue')
  const instance = Object.assign(Object.create(MindMap.prototype), { renderer: { tree: makeTree(1000) } })
  markMindMapRaw(instance)
  const component = new Vue({
    data: { holder: Object.freeze({ instance }) },
    computed: { mindMap() { return this.holder.instance } }
  })
  assert.equal(component.mindMap, instance)
  assert.equal(instance.__ob__, undefined)
  assert.equal(instance.renderer.tree.children[0].__ob__, undefined)
  instance.plugin = { enabled: true }
  assert.equal(component.mindMap.plugin.enabled, true)
  const node = Object.assign(Object.create(MindMapNode.prototype), {
    mindMap: instance, renderer: instance.renderer, nodeData: { data: { hyperlink: 'before' } }
  })
  markMindMapRaw([node])
  const sidebar = new Vue({
    data: { activeNodes: [node], node },
    computed: { hyperlink() { return this.activeNodes[0].getData('hyperlink') } }
  })
  assert.equal(node.__ob__, undefined)
  assert.equal(instance.renderer.__ob__, undefined, 'Selecting a node must not observe the renderer through a sidebar')
  assert.equal(sidebar.node, node)
  assert.equal(sidebar.hyperlink, 'before')
  node.nodeData.data.hyperlink = 'after'
  sidebar.activeNodes = [node]
  assert.equal(sidebar.hyperlink, 'after', 'Replacing the selection array must refresh sidebar state after data_change')
  const directNode = Object.assign(Object.create(MindMapNode.prototype), { mindMap: instance })
  instance.event = { emit(event, ...args) {
    assert.equal(event, 'node_tag_click')
    assert.equal(args[0].__v_skip, true, 'Direct subscriptions must receive a raw node')
  } }
  const wrappedEmit = instance.emit
  markMindMapRaw(instance)
  assert.equal(instance.emit, wrappedEmit, 'Repeated exposure must not wrap the emitter again')
  instance.emit('node_tag_click', directNode)
  const next = { renderer: {} }
  component.holder = Object.freeze({ instance: next })
  assert.equal(component.mindMap, next)
  component.$destroy()
  sidebar.$destroy()
})

test('count statistics update Vue state once after traversing all nodes', () => {
  const componentPath = path.resolve(__dirname, '../../web/src/pages/Edit/components/Count.vue')
  const script = fs.readFileSync(componentPath, 'utf8').split('<script>')[1].split('</script>')[0]
  const transformed = webRequire('esbuild').transformSync(script, { format: 'cjs' }).code
  const countEl = {
    set innerHTML(value) { this.textContent = value },
    textContent: ''
  }
  const componentModule = { exports: {} }
  vm.runInNewContext(transformed, {
    module: componentModule, exports: componentModule.exports, require: webRequire,
    document: { createElement: () => countEl }
  })
  const component = componentModule.exports.default
  let numWrites = 0
  let wordWrites = 0
  let num = 0
  let words = 0
  const state = {}
  Object.defineProperties(state, {
    num: { set(value) { numWrites++; num = value } },
    words: { set(value) { wordWrites++; words = value } }
  })
  const tree = makeTree(1000)
  component.methods.onDataChange.call(state, tree)
  assert.equal(num, 1001)
  assert.equal(words, ['root', ...tree.children.map(node => node.data.text)].join('').length)
  assert.equal(numWrites, 1)
  assert.equal(wordWrites, 1)
})

test('wide-tree traversal benchmark against the previous implementation', () => {
  // 固定原先 shift() 队列作为比较基线，不依赖 Git HEAD 或提交状态。
  const oldWalk = (root, callback) => {
    const queue = [root]
    callback(root, null)
    while (queue.length) {
      const current = queue.shift()
      for (const child of current.children || []) {
        queue.push(child)
        callback(child, current)
      }
    }
  }
  const tree = makeTree(50000)
  const measure = walk => {
    let count = 0
    const start = performance.now()
    walk(tree, () => count++)
    assert.equal(count, 50001)
    return performance.now() - start
  }
  // 时间只作本机观察，不用不稳定的耗时阈值决定测试是否通过。
  console.log(`BFS 50001 nodes: before=${measure(oldWalk).toFixed(2)}ms after=${measure(bfsWalk).toFixed(2)}ms`)
})
