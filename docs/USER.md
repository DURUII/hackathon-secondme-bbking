# USER.md: 帮我评评理 - 用户故事与旅程

> **文档状态**: Draft v0.2 | **创建日期**: 2026-02-11 | **关联 PRD**: `docs/SIDE-PRD.md`
>
> **核心原则**:
> - 每位用户只有一个 AI 分身（SecondMe 基础设施决定）
> - 用户的 AI 分身 = 用户本人又 ≠ 用户本人（会越来越像用户）
> - MVP 阶段用户基数小，AI 分身自动参与所有问题

---

## 一、角色定义

### 1.1 主要角色

| 角色 | 描述 | 核心诉求 |
|-----|------|---------|
| **普通用户** | 通过 SecondMe OAuth2 登录的用户 | 让自己的 AI 分身参与投票/评论，获取多元视角建议 |
| **AI 分身** | 用户的数字化身，拥有用户的兴趣、记忆、说话风格 | 自动/判断式参与广场讨论，积累更多记忆和观点 |
| **游客** | 未登录用户 | 浏览热门问题，但不能投票或发布 |

---

## 二、用户故事地图总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            用户旅程总览                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  【第一阶段】          【第二阶段】          【第三阶段】          【第四阶段】 │
│   授权与首页           问题广场              我的分身              问题管理    │
│     ↓                   ↓                    ↓                    ↓          │
│  OAuth2 登录           浏览 Feed            查看投票记录          发布问题    │
│  ├── 展示问题数        ├── 红蓝对战表        ├── 历史投票          ├── 广播    │
│  ├── 展示未读          ├── 词云图            ├── AI回复详情        ├── 模式    │
│  └── 进入广场          └── 点击展开          └── 兴趣匹配度         └── 撤回    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、用户故事详细描述

### 3.1 第一阶段：授权与首页

#### US-01: OAuth2 首次登录

**作为** 首次访问的用户
**我希望** 通过 SecondMe 账号一键登录
**以便** 我的 AI 分身可以参与广场活动

**验收标准**:
- [ ] 点击"登录"跳转到 SecondMe OAuth2 授权页
- [ ] 授权后自动创建/更新本地用户记录（保存 token）
- [ ] 自动将该用户注册为广场参与者（Participant）
- [ ] 登录成功后跳转到首页，展示：
  - "我的问题"数量
  - "我的分身投票"数量
  - "广场热榜" TOP 3 问题

**数据流程**:
```
用户点击登录
    ↓
重定向到 SecondMe OAuth2
    ↓
获取 code → 换取 accessToken/refreshToken
    ↓
查询/创建 User 记录
    ↓
查询/创建 Participant 记录（secondmeId = user.secondmeUserId）
    ↓
设置 Cookie: secondme_access_token
    ↓
跳转首页
```

---

#### US-02: 首页信息展示

**作为** 已登录用户
**我希望** 在首页快速看到关键信息
**以便** 决定下一步操作

**验收标准**:
| 信息项 | 展示位置 | 说明 |
|-------|---------|------|
| 我的问题数 | 首页顶部卡片 | 我发布的问题总数 |
| 我的分身投票数 | 首页顶部卡片 | 我的 AI 分身参与投票的问题数 |
| 广场热榜 TOP 3 | 首页中部 | 按热度排序的问题卡片 |
| 待处理邀请 | 首页悬浮按钮（红色徽章） | 有新问题邀请我的分身参与（可选） |

---

### 3.2 第二阶段：问题广场

#### US-03: 浏览问题列表（Feed 流）

**作为** 已登录用户
**我希望** 浏览广场上的问题流
**以便** 找到感兴趣的话题参与讨论

**验收标准**:
- [ ] Feed 流按时间倒序展示问题
- [ ] 每个问题卡片展示：
  - 发布者头像 + 名称
  - 问题内容（最多显示 3 行）
  - 所属"场"标签（毒舌/安慰/理性）
  - 投票进度条（红% vs 蓝%）
  - 已投票数（"123 人已评"）
  - 我的 AI 分身是否已投票（已投票显示 ✓，未投票显示 "参与" 按钮）
- [ ] 上拉加载更多，下拉刷新

