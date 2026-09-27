import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { processSiyuanImages, resolveSiyuanImageUrl } from '../src/utils/siyuanImage.js'
import { transformMarkdownToWithImages } from 'simple-mind-map/src/parse/markdownTo.js'

const originalGlobals = Object.fromEntries(
  ['window', 'fetch', 'FileReader', 'Image'].map(key => [key, globalThis[key]])
)
const imageData = 'data:image/png;base64,aW1hZ2U='
let requests

beforeEach(() => {
  requests = []
  globalThis.window = {
    location: { href: 'https://notes.example:7443/plugins/simplemindmap/mindmap-embed/index.html' }
  }
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return { ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) }
  }
  globalThis.FileReader = class {
    async readAsDataURL(blob) {
      this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`
      this.onload()
    }
  }
  globalThis.Image = class {
    naturalWidth = 640
    naturalHeight = 480
    set src(value) {
      assert.equal(value, imageData)
      this.onload()
    }
  }
})

after(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key]
    else globalThis[key] = value
  }
})

test('资源路径使用当前思源服务地址，兼容 iframe、端口和查询参数', () => {
  for (const prefix of ['assets/', '/assets/', './assets/']) {
    assert.equal(
      resolveSiyuanImageUrl(`${prefix}测试%20图片.png?v=1#preview`),
      'https://notes.example:7443/assets/%E6%B5%8B%E8%AF%95%20%E5%9B%BE%E7%89%87.png?v=1#preview'
    )
  }
  const externalURL = 'https://images.example/photo.png'
  assert.equal(resolveSiyuanImageUrl(externalURL), externalURL)
  assert.equal(resolveSiyuanImageUrl(imageData), imageData)
})

test('正文和嵌套列表图片在导入后嵌入数据并保留实际尺寸', async () => {
  const root = {
    data: { text: '正文', image: 'assets/paragraph.png' },
    children: [{
      data: { text: '列表项' },
      children: [{ data: { text: '', image: './assets/list.png', imageTitle: '图片说明' } }]
    }]
  }
  await processSiyuanImages(root)
  assert.deepEqual(requests.map(request => request.url), [
    'https://notes.example:7443/assets/paragraph.png',
    'https://notes.example:7443/assets/list.png'
  ])
  assert.ok(requests.every(request => request.options.credentials === 'same-origin'))
  for (const node of [root, root.children[0].children[0]]) {
    assert.equal(node.data.image, imageData)
    assert.deepEqual(node.data.imageSize, { width: 640, height: 480 })
  }
  assert.equal(root.children[0].children[0].data.imageTitle, '图片说明')
})

test('下载失败时保留服务根目录地址，避免 iframe 再次请求插件目录', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404 })
  const root = { data: { image: 'assets/missing.png', imageSize: { width: 100, height: 100 } } }
  await processSiyuanImages(root)
  assert.equal(root.data.image, 'https://notes.example:7443/assets/missing.png')
  assert.deepEqual(root.data.imageSize, { width: 100, height: 100 })
})

test('已有内嵌图片保持原数据，不重复下载', async () => {
  const root = { data: { image: imageData, imageSize: { width: 20, height: 30 } } }
  await processSiyuanImages(root)
  assert.equal(requests.length, 0)
  assert.equal(root.data.image, imageData)
  assert.deepEqual(root.data.imageSize, { width: 20, height: 30 })
})

test('截图中的列表文字加图片经过完整 Markdown 转换后可以加载', async () => {
  const parsed = await transformMarkdownToWithImages('- c\n- 1\n\n  ![图片](assets/photo.png)')
  assert.equal(parsed.children[0].data.text, 'c')
  const imageNode = parsed.children[1]
  assert.equal(imageNode.data.text, '1')
  assert.equal(imageNode.data.image, imageData)
  assert.deepEqual(imageNode.data.imageSize, { width: 640, height: 480 })
  assert.equal(requests[0].url, 'https://notes.example:7443/assets/photo.png')
})
