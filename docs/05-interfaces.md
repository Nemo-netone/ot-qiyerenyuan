# 05 接口与环境变量

## 鉴权

线上 API 基址：

```text
https://ot-qiyerenyuan-api-273280-7-1369167244.sh.run.tcloudbase.com
```

登录接口不需要 token。其他业务接口通过请求头传递：

```http
token: <jwt>
```

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/login` | 登录 |
| `GET` | `/home/count` | 首页统计 |
| `POST` | `/staff/page` | 员工分页 |
| `GET` | `/dept/all` | 部门列表 |
| `GET` | `/menu/staff` | 当前员工菜单 |
| `GET/POST/PUT/DELETE` | `/attendance` | 考勤维护 |
| `GET/POST/PUT/DELETE` | `/salary` | 薪资维护 |
| `POST` | `/**/import` | Excel 导入 |
| `GET` | `/**/export` | Excel 导出 |
| `POST` | `/docs/upload` | 文件上传 |
| `GET` | `/docs/download/{filename}` | 文件下载 |

## 标准响应

后端使用 `ResponseDTO` 风格响应，前端根据 `code` 判断是否继续：

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

特殊状态码 `800`、`900`、`1200`、`1300`、`1400` 会触发前端登出或错误提示。

## 环境变量

详见根目录 `README.md` 的“关键配置”章节和 `hrm/.env.example`。
