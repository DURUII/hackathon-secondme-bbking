# TECH4: 奇葩说式 A2A 辩论赛制（多场次 Session 化升级方案）

> 更新时间：2026-02-12  
> 目标：把“奇葩说式辩论 + 观众实时投票 + 摇摆胜负”落到当前代码库可实现的闭环，并修正 TECH3 暴露的卡死/鉴权/数据模型问题。  
> 本版新增关键前提：**同一 Question 下可以有多场辩论（DebateSession），但同一用户对同一 Question 只能发起一次；辩论与投票全站可见，展示为“xx 发起了辩论”。**

---

## 0. 背景与现状（从仓库审计得出的约束）

- 当前存在 `DebateEngine`，但：
  - 发言顺序固定 `PRO_1/CON_1/.../PRO_3/CON_3`，缺人会直接 return，可能卡死在 `DEBATING_*`（TECH3 已指出）。
  - `/api/cron/heartbeat` 未鉴权，且被前端周期触发存在滥用风险（TECH3 已指出）。
- 当前 Prisma 模型：
  - `DebateRole/DebateTurn` 直接挂在 `Question` 上，天然只能表示“每题一场辩论”，与“同题多场辩论”冲突。
  - `Vote` 以 `(questionId, participantId)` 唯一，语义更偏“分身对题的观点评论”；不适合承载“观众对某一场辩论 Session 的实时切换投票”。
  - `Question.status` 当前混用 `pending/collected/DEBATING_*`，在“同题多场 Session”后更不应承担辩论进度。

---

## 1. 产品结论（最终口径）

### 1.1 核心体验

- 一场辩论 = 1 个 `DebateSession`（隶属于某个 `Question`），由某个登录用户发起（initiator）。
- 约束：
  - 同一 `Question` 下可以存在多场 `DebateSession`（不同 initiator）。
  - 同一用户对同一 `Question` **最多发起 1 次**（DB 唯一约束保证）。
- 赛制结构（写死规则）：
  - 开篇立论（Opening）→ 驳论（Rebuttal）→（50% 概率触发奇袭问答 5 轮）→ 结辩（Closing）→ 结束（Closed）
- 辩论全站可见：列表/详情页展示“xx 发起了辩论”，并可查看时间线与投票走势。

### 1.2 辩手席位（6 人）

- 每场固定 6 个席位：正方 3 / 反方 3。
- 职责固定：
  - 1 辩：Opening
  - 2 辩：Rebuttal + Cross-Exam（奇袭问答参与者）
  - 3 辩：Closing
- 发起者自己的 AI 分身 **不参赛**（避免“自问自答”的观感与偏置）。

### 1.3 参赛来源与“克隆补位”

- 参赛来源仅限：**已登录注册的用户分身**（即 DB 存在 `User` token 的真实 SecondMe 身份）。
- 若“可用的独立参赛者人数不足 6”，允许从**其他用户分身**进行“克隆补位”：
  - 克隆补位的含义：同一个 `Participant` 可以在同一场 `DebateSession` 中占用多个席位（同 token，不同席位 persona / role prompt）。
  - 这要求数据模型以“席位（seat）唯一”为核心，而不是“participant 在 question 内唯一”。

### 1.4 围观投票（实时可切换，按 Session）

- 投票对象是 `DebateSession`（不是 Question）。
- 投票/切换立场：强制登录；未登录可围观。
- 立场选项：仅 正 / 反。
- “开场立场 openingPosition”：
  - 用户对该 session 的**第一次投票**即确认为 openingPosition，同时也是 currentPosition。
  - 之后每次切换仅更新 currentPosition，并记录事件流。

### 1.5 胜负（摇摆胜负）

- 以“观众摇摆”作为胜负依据：对每个投票用户比较 `openingPosition` 与 `finalPosition`（结束时刻的 currentPosition）。
- 结算口径（建议默认）：
  - 仅统计“投过 openingPosition 的用户”。
  - 计算 `netSwing = finalProCount - openingProCount`（等价于“正方净增票数”）。
  - `netSwing > 0`：正方胜；`netSwing < 0`：反方胜；`netSwing = 0`：平局（或用“最终多数”做 tie-break，可作为开关）。

---

## 2. Session 化状态机（关键改动点）

### 2.1 状态归属

- `Question.status` 不再承载辩论进度（同题多 Session 无法用单字段表达）。
- 新增 `DebateSession.status`（枚举或受控字符串）：
  - `RECRUITING`
  - `OPENING`
  - `REBUTTAL`
  - `CROSS_EXAM`（可选阶段）
  - `CLOSING`
  - `CLOSED`
  - `ABORTED`（长期无进展/手动终止，可选）

### 2.2 发言调度（按阶段 + 槽位推进，允许跳过）

