# SecondMe API 认证概述

**认证方式**: OAuth2 标准授权流程

**请求头格式**:
```
Authorization: Bearer <token>
```
其中 token 格式为 `lba_at_xxxxx...`

**可用权限 (Scopes)**:

| 权限 | 说明 | 分组 |
|------|------|------|
| `user.info` | 访问用户基础信息（姓名、邮箱、头像等） | 用户信息 |
| `user.info.shades` | 访问用户兴趣标签 | 用户信息 |
| `user.info.softmemory` | 访问用户软记忆 | 用户信息 |
| `note.add` | 添加笔记和记忆 | 笔记 |
| `chat` | 访问聊天功能 | 聊天 |

**OAuth2 授权码流程**: 包含 9 步流程（用户访问应用 → 重定向授权 → 用户授权 → 返回授权码 → 换取 Token → 调用 API）

参考链接: [OAuth2 集成指南](/zh/docs/authentication/oauth2)
