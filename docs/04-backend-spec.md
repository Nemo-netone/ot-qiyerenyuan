# 04 后端规格

## 模块划分

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| 登录 | `/login` | 校验员工编号和密码，签发 JWT |
| 首页 | `/home` | 汇总员工、部门、考勤等统计 |
| 员工与部门 | `/staff`、`/dept` | 员工档案、部门结构、角色绑定 |
| 权限 | `/menu`、`/role` | 菜单、角色、角色菜单关系 |
| 考勤 | `/attendance`、`/leave`、`/overtime`、`/staff-leave` | 打卡、请假、加班规则 |
| 财务 | `/salary`、`/salary-deduct`、`/insurance`、`/city` | 薪资、扣款、社保城市和五险一金 |
| 文件 | `/docs` | 文件记录、上传、下载、导入导出 |

## 配置规则

`application.yml` 不保存真实凭据。线上通过 CloudBase Run 环境变量注入：

| 变量 | 说明 |
| --- | --- |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL，必须带 `sslmode=require` 和 `currentSchema=hrm_qiyerenyuan` |
| `SPRING_DATASOURCE_USERNAME` | Supabase 数据库用户名 |
| `SPRING_DATASOURCE_PASSWORD` | Supabase 数据库密码 |
| `DB_SCHEMA` | 默认 `hrm_qiyerenyuan` |
| `FILE_UPLOAD_PATH` | 默认 `/tmp/hrm-files/` |

## PostgreSQL 适配

| 原 MySQL 点 | 处理 |
| --- | --- |
| MySQL driver | 新增 PostgreSQL driver，默认使用 `org.postgresql.Driver` |
| MyBatis 分页 | `DbType.MYSQL` 改为 `DbType.POSTGRE_SQL` |
| `date_format(...)` | 改为 PostgreSQL `to_char(...)` |
| MySQL dump | 新增 `docs/database/hrm-postgres.sql` |

## 错误与限制

JWT token 默认 1 小时过期。文件上传为容器临时目录，重启或重新部署后可能丢失，应按演示能力处理。
