# 原始前端恢复记录

## 项目

- 项目名：企业人员与人力资源管理系统
- GitHub：<https://github.com/Nemo-netone/ot-qiyerenyuan>
- 稳定演示地址：<https://ot-qiyerenyuan.pages.dev>
- 登录入口：<https://ot-qiyerenyuan.pages.dev/login>
- Cloudflare Pages 项目：`ot-qiyerenyuan`
- Supabase schema：`hrm_qiyerenyuan`

## 恢复内容

- `original-site/` 使用原项目 `vue-elementui-hrm/dist` 构建产物。
- 保留旧 `site/` 统一演示壳作为兜底，没有删除原源码。
- `original-site/config.js` 改为：
  - `window.HRM_CONFIG.apiBase = window.location.origin`
- 新增 `original-site/_worker.js`，兼容原 HRM 前端接口：
  - `POST /login`
  - `GET /menu/staff`
  - `GET /home/staff|count|city|department|attendance`
  - `GET /staff/info/:id`
  - 员工、部门、考勤、请假、薪资、社保、角色、文档等列表/增删改演示接口

## 关键问题

- 原前端是 Vue history 路由，浏览器导航到 `/login`、`/home` 时必须返回 SPA 的 `index.html`。
- 同时 `/login` 也是登录 API，所以 Worker 需要按 `Accept: text/html` 区分页面导航和 XHR/API 请求。
- 原构建默认 API 指向旧 CloudBase Run，已通过 `config.js` 覆盖为同源 Pages Worker。

## 验证记录

验证时间：2026-07-12

- `https://ot-qiyerenyuan.pages.dev/health` 返回 `frontend: original-vue-elementui-hrm-dist`
- 管理员 `admin / 123456` 可登录
- 登录后进入 `/home`，显示原 HRM 仪表盘
- 浏览器请求未再访问旧 CloudBase、`127.0.0.1` 或 `ot-qiyerenyuan-api` 容器地址
- 截图：
  - `docs/screenshots/original-login.png`
  - `docs/screenshots/original-home.png`

## 部署命令

```powershell
npx wrangler@3 pages deploy "E:\twentySixGitHub\ThreeStandard\oneBianXian\gyq-product-1\2.项目库\3.qiyerenyuan\qiyerenyuan\original-site" --project-name ot-qiyerenyuan --branch main --commit-dirty=true
```
