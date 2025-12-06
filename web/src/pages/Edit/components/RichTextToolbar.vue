<template>
  <div
    class="richTextToolbar"
    ref="richTextToolbar"
    :style="style"
    :class="{ isDark: isDark }"
    @click.stop.passive
    v-show="showRichTextToolbar"
  >
    <el-tooltip :content="$t('richTextToolbar.bold')" placement="top">
      <div class="btn" :class="{ active: formatInfo.bold }" @click="toggleBold">
        <span class="icon iconfont iconzitijiacu"></span>
      </div>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.italic')" placement="top">
      <div
        class="btn"
        :class="{ active: formatInfo.italic }"
        @click="toggleItalic"
      >
        <span class="icon iconfont iconzitixieti"></span>
      </div>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.underline')" placement="top">
      <div
        class="btn"
        :class="{ active: formatInfo.underline }"
        @click="toggleUnderline"
      >
        <span class="icon iconfont iconzitixiahuaxian"></span>
      </div>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.strike')" placement="top">
      <div
        class="btn"
        :class="{ active: formatInfo.strike }"
        @click="toggleStrike"
      >
        <span class="icon iconfont iconshanchuxian"></span>
      </div>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.fontFamily')" placement="top">
      <el-popover placement="bottom" trigger="hover">
        <div class="fontOptionsList" :class="{ isDark: isDark }">
          <div
            class="fontOptionItem"
            v-for="item in fontFamilyList"
            :key="item.value"
            :style="{ fontFamily: item.value }"
            :class="{ active: formatInfo.font === item.value }"
            @click="changeFontFamily(item.value)"
          >
            {{ item.name }}
          </div>
        </div>
        <div class="btn" slot="reference">
          <span class="icon iconfont iconxingzhuang-wenzi"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.fontSize')" placement="top">
      <el-popover placement="bottom" trigger="hover">
        <div class="fontOptionsList" :class="{ isDark: isDark }">
          <div
            class="fontOptionItem"
            v-for="item in fontSizeList"
            :key="item"
            :style="{
              fontSize: item + 'px',
              height: (item < 30 ? 30 : item + 10) + 'px'
            }"
            :class="{ active: formatInfo.size === item + 'px' }"
            @click="changeFontSize(item)"
          >
            {{ item }}px
          </div>
        </div>
        <div class="btn" slot="reference">
          <span class="icon iconfont iconcase fontColor"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.color')" placement="top">
      <el-popover placement="bottom" trigger="hover">
        <Color :color="fontColor" @change="changeFontColor"></Color>
        <div class="btn" slot="reference" :style="{ color: formatInfo.color }">
          <span class="icon iconfont iconzitiyanse"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip
      :content="$t('richTextToolbar.backgroundColor')"
      placement="top"
    >
      <el-popover placement="bottom" trigger="hover">
        <Color
          :color="fontBackgroundColor"
          @change="changeFontBackgroundColor"
        ></Color>
        <div class="btn" slot="reference">
          <span class="icon iconfont iconbeijingyanse"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.textAlign')" placement="top">
      <el-popover placement="bottom" trigger="hover">
        <div class="fontOptionsList" :class="{ isDark: isDark }">
          <div
            class="fontOptionItem"
            v-for="item in alignList"
            :key="item.value"
            :class="{ active: formatInfo.align === item.value }"
            @click="changeTextAlign(item.value)"
          >
            {{ item.name }}
          </div>
        </div>
        <div class="btn" slot="reference">
          <span class="icon iconfont iconjuzhongduiqi"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip :content="hasLink ? linkUrl : $t('richTextToolbar.hyperlink')" placement="top">
      <div class="btn" :class="{ active: hasLink }" @click="openLinkDialog">
        <span class="icon iconfont iconchaolianjie"></span>
      </div>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.removeFormat')" placement="top">
      <div class="btn" @click="removeFormat">
        <span class="icon iconfont iconqingchu"></span>
      </div>
    </el-tooltip>

    <!-- 链接编辑对话框 -->
    <el-dialog
      :title="$t('richTextToolbar.hyperlink')"
      :visible.sync="linkDialogVisible"
      width="400px"
      :append-to-body="true"
      :close-on-click-modal="false"
      @open="onLinkDialogOpen"
      custom-class="rich-text-link-dialog"
    >
      <div class="linkInputBox" :class="{ isDark: isDark }">
        <div class="linkInputItem">
          <span class="linkInputLabel">{{ $t('richTextToolbar.linkText') }}</span>
          <el-input
            ref="linkTextInput"
            v-model="linkText"
            size="small"
            :placeholder="$t('richTextToolbar.linkTextPlaceholder')"
          >
          </el-input>
        </div>
        <div class="linkInputItem">
          <span class="linkInputLabel">{{ $t('richTextToolbar.linkUrl') }}</span>
          <el-input
            ref="linkUrlInput"
            v-model="linkUrl"
            size="small"
            :placeholder="$t('richTextToolbar.linkPlaceholder')"
            @keyup.native.enter="confirmLink"
          >
          </el-input>
        </div>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="removeLink" v-if="hasLink" type="danger" size="small">
          {{ $t('richTextToolbar.removeLink') }}
        </el-button>
        <el-button @click="cancelLink" size="small">{{ $t('dialog.cancel') }}</el-button>
        <el-button type="primary" @click="confirmLink" size="small">{{ $t('dialog.confirm') }}</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { fontFamilyList, fontSizeList, alignList } from '@/config'
