<template>
  <el-container class="app-shell">
    <el-aside class="app-aside" width="auto">

      <common-aside/>
      <!-- 引入侧边栏 -->
    </el-aside>
    <el-container class="app-content">
      <el-header>
        <common-header/>
        <!-- 引入顶栏 -->
      </el-header>
      <!-- 引入标签栏 -->
      <common-tag/>
      <el-main>
        <router-view/>
        <!-- 路由视图 -->
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
// @ is an alias to /src
import CommonAside from '../components/CommonAside'
import CommonHeader from '../components/CommonHeader'
import CommonTag from '../components/CommonTag'

export default {
  name: 'Main',
  components: {
    CommonAside,
    CommonHeader,
    CommonTag
  }
}
</script>

<style lang="less">
.el-header {
  background-color: #333;
}

.el-main {
  padding-top: 0;
}

.app-aside {
  box-shadow: 2px 0 6px rgb(0 21 41 / 35%);
  z-index: 20;
}

@media (max-width: 768px) {
  .app-shell {
    position: relative;
    overflow: hidden;
  }

  .app-aside {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
  }

  .app-content {
    min-width: 0;
    margin-left: 64px;
  }

  .el-main {
    padding: 0 8px 12px;
    overflow-x: auto;
  }
}
</style>
