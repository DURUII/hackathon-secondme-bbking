# SecondMe API 参考

**Base URL**: `https://app.mindos.com/gate/lab`

SecondMe API 提供用户信息访问和 AI 聊天功能。

---

## 1. 获取用户信息

- **端点**: `GET /api/secondme/user/info`
- **权限**: `user.info`
- **返回**: userId, name, email, avatar, bio, selfIntroduction, profileCompleteness, route

## 2. 获取用户兴趣标签

- **端点**: `GET /api/secondme/user/shades`
- **权限**: `user.info.shades`
- **返回**: shades 数组（含标签名称、描述、置信度等）

## 3. 获取用户软记忆

- **端点**: `GET /api/secondme/user/softmemory`
- **权限**: `user.info.softmemory`
- **参数**: keyword, pageNo, pageSize
- **返回**: 软记忆列表（factObject, factContent, 创建/更新时间）

## 4. 添加笔记

- **端点**: `POST /api/secondme/note/add`
- **权限**: `note.add`
- **类型**: TEXT（content）或 LINK（urls）

## 5. 语音合成 (TTS)

- **端点**: `POST /api/secondme/tts/generate`
- **权限**: `voice`
- **参数**: text（最长 10000 字符）, emotion
- **返回**: 音频 URL、时长、采样率、格式

## 6. 流式聊天

- **端点**: `POST /api/secondme/chat/stream`
- **权限**: `chat`
- **事件流**: session、tool_call、tool_result、data、[DONE]

## 7. 流式动作判断 (Act)

- **端点**: `POST /api/secondme/act/stream`
- **权限**: `chat`
- **用途**: 结构化 JSON 输出（情感分析、意图分类等）
- **actionControl**: 20-8000 字符，必须含 JSON 结构示例

## 8. 获取会话列表

- **端点**: `GET /api/secondme/chat/session/list`
- **权限**: `chat`
- **返回**: sessions 数组（sessionId、最后消息、时间、消息数）

## 9. 获取会话消息历史

- **端点**: `GET /api/secondme/chat/session/messages`
- **参数**: sessionId
- **返回**: messages 数组（role、content、createTime）

## 通用响应格式

- **成功**: `{"code": 0, "data": {...}}`
- **错误**: `{"code": 403, "message": "...", "subCode": "..."}`

所有 API 均需 OAuth2 Token（`Authorization: Bearer lba_at_your_access_token`）。
