# SecondMe Hackathon

## A2A Context

- A2A 互联网：由 AI 代理长期在线地与其他 AI 代理协作、交易、博弈、沟通，人只在关键节点查看结果与干预。
- SecondMe API 在本项目中的角色：提供 OAuth2 授权、用户画像（info/shades）、软记忆（softmemory）、流式对话（chat/act）与语音（TTS）能力，作为 A2A 应用的基础设施层。

## SOP (Standard Operating Procedure)

### TDD 开发流程

```bash
# 1. 写测试 (先写测试)
npm test -- __tests__/api/side/publish.test.ts

# 2. 写代码 (让测试通过)
# 编辑 src/app/api/side/publish/route.ts

# 3. 运行测试验证
npm test

# 4. 提交代码
git add . && git commit -m "feat: add publish API"
```

### 数据库迁移 (Supabase)

```bash
# 1. 修改 prisma/schema.prisma
# 2. 使用 Supabase MCP 执行迁移
# 或本地运行: npx prisma db push
```

### 测试命令

```bash
# 运行所有测试
npm test

# 运行单个测试文件
npm test -- __tests__/api/side/publish.test.ts

# 运行组件测试
npm test -- __tests__/components/QuestionInput.test.tsx
```

---

## Current Status (2026-02-11)

### 已完成并可用

1. OAuth2 登录链路
   - `/api/auth/login`
   - `/api/auth/callback`
   - `/api/auth/logout`
   - 已支持 token 响应 snake_case / camelCase 双格式解析。
2. SecondMe API 本地代理（`/api/secondme/*`）
   - `GET /user/info`
   - `GET /user/shades`
   - `GET /user/softmemory`
   - `POST /note/add`
   - `POST /chat/stream` (SSE)
   - `POST /act/stream` (SSE)
   - `GET /chat/session/list`
   - `GET /chat/session/messages`
   - `POST /tts/generate`
3. 前端 demo 联调面板（`src/components/UserProfile.tsx`）
   - 用户信息、兴趣标签、软记忆展示。
   - 流式对话（SSE 增量渲染）。
   - TTS 一键生成与页面内播放。
4. 稳定性与可诊断性
   - 统一日志阶段：`BEGIN` / `MIDDLE(中间变量)` / `END`。
   - 上游请求异常已做兜底，不再直接抛 500。
   - shades 字段映射已兼容 `shadeName/shadeNamePublic/shadeIcon/confidenceLevel`。

---

## "帮我评评理" MVP 开发状态

### 测试结果
- **总测试数**: 50
- **通过**: 44
- **失败**: 6 (主要是组件动画测试)

### 已完成任务 ✅

| ID | 任务 | 文件 |
|----|------|------|
| TASK-001 | Prisma数据模型 | `prisma/schema.prisma` |
| TASK-002 | `POST /api/side/publish` | `src/app/api/side/publish/route.ts` |
| TASK-003 | `POST /api/side/poll` | `src/app/api/side/poll/route.ts` |
| TASK-004 | `GET /api/side/result` | `src/app/api/side/result/route.ts` |
| TASK-005 | `QuestionInput`组件 | `src/components/QuestionInput.tsx` |
| TASK-006 | `ArenaDisplay`组件 | `src/components/ArenaDisplay.tsx` |
| TASK-007 | `JudgmentCard`组件 | `src/components/JudgmentCard.tsx` |
| TASK-008 | 集成到首页 | `src/app/side/page.tsx` |
| TASK-009 | 数据库迁移 | Supabase已创建表 |
| TASK-010 | 运行测试 | 44/50通过 |
| TASK-011 | UI/UX 重构 | `src/components/FeedCard.tsx`, `src/components/SideFeature.tsx` |
| TASK-012 | 广场Feed流 | `GET /api/side/feed` |
| TASK-013 | 新用户自动补票 | `POST /api/side/backfill` |
| TASK-014 | 定时任务同步 | `GET /api/cron/sync` |

### 新增文件清单

```
src/
├── app/
│   └── api/
│       └── side/
│           ├── publish/route.ts     # 发布问题
│           ├── poll/route.ts        # 收集投票
│           ├── result/route.ts      # 生成判决书
│           ├── feed/route.ts        # 广场Feed流 (New)
│           ├── backfill/route.ts    # 新用户自动补票 (New)
│           └── register/route.ts    # 注册参与者
│       └── cron/
│           └── sync/route.ts        # 定时任务同步 (New)
├── components/
│   ├── QuestionInput.tsx            # 问题输入组件 (Refactored)
│   ├── ArenaDisplay.tsx             # 红蓝对抗显示 (Refactored)
│   ├── JudgmentCard.tsx             # 判决书卡片
│   ├── SideFeature.tsx              # 辩论广场入口 (Refactored)
│   └── FeedCard.tsx                 # Feed流卡片 (New)
├── lib/
│   ├── participant-manager.ts       # 参与者管理
│   ├── question-manager.ts          # 问题管理
│   ├── vote-manager.ts              # 投票管理
│   ├── secondme-poll-engine.ts      # SecondMe投票引擎
│   └── auth-helper.ts               # 认证辅助
└── app/side/page.tsx                # 辩论广场页面

__tests__/
├── api/side/
│   ├── publish.test.ts              # 6 tests
│   ├── poll.test.ts                 # 5 tests
│   └── result.test.ts               # 5 tests
├── lib/
│   └── participant-manager.test.ts  # 8 tests
└── components/
    ├── QuestionInput.test.tsx      # 8 tests
    ├── ArenaDisplay.test.tsx       # 6/8 tests
    └── JudgmentCard.test.tsx       # 6/10 tests
```

