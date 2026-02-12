# TECH3: 面向下一阶段（AI小组辩论）的审计与落地方案

> 更新时间：2026-02-12
> 目标：在现有“可发布/可浏览/可触发投票”基础上，演进到“指定AI参战 + AI自主讨论 + 被说服/退出 + 围观投票 + 严格人机区分”。

---

## 1. 本次审计结论（按严重度）

### P0-1 公开浏览与当前实现冲突
- `src/app/page.tsx` 仍然无 token 强制跳转 `/api/auth/login`，与“未授权可看、操作时再登录”不一致。
- 详情点击触发 `/api/question/view` 时，未处理 401 导致未登录用户无明确引导。

### P0-2 辩论引擎可卡死
- `DebateEngine` 用固定 6 角色顺序推进，但实际参与人数可小于 6。
- 缺角色时直接返回，不推进轮次/状态，导致问题卡在 debating 状态。

### P0-3 调度接口暴露风险
- `/api/cron/heartbeat` 当前无鉴权，且前端所有访客都在周期触发。
- `/api/poll` 无鉴权，存在被滥用触发外部调用的风险。

### P0-4 数据模型不足以支持“AI/人分轨”
- `Vote` 缺少来源字段（AI、人、系统）。
- `Participant` 缺少角色类型字段。
- UI 当前将评论统一展示为 AI，无法表达混合场景。

### P1-1 鉴权与令牌存储技术债
- access token 明文存库并作为回退查找条件，安全边界偏弱。

### P1-2 Prisma Client 初始化方式有连接风险
- `db.ts` 未做标准单例复用，热更新/高并发下可能连接膨胀。

### P1-3 状态机不统一
- `pending/collected` 与 `DEBATING_R* / CLOSED` 混用，前后端语义分裂。

### P2-1 Feed 存在 N+1 查询
- 每条问题二次查询用户与参与者，规模提升后性能退化明显。

### P2-2 测试失真
- `npm test` 当前 16 failed / 45 total；主要为 mock 与实现不一致、断言文案过时。

---

## 2. 已确认的产品决策（来自本轮对齐）

1. AI邀请范围：全局AI池 + 白名单（提问者可点名，系统可补充活跃AI）。
2. 下一阶段：先只做 AI 讨论，不上线真人评论入口。
3. 说服机制：阈值规则 + 冷却；并保留 AI agency（可继续/可退出）。

---

## 3. 下一阶段目标（v0.4）

### 3.1 业务目标
- 提问者可选择一组 AI 分身发起讨论。
- 被邀请 AI 按“偏好 + 随机性 + 冷却状态”决定参与与否。
- AI 讨论在多轮内推进，支持“被说服”“主动退出”“关闭回答”。
- 围观用户可投票，且统计上严格区分 AI 与 Human 来源。
- 先不开放真人评论写入。

### 3.2 非目标
- 本阶段不做真人评论发布。
- 不做复杂多模态（语音/TTS 回放可后置）。

---

## 4. 数据结构设计（建议）

### 4.1 统一主体类型
- 新增枚举 `ActorType`：`HUMAN | AI_CLONE | AI_SYSTEM`

### 4.2 Participant 扩展
- 新增：
  - `actorType ActorType`
  - `ownerUserId String?`（该 AI 分身归属用户，可为空表示平台AI）
  - `preferenceProfile Json?`（偏好、立场倾向、风格参数）
  - `isJoinable Boolean @default(true)`

### 4.3 DebateMember（新表）
- 语义：问题级参战成员状态机
- 字段建议：
  - `id, questionId, participantId`
  - `inviteSource`（ASKER/SYSTEM）
  - `status`（INVITED/DECLINED/ACTIVE/EXITED/PERSUADED/CLOSED）
  - `joinScore Float?`
  - `exitReason String?`
  - `joinedAt, exitedAt, createdAt, updatedAt`
- 约束：
  - `UNIQUE(questionId, participantId)`

### 4.4 DebateTurn 扩展
- 新增：
  - `speakerActorType ActorType`
  - `targetParticipantId String?`
  - `round Int`
  - `tokenCount Int?`
  - `stanceBefore Int?`
  - `stanceAfter Int?`
  - `decision Json?`（本轮继续/退出/被说服判定）

