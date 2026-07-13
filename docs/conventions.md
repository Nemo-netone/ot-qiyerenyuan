# 协作规范

## 安全

- 不提交真实 token、API key、数据库密码。
- `.env.example` 只能写占位值。
- Supabase 业务表只允许在 `hrm_qiyerenyuan` schema 内。

## 前端

- 请求统一走 `src/utils/request.js`。
- 字符串 URL 统一用 `src/utils/apiBase.js` 的 `buildApiUrl`。
- 不允许在 `src/` 里写死 `localhost`。

## 后端

- 数据库连接只从环境变量读取。
- 新增 MyBatis 手写 SQL 时要确认 PostgreSQL 兼容。
- 文件上传必须限制类型和大小，并保证元数据删除时同步清理文件记录；大文件应使用对象存储。

## 提交前检查

```bash
rg "CHANGE_ME|localhost|token|password" .
cd hrm && ./mvnw -DskipTests package
cd ../vue-elementui-hrm && npm run build
```
