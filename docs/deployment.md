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
