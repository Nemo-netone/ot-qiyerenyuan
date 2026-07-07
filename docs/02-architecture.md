# 02 架构说明

## 分层结构

| 层 | 目录/平台 | 职责 |
| --- | --- | --- |
| 前端展示层 | `vue-elementui-hrm` / Cloudflare Pages | 登录、菜单、表格、表单、导入导出入口 |
| API 层 | `hrm` / CloudBase Run | REST 接口、JWT 拦截、业务服务 |
| 持久化层 | Supabase PostgreSQL | `hrm_qiyerenyuan` schema 内的表和种子数据 |
| 文档与部署层 | `README.md`、`docs/`、`Dockerfile`、`wrangler.toml` | 交付说明、部署命令、运维规则 |

## 运行链路

1. 用户访问 `https://ot-qiyerenyuan.pages.dev`。
2. Vue 前端通过 `VUE_APP_BASE_API` 或 `public/config.js` 拼接 CloudBase API 地址。
3. 用户登录调用 `POST /login`，后端按员工编号和密码哈希查询 `sys_staff`。
4. 登录成功后前端保存 token，后续请求通过 `token` header 传给后端。
5. 后端 JWT 拦截器校验 token，再进入 controller/service/mapper。
6. MyBatis-Plus 通过 PostgreSQL JDBC 访问 `hrm_qiyerenyuan` schema。

## 数据流

```text
UI action
  -> src/api/*.js
  -> src/utils/request.js
  -> CloudBase Run Spring Boot Controller
  -> Service
  -> Mapper / MyBatis-Plus
  -> Supabase schema hrm_qiyerenyuan
```

## 边界规则

| 边界 | 规则 | 守护方式 |
| --- | --- | --- |
| 前端不能写死 localhost | 所有 API 地址通过 `apiBase.js` 生成 | `rg localhost vue-elementui-hrm/src` |
| 后端不能写死数据库账号 | 数据库连接全部来自环境变量 | `application.yml` 只保留占位默认值 |
| 数据库不能污染其他项目 | 只创建和访问 `hrm_qiyerenyuan` schema | `docs/database/hrm-postgres.sql` |
| 公开仓库不能包含秘密 | token、真实密码只放平台环境变量 | `rg` 敏感词扫描 |

## 已知限制

文件上传目前写入容器本地目录。CloudBase Run 容器文件系统不适合作为长期持久化存储，所以该能力适合演示；生产应迁移到对象存储或 Supabase Storage。