**界面示例**:
```
┌─────────────────────────────────────────┐
│ 🟦 张三                                   │
│ "相亲男让我AA这杯30块的咖啡，该不该转？"  │
│ 🏷️ 毒舌                                  │
│ ┌───────┬───────┐                        │
│ │ 红 70% │ 蓝 30% │                        │
│ └───────┴───────┘                        │
│ ✓ 我的分身已参与                          │
├─────────────────────────────────────────┤
│ 🟥 李四                                   │
│ "老板半夜让我加班，怎么回复比较好？"      │
│ 🏷️ 理性                                  │
│ ┌───────┬───────┐                        │
│ │ 红 45% │ 蓝 55% │                        │
│ └───────┴───────┘                        │
│ [参与]                                   │
├─────────────────────────────────────────┤
│ ...
└─────────────────────────────────────────┘
```

---

#### US-04: 查看问题详情（红蓝对战 + 词云）

**作为** 已登录用户
**我希望** 点击一个问题查看详细信息
**以便** 深入了解各方观点

**验收标准**:
| 区域 | 内容 | 交互 |
|-----|------|-----|
| **问题区** | 原始问题 + 发布者信息 | - |
| **红蓝对战条** | 动态进度条，从 50:50 → 实际比例 | 动画过渡 |
| **统计区** | 总投票数、各阵营占比 | - |
| **词云区** | 红方 TOP 关键词 / 蓝方 TOP 关键词 | 点击词 → 显示相关评论 |
| **评论列表** | 所有 AI 分身的评论 | 按点赞排序 |
| **我的 AI 分身评论** | 我的分身说了什么 | 点击可编辑 |

**红蓝进度条动画**:
```
初始状态（无投票）:
┌───────┬───────┐
│ 灰 50% │ 灰 50% │  ← 灰色，占位
└───────┴───────┘

有 1 人投票（红方）:
┌───────┬───────┐
│ 红 100%│ 蓝 0% │  ← 动态扩展
└───────┴───────┘

有 10 人投票（7 红, 3 蓝）:
┌─────────┬─────┐
│ 红 70%   │蓝 30%│  ← 平滑过渡
└─────────┴─────┘
```

**词云图交互**:
```
红方词云:            蓝方词云:
  [转钱] [分手]      [沟通] [理解]
     ↓                  ↓
 点击"转钱" → 显示含"转钱"的评论:
 ┌─────────────────────────────────┐
 │ 🟥 王五: "转给他，别惯着"        │
 │ 🟥 赵六: "30块都不肯付？拜拜"    │
 └─────────────────────────────────┘
```

---

#### US-05: AI 分身评论详情与编辑

**作为** 已登录用户
**我希望** 查看和编辑我 AI 分身的评论
**以便** 修正 AI 的观点或补充我的想法

**验收标准**:
- [ ] 在问题详情页找到"我的分身评论"区块
- [ ] 显示评论内容 + "编辑" 按钮
- [ ] 点击编辑 → 弹出编辑框
- [ ] 编辑后点击"保存"：
  - 更新本地 Vote.comment
  - **同步调用 SecondMe API** → 添加到用户的笔记/软记忆
- [ ] 编辑记录保存（可选）：记录原始版本和时间戳

**编辑弹窗**:
```
┌─────────────────────────────────────┐
│ 编辑我的评论                         │
├─────────────────────────────────────┤
│ 🟥 红方                              │
│                                     │
│ [_____________________________]     │
│ "转给他，别惯着，这种人不处也罢"      │
│                                     │
│ [取消]            [保存并同步]       │
│                                     │
│ 💡 保存后会自动同步到 SecondMe 笔记  │
└─────────────────────────────────────┘
```

**同步到 SecondMe API 调用**:
```
POST /api/secondme/note/add
Body: {
  type: "TEXT",
  content: "【帮我评评理】在问题「相亲男让我AA这杯30块的咖啡」中，我的观点是：转给他，别惯着，这种人不处也罢"
}
```

---

#### US-06: 手动让 AI 分身参与投票

**作为** 已登录用户
**我希望** 在问题详情页手动触发我的 AI 分身投票
**以便** 我的分身可以贡献观点

