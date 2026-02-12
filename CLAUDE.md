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

## Latest Progress (2026-02-12)

### 本轮已完成

1. OAuth 回调地址策略修复
   - `src/lib/secondme-server.ts` 的 `getRedirectUri()` 改为只读取 `SECONDME_REDIRECT_URI`，不再自动探测 Vercel preview 域名。
   - 目标：彻底避免 `Redirect URI mismatch`（preview 域名被拼到 `redirect_uri`）。

2. 投票链路升级为异步队列（Vercel 友好）
   - 新增 `VoteTask` 模型与管理器：
     - `prisma/schema.prisma`
     - `src/lib/vote-task-manager.ts`
     - `src/lib/vote-task-worker.ts`
   - `Vote` 增加唯一约束 `@@unique([questionId, participantId])`，投票写入改为 upsert（防重复计票）：
     - `src/lib/vote-manager.ts`
   - 发布/注册/回填改为入队驱动：
     - `src/app/api/publish/route.ts`
     - `src/app/api/register/route.ts`
     - `src/app/api/backfill/route.ts`
   - Worker 消费统一到：
     - `src/app/api/cron/sync/route.ts`
     - `src/app/api/cron/heartbeat/route.ts`（Hobby 低频 cron 的在线补偿）

3. 前端“浏览即参与”接入
   - 新增 `POST /api/question/view`：
     - `src/app/api/question/view/route.ts`
   - 用户点开 Feed 卡片时触发入队：
     - `src/components/SideFeature.tsx`

4. 连接压力与幂等性修复
   - 前端轮询降频以缓解免费配额和连接峰值：
     - heartbeat: 5s -> 30s
     - feed polling: 3s -> 10s
   - 辩论招募改为幂等，避免重复创建 `DebateRole` 导致 unique 冲突：
     - `src/lib/debate-engine.ts`

5. 文档与迁移
   - 新增架构文档：
     - `docs/TECH.md`（强实时体验 + 异步最终一致、队列、Vercel 部署建议）
   - 在 `TECH.md` 补充 Supabase 连接策略：
     - `DATABASE_URL` 使用 pooler (`:6543`)
     - `DIRECT_URL` 使用直连 (`:5432`)
   - Prisma 迁移已落地并验证：
     - `prisma/migrations/20260212104500_add_vote_task_queue_and_vote_uniqueness/migration.sql`
     - `prisma migrate status` -> `Database schema is up to date`

### 线上状态（最新复测）

- `GET /api/feed`：`success: true`（已恢复）
- `POST /api/cron/heartbeat`：`success: true`（最新复测通过）
- OAuth 登录跳转：`redirect_uri` 已指向 `https://pli-one.vercel.app/api/auth/callback`

### 关键运维结论

- Vercel Hobby 不支持高频 cron（`*/5 * * * *`），只能每日一次。
- 实时推进依赖在线心跳小批量消费（`/api/cron/heartbeat`）+ 低频 cron 兜底。
- 若再次出现 `P2037/P1017`，优先检查：
  1. `DATABASE_URL` 是否为 Supabase pooler
  2. 密码是否 URL 编码
  3. 是否有旧部署仍在高频触发

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
| TASK-011 | UI/UX 重构 | `src/components/FeedCard.tsx`, `src/components/PilFeature.tsx` |
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
│   ├── PilFeature.tsx              # 辩论广场入口 (Refactored)
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
POST /api/publish → 创建Question (status: pending)
    ↓
POST /api/cron/heartbeat → 真实用户驱动引擎 (Recruiting -> Debating)
    ↓
GET /api/feed → 返回Feed流数据 (实时 + 历史)
    ↓
