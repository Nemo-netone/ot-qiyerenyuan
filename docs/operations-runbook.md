# 运维手册

## 常见检查

| 症状 | 检查点 | 处理 |
| --- | --- | --- |
| 前端白屏 | Cloudflare 构建日志、`dist/config.js` | 重新执行 `npm run build` |
| 登录失败 | `/login` 响应、Supabase `sys_staff` 数据 | 确认 `admin / 123456` 对应密码哈希存在 |
| 接口跨域失败 | `APP_CORS_ALLOWED_ORIGINS` | 加入 Pages 域名 |
| 数据库连不上 | CloudBase 环境变量、Supabase 连接密码 | 重置或更新数据库密码 |
| 文件下载失败 | `FILE_UPLOAD_PATH` 和容器文件是否存在 | 演示环境文件不保证持久化 |

## 发布流程

1. 本地执行后端构建：`cd hrm && ./mvnw -DskipTests package`。
2. 本地执行前端构建：`cd vue-elementui-hrm && npm run build`。
3. 更新 Supabase SQL 时先确认只操作 `hrm_qiyerenyuan`。
4. 部署 CloudBase Run。
5. 部署 Cloudflare Pages `main` 分支。
6. 使用演示账号做线上冒烟验证。

## 回滚

Cloudflare Pages 可以在 Pages 项目中回滚到上一版本部署。CloudBase Run 可以在控制台切换历史版本。数据库脚本不包含 `DROP`，回滚应用时通常不需要回滚数据。