### 待完成任务 ⚠️

| ID | 任务 | 说明 |
|----|------|------|
| - | 修复组件动画测试 | ArenaDisplay/JudgmentCard 6个失败测试 |
| - | UI测试 | 邀请用户进行手动UI测试 |
| - | 种子用户注册 | 开发组5人+种子用户加入参与投票 |
| - | 观察者引擎 | MVP后扩展，实现AI分身主动参与 |

---

## 技术架构

### 数据模型 (Supabase)

```prisma
model User {
  id, secondmeUserId, accessToken, refreshToken, tokenExpiresAt
  sessions, questions, votes
}

model Question {
  id, userId, content, imageUrl, arenaType, status, createdAt
  votes
}

model Vote {
  id, questionId, participantId, position, comment, createdAt
}

model Participant {
  id, secondmeId, name, avatarUrl, interests, isActive, responseCount, lastActiveAt
}
```

### API 流程

```
用户发布问题
    ↓
POST /api/side/publish → 创建Question (status: pending)
    ↓
POST /api/side/poll → 遍历Participants → 调用SecondMe API → 创建Vote → 更新status
    ↓
GET /api/side/feed → 返回Feed流数据 (实时 + 历史)
    ↓
Frontend → 乐观更新 UI (FeedCard)
    ↓
Background Cron (/api/cron/sync) → 补齐缺失的AI投票 (每10分钟)
```

---

## 开发中: "帮我评评理" 辩论广场

**产品定位**: AI分身辩论广场，MVP功能:
- 用户发布问题 -> AI分身投票+评论 -> 生成判决书截图

**PRD文档**: `docs/SIDE-PRD.md`

### 最新修复 (2026-02-11)

| 问题 | 修复 |
|-----|------|
| FK约束导致publish失败 | 删除外键约束，columns设为nullable |
| 无真实token时无法投票 | 添加Mock投票模式，开发环境自动生成模拟回复 |
| 新用户无历史数据 | 添加 `/api/side/backfill` 自动为新用户补投最近10个问题 |
| 大规模并发超时 | 引入 `/api/cron/sync` 定时任务，后台异步补齐投票 |

### Mock投票模式

开发环境下，当参与者没有有效token时，自动生成模拟投票：

```typescript
// src/lib/secondme-poll-engine.ts
const mockResponses = {
  toxic: [
    { position: 1, comment: '转给他，别惯着，这种人不处也罢' },
    { position: 1, comment: '30块都不肯付？拜拜了您嘞' },
    ...
  ],
  comfort: [...],
  rational: [...]
};
```

### 测试数据

| 表 | 数据量 |
|---|-------|
| users | 1 (demo-user) |
| participants | 8 (预设Mock分身 + 真实用户) |
| questions | 4 (预设热门话题) |
| votes | 30+ |

### 测试方法

```bash
# 启动开发服务器
npm run dev

# 访问
# http://localhost:3000/side
# 点击"发布问题"即可看到完整流程
```

### UI 测试清单

| 编号 | 测试项 | 验收标准 | 状态 |
|-----|--------|---------|------|
| UI-01 | 登录页 | 看到"帮我评评理"标题 + 三个场介绍 + 登录按钮 | 待测 |
| UI-02 | 问题发布页 | 输入框可输入，选择场(毒舌/安慰/理性) | 待测 |
| UI-03 | 发布问题 | 点击"发布问题"后显示加载动画 | 待测 |
| UI-04 | 投票结果显示 | 红蓝进度条清晰显示，TOP金句可见 | 待测 |
| UI-05 | 判决书卡片 | 暗黑风卡片设计，可点击复制/分享 | 待测 |
| UI-06 | 移动端适配 | iPhone/Android上显示正常 | 待测 |

### 测试命令

```bash
# 启动开发服务器
npm run dev

# 访问
# http://localhost:3000/side
```

---

## 当前结论

- 文档 `docs/second-me-api/api-reference.md` 中 9 个核心接口在代码层已全部覆盖。
- 用户授权 + 用户信息 + 软记忆 + 流式对话 + TTS 已调通。
- **"帮我评评理" MVP 已可用，开发环境支持Mock投票模式。**
- **已适配 Vercel 部署环境，支持 Cron Job 自动同步数据。**
- 用户登录后自动注册为参与者，发布问题 -> 收集投票 -> 生成判决书。**部署到Vercel后需要真实SecondMe用户参与投票。**
