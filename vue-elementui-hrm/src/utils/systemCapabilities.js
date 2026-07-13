import store from '../store'

const writeLabels = ['新增', '编辑', '删除', '批量删除', '导入', '审批', '分配角色', '分配菜单']

const applyReadOnlyUi = root => {
  const staff = store.state.staff.staff
  if (!root || !staff || staff.canWrite !== false) return
  root.querySelectorAll('button, .el-upload, .el-popconfirm').forEach(element => {
    const text = (element.textContent || '').replace(/\s+/g, '')
    if (writeLabels.some(label => text.includes(label))) element.style.display = 'none'
  })
}

export const installSystemCapabilities = Vue => {
  Vue.mixin({
    mounted () {
      this.$nextTick(() => applyReadOnlyUi(this.$el))
    },
    updated () {
      this.$nextTick(() => applyReadOnlyUi(this.$el))
    }
  })

  const nativeOpen = window.open.bind(window)
  window.open = (url, target, features) => {
    const value = String(url || '')
    if (!/(\/export(?:\?|$)|\/download\/)/.test(value)) return nativeOpen(url, target, features)
    fetch(value, { headers: { token: store.state.token.token || '' } })
      .then(async response => {
        if (!response.ok) throw new Error((await response.json()).message || '下载失败')
        const blob = await response.blob()
        const disposition = response.headers.get('Content-Disposition') || ''
        const utfName = disposition.match(/filename\*=UTF-8''([^;]+)/i)
        const plainName = disposition.match(/filename="?([^";]+)"?/i)
        const name = utfName ? decodeURIComponent(utfName[1]) : (plainName ? plainName[1] : 'download.csv')
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = name
        link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      })
      .catch(error => Vue.prototype.$message.error(error.message))
    return null
  }
}
