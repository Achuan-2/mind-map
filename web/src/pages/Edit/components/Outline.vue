<template>
  <div class="outlineRoot">
  <el-tree
    ref="tree"
    class="outlineTree"
    node-key="uid"
    draggable
    default-expand-all
    :class="{ isDark: isDark }"
    :data="data"
    :props="defaultProps"
    :highlight-current="true"
    :expand-on-click-node="false"
    :allow-drag="checkAllowDrag"
    @node-drop="onNodeDrop"
    @node-drag-start="onNodeDragStart"
    @node-drag-end="onNodeDragEnd"
    @current-change="onCurrentChange"
    @mouseenter.native="isInTreArea = true"
    @mouseleave.native="isInTreArea = false"
  >
    <span
      class="customNode"
      slot-scope="{ node, data }"
      :data-id="data.uid"
      @click="onClick(data)"
      @contextmenu.prevent="showContextMenu($event, data)"
    >
      <span
        class="nodeEdit"
        :contenteditable="!isReadonly"
        :key="getKey()"
        @keydown.stop="onNodeInputKeydown($event, node)"
        @keyup.stop
        @blur="onBlur($event, node)"
        @paste="onPaste($event, node)"
        v-html="node.label"
      ></span>
    </span>
  </el-tree>
  <div
    v-if="contextMenu && contextMenu.show"
    class="outline-context-menu"
    :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
  >
    <div class="item" @click="ctxInsertChild(contextMenu.nodeData)">新建子节点</div>
    <div class="item" @click="ctxInsertBefore(contextMenu.nodeData)">在上方插入</div>
    <div class="item" @click="ctxInsertAfter(contextMenu.nodeData)">在下方插入</div>
    <div class="item delete" @click="ctxDelete(contextMenu.nodeData)">删除</div>
  </div>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex'
import {
  nodeRichTextToTextWithWrap,
  textToNodeRichTextWithWrap,
  createUid,
  htmlEscape,
  handleInputPasteText
} from 'simple-mind-map/src/utils'

