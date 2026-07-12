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

原 CloudBase Run 后端已出现 503、CORS 或资源隔离问题。线上演示已切换为 Cloudflare Pages Worker 兼容层：

- Pages 项目：`ot-qiyerenyuan`
- 稳定地址：https://ot-qiyerenyuan.pages.dev
- API：`/health`、`/login`、`/home/*`、`/staff/*`、`/dept/*`、`/menu/*` 等原 HRM 路由
- 数据：3 个公开演示账号和各业务模块演示数据
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