Frontend → 实时轮询 (模拟WebSocket)
```

---

## 开发中: "帮我评评理" 辩论广场 (Deep Debate Edition)

**产品定位**: 真实用户驱动的 AI 分身辩论广场。
**当前状态**: 已移除 Mock，完全依赖真实用户 (需 6 人成团)。

### 最新修复 (2026-02-11)

| 问题 | 修复 |
|-----|------|
| 路径冗余 | 移除 `/api/side/` 前缀，API 扁平化至 `/api/` |
| 真实性 | 移除 Mock 辩手，实现 `Heartbeat` 引擎调度真实 AI 分身 |
| 实时性 | 前端增加心跳触发器，实现伪实时直播体验 |
| **User Table Empty** | 修复 `auth-helper` 使用 Mock 数据的 Bug，现在会拉取真实 UserInfo 并存入 DB |

### 新增文件清单

```
src/
├── app/
│   └── api/
│       ├── publish/route.ts     # 发布问题
│       ├── feed/route.ts        # 广场Feed流
│       ├── cron/
│       │   └── heartbeat/route.ts # 核心辩论引擎 (New)
│       └── admin/
│           └── seed/route.ts    # 数据预埋 (Updated: Clears DB first)
├── components/
│   ├── ArenaDisplay.tsx         # 辩论直播组件 (Updated)
│   └── SideFeature.tsx          # 主功能入口 (Updated)
└── lib/
    └── debate-engine.ts         # 辩论逻辑核心 (New)
```


---

## 当前结论

- 文档 `docs/second-me-api/api-reference.md` 中 9 个核心接口在代码层已全部覆盖。
- 用户授权 + 用户信息 + 软记忆 + 流式对话 + TTS 已调通。
- **"帮我评评理" MVP 已可用，开发环境支持Mock投票模式。**
- **已适配 Vercel 部署环境，支持 Cron Job 自动同步数据。**
- 用户登录后自动注册为参与者，发布问题 -> 收集投票 -> 生成判决书。**部署到Vercel后需要真实SecondMe用户参与投票。**

---

## 本轮状态更新 (2026-02-12)

### 已完成

1. 鉴权与用户标识兼容修复  
   - 修复 SecondMe 返回 `userId` 时被误判未登录的问题（兼容 `id/userId`）。  
   - 影响文件：`src/lib/auth-helper.ts`, `src/app/api/secondme/user/info/route.ts`, `src/app/api/auth/callback/route.ts`

2. 发布流程稳定性修复  
   - 增加发布并发防重、失败回滚、错误提示。  
   - 影响文件：`src/components/SideFeature.tsx`

3. 投票引擎改造（结构化输出）  
   - 投票从 `chat/stream` 调整为 `act/stream + actionControl`。  
   - 增强 SSE 解析与结果校验，禁止泛化文案（如“我支持这个观点”）直接落库。  
   - 影响文件：`src/lib/secondme-poll-engine.ts`, `src/lib/vote-task-worker.ts`, `src/app/api/publish/route.ts`

4. MVP 聚焦（先做提问 + 回答 + 票数 + 理据）  
   - 暂时隐藏辩论展示与“查看完整判决”入口。  
   - 票数显示改为仅基于 `votes`，不再混入 debate turns。  
   - 影响文件：`src/components/ArenaDisplay.tsx`, `src/app/api/feed/route.ts`, `src/components/FeedCard.tsx`

5. 分享功能第一版落地  
   - 点击分享 -> 弹窗预览 -> 点击下载。  
   - 生成模板图包含：问题、红蓝票面、总票数、AI 分身理据。  
   - 修复弹窗关闭无响应问题（Portal + 事件处理）。  
   - 影响文件：`src/components/FeedCard.tsx`, `src/lib/share-card.ts`, `src/app/api/feed/route.ts`

6. 提示词外置  
   - 投票 actionControl 提示词迁移到 YAML + frontmatter，便于你直接调试。  
   - 文件：`config/vote-act-prompt.yaml`

### 未完成 / 待继续

1. 分享模板继续精修  
   - 当前已按“红蓝票面”方向重绘，但仍可继续对齐目标视觉（字体、边线、间距、装饰细节）。

2. 多用户实战验证  
   - 目前环境只有 1 个真实参与者，已能验证“每题至少一票”链路；仍需多用户实测票数分布与稳定性。

3. 历史数据治理  
   - 历史低质量文案已清理并重排队过一轮；后续需持续观察是否还出现异常文案并完善规则。
