# ot-qiyerenyuan

企业人员与人力资源管理系统。前端使用 Vue 2 + Element UI，线上后端使用 Cloudflare Pages Worker，业务数据持久化到 Supabase PostgreSQL 独立 schema。

## 在线系统

| 项目 | 地址 |
| --- | --- |
| Cloudflare Pages | https://ot-qiyerenyuan.pages.dev |
| CloudBase API | https://ot-qiyerenyuan-api-273280-7-1369167244.sh.run.tcloudbase.com |
| GitHub 仓库 | https://github.com/Nemo-netone/ot-qiyerenyuan |

初始账号：

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | `admin` | `123456` |

当前状态：`main` 分支已推送 GitHub，Cloudflare Pages 已发布，CloudBase API 已连接 Supabase 的 `hrm_qiyerenyuan` 独立 schema。登录、首页统计、员工分页、部门列表、菜单接口已完成线上冒烟验证。

## 功能总览

| 模块 | 能力 | 使用场景 |
| --- | --- | --- |
| 登录与鉴权 | 账号密码登录、JWT token 鉴权 | 后台管理入口和接口访问控制 |
| 员工管理 | 员工档案、角色绑定、导入导出 | 人事维护员工基础资料 |
| 部门管理 | 部门树、上下班时间、导入导出 | 建立组织结构和考勤时间规则 |
| 文件管理 | 文件上传、下载、记录维护 | 保存员工头像、附件、资料文档 |
| 考勤管理 | 打卡记录、按月导入导出、考勤状态 | 统计迟到、早退、旷工、休假 |
| 请假审批 | 员工请假、审批状态、撤销状态 | 管理请假流程和考勤联动 |
| 加班规则 | 加班倍数、奖金、补休配置 | 配置薪资计算相关规则 |
| 社保城市与五险一金 | 参保城市、社保公积金基数和缴纳额 | 管理员工社保和公积金数据 |
| 薪资管理 | 工资项、扣款项、月度工资导出 | 计算和导出员工薪资数据 |
| 权限管理 | 菜单、角色、员工角色关系 | 控制不同员工可见菜单 |

## 架构总览

```text
Browser
  -> Cloudflare Pages: original-site
  -> CloudBase Run: Spring Boot API, service ot-qiyerenyuan-api
  -> Supabase PostgreSQL: schema hrm_qiyerenyuan
```

核心数据只放在 Supabase 的 `hrm_qiyerenyuan` schema 中，不使用也不覆盖 `public` schema。原始 MySQL dump 保留在 `hrm/sql/hrm.sql`，Supabase 初始化脚本在 `docs/database/hrm-postgres.sql`。

## 本地运行

后端需要 JDK 17：

```bash
cd hrm
./mvnw -DskipTests package
java -jar target/hrm-0.0.1-SNAPSHOT.jar
```

前端使用 npm：

```bash
cd vue-elementui-hrm
npm install
npm run serve
```

本地前端默认通过 `/dev` 代理到 `http://localhost:8888`。线上前端通过 `VUE_APP_BASE_API` 或 `public/config.js` 指向 CloudBase API。

## 关键配置

| 变量 | 所属 | 说明 | 是否敏感 |
| --- | --- | --- | --- |
| `SPRING_DATASOURCE_URL` | 后端 | Supabase PostgreSQL JDBC URL，带 `currentSchema=hrm_qiyerenyuan` | 是 |
| `SPRING_DATASOURCE_USERNAME` | 后端 | Supabase 数据库用户名 | 是 |
| `SPRING_DATASOURCE_PASSWORD` | 后端 | Supabase 数据库密码 | 是 |
| `DB_SCHEMA` | 后端 | 当前项目独立 schema，默认 `hrm_qiyerenyuan` | 否 |
| `FILE_UPLOAD_PATH` | 后端 | CloudBase 容器内临时上传目录 | 否 |
| `APP_CORS_ALLOWED_ORIGINS` | 后端 | 允许跨域的前端域名 | 否 |
| `VUE_APP_BASE_API` | 前端 | CloudBase API 公开访问地址 | 否 |

不要把真实数据库密码、平台 token、API key 写入仓库。

## 常用命令

```bash
# 后端构建
cd hrm && ./mvnw -DskipTests package

# 前端构建
cd vue-elementui-hrm && npm run build

# CloudBase Run 后端部署
cloudbase --env-id meta-d5gh4ds014005aff1 cloudrun deploy --serviceName ot-qiyerenyuan-api --port 8888 --source <clean-backend-source> --force

# Cloudflare Pages 部署
wrangler pages deploy original-site --project-name ot-qiyerenyuan --branch main
```

## 文档索引

1. [需求规格](docs/01-requirements.md)
2. [架构说明](docs/02-architecture.md)
3. [前端规格](docs/03-frontend-spec.md)
4. [后端规格](docs/04-backend-spec.md)
5. [接口与环境变量](docs/05-interfaces.md)
6. [部署说明](docs/deployment.md)
7. [Supabase 数据隔离](docs/supabase-isolation.md)
8. [运维手册](docs/operations-runbook.md)
9. [协作规范](docs/conventions.md)

## 2026-07-11 Pages Worker 恢复部署

原 CloudBase Run 后端已出现 503、CORS 或资源隔离问题。线上系统已切换为 Cloudflare Pages Worker + Supabase 独立 schema：

- Pages 项目：`ot-qiyerenyuan`
- 稳定地址：https://ot-qiyerenyuan.pages.dev
- Supabase schema：`hrm_qiyerenyuan`
- API：`/health`、`/api/login`、`/api/summary`、`/api/items/*`
- 数据：3 个初始账号及各业务模块持久化数据
- 验证：全部账号登录、summary、列表、创建、更新、删除清理和 Playwright 登录前后视图均通过

原 Java/Vue/SSM 源码继续保留；兼容层只负责稳定的公开作品集体验。
## 2026-07-13 正式部署升级

- 10 个核心业务模块已接入 Supabase 持久化兼容层。
- 使用可验证的 HMAC 登录 token，业务接口统一鉴权。
- 管理员、人事专员可维护数据，普通员工只读。
- 移动端默认折叠侧栏并隐藏标签栏。
- 员工角色、角色菜单、修改密码均真实持久化，密码使用 PBKDF2-SHA256 加盐哈希存储。
- CSV 导入导出和文档上传下载已真实实现，普通员工按个人数据范围只读访问。
- 生产前端改为同源 Pages Worker API，移除旧 CloudBase API 地址和生产 source map。
- 线上验收：`python tests/deployed_e2e.py`。
