module.exports = {
  productionSourceMap: false,
  lintOnSave: false,
  chainWebpack: config => {
    config.plugins.delete('prefetch')
  },
  devServer: {
    proxy: {
      '/dev': {
        target: 'http://localhost:' + process.env.VUE_APP_PORT,
        pathRewrite: { '^/dev': '' },
        changeOrigin: true
      }
    }
  }
}