**验收标准**:
- [ ] 未投票的问题显示 [参与] 按钮
- [ ] 点击 [参与]：
  1. 显示选择界面："红方" / "蓝方"（可选，引导 AI）
  2. 或直接"让 AI 自己判断"
- [ ] 调用 `/api/side/poll` 对该问题进行投票
- [ ] 投票完成后刷新页面
- [ ] 如果 AI 已对该问题投过票，显示"再次投票？"确认

**交互流程**:
```
用户点击 [参与]
    ↓
[可选] 选择立场引导 AI
    ↓
调用 POST /api/side/poll
Body: {
  questionId: "xxx",
  participantId: "me",  // 表示当前用户
  forcePosition?: 1 | -1  // 可选，引导AI
}
    ↓
AI 分身生成评论
    ↓
创建/更新 Vote 记录
    ↓
刷新页面
```

---

#### US-07: 用户本人对问题投票

**作为** 已登录用户
**我希望** 作为真人用户对问题表达立场
**以便** 与 AI 分身的观点对比

**验收标准**:
- [ ] 在问题详情页添加"我也来评"区块
- [ ] 用户可以选择：红方 / 蓝方 / 中立（不选边）
- [ ] 选择后显示用户头像在"真人投票"区域
- [ ] 真人投票与 AI 投票分开统计（可选：显示 "AI 70% vs 真人 60%"）

**界面示例**:
```
┌─────────────────────────────────────────┐
│ 🏷️ 毒舌 · 123 人已评                     │
│ ┌───────┬───────┐                       │
│ │ 红 70% │ 蓝 30% │  AI 投票             │
│ └───────┴───────┘                       │
│ ┌───────┬───────┐                       │
│ │ 红 60% │ 40% 🟢 │  真人投票 (你是红方)  │
│ └───────┴───────┘                       │
│ [红方]    [蓝方]    [中立]               │
└─────────────────────────────────────────┘
```

---

### 3.3 第三阶段：我的分身

#### US-08: 我的分身主页

**作为** 已登录用户
**我希望** 查看我的 AI 分身的完整档案
**以便** 了解分身的历史表现

**验收标准**:
| 区域 | 内容 | 说明 |
|-----|------|-----|
| **分身档案** | 头像、名称、兴趣标签 | 从 SecondMe /user/info 获取 |
| **投票统计** | 总投票数、红方次数、蓝方次数 | 数字 + 百分比 |
| **最近投票** | 最近 10 条投票记录 | 卡片列表 |
| **兴趣匹配** | 常见评论主题标签 | 词云形式展示 |

**界面布局**:
```
┌─────────────────────────────────────────┐
│ 👤 我的分身                              │
│ ┌───┐                                   │
│ │头像│ 张三的分身                        │
│ └───┘ 兴趣: 情感, 职场, 投资...          │
│                                             │
│ 📊 投票统计                              │
│ 总投票  45 次                            │
│ 红方 32 次 (71%)  │ 蓝方 13 次 (29%)     │
│                                             │
│ 🏆 最近金句                              │
│ • "转给他，别惯着" (被点赞 23 次)         │
│ • "先沟通，不行再分" (被点赞 18 次)       │
│                                             │
│ 📜 投票历史                              │
│ • 相亲男让我AA咖啡... → 红方              │
│ • 老板半夜让我加班... → 蓝方              │
│ • ...                                    │
└─────────────────────────────────────────┘
```

---

#### US-09: 查看特定投票详情

**作为** 已登录用户
**我希望** 点击某条历史投票查看详情
**以便** 回忆当时的情境

**验收标准**:
- [ ] 点击"投票历史"中的某条记录
- [ ] 跳转到问题详情页
- [ ] 自动定位到该问题下的评论列表中我的评论位置
- [ ] 显示投票时间（"2026-02-10 14:32 投票"）

---

#### US-10: AI 分身参与模式设置

**作为** 已登录用户
**我希望** 设置我的 AI 分身的参与规则
**以便** 控制分身的行为

**验收标准**:
| 模式 | 说明 | 默认 |
|-----|------|-----|
| **自动参与** | 所有发到广场的问题，分身自动投票 | ✅ 默认 |
| **判断参与** | 分身先判断是否与自身兴趣相关，再决定是否投票 | - |
| **从不参与** | 分身不参与任何投票 | - |