按阶段定义“期望槽位”：
- `OPENING`：`PRO_1` → `CON_1`
- `REBUTTAL`：`PRO_2` → `CON_2`
- `CROSS_EXAM`（若触发）：5 轮，每轮 `Q` + `A`，参与者固定 `PRO_2` vs `CON_2`，先手随机并持久化，之后交替
- `CLOSING`：`PRO_3` → `CON_3`

生成失败策略（防卡死）：
- token 不可用 / 上游失败：该槽位写入一条 `DebateTurn` 的“SKIPPED/ERROR”占位（或直接跳过，但必须推进 seq/nextTurnAt），保证状态机前进。

### 2.3 随机性的持久化（可测开关）

- 奇袭是否触发（50%）与先手选择必须写库（否则多次推进会出现“同一场有时触发有时不触发”）。
- 建议字段：
  - `DebateSession.crossExamEnabled boolean`
  - `DebateSession.crossExamFirstSide enum(PRO|CON)`
- 同时提供配置开关（便于验收测试）：
  - `CROSS_EXAM_FORCE=on|off|random`

---

## 3. Prisma 数据模型（最小可落地 + 可扩展）

核心思路：新增 `DebateSession`，并把“角色/回合/投票”全部从 `Question` 迁移到“按 Session 归属”。

### 3.1 DebateSession（同题多场）

建议新增表：`DebateSession`
- `id`
- `questionId`
- `initiatorUserId`
- `status`
- `nextTurnAt`
- `seq`（下一条 turn 的全局序号）
- `crossExamEnabled`, `crossExamFirstSide`
- `createdAt`, `closedAt`, `abortedAt`

唯一约束：
- `@@unique([questionId, initiatorUserId])`（同一用户对同一题只能发起一次）

### 3.2 席位表（Seat 唯一，允许克隆）

用“席位唯一”替代当前 `DebateRole` 的“participant 唯一”约束。

建议新增表：`DebateSeat`
- `id`
- `sessionId`
- `seat`：`PRO_1|PRO_2|PRO_3|CON_1|CON_2|CON_3`
- `participantId`（允许重复出现，实现克隆补位）
- 可选：`seedPersona` / `styleHints`（用于 prompt 差异化）

唯一约束：
- `@@unique([sessionId, seat])`

### 3.3 DebateTurn（时间线）

建议让 `DebateTurn` 归属 session，并强化可排序：
- `sessionId`
- `seq Int`（全局序号）
- `type`：`OPENING|REBUTTAL|CROSS_Q|CROSS_A|CLOSING|SYSTEM_SUMMARY|SKIPPED|ERROR`
- `speakerSeat`（如 `PRO_2`）
- `speakerParticipantId`
- `content Text`
- `meta Json?`（问答轮次、先手、异常信息等）

唯一约束：
- `@@unique([sessionId, seq])`

### 3.4 观众投票（事件流 + 快照，按 Session）

1) `AudienceVoteEvent`
- `id, sessionId, userId, position(PRO/CON), createdAt`
- 可选：`phase`, `clientSessionId`, `ipHash`

2) `AudienceVoteSnapshot`
- `@@unique([sessionId, userId])`
- `openingPosition`
- `currentPosition`
- `openedAt`, `updatedAt`

### 3.5 MVP（可选，按 Session）

`MvpVote`
- `@@unique([sessionId, userId])`
- `pickedSeat` 或 `pickedParticipantId`

### 3.6 积分榜（可选）

- 首版建议用事件化 `ScoreEvent`，避免重复结算与幂等困难；
- 或 Participant 冗余字段也可，但必须有“session 结算幂等”标记（如 `DebateSession.settledAt` + `winnerSide`）。

---

## 4. API 设计（公开读 + 登录写 + 内部推进）

### 4.1 公开读

- `GET /api/question/:id/sessions`
  - 返回：该题下的 session 列表（initiator、status、createdAt、当前投票统计、是否已结束、winner）
- `GET /api/session/:id`
  - 返回：session 基本信息 + 6 席位 + 当前阶段 + 投票统计
- `GET /api/session/:id/timeline`
  - 返回：所有 `DebateTurn`（按 seq 升序）

### 4.2 登录写（发起/投票）

- `POST /api/question/:id/session`
  - 发起 session（服务端 enforce：同题同用户仅一次；并完成 RECRUITING/分配席位）
- `POST /api/session/:id/opening`
  - 写 `openingPosition`（若已有 openingPosition 则幂等或直接报错，二选一）
- `POST /api/session/:id/vote`
  - 追加 `AudienceVoteEvent` + 更新 `AudienceVoteSnapshot.currentPosition`
- `POST /api/session/:id/mvp`（可选）

### 4.3 内部推进（鉴权）

