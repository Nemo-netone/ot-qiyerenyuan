# 01 需求规格

| 项 | 值 |
| --- | --- |
| 项目 | ot-qiyerenyuan |
| 版本 | v0.1 |
| 目标 | 将原本地 HRM 项目整理成可公开展示、可线上运行的演示项目 |
| 部署目标 | Cloudflare Pages + CloudBase Run + Supabase PostgreSQL |

## 背景与目标

原项目是本地 Spring Boot + Vue 后台管理系统，依赖本机 MySQL 和 `localhost`。本次目标是将它迁移为作品集可展示版本：代码可提交 GitHub，前端可公开访问，后端 API 可运行，数据库与用户已有 Supabase 数据隔离。

## 功能需求

| 编号 | 功能 | 验收方式 |
| --- | --- | --- |
| FR-01 | 管理员可登录系统 | 使用 `admin / 123456` 登录成功并返回 token |
| FR-02 | 员工、部门、角色、菜单可查询维护 | 页面列表可加载，新增/编辑/删除调用 API |
| FR-03 | 考勤、请假、加班、薪资、社保模块可查询 | 对应菜单和接口可访问 |
| FR-04 | Excel 导入导出地址可在线使用 | 前端生成的 URL 指向 CloudBase API，不再是 localhost |
| FR-05 | 文件上传下载可演示 | 使用 CloudBase 容器临时目录，文档标注非持久化限制 |
| FR-06 | Supabase 数据不覆盖其他项目 | 所有表在 `hrm_qiyerenyuan` schema 内 |

## 非功能需求

| 编号 | 要求 | 验收方式 |
| --- | --- | --- |
| NFR-01 | 公开仓库不包含平台 token 和真实密码 | `rg` 搜索敏感模式无结果 |
| NFR-02 | 前后端都能构建 | `mvn package`、`npm run build` 通过 |
| NFR-03 | 重复执行数据库初始化不破坏已有数据 | SQL 使用 `CREATE TABLE IF NOT EXISTS` 和 `ON CONFLICT DO NOTHING` |
| NFR-04 | 线上地址稳定 | Cloudflare Pages 项目固定为 `ot-qiyerenyuan` |

## 本期范围

本期做：项目清理、PostgreSQL SQL 初始化脚本、环境变量配置、CloudBase/Cloudflare 部署配置、README 与 docs、线上冒烟验证。

本期不做：重写 UI、重写权限模型、把文件上传改为对象存储、完整自动化测试体系。

## 验收清单

- [x] GitHub 公开仓库可访问。
- [x] Cloudflare Pages 地址可访问。
- [x] CloudBase API 能连 Supabase。
- [x] `admin / 123456` 可登录。
- [x] 至少员工/部门/菜单/首页统计接口可正常返回。
