<template>
  <el-dialog
    class="nodeHyperlinkDialog"
    :title="$t('nodeHyperlink.title')"
    :visible.sync="dialogVisible"
    :width="isMobile ? '90%' : '50%'"
    :top="isMobile ? '20px' : '15vh'"
  >
    <div class="item">
      <span class="name">{{ $t('nodeHyperlink.link') }}</span>
      <el-input
        v-model="link"
        size="mini"
        placeholder="http://xxxx.com/"
        @keyup.native.stop
        @keydown.native.stop
        @paste.native="handlePaste"
      ></el-input>
    </div>
    <div class="item">
      <span class="name">{{ $t('nodeHyperlink.name') }}</span>
      <el-input
        v-model="linkTitle"
        size="mini"
        @keyup.native.stop
        @keydown.native.stop
      ></el-input>
    </div>
    <span slot="footer" class="dialog-footer">
      <el-button @click="cancel">{{ $t('dialog.cancel') }}</el-button>
      <el-button type="primary" @click="confirm">{{
        $t('dialog.confirm')
      }}</el-button>
    </span>
  </el-dialog>
</template>

<script>
import { isMobile } from 'simple-mind-map/src/utils/index'

// 节点超链接内容设置
export default {
  data() {
    return {
      dialogVisible: false,
      link: '',
      linkTitle: '',
      activeNodes: [],
      isMobile: isMobile()
    }
  },
  created() {
    this.$bus.$on('node_active', this.handleNodeActive)
    this.$bus.$on('showNodeLink', this.handleShowNodeLink)
  },
  beforeDestroy() {
    this.$bus.$off('node_active', this.handleNodeActive)
    this.$bus.$off('showNodeLink', this.handleShowNodeLink)
  },
  methods: {
    handleNodeActive(...args) {
      this.activeNodes = [...args[1]]
      if (this.activeNodes.length > 0) {
        let firstNode = this.activeNodes[0]
        this.link = firstNode.getData('hyperlink') || ''
        this.linkTitle = firstNode.getData('hyperlinkTitle') || ''
      } else {
        this.link = ''
        this.linkTitle = ''
      }
    },

    handleShowNodeLink() {
      this.dialogVisible = true
    },

    // 处理粘贴事件
    handlePaste(e) {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      if (!text) return

      // 检测思源块引用格式: ((blockId 'title')) 或 ((blockId "title"))
      const siyuanBlockRefMatch = text.match(/^\(\(([a-zA-Z0-9-]+)\s+['"](.+?)['"]\)\)$/)
      if (siyuanBlockRefMatch) {
        const blockId = siyuanBlockRefMatch[1]
        const title = siyuanBlockRefMatch[2]
        this.link = `siyuan://blocks/${blockId}`
        this.linkTitle = title
        return
      }

      // 检测 siyuan://blocks/xxx 格式
      const siyuanLinkMatch = text.match(/^siyuan:\/\/blocks\/([a-zA-Z0-9-]+)$/)
      if (siyuanLinkMatch) {
        this.link = text
        // 如果linkTitle为空,可以尝试从API获取
        if (!this.linkTitle) {
          this.fetchBlockTitle(siyuanLinkMatch[1])
        }
        return
      }

      // 普通链接,直接设置
      this.link = text
    },

    // 获取思源块标题
    async fetchBlockTitle(blockId) {
      try {
        const res = await fetch('/api/query/sql', {
          method: 'POST',
          body: JSON.stringify({
            stmt: `SELECT * FROM blocks WHERE id = '${blockId}'`
          })
        })
        const data = await res.json()
        
        if (data && data.code === 0 && data.data && data.data.length > 0) {
          const block = data.data[0]
          let title = block.content || block.name || ''
          // 移除HTML标签
          title = title.replace(/<[^>]+>/g, '')
          this.linkTitle = title
        }
      } catch (error) {
        console.error('获取思源块标题失败:', error)
      }
    },

    cancel() {
      this.dialogVisible = false
    },

    confirm() {
      this.activeNodes.forEach(node => {
        node.setHyperlink(this.link, this.linkTitle)
        this.cancel()
      })
    }
  }
}
</script>

<style lang="less" scoped>
.nodeHyperlinkDialog {
  .item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;

    .name {
      display: block;
      width: 50px;
    }
  }
}
</style>