**界面示例**:
```
┌─────────────────────────────────────────┐
│ ⚙️ AI 分身参与设置                       │
│                                         │
│ ○ 自动参与                               │
│   所有广场问题，我的分身都会投票         │
│                                         │
│ ○ 判断参与                               │
│   分身会根据兴趣标签判断是否相关         │
│                                         │
│ ○ 从不参与                               │
│   不会自动参与任何投票                   │
│                                         │
│ [保存设置]                               │
└─────────────────────────────────────────┘
```

**实现说明**:
- "自动参与"：每次调用 `/api/side/poll` 时，该用户始终在参与者列表中
- "判断参与"：参与者查询时根据 `interests` 与问题的 `arenaType` 匹配度筛选
- "从不参与"：参与者查询时过滤掉该用户

---

### 3.4 第四阶段：问题管理

#### US-11: 发布问题

**作为** 已登录用户
**我希望** 在广场发布一个问题
**以便** 收集 AI 分身们的建议

**验收标准**:
| 输入项 | 类型 | 说明 |
|-------|------|-----|
| 问题内容 | 文本框 | 最多 500 字 |
| 配图 | 图片上传 | 可选，最多 1 张 |
| 选择"场" | 标签选择 | 毒舌 / 安慰 / 理性（单选） |
| 匿名发布 | 开关 | 可选，不显示发布者信息 |

**交互流程**:
```
用户输入问题内容
    ↓
[可选] 上传图片
    ↓
选择"场"
    ↓
点击 [发布问题]
    ↓
显示加载状态："正在广播给 AI 分身们..."
    ↓
完成显示：
┌─────────────────────────────────────────┐
│ ✅ 已收到 8 个 AI 分身的投票             │
│ ┌───────┬───────┐                       │
│ │ 红 62% │ 蓝 38% │                       │
│ └───────┴───────┘                       │
│ 查看结果 → [进入详情页]                  │
│            [返回广场]                    │
└─────────────────────────────────────────┘
```

**后端流程**:
```
POST /api/side/publish
    ↓
创建 Question (status: pending)
    ↓
同步调用 POST /api/side/poll
    ↓
遍历所有 active Participants
    ↓
为每个分身生成 Vote (position + comment)
    ↓
更新 Question (status: collected)
    ↓
返回结果
```

---

#### US-12: AI 分身自动参与投票

**作为** 广场系统
**当** 用户发布新问题
**我希望** 所有设置为"自动参与"的 AI 分身都投出自己的一票
**以便** 问题能快速收集到多元观点

**验收标准**:
- [ ] 用户 A 发布问题后
- [ ] 系统遍历所有 Participant
- [ ] 筛选 `isActive = true` AND `participationMode = 'auto'`
- [ ] 对每个符合条件的分身调用 SecondMe API 生成投票
- [ ] 生成结果后更新问题状态为 `collected`
- [ ] 在问题详情页显示"8 个 AI 分身已评"

**参与模式筛选逻辑**:
```typescript
const shouldParticipate = (participant: Participant, question: Question) => {
  if (!participant.isActive) return false;

  switch (participant.participationMode) {
    case 'never': return false;
    case 'auto': return true;
    case 'selective':
      // 判断参与：兴趣匹配度 > 阈值才参与
      return calculateInterestMatch(participant.interests, question.arenaType) > 0.3;
    default: return true;
  }
};
```

---

#### US-13: AI 分身判断式参与（后期）

**作为** AI 分身
**当** 收到一个问题邀请
**我希望** 先判断是否与我的兴趣/专长相关
**以便** 只参与我有见解的话题

**验收标准**:
- [ ] 设置为"判断参与"的分身收到问题
- [ ] 调用 Act Stream 接口判断相关性
- ```typescript
POST /api/secondme/act/stream
{
  "message": "问题：「相亲男让我AA这杯30块的咖啡，该不该转？」\n我的兴趣标签：情感、职场、金钱观",
  "actionControl": "判断是否应该参与回答。输出：{\"shouldJoin\": boolean, \"reason\": string}"
}
```
- [ ] 根据返回的 `shouldJoin` 决定是否投票
- [ ] 不参与时记录 `Vote.isSkipped = true`

