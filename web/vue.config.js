const path = require('path')
const isDev = process.env.NODE_ENV === 'development'
const isLibrary = process.env.NODE_ENV === 'library'

const WebpackDynamicPublicPathPlugin = require('webpack-dynamic-public-path')
const mindMapPackageDir = path.dirname(require.resolve('simple-mind-map/package.json'))
const quillPackageDir = path.dirname(require.resolve('quill/package.json', {
  paths: [mindMapPackageDir]
}))
const viewerPackageDir = path.dirname(require.resolve('viewerjs/package.json', {
  paths: [path.dirname(require.resolve('v-viewer'))]
}))

module.exports = {
  publicPath: isDev ? '' : './dist',
  outputDir: '../dist',
  lintOnSave: false,
  productionSourceMap: false,
  filenameHashing: false,
  transpileDependencies: ['yjs', 'lib0', 'quill'],
  chainWebpack: config => {
    // 移除 preload 插件
    config.plugins.delete('preload')
    // 移除 prefetch 插件
    config.plugins.delete('prefetch')
    // 支持运行时设置public path
    if (!isDev) {
      config
        .plugin('dynamicPublicPathPlugin')
        .use(WebpackDynamicPublicPathPlugin, [
          { externalPublicPath: 'window.externalPublicPath' }
        ])
    }
    // 给插入html页面内的js和css添加hash参数
    if (!isLibrary) {
      config.plugin('html').tap(args => {
        args[0].hash = true
        return args
      })
    }
  },
  configureWebpack: {
    resolve: {
      // file: 依赖由 pnpm 安装在独立目录，其依赖也位于该目录的上一级。
      modules: [
        'node_modules',
        path.resolve(mindMapPackageDir, '..'),
        // 富文本插件直接使用 Quill 的 Delta 和 Parchment，必须解析到同一版本。
        path.resolve(quillPackageDir, '..')
      ],
      alias: {
        '@': path.resolve(__dirname, './src/'),
        // 使用当前源码，避免构建时读取 pnpm file: 依赖中的旧副本。
        'simple-mind-map': path.resolve(__dirname, '../simple-mind-map'),
        // 图片预览组件和直接导入的样式使用同一个 Viewer.js 实例。
        viewerjs: viewerPackageDir
      }
    }
  },
  devServer: {
    proxy: {
      '^/api/v3/': {
        target: 'http://ark.cn-beijing.volces.com',
        changeOrigin: true
      }
    }
  }
}
