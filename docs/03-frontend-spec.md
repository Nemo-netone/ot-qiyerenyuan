# 03 前端规格

## 页面目标

前端是企业 HR 后台管理界面，目标是让管理员完成登录、员工/部门/权限/考勤/薪资等日常维护。

## 入口与状态

| 部分 | 位置 | 职责 |
| --- | --- | --- |
| 请求封装 | `src/utils/request.js` | 设置 API baseURL、token header、统一错误提示 |
| API 地址 | `src/utils/apiBase.js` | 支持构建时和运行时配置 CloudBase API |
| 登录状态 | `src/store` | 保存员工信息和 token |
| 路由菜单 | `src/router`、后端 `/menu/staff` | 登录后按角色加载菜单 |

## API 基址规则

优先级从高到低：

1. URL 查询参数 `?apiBase=...`
2. 浏览器 `localStorage.HRM_API_BASE_URL`
3. `window.HRM_CONFIG.apiBase`
4. 构建变量 `VUE_APP_BASE_API`
5. 本地默认 `/dev`

导入、导出、上传、下载这类原来返回字符串 URL 的接口，必须使用 `buildApiUrl(...)`，不能拼 `http://localhost`。

## 手动验收

- 登录页可打开。
- 登录成功后左侧菜单可显示。
- 员工、部门、考勤、薪资等列表页面可请求数据。
- 导入/导出按钮请求地址指向 CloudBase 域名。
