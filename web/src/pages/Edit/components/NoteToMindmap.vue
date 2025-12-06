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
          <!-- 查询按钮放在输入下方 -->
          <div style="margin-top:8px;">
            <el-button type="primary" size="small" @click="queryBlockInfo" :loading="querying">
              {{ $t('noteToMindmap.queryBlock') }}
            </el-button>
          </div>
        </el-form-item>

        <!-- 块类型显示 -->
        <el-form-item :label="$t('noteToMindmap.blockType')" v-if="blockInfo">
          <el-tag :type="blockInfo.type === 'd' ? 'success' : (blockInfo.type === 'notebook' ? 'warning' : 'info')">
            {{ blockInfo.type === 'd' ? $t('noteToMindmap.document') : (blockInfo.type === 'notebook' ? $t('noteToMindmap.notebook') : $t('noteToMindmap.block')) }}
          </el-tag>
          <span class="block-title">{{ blockInfo.content || blockInfo.name }}</span>
        </el-form-item>

        <!-- 导入类型选择（文档/笔记本均可显示不同选项） -->
        <el-form-item :label="$t('noteToMindmap.importType')" v-if="blockInfo">
          <el-radio-group v-model="importType">
            <el-radio v-if="blockInfo.type === 'd'" label="outline">{{ $t('noteToMindmap.importOutline') }}</el-radio>
            <el-radio v-if="blockInfo.type === 'd'" label="content">{{ $t('noteToMindmap.importContent') }}</el-radio>
            <el-radio v-if="blockInfo.type === 'd'" label="docTree">{{ $t('noteToMindmap.importDocTree') || '子文档树' }}</el-radio>
            <el-radio v-if="blockInfo.type === 'notebook'" label="docTree">{{ $t('noteToMindmap.importDocTree') || '文档树' }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- 文档ID不再显示起始路径输入框，使用文档自身 path 或通过 SQL 获取 -->

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
        <el-button type="success" @click="importToMindmap" :loading="importing" :disabled="!blockInfo">
          {{ $t('noteToMindmap.import') }}
        </el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { storeData } from '@/api'
import {
  fetchSyncPost,
  importOutline,
  importContent,
  importDocTree,
  getDocTree,
  applyAutoNumber
} from '@/utils/noteImport'

// 笔记转导图组件
export default {
  name: 'NoteToMindmap',
  data() {
    return {
      dialogVisible: false,
      blockId: '',
      blockInfo: null,
      importType: 'outline', // outline | content | docTree
      finalSortMode: 15,
      autoNumber: false,
      maxLevel: 0, // 0 表示不限制
      autoRefresh: false,
      querying: false,
      importing: false,
      currentImageUrl: '' // 当前思维导图的图片URL
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
        // 通过 postMessage 请求父窗口的块属性和图片URL
        window.parent.postMessage(JSON.stringify({
          event: 'get_block_setting'
        }), '*')
        window.parent.postMessage(JSON.stringify({
          event: 'get_current_image_url'
        }), '*')

        // 监听响应
        const handler = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.event === 'block_setting_response') {
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
            } else if (message.event === 'current_image_url_response') {
              if (message.imageUrl) {
                this.currentImageUrl = message.imageUrl
                console.log('[NoteToMindmap] Got image URL:', this.currentImageUrl)
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
        // 先判断是否为笔记本ID
        try {
          const nbRes = await fetchSyncPost('/api/notebook/lsNotebooks')
          if (nbRes && nbRes.code === 0 && nbRes.data && Array.isArray(nbRes.data.notebooks)) {
            const nb = nbRes.data.notebooks.find(n => n.id === this.blockId.trim())
            if (nb) {
              // 识别为笔记本
              this.blockInfo = {
                type: 'notebook',
                id: nb.id,
                name: nb.name,
                sortMode: nb.sortMode
              }
              this.importType = 'docTree'

              // 获取笔记本配置以确定最终排序模式
              try {
                const confRes = await fetchSyncPost('/api/notebook/getNotebookConf', {
                  notebook: this.blockId.trim()
                })
                if (confRes && confRes.code === 0 && confRes.data && confRes.data.conf) {
                  const notebookSortMode = confRes.data.conf.sortMode
                  if (notebookSortMode === 15) {
                    // 使用全局配置
                    this.finalSortMode = window?.siyuan?.config?.fileTree?.sort || nb.sortMode || 15
                  } else {
                    this.finalSortMode = notebookSortMode
                  }
                }
              } catch (e) {
                // 忽略 conf 获取错误，使用默认
                console.warn('Get notebook conf failed', e)
              }

              this.$message.success(this.$t('noteToMindmap.querySuccess'))
              return
            }
          }
        } catch (e) {
          // 忽略笔记本列表错误，继续尝试读取块
          console.warn('lsNotebooks failed', e)
        }

        // 不是笔记本，则查询 blocks 表
        const res = await fetchSyncPost('/api/query/sql', {
          stmt: `SELECT * FROM blocks WHERE id = '${this.blockId.trim()}'`
        })

        if (res.code === 0 && res.data && res.data.length > 0) {
          this.blockInfo = res.data[0]

          // 支持允许对文档选择子文档树
          if (this.blockInfo.type === 'd') {
            // 尝试将 path 和 notebook 字段规范化到 blockInfo
            // 常见字段名尝试:
            // notebook, notebook_id, notebookId
            // path, doc_path, file_path
            this.blockInfo.notebook = this.blockInfo.notebook || this.blockInfo.notebook_id || this.blockInfo.notebookId || this.blockInfo.notebookId
            this.blockInfo.path = this.blockInfo.path || this.blockInfo.doc_path || this.blockInfo.file_path || this.blockInfo.path
          }

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

        if (this.blockInfo.type === 'notebook' && this.importType === 'docTree') {
          // 从笔记本的文档树导入（笔记本无需输入路径，始终从根目录开始）
          const startPath = '/'
          mindmapData = await importDocTree(this.blockId, startPath, this.maxLevel, this.finalSortMode, this.blockInfo.name)
        } else if (this.blockInfo.type === 'd' && this.importType === 'docTree') {
          // 文档ID也可选择子文档树：需要 notebook 与 path
          const docId = this.blockId.trim()
          let notebookId = this.blockInfo.notebook || this.blockInfo.notebook_id || this.blockInfo.notebookId
          let docPath = this.blockInfo.path || this.blockInfo.doc_path || this.blockInfo.file_path

          // 如果没有 notebookId，则使用 SQL 查询 blocks 表以取 box 字段
          if (!notebookId) {
            try {
              const boxRes = await fetchSyncPost('/api/query/sql', {
                stmt: `SELECT box, path FROM blocks WHERE id = '${docId}'`
              })
              if (boxRes && boxRes.code === 0 && boxRes.data && boxRes.data.length > 0) {
                const row = boxRes.data[0]
                notebookId = row.box || notebookId
                // 优先使用返回的 path，如果原来没有 docPath
                const pathFromRow = row.path || row.doc_path || row.file_path
                if (pathFromRow && !docPath) docPath = pathFromRow
              }
            } catch (e) {
              console.warn('查询 blocks.box 失败', e)
            }
          }

          if (!notebookId) {
            this.$message.error(this.$t('noteToMindmap.cannotGetNotebook'))
            this.importing = false
            return
          }

          if (!docPath) {
            this.$message.error(this.$t('noteToMindmap.cannotGetDocPath'))
            this.importing = false
            return
          }

          // 使用 importDocTree 生成子节点树，然后给根节点附加文档名与超链接
          mindmapData = await importDocTree(notebookId, docPath, this.maxLevel, this.finalSortMode, this.blockInfo.content || this.blockInfo.name)
          try {
            mindmapData.data.hyperlink = `siyuan://blocks/${docId}`
            mindmapData.data.hyperlinkTitle = (mindmapData.data.hyperlinkTitle) || (this.blockInfo.content || this.blockInfo.name || '')
          } catch (e) {}
        } else if (this.blockInfo.type === 'd' && this.importType === 'outline') {
          // 导入文档大纲
          mindmapData = await importOutline(this.blockId, this.blockInfo, this.maxLevel)
        } else {
          // 导入内容（文档内容或块内容）
          mindmapData = await importContent(this.blockId, this.blockInfo, this.maxLevel, this.currentImageUrl)
        }

        if (mindmapData) {
          // 应用自动编号
          if (this.autoNumber) {
            applyAutoNumber(mindmapData)
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