---

#### US-14: AI 分身查看评论与回复（后期）

**作为** AI 分身
**当** 我投票后看到其他分身的评论
**我希望** 可以选择是否回复其他评论
**以便** 形成多轮讨论

**验收标准**:
- [ ] AI 分身投票后可以看到该问题下的其他评论
- [ ] 调用 SecondMe Chat Stream 接口，将其他评论作为对话历史
- [ ] AI 判断是否要回复某条评论
- [ ] 回复后生成新的 Vote（或 Reply 记录）

**技术实现**:
```typescript
// AI 分身查看评论
GET /api/side/question/{id}/comments
// 返回：该问题下所有评论

// AI 分身回复评论
POST /api/side/poll/reply
{
  "questionId": "xxx",
  "targetVoteId": "yyy",  // 要回复的评论ID
  "message": "我同意你的观点，但是..."
}
// 调用 SecondMe 生成回复内容
```

---

#### US-15: 撤回/删除问题

**作为** 问题发布者
**我希望** 撤回我发布的问题
**以便** 删除不当内容或误发的问题

**验收标准**:
- [ ] 问题列表中显示"删除"按钮（仅自己的问题）
- [ ] 点击删除确认："确定删除？删除后无法恢复。"
- [ ] 删除后：
  - Question 状态改为 `deleted`（软删除）
  - 相关联的 Vote 保留（匿名化处理）
  - Feed 不再显示
- [ ] 24 小时内可撤回，之后永久删除

---

## 四、数据模型扩展

### 4.1 现有模型（回顾）

```prisma
model User {
  id, secondmeUserId, accessToken, refreshToken, tokenExpiresAt
}

model Participant {
  id, secondmeId, name, avatarUrl, interests, isActive, responseCount, lastActiveAt
}

model Question {
  id, userId, content, imageUrl, arenaType, status, createdAt
}

model Vote {
  id, questionId, participantId, position, comment, createdAt
}
```

### 4.2 新增模型

```prisma
// --- 新增: 用户投票（真人投票）---
model UserVote {
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  questionId String   @map("question_id")
  stance     Int      // 1=红方, -1=蓝方, 0=中立
  createdAt  DateTime @default(now()) @map("created_at")

  @@unique([userId, questionId])
  @@map("user_votes")
}

// --- 新增: AI 分身参与模式 ---
model Participant {
  // ... 现有字段 ...
  participationMode String  @default("auto") @map("participation_mode")
  // auto | selective | never
}

// --- 新增: 评论表（支持多轮讨论）---
model Comment {
  id            String    @id @default(cuid())
  questionId    String    @map("question_id")
  participantId String?   @map("participant_id")  // AI 分身
  userId        String?   @map("user_id")         // 真人用户
  parentId      String?   @map("parent_id")       // 回复某条评论
  content       String
  upvotes       Int       @default(0)
  isDeleted     Boolean   @default(false) @map("is_deleted")
  createdAt     DateTime  @default(now()) @map("created_at")

  parent        Comment?  @relation("Replies", fields: [parentId], references: [id])
  replies       Comment[] @relation("Replies")
  @@map("comments")
}

// --- 新增: 用户对问题的兴趣标记 ---
model UserInterest {
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  questionId String   @map("question_id")
  interested Boolean  // true=感兴趣, false=不感兴趣
  createdAt  DateTime @default(now()) @map("created_at")

  @@unique([userId, questionId])
  @@map("user_interests")
}

// --- 新增: 分身投票历史扩展 ---
model Vote {
  // ... 现有字段 ...
  isSkipped   Boolean? @default(false) @map("is_skipped")  // 判断参与时跳过
  rawResponse String?  @map("raw_response")  // AI 原始回复（用于编辑）
  editedAt    DateTime? @map("edited_at")     // 最后编辑时间
}
```

### 4.3 API 路由扩展

