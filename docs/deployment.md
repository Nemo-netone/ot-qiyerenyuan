# 部署说明

## 命名

| 资源 | 名称 |
| --- | --- |
| GitHub 仓库 | `Nemo-netone/ot-qiyerenyuan` |
| Cloudflare Pages | `ot-qiyerenyuan` |
| Pages 稳定地址 | `https://ot-qiyerenyuan.pages.dev` |
| CloudBase Run 服务 | `ot-qiyerenyuan-api` |
| CloudBase API | `https://ot-qiyerenyuan-api-273280-7-1369167244.sh.run.tcloudbase.com` |
| Supabase schema | `hrm_qiyerenyuan` |

## 1. 初始化 Supabase

在 Supabase 项目 `fmgqjbxydgxwhjrrhwxi` 中执行：

```bash
supabase db query --linked --file docs/database/hrm-postgres.sql
```

如果 CLI 要求数据库密码，可在 Supabase Dashboard 的 Project Settings -> Database 中重置或复制连接密码，然后通过 CLI 或 SQL Editor 执行同一文件。执行范围只限 `hrm_qiyerenyuan` schema。

## 2. 部署 CloudBase Run

后端镜像由根目录 `Dockerfile` 构建，容器端口 `8888`。当前 CloudBase CLI 使用新版 `cloudrun deploy`：

```bash
cloudbase --env-id meta-d5gh4ds014005aff1 cloudrun deploy \
  --serviceName ot-qiyerenyuan-api \
  --port 8888 \
  --source <clean-backend-source> \
  --force
```

部署前必须在 CloudBase Run 环境变量中配置数据库连接变量。不要把真实密码写进仓库。为了避免上传前端 `node_modules`，实际发布时建议用临时干净目录，只复制 `Dockerfile`、`hrm/pom.xml` 和 `hrm/src`。

## 3. 构建并部署 Cloudflare Pages

当前生产发布目录是仓库根目录下的 `original-site/`，其中包含恢复后的原 Vue 构建产物与 Pages Worker 兼容 API：

```bash
wrangler pages deploy original-site --project-name ot-qiyerenyuan --branch main
```

如果 Cloudflare Pages 使用 GitHub 自动构建：

| 设置项 | 值 |
| --- | --- |
| Production branch | `main` |
| Build command | 留空 |
| Build output directory | `original-site` |
| Runtime API | `original-site/_worker.js` |

## 4. 线上验收

1. 打开 `https://ot-qiyerenyuan.pages.dev`。
2. 使用 `admin / 123456` 登录。
3. 验证首页统计、员工列表、部门列表、菜单接口。
4. 打开浏览器 Network，确认请求目标是 CloudBase API，不是 localhost。

2026-07-07 已验收通过：

| 检查项 | 结果 |
| --- | --- |
| Pages 稳定地址 | `200 OK` |
| `config.js` API 基址 | 指向 CloudBase API |
| CORS 预检与登录 | 通过 |
| `admin / 123456` 登录 | 返回 token |
| `/home/count`、`/home/staff`、`/home/department` | `code=200` |
| `/staff/page`、`/dept/all`、`/menu/staff` | `code=200` |

## 2026-07-11 Pages Worker 恢复部署

原 CloudBase Run 后端已出现 503、CORS 或资源隔离问题。线上系统已切换为 Cloudflare Pages Worker 正式接口层：

- Pages 项目：`ot-qiyerenyuan`
- 稳定地址：https://ot-qiyerenyuan.pages.dev
- API：`/health`、`/login`、`/home/*`、`/staff/*`、`/dept/*`、`/menu/*` 等原 HRM 路由
- 数据：初始账号和各业务模块持久化数据
- 原 Java/Vue/SSM 源码继续保留；Pages Worker 负责稳定的公开作品集体验

## 2026-07-12 列表功能修复部署

线上登录和首页可用，但员工、部门、考勤、薪资等页面出现“共 N 条”却显示“暂无数据”，并在浏览器中反复抛出 `undefined.forEach`。

根因与修复：

- 原 Vue 页面读取分页字段 `response.data.list`，Worker 只返回了 `records`；现在同时返回 `list` 和 `records`
- 原 Vue 部门接口使用 `/dept/*`，Worker 只注册了 `/department/*`；现在 `dept` 复用同一个部门处理器
- 部门下拉会遍历 `children`；顶级部门现在显式返回 `children: []`

部署与验收：

- Cloudflare Pages 稳定地址：https://ot-qiyerenyuan.pages.dev
- 修复部署版本：https://426bdfe0.ot-qiyerenyuan.pages.dev
- `/health`、`/login`、`/staff/page`、`/dept/all`、`/menu/staff` 均返回 `code=200`
- Playwright 验证 11 个核心页面：表格均有数据、无 `pageerror`、无 HTTP 4xx/5xx、无桌面横向溢出
- 390×844 移动端登录和首页通过，无 `pageerror`、无横向溢出
## 2026-07-12 侧边栏菜单跳转修复

侧边栏子菜单数据已经包含完整路径，例如 `/system/staff`，但组件点击事件又拼接父级 `/system`，导致实际跳转到不存在的 `/system/system/staff`；考勤、薪资和权限菜单同样出现重复路径。

修复与验收：

- `CommonAside.vue` 子菜单直接使用 `subItem.path`，不再重复拼接父路径
- 重新构建 Vue 生产资源并部署到 Cloudflare Pages
- 真实展开父菜单并点击 10 个子菜单，全部进入预期页面
- 所有页面均有业务数据，无 `pageerror`、无 HTTP 4xx/5xx
- 修复部署版本：https://fc60f52b.ot-qiyerenyuan.pages.dev
## 2026-07-12 顶栏项目标题

在后台深色顶栏中央增加白色艺术字“第四组生产实习项目”，使用楷体字族、字间距、柔和高光阴影和渐隐下划线；标题采用绝对居中，不受左侧折叠按钮和右侧头像宽度影响。

- 稳定地址：https://ot-qiyerenyuan.pages.dev
- 修复部署版本：https://c535f7ee.ot-qiyerenyuan.pages.dev
- Playwright 检查：标题文字、白色样式、字体和居中位置正确，无 `pageerror`
## 2026-07-13 功能真实性与安全优化

本次完成正式部署的核心安全与业务优化：

1. 员工、部门、文档、考勤、请假、城市社保、社保、薪资、角色和菜单数据通过 Supabase `items` 表持久化，新增、修改、删除和审批刷新后仍保留。
2. 登录从 Supabase `accounts` 表校验，Worker 签发 HMAC token；除登录和健康检查外，全部业务接口要求有效 token。
3. 管理员和人事专员可以写入，普通员工为只读账号；未登录返回 HTTP 401，越权写入返回 HTTP 403。
4. 390px 移动端默认折叠为 64px 侧栏、隐藏标签栏、内容区无横向页面溢出。
5. CSV 导入导出、文件上传下载均真实落库并经过端到端验证。
6. Cloudflare Pages 必须配置加密 Secret：`AUTH_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_URL`、`SUPABASE_SCHEMA`。
7. Supabase RPC 仅授权 `service_role`，不向 `anon` 或 `authenticated` 开放。

验证：

- 自动化脚本：`python tests/deployed_e2e.py`
- 覆盖未登录拒绝、管理员 CRUD 持久化、普通员工写入拒绝、10 个菜单真实点击和移动端布局。
- 修复部署版本：https://25a9ee78.ot-qiyerenyuan.pages.dev
