# Supabase 数据隔离说明

## 结论

本项目只使用 `hrm_qiyerenyuan` schema。不要在 `public` schema 创建业务表，不要执行原始 MySQL dump 中的 `DROP TABLE` 语句。

## 文件分工

| 文件 | 作用 |
| --- | --- |
| `hrm/sql/hrm.sql` | 原始 MySQL dump，只作为迁移来源 |
| `docs/database/hrm-postgres.sql` | Supabase/PostgreSQL 初始化脚本 |

## 初始化策略

PostgreSQL 脚本使用：

- `CREATE SCHEMA IF NOT EXISTS hrm_qiyerenyuan`
- `SET search_path TO hrm_qiyerenyuan`
- `CREATE TABLE IF NOT EXISTS`
- `INSERT ... ON CONFLICT (id) DO NOTHING`
- `setval(...)` 对齐自增序列

这些语句允许重复执行，不会删除已有业务数据。

## 应用连接策略

后端 JDBC URL 必须包含：

```text
sslmode=require&currentSchema=hrm_qiyerenyuan
```

同时设置：

```text
DB_SCHEMA=hrm_qiyerenyuan
```

这样 MyBatis-Plus 默认表名 `sys_staff`、`sys_dept` 会落到当前项目 schema，而不是 `public`。