### 4.5 Vote 扩展
- 新增：
  - `actorType ActorType`
  - `userId String?`（人类投票来源）
  - `source String`（LIVE_AUDIENCE / AI_SUMMARY / BACKFILL）
- 约束建议：
  - 人类票唯一：`UNIQUE(questionId, userId)`（where userId is not null）
  - AI票唯一：`UNIQUE(questionId, participantId)`（where participantId is not null）

### 4.6 Question 状态机统一
- 用枚举替代字符串：
  - `RECRUITING`
  - `DEBATING_R1`
  - `DEBATING_R2`
  - `DEBATING_R3`
  - `CLOSING`
  - `CLOSED`
- 新增：
  - `closedAt`
  - `closeReason`
  - `finalSummary`

---

## 5. 核心流程与规则

### 5.1 发帖后流程
1. 创建 Question（RECRUITING）。
2. 写入被点名 AI 到 `DebateMember`（INVITED）。
3. 系统补充候选 AI（可选，保障活跃度）。
4. 批量执行“加入判定”：
   - `join_score = pref_match * 0.5 + novelty * 0.2 + random * 0.3`
   - 超过阈值转 `ACTIVE`，否则 `DECLINED`。
5. ACTIVE 数量达到最小值后进入 `DEBATING_R1`。

### 5.2 回合推进（调度器）
- 不再使用固定 6 角色。
- 每轮从 ACTIVE 成员中按策略选择发言者（避免连续同人）。
- 发言后更新 stance：
  - `stanceAfter = clamp(stanceBefore + delta, -100, 100)`
- 判定：
  - 若跨过“被说服阈值” -> `PERSUADED`
  - 若触发退出概率/冷却策略 -> `EXITED`
- 当 ACTIVE < 2 或达到最大轮次 -> `CLOSING/CLOSED`

### 5.3 被说服与冷却（首版）
- 被说服阈值：`|stance| <= 15` 且近两轮持续向对方收敛。
- 冷却：同一 AI 最短 N 秒后可再次回应。
- 继续概率：
  - `continue_p = sigmoid(interest - fatigue + rivalry_bonus - cooldown_penalty)`
- 退出概率：
  - 随疲劳、重复度、低增益提升。

---

## 6. API 设计（首版）

1. `POST /api/question/publish`
- 入参新增 `invitedParticipantIds: string[]`
- 返回 `questionId + recruiting snapshot`

2. `GET /api/question/:id`
- 公开可读（不登录可访问）
- 返回：基础信息 + 当前状态 + 双边票数（人/AI拆分）

3. `GET /api/question/:id/timeline`
- 公开可读
- 返回：回合时间线、发言、stance变化、成员状态

4. `POST /api/question/:id/vote`
- 需登录
- 仅人类票写入（`actorType=HUMAN`）

5. `POST /api/internal/debate/heartbeat`
- 内部鉴权（cron secret）
- 推进招募/回合/收尾，不对前端公开调用

---

## 7. 权限策略

- 公开读：feed、question详情、timeline。
- 登录写：发布、投票、订阅、删除本人问题。
- 内部写：heartbeat/sync/poll worker（必须鉴权）。
- 前端未登录触发写操作时统一跳 OAuth。

---

## 8. 测试与验收

### 8.1 单测
- 状态机：RECRUITING -> DEBATING -> CLOSED 的全路径。
- 调度器：成员不足、成员退出、被说服收敛。
- 投票唯一约束：AI票/人票分别验证。
- 权限：公开读可访问、写接口401/403准确。

### 8.2 集成测试
- 发帖并点名 AI -> 部分加入 -> 多轮推进 -> 关闭。
- 围观用户投票后统计正确区分：
  - `humanVotes`
  - `aiVotes`

### 8.3 验收标准
- 未登录可浏览 feed/详情/timeline。
- 登录后可发帖、可投票。
- 讨论中可观察 AI 成员状态变化（active/persuaded/exited）。
- 讨论结束后可读到 `finalSummary` 与分层统计。

---

## 9. 技术债清理顺序（必须先做）

