<template>
  <div class="toolbarContainer" :class="{ isDark: isDark }">
    <div class="toolbar" ref="toolbarRef">
      <!-- 节点操作 -->
      <div class="toolbarBlock">
        <ToolbarNodeBtnList :list="horizontalList"></ToolbarNodeBtnList>
        <!-- 更多 -->
        <el-popover
          v-model="popoverShow"
          placement="bottom-end"
          width="120"
          trigger="hover"
          v-if="showMoreBtn"
          :style="{ marginLeft: horizontalList.length > 0 ? '20px' : 0 }"
        >
          <ToolbarNodeBtnList
            dir="v"
            :list="verticalList"
            @click.native="popoverShow = false"
          ></ToolbarNodeBtnList>
          <div slot="reference" class="toolbarBtn">
            <span class="icon iconfont icongongshi"></span>
            <span class="text">{{ $t('toolbar.more') }}</span>
          </div>
        </el-popover>
      </div>
      <!-- 导出 -->
      <div class="toolbarBlock">
        <div class="toolbarBtn" @click="onPasteMarkdown">
          <span class="icon iconfont iconniantie"></span>
          <span class="text">{{ $t('toolbar.pasteMarkdown') }}</span>
        </div>
        <div class="toolbarBtn" @click="$bus.$emit('showNoteToMindmap')">
          <span class="icon iconfont iconwenjian"></span>
          <span class="text">{{ $t('toolbar.noteToMindmap') }}</span>
        </div>
        <div
          class="toolbarBtn"
          v-if="hasBlockSetting"
          @click="refreshFromBlock"
          :title="$t('toolbar.refreshFromBlockTip')"
        >
          <span class="icon el-icon-refresh" :class="{ rotating: refreshing }"></span>
          <span class="text">{{ $t('toolbar.refreshFromBlock') }}</span>
        </div>
        <div class="toolbarBtn" @click="$bus.$emit('showImport')">
          <span class="icon iconfont icondaoru"></span>
          <span class="text">{{ $t('toolbar.import') }}</span>
        </div>
        <div
          class="toolbarBtn"
          @click="$bus.$emit('showExport')"
          style="margin-right: 0;"
        >
          <span class="icon iconfont iconexport"></span>
          <span class="text">{{ $t('toolbar.export') }}</span>
        </div>
        <!-- 本地文件树 -->
        <div
          class="fileTreeBox"
          v-if="fileTreeVisible"
          :class="{ expand: fileTreeExpand }"
        >
          <div class="fileTreeToolbar">
            <div class="fileTreeName">
              {{ rootDirName ? '/' + rootDirName : '' }}
            </div>
            <div class="fileTreeActionList">
              <div
                class="btn"
                :class="[
                  fileTreeExpand ? 'el-icon-arrow-up' : 'el-icon-arrow-down'
                ]"
                @click="fileTreeExpand = !fileTreeExpand"
              ></div>
              <div
                class="btn el-icon-close"
                @click="fileTreeVisible = false"
              ></div>
            </div>
          </div>
          <div class="fileTreeWrap">
            <el-tree
              :props="fileTreeProps"
              :load="loadFileTreeNode"
              :expand-on-click-node="false"
              node-key="id"
              lazy
            >
              <span class="customTreeNode" slot-scope="{ node, data }">
                <div class="treeNodeInfo">
                  <span
                    class="treeNodeIcon iconfont"
                    :class="[
                      data.type === 'file' ? 'iconwenjian' : 'icondakai'
                    ]"
                  ></span>
                  <span class="treeNodeName">{{ node.label }}</span>
                </div>
                <div class="treeNodeBtnList" v-if="data.type === 'file'">
                  <el-button
                    type="text"
                    size="mini"
                    v-if="data.enableEdit"
                    @click="editLocalFile(data)"
                    >编辑</el-button
                  >
                  <el-button
                    type="text"
                    size="mini"
                    v-else
                    @click="importLocalFile(data)"
                    >导入</el-button
                  >
                </div>
              </span>
            </el-tree>
          </div>
        </div>
      </div>
    </div>
    <NodeImage></NodeImage>
    <NodeHyperlink></NodeHyperlink>
    <NodeIcon></NodeIcon>
    <NodeNote></NodeNote>
    <NodeTag></NodeTag>
    <Export></Export>
    <Import ref="ImportRef"></Import>
    <NoteToMindmap></NoteToMindmap>
  </div>