import Color from './Color.vue'
import { mapState } from 'vuex'

export default {
  components: {
    Color
  },
  props: {
    mindMap: {
      type: Object
    }
  },
  data() {
    return {
      fontSizeList,
      showRichTextToolbar: false,
      style: {
        left: 0,
        top: 0
      },
      fontColor: '',
      fontBackgroundColor: '',
      formatInfo: {},
      linkDialogVisible: false,
      linkUrl: '',
      linkText: '',
      hasLink: false,
      savedRange: null
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark
    }),

    fontFamilyList() {
      return fontFamilyList[this.$i18n.locale] || fontFamilyList.zh
    },

    alignList() {
      return alignList[this.$i18n.locale] || alignList.zh
    }
  },
  created() {
    this.$bus.$on('rich_text_selection_change', this.onRichTextSelectionChange)
  },
  mounted() {
    document.body.append(this.$refs.richTextToolbar)
  },
  beforeDestroy() {
    this.$bus.$off('rich_text_selection_change', this.onRichTextSelectionChange)
  },
  methods: {
    onRichTextSelectionChange(hasRange, rect, formatInfo) {
      if (hasRange) {
        this.style.left = rect.left + rect.width / 2 + 'px'
        this.style.top = rect.top - 60 + 'px'
        this.formatInfo = { ...(formatInfo || {}) }
        // 检查是否有链接
        this.hasLink = !!formatInfo?.link
        if (this.hasLink) {
          this.linkUrl = formatInfo.link
        }
      }
      this.showRichTextToolbar = hasRange
    },

    toggleBold() {
      this.formatInfo.bold = !this.formatInfo.bold
      this.mindMap.richText.formatText({
        bold: this.formatInfo.bold
      })
    },

    toggleItalic() {
      this.formatInfo.italic = !this.formatInfo.italic
      this.mindMap.richText.formatText({
        italic: this.formatInfo.italic
      })
    },

    toggleUnderline() {
      this.formatInfo.underline = !this.formatInfo.underline
      this.mindMap.richText.formatText({
        underline: this.formatInfo.underline
      })
    },

    toggleStrike() {
      this.formatInfo.strike = !this.formatInfo.strike
      this.mindMap.richText.formatText({
        strike: this.formatInfo.strike
      })
    },

    changeFontFamily(font) {
      this.formatInfo.font = font
      this.mindMap.richText.formatText({
        font
      })
    },

    changeFontSize(size) {
      this.formatInfo.size = size
      this.mindMap.richText.formatText({
        size: size + 'px'
      })
    },

    changeFontColor(color) {
      this.formatInfo.color = color
      this.mindMap.richText.formatText({
        color
      })
    },

    changeFontBackgroundColor(background) {
      this.formatInfo.background = background
      this.mindMap.richText.formatText({
        background
      })
    },

    changeTextAlign(align) {
      this.formatInfo.align = align
      this.mindMap.richText.formatText({
        align
      })
    },

    removeFormat() {
      this.mindMap.richText.removeFormat()
    },

    openLinkDialog() {
      if (this.mindMap && this.mindMap.richText) {
        // 保存当前选区
        this.savedRange = this.mindMap.richText.range || this.mindMap.richText.lastRange
        if (!this.savedRange) {
          return
        }
        // 获取当前选中文本
        const selectedText = this.mindMap.richText.getSelectionText()
        // 获取当前选中文本的链接
        const currentLink = this.mindMap.richText.getSelectionLink()
        if (currentLink) {
          this.hasLink = true
          this.linkUrl = currentLink
          this.linkText = selectedText || ''
        } else {
          this.hasLink = false
          this.linkUrl = ''
          this.linkText = selectedText || ''
        }
      }
      this.linkDialogVisible = true
    },

    onLinkDialogOpen() {
      this.$nextTick(() => {
        if (this.$refs.linkUrlInput) {
          this.$refs.linkUrlInput.focus()
        }
      })
    },

    confirmLink() {
      if (this.mindMap && this.mindMap.richText && this.savedRange) {
        const url = this.linkUrl.trim()
        const text = this.linkText.trim()
        
        // 恢复选区
        this.mindMap.richText.quill.setSelection(this.savedRange.index, this.savedRange.length)
        
        if (text && text !== this.mindMap.richText.getSelectionText()) {
          // 如果锚文本改变了，需要先删除原文本再插入新文本
          this.mindMap.richText.quill.deleteText(this.savedRange.index, this.savedRange.length)
          if (url) {
            this.mindMap.richText.quill.insertText(this.savedRange.index, text, 'link', url)
          } else {
            this.mindMap.richText.quill.insertText(this.savedRange.index, text)
          }
          // 更新选区
          this.mindMap.richText.quill.setSelection(this.savedRange.index, text.length)
        } else {
          // 只更新链接
          this.mindMap.richText.formatLink(url || false)
        }
        this.hasLink = !!url
      }
      this.linkDialogVisible = false
    },

    removeLink() {
      if (this.mindMap && this.mindMap.richText && this.savedRange) {
        // 恢复选区
        this.mindMap.richText.quill.setSelection(this.savedRange.index, this.savedRange.length)
        this.mindMap.richText.formatLink(false)
        this.hasLink = false
        this.linkUrl = ''
      }
      this.linkDialogVisible = false
    },

    cancelLink() {
      this.linkDialogVisible = false
    },

    closeLinkPopover() {
      this.linkDialogVisible = false
      this.savedRange = null
    }
  }
}
</script>