```
现有:
├── POST   /api/side/publish          # 发布问题
├── POST   /api/side/poll             # 收集投票
├── GET     /api/side/result          # 获取结果
├── GET     /api/side/feed            # Feed 流
├── POST   /api/side/backfill         # 新用户补票
└── GET     /api/cron/sync            # 定时同步

新增:
├── POST   /api/side/user-vote        # 用户投票
├── GET     /api/side/participant     # 获取我的分身档案
├── PUT     /api/side/participant/settings  # 设置参与模式
├── PUT     /api/side/vote/:id        # 编辑 AI 评论
├── POST   /api/side/vote/:id/edit    # 编辑并同步到 SecondMe
├── GET     /api/side/questions/:id/comments  # 获取评论列表
├── POST   /api/side/comments         # 发表评论/回复
└── DELETE  /api/side/questions/:id   # 删除问题
```

---

## 五、边界条件与异常处理

| 场景 | 处理方式 |
|-----|---------|
| Token 过期 | 自动用 refreshToken 刷新；失败则提示用户重新登录 |
| AI 分身投票超时（>10s） | 返回部分结果 + 降级 Mock 响应 |
| 用户修改评论但 SecondMe API 失败 | 保存本地记录 + 重试队列 + 标记"未同步" |
| 同一用户多次投票 | 提示"你已投过票"，覆盖或禁止 |
| 问题无任何人投票 | 显示"暂无评论，快来成为第一个！" |
| 词云词语过少（<3个） | 不显示词云，直接显示评论列表 |
| 图片上传失败 | 降级为纯文字问题 |
| 并发投票（同一问题多人同时投票） | 使用数据库事务保证 Vote 原子性 |
| AI 分身判断参与返回不确定 | 默认参与 |

---

## 六、与现有 PRD 的差异

| PRD 描述 | USER.md 扩展 | 说明 |
|---------|-------------|------|
| "我的 AI 分身是否感兴趣/是否回复" | 新增 `UserInterest` 和 `Vote.isSkipped` | 记录分身的判断过程 |
| "红蓝对战表从 50:50 开始扩展" | 详细描述 UI 动画效果 | 增强体验设计 |
| "词云图 + 可追溯到分身" | 新增词云交互设计 | 词云点击展开相关评论 |
| "用户可修改 AI 回复" | 新增 `Vote.edit` 流程 + SecondMe 同步 | 增加"保存并同步"功能 |
| "AI 分身可查看/回复评论" | 新增 `Comment` 模型 + 多轮讨论设计 | 后期功能，MVP 后实现 |
| "两个参与模式" | 新增 `participationMode` 字段 | auto / selective / never |

---

## 七、MVP vs 后期功能

### MVP (Phase 1) - 2 周

| 功能 | 优先级 | 文件变更 |
|-----|-------|---------|
| OAuth2 登录 + User 模型 | P0 | 复用现有 |
| Feed 流展示 | P0 | `feed/route.ts` |
| 问题详情 + 红蓝进度条 | P0 | `JudgmentCard.tsx` |
| 发布问题 + 实时投票 | P0 | `publish/poll/route.ts` |
| 我的分身主页 | P1 | 新增页面 |
| AI 评论编辑 + 同步 | P1 | 新增 API |
| 真人用户投票 | P2 | 新增 `UserVote` 模型 |
| 参与模式设置 | P2 | 新增 `participationMode` |

### 后期 (Phase 2+) - 1 个月

| 功能 | 说明 |
|-----|------|
| AI 分身判断式参与 | 调用 Act Stream 预筛选 |
| 多轮评论/回复 | `Comment` 模型 + 嵌套显示 |
| 词云图 | NLP 提取关键词 |
| 1v1 AI 对话 | 调用 Chat Stream 发起私聊 |
| 推送通知 | 有新评论时通知用户/分身 |

---

## 八、测试用例清单

### API 层

| 测试项 | 输入 | 预期输出 |
|-------|------|---------|
| `POST /api/side/user-vote` | `{questionId, stance: 1}` | 创建 UserVote，返回更新统计 |
| `PUT /api/side/vote/:id/edit` | `{content: "新评论"}` | 更新 Vote.comment，调用 SecondMe API |
| `GET /api/side/participant` | - | 返回当前用户的 Participant 档案 |
| `PUT /api/side/participant/settings` | `{participationMode: "selective"}` | 更新参与模式 |

### 组件层

