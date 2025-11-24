<template>
  <Sidebar ref="sidebar" :title="$t('outline.title')">
    <template #headerButtons>
      <div class="btnList">
        <el-tooltip
          class="item"
          effect="dark"
          :content="$t('outline.copyToMarkdown')"
          placement="top"
        >
          <div class="btn" @click="onCopyToMarkdown">
            <span class="icon iconfont iconmarkdown"></span>
          </div>
        </el-tooltip>
        <el-tooltip
          class="item"
          effect="dark"
          :content="$t('outline.print')"
          placement="top"
        >
          <div class="btn" @click="onPrint">
            <span class="icon iconfont iconprinting"></span>
          </div>
        </el-tooltip>
        <el-tooltip
          class="item"
          effect="dark"
          :content="$t('outline.pasteFromMarkdown') || '粘贴导入 Markdown'"
          placement="top"
        >
          <div class="btn" @click="onPasteImport">
            <span class="icon iconfont iconniantie"></span>
          </div>
        </el-tooltip>
        <el-tooltip
          class="item"
          effect="dark"
          :content="$t('outline.fullscreen')"
          placement="top"
        >
          <div
            class="btn"
            :class="{ isDark: isDark }"
            @click="onChangeToOutlineEdit"
          >
            <span class="icon iconfont iconquanping1"></span>
          </div>
        </el-tooltip>
      </div>
    </template>
    <div class="outlineWrap">
      <Outline
        :mindMap="mindMap"
        v-if="activeSidebar === 'outline'"
        @scrollTo="onScrollTo"
        ref="outlineRef"
      ></Outline>
    </div>
  </Sidebar>
</template>

<script>
import Sidebar from './Sidebar.vue'
import { mapState, mapMutations } from 'vuex'
import Outline from './Outline.vue'
import { printOutline, setDataToClipboard, copy, transformToMarkdownList, applyInlineMarkdownToTree } from '@/utils'
import markdown from 'simple-mind-map/src/parse/markdown.js'
import { storeData } from '@/api'

// 大纲侧边栏
export default {
  components: {
    Sidebar,
    Outline
  },
  props: {
    mindMap: {
      type: Object
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark,
      activeSidebar: state => state.activeSidebar
    })
  },
  watch: {
    activeSidebar(val) {
      if (val === 'outline') {
        this.$refs.sidebar.show = true
      } else {
        this.$refs.sidebar.show = false
      }
    }
  },
  methods: {
    ...mapMutations(['setIsOutlineEdit', 'setActiveSidebar']),

    onChangeToOutlineEdit() {
      this.setActiveSidebar(null)
      this.setIsOutlineEdit(true)
    },

    onScrollTo(y) {
      let container = this.$refs.sidebar.getEl()
      let height = container.offsetHeight
      let top = container.scrollTop
      if (y > top + height) {
        container.scrollTo(0, y - height / 2)
      }
    },

    // 打印
    onPrint() {
      printOutline(this.$refs.outlineRef.$el)
    },

    // 复制为Markdown
    onCopyToMarkdown() {
      const data = this.mindMap.getData()
      const md = transformToMarkdownList(data)
      if (navigator.clipboard) {
        setDataToClipboard(md)
      } else {
        copy(md)
      }
      this.$message.success(this.$t('contextmenu.copySuccess'))
    }
    ,
    // 粘贴/导入 Markdown 列表
    async onPasteImport() {
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
        const res = markdown.transformMarkdownTo(md)
        let root = res.root || res
        // 将行内 Markdown (粗体/斜体) 转为富文本并在节点上标记
        try {
          applyInlineMarkdownToTree(root)
        } catch (err) {
          console.error('applyInlineMarkdownToTree fail', err)
        }
        this.$bus.$emit('setData', root)
        storeData({ root })
        this.$message.success(this.$t('outline.importSuccess') || '导入成功')
      } catch (e) {
        console.error(e)
        this.$message.error(this.$t('outline.importFail') || '导入失败')
      }
    }
  }
}
</script>

<style lang="less" scoped>
.btnList {
  position: absolute;
  /* leave space for the close button (right:20px) */
  right: 52px;
  display: flex;
  align-items: center;
  z-index: 100;

  .btn {
    cursor: pointer;
    margin-left: 12px;

    &.isDark {
      color: #fff;
    }
  }
}
</style>
