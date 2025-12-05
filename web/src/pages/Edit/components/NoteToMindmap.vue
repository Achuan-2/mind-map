<template>
  <div>
    <el-dialog
      class="noteToMindmapDialog"
      :title="$t('noteToMindmap.title')"
      :visible.sync="dialogVisible"
      width="500px"
      @open="onDialogOpen"
    >
      <el-form label-position="top" size="small">
        <!-- 块ID输入 -->
        <el-form-item :label="$t('noteToMindmap.blockId')">
          <div class="block-id-row">
            <el-input
              v-model="blockId"
              :placeholder="$t('noteToMindmap.blockIdPlaceholder')"
              clearable
            ></el-input>
            <el-button
              type="primary"
              size="small"
              @click="setCurrentDocBlock"
              :title="$t('noteToMindmap.setCurrentDocTip')"
            >
              {{ $t('noteToMindmap.setCurrentDoc') }}
            </el-button>
          </div>
        </el-form-item>

        <!-- 块类型显示 -->
        <el-form-item :label="$t('noteToMindmap.blockType')" v-if="blockInfo">
          <el-tag :type="blockInfo.type === 'd' ? 'success' : 'info'">
            {{ blockInfo.type === 'd' ? $t('noteToMindmap.document') : $t('noteToMindmap.block') }}
          </el-tag>
          <span class="block-title">{{ blockInfo.content || blockInfo.name }}</span>
        </el-form-item>

        <!-- 导入类型选择（仅文档时显示） -->
        <el-form-item :label="$t('noteToMindmap.importType')" v-if="blockInfo && blockInfo.type === 'd'">
          <el-radio-group v-model="importType">
            <el-radio label="outline">{{ $t('noteToMindmap.importOutline') }}</el-radio>
            <el-radio label="content">{{ $t('noteToMindmap.importContent') }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 是否自动编号 -->
        <el-form-item :label="$t('noteToMindmap.autoNumber')">
          <el-switch v-model="autoNumber"></el-switch>
          <span class="option-desc">{{ $t('noteToMindmap.autoNumberDesc') }}</span>
        </el-form-item>

        <!-- 导入层级设置 -->
        <el-form-item :label="$t('noteToMindmap.maxLevel')">
          <el-input-number
            v-model="maxLevel"
            :min="0"
            :max="10"
            size="small"
          ></el-input-number>
          <span class="option-desc">{{ $t('noteToMindmap.maxLevelDesc') }}</span>
        </el-form-item>

        <!-- 自动获取块内容 -->
        <el-form-item :label="$t('noteToMindmap.autoRefresh')">
          <el-switch v-model="autoRefresh"></el-switch>
          <span class="option-desc">{{ $t('noteToMindmap.autoRefreshDesc') }}</span>
        </el-form-item>
      </el-form>

      <span slot="footer" class="dialog-footer">
        <el-button @click="cancel">{{ $t('dialog.cancel') }}</el-button>
        <el-button type="primary" @click="queryBlockInfo" :loading="querying">
          {{ $t('noteToMindmap.queryBlock') }}
        </el-button>
        <el-button type="success" @click="importToMindmap" :loading="importing" :disabled="!blockInfo">
          {{ $t('noteToMindmap.import') }}
        </el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import markdown from 'simple-mind-map/src/parse/markdown.js'
import { storeData } from '@/api'

// 思源API调用
async function fetchSyncPost(url, data, returnType = 'json') {
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

// 笔记转导图组件
export default {
  name: 'NoteToMindmap',
  data() {
    return {
      dialogVisible: false,
      blockId: '',
      blockInfo: null,
      importType: 'outline', // outline | content
      autoNumber: false,
      maxLevel: 0, // 0 表示不限制
      autoRefresh: false,
      querying: false,
      importing: false
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark
    })
  },
  created() {
    this.$bus.$on('showNoteToMindmap', this.handleShow)
  },
  beforeDestroy() {
    this.$bus.$off('showNoteToMindmap', this.handleShow)
  },
  methods: {
    handleShow() {
      this.dialogVisible = true
    },

    onDialogOpen() {
      // 尝试从父窗口获取保存的设置
      this.loadSavedSettings()
    },

    // 加载保存的设置
    async loadSavedSettings() {
      try {
        // 通过 postMessage 请求父窗口的块属性
        window.parent.postMessage(JSON.stringify({
          event: 'get_block_setting'
        }), '*')

        // 监听响应
        const handler = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.event === 'block_setting_response') {
              window.removeEventListener('message', handler)
              if (message.settings) {
                const settings = message.settings
                if (settings.blockId) this.blockId = settings.blockId
                if (settings.importType) this.importType = settings.importType
                if (typeof settings.autoNumber === 'boolean') this.autoNumber = settings.autoNumber
                if (typeof settings.maxLevel === 'number') this.maxLevel = settings.maxLevel
                if (typeof settings.autoRefresh === 'boolean') this.autoRefresh = settings.autoRefresh
                // 自动查询块信息
                if (this.blockId) {
                  this.queryBlockInfo()
                }
              }
            }
          } catch (e) {}
        }
        window.addEventListener('message', handler)

        // 超时移除监听
        setTimeout(() => {
          window.removeEventListener('message', handler)
        }, 2000)
      } catch (e) {
        console.error('Load settings error:', e)
      }
    },

    // 保存设置到块属性
    saveSettings() {
      const settings = {
        blockId: this.blockId,
        importType: this.importType,
        autoNumber: this.autoNumber,
        maxLevel: this.maxLevel,
        autoRefresh: this.autoRefresh
      }
      window.parent.postMessage(JSON.stringify({
        event: 'save_block_setting',
        settings: settings
      }), '*')

      // 通知 Toolbar 更新刷新按钮显示状态
      this.$bus.$emit('block_setting_updated')
    },

    // 设置为当前文档块
    setCurrentDocBlock() {
      window.parent.postMessage(JSON.stringify({
        event: 'get_current_doc_id'
      }), '*')

      const handler = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.event === 'current_doc_id_response') {
            window.removeEventListener('message', handler)
            if (message.docId) {
              this.blockId = message.docId
              this.queryBlockInfo()
            } else {
              this.$message.warning(this.$t('noteToMindmap.noCurrentDoc'))
            }
          }
        } catch (e) {}
      }
      window.addEventListener('message', handler)

      setTimeout(() => {
        window.removeEventListener('message', handler)
      }, 2000)
    },

    // 查询块信息
    async queryBlockInfo() {
      if (!this.blockId || !this.blockId.trim()) {
        this.$message.warning(this.$t('noteToMindmap.pleaseInputBlockId'))
        return
      }

      this.querying = true
      this.blockInfo = null

      try {
        const res = await fetchSyncPost('/api/query/sql', {
          stmt: `SELECT * FROM blocks WHERE id = '${this.blockId.trim()}'`
        })

        if (res.code === 0 && res.data && res.data.length > 0) {
          this.blockInfo = res.data[0]
          this.$message.success(this.$t('noteToMindmap.querySuccess'))
        } else {
          this.$message.error(this.$t('noteToMindmap.blockNotFound'))
        }
      } catch (e) {
        console.error('Query block error:', e)
        this.$message.error(this.$t('noteToMindmap.queryFailed'))
      } finally {
        this.querying = false
      }
    },

    // 导入到思维导图
    async importToMindmap() {
      if (!this.blockInfo) {
        this.$message.warning(this.$t('noteToMindmap.pleaseQueryFirst'))
        return
      }

      this.importing = true

      try {
        let mindmapData = null

        if (this.blockInfo.type === 'd' && this.importType === 'outline') {
          // 导入文档大纲
          mindmapData = await this.importOutline()
        } else {
          // 导入内容（文档内容或块内容）
          mindmapData = await this.importContent()
        }

        if (mindmapData) {
          // 应用自动编号
          if (this.autoNumber) {
            this.applyAutoNumber(mindmapData)
          }

          // 标记为新版本数据
          try {
            mindmapData.smmVersion = '0.13.0'
          } catch (e) {}

          // 更新思维导图
          this.$bus.$emit('updateData', mindmapData)
          storeData({ root: mindmapData })

          // 默认保存设置
          this.saveSettings()

          this.$message.success(this.$t('noteToMindmap.importSuccess'))
          this.dialogVisible = false
        }
      } catch (e) {
        console.error('Import error:', e)
        this.$message.error(this.$t('noteToMindmap.importFailed'))
      } finally {
        this.importing = false
      }
    },

    // 导入文档大纲
    async importOutline() {
      const res = await fetchSyncPost('/api/outline/getDocOutline', {
        id: this.blockId
      })

      if (res.code !== 0 || !res.data) {
        throw new Error('Get outline failed')
      }

      const outline = res.data
      const docTitle = cleanText(this.blockInfo.content || this.blockInfo.name || '文档')

      // 转换大纲为思维导图数据
      const root = {
        data: {
          text: docTitle,
          hyperlink: `siyuan://blocks/${this.blockId}`,
          hyperlinkTitle: docTitle
        },
        children: this.convertOutlineToMindmap(outline, 1)
      }

      return root
    },

    // 转换大纲数据为思维导图格式
    convertOutlineToMindmap(outline, currentLevel = 1) {
      if (!outline || !Array.isArray(outline)) return []
      
      // 如果设置了最大层级且当前层级超过限制，返回空数组
      if (this.maxLevel > 0 && currentLevel > this.maxLevel) {
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

        // 处理子节点 (blocks 或 children)
        if (item.blocks && item.blocks.length > 0) {
          node.children = this.convertOutlineToMindmap(item.blocks, currentLevel + 1)
        }
        if (item.children && item.children.length > 0) {
          node.children = node.children.concat(this.convertOutlineToMindmap(item.children, currentLevel + 1))
        }

        return node
      })
    },

    // 导入内容
    async importContent() {
      const res = await fetchSyncPost('/api/export/exportMdContent', {
        id: this.blockId,
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

      const title = cleanText(this.blockInfo.content || this.blockInfo.name || '内容')

      // 使用 markdown 解析器转换
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
        if (this.maxLevel > 0 && currentLevel >= this.maxLevel) {
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
              hyperlink: `siyuan://blocks/${this.blockId}`,
              hyperlinkTitle: title
            },
            children: parsed.children
          }
        }
      } else {
        root = {
          data: {
            text: title,
            hyperlink: `siyuan://blocks/${this.blockId}`,
            hyperlinkTitle: title
          },
          children: []
        }
      }

      // 清理所有节点文本
      cleanNodeText(root)

      // 应用层级限制
      if (this.maxLevel > 0) {
        trimByLevel(root)
      }

      // 为根节点添加链接（如果还没有）
      if (!root.data.hyperlink) {
        root.data.hyperlink = `siyuan://blocks/${this.blockId}`
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
        
        // 检查是否已有编号，避免重复添加
        if (!/^\d+(\.\d+)*\s/.test(text)) {
          child.data.text = `${num} ${text}`
        }

        // 递归处理子节点
        this.applyAutoNumber(child, num)
      })
    },

    // 取消
    cancel() {
      this.dialogVisible = false
    }
  }
}
</script>

<style lang="less" scoped>
.noteToMindmapDialog {
  .block-id-row {
    display: flex;
    gap: 10px;

    .el-input {
      flex: 1;
    }
  }

  .block-title {
    margin-left: 10px;
    color: #606266;
  }

  .option-desc {
    margin-left: 10px;
    color: #909399;
    font-size: 12px;
  }
}
</style>
