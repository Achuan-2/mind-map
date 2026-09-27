<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
import { preventPageSelectAll } from './utils/preventPageSelectAll'

export default {
  name: 'App',
  mounted() {
    // 捕获阶段处理，覆盖工具栏及阻止键盘事件冒泡的弹窗控件。
    document.addEventListener('keydown', preventPageSelectAll, true)
  },
  beforeDestroy() {
    document.removeEventListener('keydown', preventPageSelectAll, true)
  }
}
</script>

<style lang="less">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  color: #2c3e50;
}

.customScrollbar {
  &::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 7px;
    background-color: rgba(0, 0, 0, 0.3);
    cursor: pointer;
  }

  &::-webkit-scrollbar-track {
    box-shadow: none;
    background: transparent;
    display: none;
  }
}

.el-dialog{
  border-radius: 10px;
}
</style>
