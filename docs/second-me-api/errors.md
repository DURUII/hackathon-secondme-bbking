# SecondMe API 错误码参考

## 错误响应格式

所有 API 错误返回统一格式：
```json
{
  "code": 400,
  "message": "错误描述",
  "subCode": "module.resource.reason"
}
```

## 错误码分类

**通用错误码**: `resource.fetch.not_found` (404)、`resource.auth.unauthorized` (401)

**OAuth2 错误码**: 涵盖应用、授权、令牌、权限、客户端凭证、授权码、Redirect URI、Grant Type、Refresh Token 等相关错误

**SecondMe 错误码**: 用户 ID 格式、会话、流式响应等错误

**系统错误码**: `internal.error` (500)、`connection.error` (503)、`invalid.param` (400)

## 最佳实践

- 检查 `code` 字段判断请求状态
- 使用 `subCode` 进行程序化错误处理
- `message` 可直接展示给用户
- 对 5xx 错误实施指数退避重试策略