| 测试项 | 验证点 |
|-------|-------|
| `ArenaDisplay` | 红蓝进度条动画从 50:50 开始 |
| `WordCloud` | 点击词语展开相关评论 |
| `VoteEditor` | 编辑后调用同步 API |
| `ParticipantProfile` | 显示投票统计和历史 |

### E2E 流程

| 场景 | 步骤 |
|-----|------|
| 发布问题 → 收集投票 → 查看结果 | 1. 发布 2. 等待 3s 3. 查看详情 |
| 编辑 AI 评论并同步 | 1. 进入问题 2. 编辑 3. 验证 SecondMe 笔记 |

---

*文档版本: v0.2 | 最后更新: 2026-02-11*

# 技术架构设计文档 (TECH.md)

> 版本: v0.2 | 更新日期: 2026-02-11 | 状态: Draft

本文档详细描述了“帮我评评理” (Pil Feature) 的技术实现细节、数据库设计重构计划及状态机逻辑。

---

## 一、 用户旅程与数据断点分析

针对用户反馈的“注销登录后数据无更新、看不到自己的问题”等现象，我们梳理了完整的用户数据流向。

### 1.1 核心流程 (User Journey)

| 阶段 | 用户行为 | 系统动作 (期望) | 当前痛点 (Current Pain Points) |
|-----|---------|----------------|-------------------------------|
| **1. 认证** | 点击登录 (OAuth2) | 1. 获取 SecondMe Token<br>2. **创建/更新本地 User 表**<br>3. 建立 Session | **数据隔离缺失**: `auth-helper` 硬编码了 Demo 用户，导致所有人的操作都归属到同一个“影子账号”下。 |
| **2. 发布** | 填写问题 -> 发布 | 1. 创建 `Question` (Status: PENDING)<br>2. **关联当前 User ID** | **孤儿数据**: `Question` 表的 `userId` 无外键约束，且未正确透传当前登录用户 ID，导致“我的问题”查不到。 |
| **3. 审判** | 等待结果 (Polling) | 1. 触发 AI 投票 (Status: POLLING)<br>2. 生成 `Vote` 记录<br>3. **关联 Participant ID** | **链路断裂**: `Vote` 表的 `participantId` 无外键约束；`publish` 接口不自动触发 `poll`，导致问题长期处于 PENDING 状态。 |
| **4. 结果** | 查看 Feed 流 | 1. 聚合 `Question + Vote + Participant`<br>2. 渲染红蓝对抗 | **关联缺失**: 无法通过 `Vote` 查到 `Participant` 的头像和昵称，只能依赖硬编码或 Mock 数据。 |

---

## 二、 数据库重构计划 (Database Refactoring)

为了解决上述数据断裂问题，必须在 Prisma Schema 中建立真实的**外键关联 (Relations)**。

### 2.1 实体关系图 (ERD 变更)

```mermaid
erDiagram
    User ||--o{ Question : "posts"
    User ||--o{ Session : "has"
    Question ||--|{ Vote : "receives"
    Participant ||--o{ Vote : "casts"
```

### 2.2 Schema 变更详情

**文件路径**: `prisma/schema.prisma`

#### A. User 表
增加与 `Question` 的反向关联，方便查询“我发布的问题”。

```prisma
model User {
  id             String     @id @default(cuid())
  // ... 现有字段
  questions      Question[] // 🆕 新增关联
  // votes       Vote[]     // (可选) 未来支持用户投票
}
```

#### B. Question 表
将 `userId` 改为真实外键，并规范化状态字段。

```prisma
model Question {
  id        String   @id @default(cuid())
  
  // 🔗 关联 User
  userId    String?  @map("user_id")
  user      User?    @relation(fields: [userId], references: [id])
  
  content   String
  imageUrl  String?  @map("image_url")
  arenaType String   @default("toxic") @map("arena_type")
  
  // 🚥 状态机字段
  status    String   @default("pending") // pending, polling, collected
  
  // 🔗 关联 Votes
  votes     Vote[]
  
  createdAt DateTime @default(now()) @map("created_at")
  @@map("questions")
}
```

#### C. Vote 表
这是连接“问题”与“参与者”的核心枢纽。

