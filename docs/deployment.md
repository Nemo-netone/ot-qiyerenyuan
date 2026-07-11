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

先让前端指向 CloudBase API：

```bash
cd vue-elementui-hrm
npm install
npm run build
cd ..
wrangler pages deploy vue-elementui-hrm/dist --project-name ot-qiyerenyuan --branch main
```

如果 Cloudflare Pages 使用 GitHub 自动构建：

| 设置项 | 值 |
| --- | --- |
| Production branch | `main` |
| Build command | `cd vue-elementui-hrm && npm install && npm run build` |
| Build output directory | `vue-elementui-hrm/dist` |
| Environment variable | `VUE_APP_BASE_API=https://ot-qiyerenyuan-api-273280-7-1369167244.sh.run.tcloudbase.com` |

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

原 CloudBase Run 后端已出现 503、CORS 或资源隔离问题。线上演示已切换为 Cloudflare Pages Worker + Supabase 独立 schema：

- Pages 项目：`ot-qiyerenyuan`
- 稳定地址：https://ot-qiyerenyuan.pages.dev
- Supabase schema：`hrm_qiyerenyuan`
- API：`/health`、`/api/login`、`/api/summary`、`/api/items/*`
- 数据：3 个公开演示账号、18 条业务记录
- 验证：全部账号登录、summary、列表、创建、更新、删除清理和 Playwright 登录前后视图均通过

原 Java/Vue/SSM 源码继续保留；兼容层只负责稳定的公开作品集体验。