// 大纲树
export default {
  props: {
    mindMap: {
      type: Object
    }
  },
  data() {
    return {
      data: [],
      defaultProps: {
        label: 'label'
      },
      currentData: null,
      notHandleDataChange: false,
      isHandleNodeTreeRenderEnd: false,
      beInsertNodeUid: '',
      insertType: '',
      insertTargetUid: '',
      insertPlace: '',
      isInTreArea: false,
      isAfterCreateNewNode: false,
      contextMenu: {
        show: false,
        x: 0,
        y: 0,
        nodeData: null
      }
    }
  },
  computed: {
    ...mapState({
      isReadonly: state => state.isReadonly,
      isDark: state => state.localConfig.isDark
    })
  },
  created() {
    window.addEventListener('keydown', this.onKeyDown)
    this.$bus.$on('data_change', this.handleDataChange)
    this.$bus.$on('node_tree_render_end', this.handleNodeTreeRenderEnd)
    this.$bus.$on('hide_text_edit', this.handleHideTextEdit)
    window.addEventListener('click', this.hideContextMenu)
  },
  mounted() {
    this.refresh()
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    this.$bus.$off('data_change', this.handleDataChange)
    this.$bus.$off('node_tree_render_end', this.handleNodeTreeRenderEnd)
    this.$bus.$off('hide_text_edit', this.handleHideTextEdit)
    window.removeEventListener('click', this.hideContextMenu)
  },
  methods: {
    ...mapMutations(['setIsDragOutlineTreeNode']),

    // 右键菜单状态
    showContextMenu(e, nodeData) {
      e.preventDefault()
      this.contextMenu.show = true
      this.contextMenu.x = e.clientX
      this.contextMenu.y = e.clientY
      this.contextMenu.nodeData = nodeData
    },

    hideContextMenu() {
      if (this.contextMenu) this.contextMenu.show = false
    },

    handleHideTextEdit() {
      if (this.notHandleDataChange) {
        this.notHandleDataChange = false
        this.refresh()
      }
    },

    handleDataChange() {
      // 在大纲里操作节点时不要响应该事件，否则会重新刷新树
      if (this.notHandleDataChange) {
        this.notHandleDataChange = false
        this.isAfterCreateNewNode = false
        return
      }
      if (this.isAfterCreateNewNode) {
        this.isAfterCreateNewNode = false
        return
      }
      this.refresh()
    },

    handleNodeTreeRenderEnd() {
      // 当前存在未完成的节点插入操作
      if (this.insertType) {
        this[this.insertType]()
        this.insertType = ''
        return
      }
      // 如果是通过右键菜单触发并且需要在创建后移动新节点到指定位置
      if (this.insertPlace) {
        try {
          const newNode = this.mindMap.renderer.findNodeByUid(this.beInsertNodeUid)
          const targetNode = this.mindMap.renderer.findNodeByUid(this.insertTargetUid)
          if (newNode && targetNode) {
            if (this.insertPlace === 'before') {
              this.mindMap.execCommand('INSERT_BEFORE', newNode, targetNode)
            } else if (this.insertPlace === 'after') {
              this.mindMap.execCommand('INSERT_AFTER', newNode, targetNode)
            }
          }
        } catch (e) {
          console.log(e)
        }
        this.insertPlace = ''
        this.insertTargetUid = ''
      }
      // 插入了新节点后需要做一些操作
      if (this.isHandleNodeTreeRenderEnd) {
        this.isHandleNodeTreeRenderEnd = false
        this.refresh()
        this.$nextTick(() => {
          this.afterCreateNewNode()
        })
      }
    },

    // 刷新树数据
    refresh() {
      let data = this.mindMap.getData()
      data.root = true // 标记根节点
      let walk = root => {
        let text = root.data.richText
          ? nodeRichTextToTextWithWrap(root.data.text)
          : root.data.text
        text = htmlEscape(text)
        text = text.replace(/\n/g, '<br>')
        root.textCache = text // 保存一份修改前的数据，用于对比是否修改了
        root.label = text
        root.uid = root.data.uid
        if (root.children && root.children.length > 0) {
          root.children.forEach(item => {
            walk(item)
          })
        }
      }
      walk(data)
      this.data = [data]
    },

    // 插入了新节点之后
    afterCreateNewNode() {
      // 如果是新插入节点，那么需要手动高亮该节点、定位该节点及聚焦
      let id = this.beInsertNodeUid
      if (id && this.$refs.tree) {
        try {
          this.isAfterCreateNewNode = true
          // 高亮树节点
          this.$refs.tree.setCurrentKey(id)
          let node = this.$refs.tree.getNode(id)
          this.onCurrentChange(node.data)
          // 定位该节点
          this.onClick(node.data)
          // 聚焦该树节点的编辑框
          const el = document.querySelector(
            `.customNode[data-id="${id}"] .nodeEdit`
          )
          if (el) {
            let selection = window.getSelection()
            let range = document.createRange()
            range.selectNodeContents(el)
            selection.removeAllRanges()
            selection.addRange(range)
            let offsetTop = el.offsetTop
            this.$emit('scrollTo', offsetTop)
          }
        } catch (error) {
          console.log(error)
        }
      }
      this.beInsertNodeUid = ''
    },

    // 根节点不允许拖拽
    checkAllowDrag(node) {
      return !node.data.root
    },

    // 失去焦点更新节点文本
    onBlur(e, node) {
      // 节点数据没有修改
      if (node.data.textCache === e.target.innerHTML) {
        // 如果存在未执行的插入新节点操作，那么直接执行
        if (this.insertType) {
          this[this.insertType]()
          this.insertType = ''
        }
        return
      }
      // 否则插入新节点操作需要等待当前修改事件渲染完成后再执行
      const richText = node.data.data.richText
      const text = richText ? e.target.innerHTML : e.target.innerText
      const targetNode = this.mindMap.renderer.findNodeByUid(node.data.uid)
      if (!targetNode) return
      this.notHandleDataChange = true
      if (richText) {
        targetNode.setText(textToNodeRichTextWithWrap(text), true)
      } else {
        targetNode.setText(text)
      }
    },

    // 拦截粘贴事件
    onPaste(e) {
      handleInputPasteText(e)
    },

    // 生成唯一的key
    getKey() {
      return Math.random()
    },

    // 节点输入区域按键事件
    onNodeInputKeydown(e) {
      if (e.keyCode === 13 && !e.shiftKey) {
        // 插入兄弟节点
        e.preventDefault()
        this.insertType = 'insertNode'
        e.target.blur()
      }
      if (e.keyCode === 9) {
        e.preventDefault()
        if (e.shiftKey) {
          // 节点上升一级
          this.insertType = 'moveUp'
          e.target.blur()
        } else {
          // 插入子节点
          this.insertType = 'insertChildNode'
          e.target.blur()
        }
      }
    },

    // 节点上移一个层级
    moveUp() {
      this.mindMap.execCommand('MOVE_UP_ONE_LEVEL')
    },

    // 插入兄弟节点
    insertNode() {
      this.notHandleDataChange = true
      this.isHandleNodeTreeRenderEnd = true
      this.beInsertNodeUid = createUid()
      this.mindMap.execCommand('INSERT_NODE', false, [], {
        uid: this.beInsertNodeUid
      })
    },

    // 插入下级节点
    insertChildNode() {
      this.notHandleDataChange = true
      this.isHandleNodeTreeRenderEnd = true
      this.beInsertNodeUid = createUid()
      this.mindMap.execCommand('INSERT_CHILD_NODE', false, [], {
        uid: this.beInsertNodeUid
      })
    },

    // 激活当前节点且移动当前节点到画布中间
    onClick(data) {
      this.notHandleDataChange = true
      const targetNode = this.mindMap.renderer.findNodeByUid(data.uid)
      if (targetNode && targetNode.nodeData.data.isActive) return
      this.mindMap.execCommand('GO_TARGET_NODE', data.uid, () => {
        this.notHandleDataChange = false
      })
    },

    onNodeDragStart() {
      this.setIsDragOutlineTreeNode(true)
    },

    onNodeDragEnd() {
      this.setIsDragOutlineTreeNode(false)
    },

    // 拖拽结束事件
    onNodeDrop(data, target, postion) {
      this.notHandleDataChange = true
      const node = this.mindMap.renderer.findNodeByUid(data.data.uid)
      const targetNode = this.mindMap.renderer.findNodeByUid(target.data.uid)
      if (!node || !targetNode) {
        return
      }
      switch (postion) {
        case 'before':
          this.mindMap.execCommand('INSERT_BEFORE', node, targetNode)
          break
        case 'after':
          this.mindMap.execCommand('INSERT_AFTER', node, targetNode)
          break
        case 'inner':
          this.mindMap.execCommand('MOVE_NODE_TO', node, targetNode)
          break
        default:
          break
      }
    },

    // 右键菜单操作 — 在下方插入同级节点
    ctxInsertAfter(nodeData) {
      this.notHandleDataChange = true
      this.isHandleNodeTreeRenderEnd = true
      this.beInsertNodeUid = createUid()
      this.insertTargetUid = nodeData.uid
      this.insertPlace = 'after'
      // 调用默认插入兄弟节点（通常是插入在当前所在位置后面）
      this.mindMap.execCommand('INSERT_NODE', false, [], { uid: this.beInsertNodeUid })
      this.hideContextMenu()
    },

    // 右键菜单操作 — 在上方插入同级节点
    ctxInsertBefore(nodeData) {
      this.notHandleDataChange = true
      this.isHandleNodeTreeRenderEnd = true
      this.beInsertNodeUid = createUid()
      this.insertTargetUid = nodeData.uid
      this.insertPlace = 'before'
      this.mindMap.execCommand('INSERT_NODE', false, [], { uid: this.beInsertNodeUid })
      this.hideContextMenu()
    },

    // 右键菜单操作 — 新建子节点
    ctxInsertChild(nodeData) {
      this.notHandleDataChange = true
      this.isHandleNodeTreeRenderEnd = true
      this.beInsertNodeUid = createUid()
      this.insertTargetUid = nodeData.uid
      this.insertPlace = 'child'
      this.mindMap.execCommand('INSERT_CHILD_NODE', false, [], { uid: this.beInsertNodeUid })
      this.hideContextMenu()
    },

    // 右键菜单操作 — 删除
    ctxDelete(nodeData) {
      const node = this.mindMap.renderer.findNodeByUid(nodeData.uid)
      if (node && !node.isRoot) {
        this.notHandleDataChange = true
        this.$refs.tree.remove(nodeData)
        this.mindMap.execCommand('REMOVE_NODE', [node])
      }
      this.hideContextMenu()
    },

    // 当前选中的树节点变化事件
    onCurrentChange(data) {
      this.currentData = data
    },

    // 删除节点
    onKeyDown(e) {
      if (!this.isInTreArea) return
      if ([46, 8].includes(e.keyCode) && this.currentData) {
        e.stopPropagation()
        this.mindMap.renderer.textEdit.hideEditTextBox()
        const node = this.mindMap.renderer.findNodeByUid(this.currentData.uid)
        if (node && !node.isRoot) {
          this.notHandleDataChange = true
          this.$refs.tree.remove(this.currentData)
          this.mindMap.execCommand('REMOVE_NODE', [node])
        }
      }
    }
  }
}
</script>

<style lang="less" scoped>
.customNode {
  width: 100%;
  color: rgba(0, 0, 0, 0.85);
  font-weight: bold;

  .nodeEdit {
    outline: none;
    white-space: normal;
    padding-right: 20px;
  }
}
</style>
<style lang="less" scoped>
@import url('../../../style/outlineTree.less');
</style>

<style lang="less" scoped>
.outline-context-menu {
  position: fixed;
  z-index: 3000;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.12);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  min-width: 140px;
  color: #333;
}
.outline-context-menu .item {
  padding: 8px 12px;
  cursor: pointer;
}
.outline-context-menu .item:hover { background: #f5f5f5 }
.outline-context-menu .item.delete { color: #f56c6c }
</style>