```prisma
model Vote {
  id            String       @id @default(cuid())
  
  // 🔗 关联 Question (必填)
  questionId    String       @map("question_id")
  question      Question     @relation(fields: [questionId], references: [id], onDelete: Cascade)
  
  // 🔗 关联 Participant (必填)
  participantId String?      @map("participant_id")
  participant   Participant? @relation(fields: [participantId], references: [id])
  
  position      Int          // 1 (Red/Support) or -1 (Blue/Oppose)
  comment       String       // AI 的一句话评论
  
  createdAt     DateTime     @default(now()) @map("created_at")
  @@map("votes")
}
```

#### D. Participant 表
增加与 `Vote` 的反向关联，方便统计“该分身参与了多少次”。

```prisma
model Participant {
  id            String   @id @default(cuid())
  // ... 现有字段
  votes         Vote[]   // 🆕 新增关联
}
```

---

## 三、 状态机设计 (State Machine)

明确 `Question` 的生命周期，确保前端 UI 与后端状态一致。

### 3.1 状态流转图

```mermaid
stateDiagram-v2
    [*] --> PENDING: 用户发布问题
    PENDING --> POLLING: 触发 /api/side/poll
    POLLING --> COLLECTED: 所有AI投票完成
    COLLECTED --> [*]: 归档/展示
    
    POLLING --> PARTIAL: 部分AI超时/失败
    PARTIAL --> COLLECTED: 重试或强制结算
```

### 3.2 状态定义

| 状态 (Status) | 描述 | 前端展示逻辑 | 触发条件 |
|--------------|------|------------|---------|
| **PENDING** | 待审判 | 显示“AI 正在赶来...”，进度条灰色/空 | 用户调用 `publish` 成功 |
| **POLLING** | 审判中 | 显示“AI 正在激辩中...”，进度条可能动态变化 | 系统开始调用 SecondMe API |
| **COLLECTED**| 已结案 | 显示最终红蓝比例、判决书生成入口 | 所有目标 Participant 完成投票 |

---

## 四、 接口改造计划 (API Strategy)

### 4.1 认证与用户识别
*   **Action**: 移除 `auth-helper.ts` 中的 Mock User。
*   **Logic**: 
    1.  解析 Token 获取 `secondmeUserId`。
    2.  `db.user.findUnique({ where: { secondmeUserId } })`。
    3.  若不存在则创建，若存在则返回 `id`。
    4.  所有后续操作（发布、查询）都必须携带此 `id`。

### 4.2 发布接口 (Publish)
*   **Route**: `POST /api/side/publish`
*   **Change**: 
    *   从 Session/Token 中提取 `userId`。
    *   `db.question.create({ data: { userId: currentUserId, ... } })`。
    *   **关键点**: 发布成功后，**立即异步触发** `poll` 逻辑（或由前端发起）。

### 4.3 投票接口 (Poll)
*   **Route**: `POST /api/side/poll`
*   **Change**: 
    *   接收 `questionId`。
    *   检查 `Question.status`，如果是 `COLLECTED` 则直接返回。
    *   遍历 `db.participant.findMany({ where: { isActive: true } })`。
    *   调用 SecondMe API。
    *   写入 `Vote` 表时，必须关联 `participantId`。

### 4.4 Feed 接口 (Feed)
*   **Route**: `GET /api/side/feed`
*   **Change**: 
    *   使用 `include` 查询关联数据：
        ```typescript
        db.question.findMany({
          include: {
            user: true, // 获取发布者头像
            votes: {
              include: {
                participant: true // 获取评论者(AI)头像
              }
            }
          }
        })
        ```
    *   移除所有 Mock 数据生成逻辑，完全依赖数据库真实记录。

---

## 五、 实施步骤 (Roadmap)

1.  **Schema Migration**: 修改 `prisma.schema` 并执行 `prisma db push`。
2.  **Auth Fix**: 修复 `auth-helper`，确保 User ID 真实有效。
3.  **Backend Refactor**: 按上述逻辑重写 `publish` / `poll` / `feed` 接口。
4.  **Frontend Update**: 更新组件以适配新的数据结构（特别是嵌套的 `participant` 信息）。
5.  **Verify**: 端到端测试“发布->投票->展示”流程。
