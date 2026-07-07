# ot-qiyerenyuan 设计文档

本目录是项目事实源：需求、架构、前端、后端、接口、部署和运维都在这里维护。

## 技术栈

| 层 | 技术 | 职责 |
| --- | --- | --- |
| 前端 | Vue 2、Vue Router、Vuex、Element UI、Axios | 后台管理界面、表格表单、导入导出入口 |
| 后端 | Spring Boot 2.6、MyBatis-Plus、JWT、Hutool、POI | REST API、鉴权、业务编排、Excel 导入导出 |
| 数据库 | Supabase PostgreSQL | `hrm_qiyerenyuan` schema 内的业务数据 |
| 托管 | Cloudflare Pages、CloudBase Run | 静态前端和 Java API |

## 推荐阅读顺序

1. [01-requirements.md](./01-requirements.md)
2. [02-architecture.md](./02-architecture.md)
3. [03-frontend-spec.md](./03-frontend-spec.md)
4. [04-backend-spec.md](./04-backend-spec.md)
5. [05-interfaces.md](./05-interfaces.md)
6. [deployment.md](./deployment.md)
7. [supabase-isolation.md](./supabase-isolation.md)
8. [operations-runbook.md](./operations-runbook.md)
9. [conventions.md](./conventions.md)

## 关键术语

| 术语 | 含义 |
| --- | --- |
| HRM | Human Resource Management，人力资源管理 |
| CloudBase Run | 腾讯云 CloudBase 的容器运行服务，承载 Spring Boot API |
| Pages | Cloudflare Pages，承载 Vue 构建产物 |
| 独立 schema | Supabase PostgreSQL 中专门给本项目使用的命名空间 |
