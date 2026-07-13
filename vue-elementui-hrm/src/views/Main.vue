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
      <div class="demo-notice">
        作品集演示模式：列表、新增、编辑、删除与审批会真实保存；导入、导出和文件上传暂不开放。
      </div>
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

.demo-notice {
  padding: 7px 16px;
  color: #8a6116;
  background: #fff8e6;
  border-bottom: 1px solid #f3d99b;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
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

  .demo-notice {
    padding: 6px 8px;
    font-size: 12px;
    text-align: left;
  }

  .el-main {
    padding: 0 8px 12px;
    overflow-x: auto;
  }
}
</style>
