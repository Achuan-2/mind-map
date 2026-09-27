import {
  isWhite,
  isTransparent,
  getVisibleColorFromTheme
} from '../utils/index'

// 小地图插件
class MiniMap {
  //  构造函数
  constructor(opt) {
    this.mindMap = opt.mindMap
    this.isMousedown = false
    this.mousedownPos = {
      x: 0,
      y: 0
    }
    this.startViewPos = {
      x: 0,
      y: 0
    }
    this.currentState = null
  }

  //  计算小地图的渲染数据
  /**
   * boxWidth：小地图容器的宽度
   * boxHeight：小地图容器的高度
   */
  calculationMiniMap(boxWidth, boxHeight) {
    let { svg, rect, origWidth, origHeight } =
      this.mindMap.getSvgData({
        ignoreWatermark: true
      })
    // 计算数据
    const elRect = this.mindMap.elRect
    rect.x -= elRect.left
    rect.x2 -= elRect.left
    rect.y -= elRect.top
    rect.y2 -= elRect.top
    let boxRatio = boxWidth / boxHeight
    let actWidth = 0
    let actHeight = 0
    if (boxRatio > rect.ratio) {
      // 高度以box为准，缩放宽度
      actHeight = boxHeight
      actWidth = rect.ratio * actHeight
    } else {
      // 宽度以box为准，缩放高度
      actWidth = boxWidth
      actHeight = actWidth / rect.ratio
    }
    // svg图形的缩放及位置
    let miniMapBoxScale = actWidth / rect.width
    let miniMapBoxLeft = (boxWidth - actWidth) / 2
    let miniMapBoxTop = (boxHeight - actHeight) / 2
    this.removeNodeContent(svg)
    const svgStr = svg.svg()
    this.currentState = {
      contentRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      canvasWidth: origWidth,
      canvasHeight: origHeight,
      miniMapBoxScale,
      miniMapBoxLeft,
      miniMapBoxTop
    }
    const viewBoxStyle = this.updateViewBoxStyle()
    return {
      getImgUrl: async callback => {
        const res = await this.mindMap.doExport.fixSvgStrAndToBlob(svgStr)
        callback(res)
      },
      svgHTML: svgStr, // 小地图html
      viewBoxStyle, // 视图框的位置信息
      miniMapBoxScale, // 视图框的缩放值
      miniMapBoxLeft, // 视图框的left值
      miniMapBoxTop // 视图框的top值
    }
  }

  // 视图移动时仅更新视口框，不重新克隆和序列化整张 SVG。
  updateViewBoxStyle() {
    if (!this.currentState) return null
    const {
      contentRect, canvasWidth, canvasHeight,
      miniMapBoxScale, miniMapBoxLeft, miniMapBoxTop
    } = this.currentState
    const { x, y, scale } = this.mindMap.view
    const clamp = (value, size) => Math.max(0, Math.min(value, size))
    const width = contentRect.width * miniMapBoxScale
    const height = contentRect.height * miniMapBoxScale
    const viewBoxStyle = {
      left: `${miniMapBoxLeft + clamp((-x / scale - contentRect.x) * miniMapBoxScale, width)}px`,
      right: `${miniMapBoxLeft + clamp((contentRect.x + contentRect.width - (canvasWidth - x) / scale) * miniMapBoxScale, width)}px`,
      top: `${miniMapBoxTop + clamp((-y / scale - contentRect.y) * miniMapBoxScale, height)}px`,
      bottom: `${miniMapBoxTop + clamp((contentRect.y + contentRect.height - (canvasHeight - y) / scale) * miniMapBoxScale, height)}px`
    }
    this.currentState.viewBoxStyle = viewBoxStyle
    return viewBoxStyle
  }

  // 移除节点的内容
  removeNodeContent(svg) {
    if (svg.hasClass('smm-node')) {
      let shape = svg.findOne('.smm-node-shape')
      let fill = shape.attr('fill')
      if (isWhite(fill) || isTransparent(fill)) {
        shape.attr('fill', getVisibleColorFromTheme(this.mindMap.themeConfig))
      }
      svg.clear()
      svg.add(shape)
      return
    }
    let children = svg.children()
    if (children && children.length > 0) {
      children.forEach(node => {
        this.removeNodeContent(node)
      })
    }
  }

  //  小地图鼠标按下事件
  onMousedown(e) {
    this.isMousedown = true
    this.mousedownPos = {
      x: e.clientX,
      y: e.clientY
    }
    // 保存视图当前的偏移量
    let transformData = this.mindMap.view.getTransformData()
    this.startViewPos = {
      x: transformData.state.x,
      y: transformData.state.y
    }
  }

  //  小地图鼠标移动事件
  onMousemove(e, sensitivityNum = 5) {
    if (!this.isMousedown || this.isViewBoxMousedown) {
      return
    }
    let ox = e.clientX - this.mousedownPos.x
    let oy = e.clientY - this.mousedownPos.y
    // 在视图最初偏移量上累加更新量
    this.mindMap.view.translateXTo(ox * sensitivityNum + this.startViewPos.x)
    this.mindMap.view.translateYTo(oy * sensitivityNum + this.startViewPos.y)
  }

  //  小地图鼠标松开事件
  onMouseup() {
    this.isMousedown = false
    this.isViewBoxMousedown = false
  }

  // 视口框鼠标按下事件
  onViewBoxMousedown(e) {
    this.isViewBoxMousedown = true
    this.mousedownPos = {
      x: e.clientX,
      y: e.clientY
    }
    // 保存视图当前的偏移量
    let transformData = this.mindMap.view.getTransformData()
    this.startViewPos = {
      x: transformData.state.x,
      y: transformData.state.y
    }
  }

  // 视口框鼠标移动事件
  onViewBoxMousemove(e) {
    if (!this.isViewBoxMousedown || !this.currentState || this.isMousedown)
      return
    let ox = e.clientX - this.mousedownPos.x
    let oy = e.clientY - this.mousedownPos.y
    const { viewBoxStyle, miniMapBoxScale, miniMapBoxLeft, miniMapBoxTop } =
      this.currentState
    const left = Math.max(
      miniMapBoxLeft,
      Number.parseFloat(viewBoxStyle.left) + ox
    )
    const right = Math.max(
      miniMapBoxLeft,
      Number.parseFloat(viewBoxStyle.right) - ox
    )
    const top = Math.max(
      miniMapBoxTop,
      Number.parseFloat(viewBoxStyle.top) + oy
    )
    const bottom = Math.max(
      miniMapBoxTop,
      Number.parseFloat(viewBoxStyle.bottom) - oy
    )
    this.mindMap.emit('mini_map_view_box_position_change', {
      left: left + 'px',
      right: right + 'px',
      top: top + 'px',
      bottom: bottom + 'px'
    })
    // 在视图最初偏移量上累加更新量
    this.mindMap.view.translateXTo(-ox / miniMapBoxScale + this.startViewPos.x)
    this.mindMap.view.translateYTo(-oy / miniMapBoxScale + this.startViewPos.y)
  }
}

MiniMap.instanceName = 'miniMap'

export default MiniMap