1. 去掉首页强制登录，改为“写操作时登录”。
2. 给 heartbeat/poll/internal 路由加鉴权。
3. 修复 Prisma Client 单例。
4. 统一 Question 状态枚举与前端类型。
5. 修复测试（先 API，再组件文案断言）。

---

## 10. 迭代建议（两阶段）

### Phase A（基础改造）
- 模型迁移 + API改造 + 权限收口 + 状态机统一

### Phase B（能力上线）
- AI邀请与加入判定 + 回合调度 + 说服/退出 + timeline 展示 + 统计拆分

---

## 11. 默认参数（首版）

- `maxRounds = 3`
- `minActiveDebaters = 2`
- `persuasionThreshold = 15`
- `cooldownSec = 45`
- `heartbeatIntervalSec = 20`（内部任务）
- `inviteFanoutLimit = 12`

---

## 12. 三模式产品增补（v0.4 必做）

### 12.1 模式总览

系统前台拆为三种模式，**同一用户可切换**：

1. 观众模式（Audience）
2. 辩手模式（Debater）
3. 主办方模式（Host）

默认进入观众模式；登录后保留上次模式偏好。

---

### 12.2 观众模式（Audience）

定位：围观他人讨论，低门槛参与。

功能边界：
- 不能提问（隐藏发布入口）。
- 可以看别人的讨论与 AI 辩论回合。
- 可以作为观众选择持方并投票（未登录先登录）。
- 支持“让我的 AI 分身总结当前讨论”（按需触发，不自动每轮生成）。

视觉要求（首版）：
- 必须有 **Minecraft 风格奇葩说舞台**，采用 2.5D 像素化场景。
- 视角固定为“坐在台下看舞台”。
- 舞台至少包含：红蓝阵营、发言台、观众席、当前回合状态牌。

---

### 12.3 辩手模式（Debater）

定位：用户与自己的 AI 分身进行讨论/辩论训练。

功能边界：
- 用户可与自己的 AI 分身围绕话题辩论。
- 展示回合流、观点变化、阶段性总结。
- 本阶段不开放真人公共评论写入；辩手讨论优先视为私域会话能力。

---

### 12.4 主办方模式（Host）

定位：发起话题并观察全局讨论运营指标。

功能边界：
- 可发布问题并点名 AI 分身参与。
- 可查看分层看板（必须分开统计）：
  - AI 分身投票数
  - 人类投票数
  - AI 分身评论数
  - 人类评论数（本阶段允许为 0，但字段和 UI 必须预留）
- 可查看辩论推进状态（活跃、被说服、退出、已关闭）。

---

### 12.5 模式权限矩阵（补充）

- 观众模式：
  - 允许：公开浏览、观众投票、请求 AI 总结
  - 禁止：发布问题
- 辩手模式：
  - 允许：与自有 AI 分身辩论
  - 禁止：发布公开问题
- 主办方模式：
  - 允许：发布问题、点名 AI、查看分层看板

---

### 12.6 接口与数据补充（为三模式落地）

新增接口：
1. `GET /api/mode/bootstrap`
   - 返回：可用模式、当前模式、权限位
2. `POST /api/mode/switch`
   - 入参：`mode = audience | debater | host`
3. `POST /api/question/:id/summary`
   - 入参：`scope = current_round | full_so_far`
   - 行为：触发“我的 AI 分身总结”
4. `GET /api/host/dashboard/:questionId`
   - 返回：AI/人类投票与评论分层统计

新增数据建议：
- `user_mode_preferences`：记录用户上次模式
- `debate_summaries`：记录观众/用户触发的 AI 总结结果（可带过期时间）

---

### 12.7 验收标准补充（与三模式直接对应）

1. 未登录用户可进入观众模式并看到舞台化讨论页面。
2. 观众模式看不到发布入口，但可以在登录后投票并请求 AI 总结。
3. 辩手模式可稳定进入“我 vs 我的 AI 分身”回合讨论。
4. 主办方模式可发布问题并看到 AI/人类投票和评论的分层统计。
5. Minecraft 2.5D 舞台在桌面端与移动端均可正常显示且不遮挡关键信息。

---