- `POST /api/internal/debate/heartbeat`
  - cron secret 鉴权
  - 推进：扫描 `DebateSession`（`status != CLOSED` 且 `nextTurnAt <= now`），逐条推进发言槽位并写 turn

迁移建议：
- 移除前端对 `/api/cron/heartbeat` 的周期触发；只保留 Vercel Cron / server-side 定时推进（且必须鉴权）。

---

## 5. 招募与席位分配（Recruiting）

输入：
- `questionId`
- `initiatorUserId`

规则：
1) 候选池 = `Participant` 中“可用 token”的用户分身（DB 中存在对应 `User` accessToken），并排除 initiator 自己的 `Participant`
2) 若候选池为空：拒绝开赛或保持 `RECRUITING`（产品需给出明确提示）
3) 席位填充：
   - 先从候选池随机抽取（不重复）直到耗尽或席位填满
   - 不足席位时，允许“带放回抽样”（即克隆补位：重复使用候选 participant 填满 6 个席位）
4) 阵营与席位分配：
   - 先决定 6 个 seat（固定集合），再对 seat 列表洗牌并逐个填入 participantId
5) 创建 `DebateSession` + `DebateSeat[]`，并置 `status=OPENING`，`nextTurnAt=now`

---

## 6. 生成与上下文（A2A 质量与成本控制）

上下文可见范围（建议）：
- 2 辩能看到 1 辩内容
- 3 辩能看到 1、2 辩内容
- 问答阶段：双方 2 辩看到全部历史 + 本轮问答上下文
- 同时可注入“当前投票走势摘要”（可选，避免引导过强）

内容限制（建议）：
- Opening/Rebuttal/Closing：≤ 200 中文字
- 问答：问 ≤ 80 字，答 ≤ 150 字

失败策略：
- 上游调用失败：写 `ERROR` turn（content 为简短占位 + meta 记录错误），并继续推进下一槽位，防卡死。

---

## 7. 结算逻辑（胜负、摇摆、MVP/积分可选）

### 7.1 胜负（摇摆）

在 `DebateSession.status=CLOSED` 时刻结算：
- 读取所有 `AudienceVoteSnapshot`（仅统计 `openingPosition != null` 的用户）
- 计算 opening 与 final 的正方人数，得到 `netSwing`
- 写入 `DebateSession.winnerSide`（`PRO|CON|DRAW`）

### 7.2 MVP（可选）

- 仅在 `CLOSED` 后允许提交
- `@@unique([sessionId, userId])` 防重复

### 7.3 积分（可选）

如启用积分：
- 胜方席位 participant +5，败方 +1
- MVP 额外 +5
- 必须保证结算幂等（`settledAt` 或 `ScoreEvent`）

---

## 8. 关键兜底（避免卡死与不完整开赛）

- 最低开赛门槛（建议）：候选池至少 1 人（允许全程克隆补位），但更推荐至少 2 人避免“单人自辩”观感。
- 若正反任一方在分配后全部为同一 participant（极端克隆）：允许，但可加开关禁止（产品体验开关）。

---

## 9. 安全与可运营

- 内部推进接口必须鉴权（cron secret）。
- 投票接口必须登录鉴权。
- 需要基础限流（同一用户对同一 session 的投票切换频率限制，防刷）。

---

## 10. 分阶段落地顺序（建议）

1) Session 数据模型落地（DebateSession/Seat/Turn/VoteSnapshot），并迁移现有 DebateEngine 逻辑到“按 session 推进”
2) 彻底移除前端触发 `/api/cron/heartbeat`，改为内部 cron + secret
3) 赛制状态机阶段化（Opening/Rebuttal/CrossExam/Closing），并持久化随机性 + 可测开关
4) 观众投票（opening vs current，实时切换）+ 胜负结算（netSwing）
5) MVP/积分榜（可选）

## 11. 测试与验收（MVP 口径）

1) 同题多场：同一 `Question` 下不同用户均可创建 `DebateSession`
2) 唯一约束：同一用户对同一 `Question` 只能创建 1 场（`@@unique([questionId, initiatorUserId])` 生效）
3) 招募：发起者分身不参赛；候选不足时可克隆补位且席位唯一约束生效（`@@unique([sessionId, seat])`）
4) 调度：`OPENING -> REBUTTAL -> (CROSS_EXAM?) -> CLOSING -> CLOSED` 全链路不卡死（失败写 `ERROR/SKIPPED` 也要推进）
5) 奇袭：`CROSS_EXAM_FORCE=on|off|random` 行为可控，先手与是否触发可重放一致
6) 投票：登录用户开场投票写 openingPosition，后续切换只更新 currentPosition；事件流追加正确
7) 胜负：`netSwing` 结算正确，`winnerSide` 写入 session；并验证平局口径
8) 安全：内部 heartbeat 必须鉴权；投票必须登录；有基础限流