<style lang="less" scoped>
.richTextToolbar {
  position: fixed;
  z-index: 2000;
  height: 55px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  transform: translateX(-50%);

  &.isDark {
    background: #363b3f;

    .btn {
      color: #fff;

      &:hover {
        background: hsla(0, 0%, 100%, 0.05);
      }
    }
  }

  .btn {
    width: 55px;
    height: 55px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;

    &:hover {
      background-color: #eefbed;
    }

    &.active {
      color: #12bb37;
    }

    .icon {
      font-size: 20px;

      &.fontColor {
        font-size: 26px;
      }
    }
  }
}

.fontOptionsList {
  width: 150px;

  &.isDark {
    .fontOptionItem {
      color: #fff;

      &:hover {
        background-color: hsla(0, 0%, 100%, 0.05);
      }
    }
  }

  .fontOptionItem {
    height: 30px;
    width: 100%;
    display: flex;
    align-items: center;
    cursor: pointer;

    &:hover {
      background-color: #f7f7f7;
    }

    &.active {
      color: #12bb37;
    }
  }
}

.linkInputBox {
  width: 100%;
  padding: 10px 0;

  &.isDark {
    .linkInputLabel {
      color: #ccc;
    }
  }

  .linkInputItem {
    margin-bottom: 15px;

    &:last-child {
      margin-bottom: 0;
    }

    .linkInputLabel {
      display: block;
      font-size: 13px;
      color: #666;
      margin-bottom: 6px;
      font-weight: 500;
    }
  }
}
</style>

<style lang="less">
// dialog 全局样式，不能 scoped
.rich-text-link-dialog {
  .el-dialog__header {
    padding: 15px 20px;
    border-bottom: 1px solid #eee;
  }

  .el-dialog__body {
    padding: 20px;
  }

  .el-dialog__footer {
    padding: 10px 20px 15px;
    border-top: 1px solid #eee;
  }
}
</style>