</template>

<script>
import NodeImage from './NodeImage.vue'
import NodeHyperlink from './NodeHyperlink.vue'
import NodeIcon from './NodeIcon.vue'
import NodeNote from './NodeNote.vue'
import NodeTag from './NodeTag.vue'
import Export from './Export.vue'
import Import from './Import.vue'
import NoteToMindmap from './NoteToMindmap.vue'
import { mapState } from 'vuex'
import { Notification } from 'element-ui'
import exampleData from 'simple-mind-map/example/exampleData'
import { getData } from '../../../api'
import ToolbarNodeBtnList from './ToolbarNodeBtnList.vue'
import { throttle, isMobile } from 'simple-mind-map/src/utils/index'
import markdown from 'simple-mind-map/src/parse/markdown.js'
import handleClipboardText from '@/utils/handleClipboardText'
import { storeData } from '@/api'

// 清理文本：转换思源特有的 HTML 标签，保留富文本样式
function cleanText(text) {
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
  // <span data-type="strong">text</span> -> <strong>text</strong>
  result = result.replace(/<span\s+data-type="strong"[^>]*>([\s\S]*?)<\/span>/gi, '<strong>$1</strong>')
  // <span data-type="em">text</span> -> <em>text</em>
  result = result.replace(/<span\s+data-type="em"[^>]*>([\s\S]*?)<\/span>/gi, '<em>$1</em>')
  // <span data-type="s">text</span> -> <del>text</del> (删除线)
  result = result.replace(/<span\s+data-type="s"[^>]*>([\s\S]*?)<\/span>/gi, '<del>$1</del>')
  // <span data-type="u">text</span> -> <u>text</u> (下划线)
  result = result.replace(/<span\s+data-type="u"[^>]*>([\s\S]*?)<\/span>/gi, '<u>$1</u>')
  // <span data-type="mark">text</span> -> <mark>text</mark> (高亮)
  result = result.replace(/<span\s+data-type="mark"[^>]*>([\s\S]*?)<\/span>/gi, '<mark>$1</mark>')
  // <span data-type="sup">text</span> -> <sup>text</sup> (上标)
  result = result.replace(/<span\s+data-type="sup"[^>]*>([\s\S]*?)<\/span>/gi, '<sup>$1</sup>')
  // <span data-type="sub">text</span> -> <sub>text</sub> (下标)
  result = result.replace(/<span\s+data-type="sub"[^>]*>([\s\S]*?)<\/span>/gi, '<sub>$1</sub>')
  
  // 移除带有 style 属性的 span 标签，只保留内容
  result = result.replace(/<span\s+[^>]*style="[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  
  // 移除思源特有的其他标签（如 data-type="code", data-type="tag" 等），只保留内容
  result = result.replace(/<span\s+data-type="(?:code|tag|kbd|text|block-ref|a)"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  
  // 移除剩余的空 span 标签
  result = result.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
  
  // 移除其他思源特有标签
  result = result.replace(/<[^>]*data-type[^>]*>([\s\S]*?)<\/[^>]+>/gi, '$1')
  
  // 清理多余空格
  result = result.replace(/\s+/g, ' ').trim()
  
  return result
}

// 工具栏
let fileHandle = null
const defaultBtnList = [
  'back',
  'forward',
  'painter',
  'siblingNode',
  'childNode',
  'deleteNode',
  'image',
  'icon',
  'link',
  'note',
  'tag',
  'summary',
  'associativeLine',
  'formula',
  // 'attachment',
  'outerFrame',
  'annotation',
  'ai'
]

export default {
  components: {
    NodeImage,
    NodeHyperlink,
    NodeIcon,
    NodeNote,
    NodeTag,
    Export,
    Import,
    NoteToMindmap,
    ToolbarNodeBtnList
  },
  data() {
    return {
      isMobile: isMobile(),
      horizontalList: [],
      verticalList: [],
      showMoreBtn: true,
      popoverShow: false,
      fileTreeProps: {
        label: 'name',
        children: 'children',
        isLeaf: 'leaf'
      },
      fileTreeVisible: false,
      rootDirName: '',
      fileTreeExpand: true,
      waitingWriteToLocalFile: false,
      hasBlockSetting: false,
      blockSettings: null,
      refreshing: false
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark,
      isHandleLocalFile: state => state.isHandleLocalFile,
      openNodeRichText: state => state.localConfig.openNodeRichText,
      enableAi: state => state.localConfig.enableAi
    }),

    btnLit() {
      let res = [...defaultBtnList]
      if (!this.openNodeRichText) {
        res = res.filter(item => {
          return item !== 'formula'
        })
      }
      if (!this.enableAi) {
        res = res.filter(item => {
          return item !== 'ai'
        })
      }
      return res
    }
  },
  watch: {
    isHandleLocalFile(val) {
      if (!val) {
        Notification.closeAll()
      }
    },
    btnLit: {
      deep: true,
      handler() {
        this.computeToolbarShow()
      }
    }
  },
  created() {
    this.$bus.$on('write_local_file', this.onWriteLocalFile)
    this.$bus.$on('block_setting_updated', this.checkBlockSetting)
  },
  mounted() {
    this.computeToolbarShow()
    this.computeToolbarShowThrottle = throttle(this.computeToolbarShow, 300)
    window.addEventListener('resize', this.computeToolbarShowThrottle)
    this.$bus.$on('lang_change', this.computeToolbarShowThrottle)
    window.addEventListener('beforeunload', this.onUnload)
    this.$bus.$on('node_note_dblclick', this.onNodeNoteDblclick)
    // 检查是否有块设置，并处理自动刷新
    this.checkBlockSetting(true)
  },
  beforeDestroy() {
    this.$bus.$off('write_local_file', this.onWriteLocalFile)
    this.$bus.$off('block_setting_updated', this.checkBlockSetting)
    window.removeEventListener('resize', this.computeToolbarShowThrottle)
    this.$bus.$off('lang_change', this.computeToolbarShowThrottle)
    window.removeEventListener('beforeunload', this.onUnload)
    this.$bus.$off('node_note_dblclick', this.onNodeNoteDblclick)
  },
  methods: {
    // 计算工具按钮如何显示
    computeToolbarShow() {
      if (!this.$refs.toolbarRef) return
      const windowWidth = window.innerWidth - 40
      const all = [...this.btnLit]
      let index = 1
      const loopCheck = () => {
        if (index > all.length) return done()
        this.horizontalList = all.slice(0, index)
        this.$nextTick(() => {
          const width = this.$refs.toolbarRef.getBoundingClientRect().width
          if (width < windowWidth) {
            index++
            loopCheck()
          } else if (index > 0 && width > windowWidth) {
            index--
            this.horizontalList = all.slice(0, index)
            done()
          }
        })
      }
      const done = () => {
        this.verticalList = all.slice(index)
        this.showMoreBtn = this.verticalList.length > 0
      }
      loopCheck()
    },

    // 监听本地文件读写
    onWriteLocalFile(content) {
      clearTimeout(this.timer)
      if (fileHandle && this.isHandleLocalFile) {
        this.waitingWriteToLocalFile = true
      }
      this.timer = setTimeout(() => {
        this.writeLocalFile(content)
      }, 1000)
    },

    onUnload(e) {
      if (this.waitingWriteToLocalFile) {
        const msg = '存在未保存的数据'
        e.returnValue = msg
        return msg
      }
    },

    // 加载本地文件树
    async loadFileTreeNode(node, resolve) {
      try {
        let dirHandle
        if (node.level === 0) {
          dirHandle = await window.showDirectoryPicker()
          this.rootDirName = dirHandle.name
        } else {
          dirHandle = node.data.handle
        }
        const dirList = []
        const fileList = []
        for await (const [key, value] of dirHandle.entries()) {
          const isFile = value.kind === 'file'
          if (isFile && !/\.(smm|xmind|md|json)$/.test(value.name)) {
            continue
          }
          const enableEdit = isFile && /\.smm$/.test(value.name)
          const data = {
            id: key,
            name: value.name,
            type: value.kind,
            handle: value,
            leaf: isFile,
            enableEdit
          }
          if (isFile) {
            fileList.push(data)
          } else {
            dirList.push(data)
          }
        }
        resolve([...dirList, ...fileList])
      } catch (error) {
        console.log(error)
        this.fileTreeVisible = false
        resolve([])
        if (error.toString().includes('aborted')) {
          return
        }
        this.$message.warning(this.$t('toolbar.notSupportTip'))
      }
    },

    // 扫描本地文件夹
    openDirectory() {
      this.fileTreeVisible = false
      this.fileTreeExpand = true
      this.rootDirName = ''
      this.$nextTick(() => {
        this.fileTreeVisible = true
      })
    },

    // 编辑指定文件
    editLocalFile(data) {
      if (data.handle) {
        fileHandle = data.handle
        this.readFile()
      }
    },

    // 导入指定文件
    async importLocalFile(data) {
      try {
        const file = await data.handle.getFile()
        this.$refs.ImportRef.onChange({
          raw: file,
          name: file.name
        })
        this.$refs.ImportRef.confirm()
      } catch (error) {
        console.log(error)
      }
    },

    // 打开本地文件
    async openLocalFile() {
      try {
        let [_fileHandle] = await window.showOpenFilePicker({
          types: [
            {
              description: '',
              accept: {
                'application/json': ['.smm']
              }
            }
          ],
          excludeAcceptAllOption: true,
          multiple: false
        })
        if (!_fileHandle) {
          return
        }
        fileHandle = _fileHandle
        if (fileHandle.kind === 'directory') {
          this.$message.warning(this.$t('toolbar.selectFileTip'))
          return
        }
        this.readFile()
      } catch (error) {
        console.log(error)
        if (error.toString().includes('aborted')) {
          return
        }
        this.$message.warning(this.$t('toolbar.notSupportTip'))
      }
    },

    // 读取本地文件
    async readFile() {
      let file = await fileHandle.getFile()
      let fileReader = new FileReader()
      fileReader.onload = async () => {
        this.$store.commit('setIsHandleLocalFile', true)
        this.setData(fileReader.result)
        Notification.closeAll()
        Notification({
          title: this.$t('toolbar.tip'),
          message: `${this.$t('toolbar.editingLocalFileTipFront')}${
            file.name
          }${this.$t('toolbar.editingLocalFileTipEnd')}`,
          duration: 0,
          showClose: true
        })
      }
      fileReader.readAsText(file)
    },

    // 渲染读取的数据
    setData(str) {
      try {
        let data = JSON.parse(str)
        if (typeof data !== 'object') {
          throw new Error(this.$t('toolbar.fileContentError'))
        }
        if (data.root) {
          this.isFullDataFile = true
        } else {
          this.isFullDataFile = false
          data = {
            ...exampleData,
            root: data
          }
        }
        this.$bus.$emit('setData', data)
      } catch (error) {
        console.log(error)
        this.$message.error(this.$t('toolbar.fileOpenFailed'))
      }
    },

    // 写入本地文件
    async writeLocalFile(content) {
      if (!fileHandle || !this.isHandleLocalFile) {
        this.waitingWriteToLocalFile = false
        return
      }
      if (!this.isFullDataFile) {
        content = content.root
      }
      let string = JSON.stringify(content)
      const writable = await fileHandle.createWritable()
      await writable.write(string)
      await writable.close()
      this.waitingWriteToLocalFile = false
    },

    // 创建本地文件
    async createNewLocalFile() {
      await this.createLocalFile(exampleData)
    },

    // 另存为
    async saveLocalFile() {
      let data = getData()
      await this.createLocalFile(data)
    },

    // 创建本地文件
    async createLocalFile(content) {
      try {
        let _fileHandle = await window.showSaveFilePicker({
          types: [
            {
              description: '',
              accept: { 'application/json': ['.smm'] }
            }
          ],
          suggestedName: this.$t('toolbar.defaultFileName')
        })
        if (!_fileHandle) {
          return
        }
        const loading = this.$loading({
          lock: true,
          text: this.$t('toolbar.creatingTip'),
          spinner: 'el-icon-loading',
          background: 'rgba(0, 0, 0, 0.7)'
        })
        fileHandle = _fileHandle
        this.$store.commit('setIsHandleLocalFile', true)
        this.isFullDataFile = true
        await this.writeLocalFile(content)
        await this.readFile()
        loading.close()
      } catch (error) {
        console.log(error)
        if (error.toString().includes('aborted')) {
          return
        }
        this.$message.warning(this.$t('toolbar.notSupportTip'))
      }
    },

    onNodeNoteDblclick(node, e) {
      e.stopPropagation()
      this.$bus.$emit('showNodeNote', node)
    },

    // 粘贴导入 Markdown
    async onPasteMarkdown() {
      // 仅从剪贴板读取并替换内容
      if (!(navigator.clipboard && navigator.clipboard.readText)) {
        this.$message.error(this.$t('outline.clipboardNotSupported') || '浏览器不支持剪贴板读取')
        return
      }
      let md = ''
      try {
        md = await navigator.clipboard.readText()
      } catch (err) {
        this.$message.error(this.$t('outline.clipboardReadFail') || '读取剪贴板失败')
        return
      }
      if (!md || !md.trim()) {
        this.$message.warning(this.$t('outline.clipboardEmpty') || '剪贴板为空或未包含 Markdown 列表')
        return
      }
      try {
        const res = await handleClipboardText(md)
        if (res.simpleMindMap && res.data) {
          let root
          if (Array.isArray(res.data) && res.data.length === 1) {
            root = res.data[0]
          } else {
            root = {
              data: {
                text: '根节点'
              },
              children: res.data
            }
          }
          // 标记为新版本数据，避免富文本插件误判为旧版并转换/转义文本
          // 这样能保证 Markdown 解析出的富文本 HTML 不会在 updateData 流程中被丢失
          try {
            root.smmVersion = '0.13.0'
          } catch (e) {}
          this.$bus.$emit('updateData', root)
          storeData({ root })
          this.$message.success(this.$t('outline.importSuccess') || '导入成功')
        } else {
           this.$message.warning('未识别到有效的Markdown列表')
        }
      } catch (e) {
        console.error(e)
        this.$message.error(this.$t('outline.importFail') || '导入失败')
      }
    },

    // 检查是否有块设置
    checkBlockSetting(isInit = false) {
      window.parent.postMessage(JSON.stringify({
        event: 'get_block_setting'
      }), '*')

      const handler = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.event === 'block_setting_response') {
            window.removeEventListener('message', handler)
            if (message.settings && message.settings.blockId) {
              this.hasBlockSetting = true
              this.blockSettings = message.settings
              // 如果是初始化且设置了自动刷新，则自动执行刷新
              if (isInit && message.settings.autoRefresh) {
                this.refreshFromBlock(true) // 静默刷新，不显示成功提示
              }
            } else {
              this.hasBlockSetting = false
              this.blockSettings = null
            }
          }
        } catch (e) {}
      }
      window.addEventListener('message', handler)

      setTimeout(() => {
        window.removeEventListener('message', handler)
      }, 2000)
    },

    // 从绑定的块刷新导图
    async refreshFromBlock(silent = false) {
      if (!this.blockSettings || !this.blockSettings.blockId) {
        if (!silent) {
          this.$message.warning(this.$t('noteToMindmap.noBlockSetting'))
        }
        return
      }

      this.refreshing = true

      try {
        const blockId = this.blockSettings.blockId
        const importType = this.blockSettings.importType || 'outline'
        const autoNumber = this.blockSettings.autoNumber || false
        const maxLevel = this.blockSettings.maxLevel || 0

        // 先查询块信息
        const blockRes = await this.fetchSyncPost('/api/query/sql', {
          stmt: `SELECT * FROM blocks WHERE id = '${blockId}'`
        })

        if (blockRes.code !== 0 || !blockRes.data || blockRes.data.length === 0) {
          if (!silent) {
            this.$message.error(this.$t('noteToMindmap.blockNotFound'))
          }
          return
        }

        const blockInfo = blockRes.data[0]
        let mindmapData = null

        if (blockInfo.type === 'd' && importType === 'outline') {
          // 导入文档大纲
          mindmapData = await this.importOutlineData(blockId, blockInfo, maxLevel)
        } else {
          // 导入内容
          mindmapData = await this.importContentData(blockId, blockInfo, maxLevel)
        }

        if (mindmapData) {
          // 应用自动编号
          if (autoNumber) {
            this.applyAutoNumber(mindmapData)
          }

          // 标记为新版本数据
          try {
            mindmapData.smmVersion = '0.13.0'
          } catch (e) {}

          // 更新思维导图
          this.$bus.$emit('updateData', mindmapData)
          storeData({ root: mindmapData })

          if (!silent) {
            this.$message.success(this.$t('noteToMindmap.refreshSuccess'))
          }
        }
      } catch (e) {
        console.error('Refresh error:', e)
        if (!silent) {
          this.$message.error(this.$t('noteToMindmap.refreshFailed'))
        }
      } finally {
        this.refreshing = false
      }
    },

    // 封装的 fetchSyncPost
    async fetchSyncPost(url, data) {
      const init = {
        method: "POST",
        body: JSON.stringify(data)
      }
      try {
        const res = await fetch(url, init)
        return await res.json()
      } catch (e) {
        console.log(e)
        return { code: 1, msg: e.message || "", data: null }
      }
    },

    // 导入大纲数据
    async importOutlineData(blockId, blockInfo, maxLevel = 0) {
      const res = await this.fetchSyncPost('/api/outline/getDocOutline', {
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
        children: this.convertOutlineToMindmap(outline, 1, maxLevel)
      }
    },

    // 转换大纲数据为思维导图格式
    convertOutlineToMindmap(outline, currentLevel = 1, maxLevel = 0) {
      if (!outline || !Array.isArray(outline)) return []
      
      // 如果设置了最大层级且当前层级超过限制，返回空数组
      if (maxLevel > 0 && currentLevel > maxLevel) {
        return []
      }

      // 检查文本是否包含富文本标签
      const hasRichTextTags = (text) => {
        return /<(strong|em|del|u|mark|sup|sub)>/i.test(text)
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

        if (item.blocks && item.blocks.length > 0) {
          node.children = this.convertOutlineToMindmap(item.blocks, currentLevel + 1, maxLevel)
        }
        if (item.children && item.children.length > 0) {
          node.children = node.children.concat(this.convertOutlineToMindmap(item.children, currentLevel + 1, maxLevel))
        }

        return node
      })
    },

    // 导入内容数据
    async importContentData(blockId, blockInfo, maxLevel = 0) {
      const res = await this.fetchSyncPost('/api/export/exportMdContent', {
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

      const title = cleanText(blockInfo.content || blockInfo.name || '内容')

      const parsed = await markdown.transformMarkdownToWithImages(mdContent)

      // 检查文本是否包含富文本标签
      const hasRichTextTags = (text) => {
        return /<(strong|em|del|u|mark|sup|sub)>/i.test(text)
      }

      // 递归清理所有节点的文本，并处理富文本
      const cleanNodeText = (node) => {
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
          node.children.forEach(cleanNodeText)
        }
      }

      // 按层级限制裁剪节点树
      const trimByLevel = (node, currentLevel = 1) => {
        if (maxLevel > 0 && currentLevel >= maxLevel) {
          node.children = []
        } else if (node.children && node.children.length > 0) {
          node.children.forEach(child => trimByLevel(child, currentLevel + 1))
        }
      }

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
        trimByLevel(root)
      }

      if (!root.data.hyperlink) {
        root.data.hyperlink = `siyuan://blocks/${blockId}`
        root.data.hyperlinkTitle = title
      }

      return root
    },

    // 应用自动编号
    applyAutoNumber(node, prefix = '') {
      if (!node.children || node.children.length === 0) return

      node.children.forEach((child, index) => {
        const num = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
        const text = child.data.text || ''
        
        if (!/^\d+(\.\d+)*\s/.test(text)) {
          child.data.text = `${num} ${text}`
        }

        this.applyAutoNumber(child, num)
      })
    }
  }
}
</script>

<style lang="less" scoped>
.toolbarContainer {
  &.isDark {
    .toolbar {
      color: hsla(0, 0%, 100%, 0.9);
      .toolbarBlock {
        background-color: #262a2e;

        .fileTreeBox {
          background-color: #262a2e;

          /deep/ .el-tree {
            background-color: #262a2e;

            &.el-tree--highlight-current {
              .el-tree-node.is-current > .el-tree-node__content {
                background-color: hsla(0, 0%, 100%, 0.05) !important;
              }
            }

            .el-tree-node:focus > .el-tree-node__content {
              background-color: hsla(0, 0%, 100%, 0.05) !important;
            }

            .el-tree-node__content:hover,
            .el-upload-list__item:hover {
              background-color: hsla(0, 0%, 100%, 0.02) !important;
            }
          }

          .fileTreeWrap {
            .customTreeNode {
              .treeNodeInfo {
                color: #fff;
              }

              .treeNodeBtnList {
                .el-button {
                  padding: 7px 5px;
                }
              }
            }
          }
        }
      }

      .toolbarBtn {
        .icon {
          background: transparent;
          border-color: transparent;
        }

        &:hover {
          &:not(.disabled) {
            .icon {
              background: hsla(0, 0%, 100%, 0.05);
            }
          }
        }

        &.disabled {
          color: #54595f;
        }
      }
    }
  }
  .toolbar {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    top: 20px;
    width: max-content;
    display: flex;
    font-size: 12px;
    font-family: PingFangSC-Regular, PingFang SC;
    font-weight: 400;
    color: rgba(26, 26, 26, 0.8);
    z-index: 2;

    .toolbarBlock {
      display: flex;
      background-color: #fff;
      padding: 10px 20px;
      border-radius: 6px;
      box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.06);
      border: 1px solid rgba(0, 0, 0, 0.06);
      margin-right: 20px;
      flex-shrink: 0;
      position: relative;

      &:last-of-type {
        margin-right: 0;
      }

      .fileTreeBox {
        position: absolute;
        left: 0;
        top: 68px;
        width: 100%;
        height: 30px;
        background-color: #fff;
        padding: 12px 5px;
        padding-top: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 5px;
        min-width: 200px;
        box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.06);

        &.expand {
          height: 300px;

          .fileTreeWrap {
            visibility: visible;
          }
        }

        .fileTreeToolbar {
          width: 100%;
          height: 30px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e9e9e9;
          margin-bottom: 12px;
          padding-left: 12px;

          .fileTreeName {
          }

          .fileTreeActionList {
            .btn {
              font-size: 18px;
              margin-left: 12px;
              cursor: pointer;
            }
          }
        }

        .fileTreeWrap {
          width: 100%;
          height: 100%;
          overflow: auto;
          visibility: hidden;

          .customTreeNode {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            padding-right: 5px;

            .treeNodeInfo {
              display: flex;
              align-items: center;

              .treeNodeIcon {
                margin-right: 5px;
                opacity: 0.7;
              }

              .treeNodeName {
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
            }

            .treeNodeBtnList {
              display: flex;
              align-items: center;
            }
          }
        }
      }
    }

    .toolbarBtn {
      display: flex;
      justify-content: center;
      flex-direction: column;
      cursor: pointer;
      margin-right: 20px;

      &:last-of-type {
        margin-right: 0;
      }

      &:hover {
        &:not(.disabled) {
          .icon {
            background: #f5f5f5;
          }
        }
      }

      &.active {
        .icon {
          background: #f5f5f5;
        }
      }

      &.disabled {
        color: #bcbcbc;
        cursor: not-allowed;
        pointer-events: none;
      }

      .icon {
        display: flex;
        height: 26px;
        background: #fff;
        border-radius: 4px;
        border: 1px solid #e9e9e9;
        justify-content: center;
        flex-direction: column;
        text-align: center;
        padding: 0 5px;

        &.rotating {
          animation: spin 1s linear infinite;
        }
      }

      .text {
        margin-top: 3px;
      }
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
