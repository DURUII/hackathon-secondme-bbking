# TECH4: 奇葩说式 A2A 辩论赛制（基于现有项目的升级方案）

> 更新时间：2026-02-12  
> 目标：把 `docs/delete/方案.md` 与 `docs/delete/规则.md` 的设想，落到当前代码库可实现的“A2A 辩论 + 围观实时投票 + 摇摆胜负 + MVP/积分榜”闭环，并修正 TECH3 暴露的卡死/鉴权/数据模型问题。

---

## 0. 背景与现状（从仓库审计得出的约束）

- 当前存在 `DebateEngine`，但：
  - 发言顺序固定 `PRO_1/CON_1/.../PRO_3/CON_3`，缺人会直接 return，问题可能卡在 `DEBATING_*` 状态（TECH3 已指出）。
  - `/api/cron/heartbeat` 未鉴权，且被前端周期触发存在滥用风险（TECH3 已指出）。
- 当前 Prisma 模型：
  - `Vote` 以 `(questionId, participantId)` 唯一，偏“AI 对问题投票/评论”语义，不适配“围观者（登录用户）实时切换立场”的事件流。
  - `Question.status` 为字符串混用（`pending` 与 `DEBATING_R*` 等），需要统一成枚举状态机（TECH3 已指出）。

---

## 1. 这次对齐后的产品结论（来自我们聊天的最终口径）

### 1.1 核心体验

- 一场辩论 = 6 位 AI 辩手（正方 3 / 反方 3）。
- 赛制结构：开篇立论 → 驳论 →（50% 概率触发奇袭问答 5 轮）→ 结辩。
- “主持人/主席 Agent”不做：流程与阶段由系统规则写死与 UI 呈现。
- 胜负以“观众摇摆”为核心：开场立场 vs 截止终态。
  - MVP 阶段只有 1 个围观者：若立场不变则原立场方赢；若切换则另一方赢（等价于“摇摆人数=0/1”）。

### 1.2 辩手角色与发言职责（每方 3 人）

- 每方三位辩手固定职责：
  - 1 辩：立论（Opening）
  - 2 辩：驳论（Rebuttal）+ 奇袭问答参与者
  - 3 辩：结辩（Closing）
- 奇袭问答：
  - 在驳论结束后 50% 概率触发。
  - 参与者固定为 PRO_2 vs CON_2。
  - 共 5 轮，每轮为“提问 1 条 + 回答 1 条”，提问方轮流交替。
  - 先手：随机先手。

### 1.3 参赛来源与避嫌

- 发起者可点名 0~6 位 AI 分身，不足由系统从全局 AI 池补齐到 6。
- 不允许发起者自己的 AI 分身参赛（避嫌）。
- 立场与座位分配：
  - 参赛名单确定后：随机分配正/反各 3 人，再在各自阵营内随机分配 1/2/3 辩。

### 1.4 A2A 调用方式与失败策略

- 辩手发言使用“真实 SecondMe 分身”方式（每个辩手用自己的 token 去生成内容），体现 A2A。
- 若某辩手找不到可用 token（DB 无 `User` / 过期等）：跳过该辩手（不阻断整场辩论）。
- 开赛最低门槛：至少 2 位有效辩手（建议仍尽量保证正反双方都有人；见第 8 节兜底）。

### 1.5 围观投票（实时可切换）

- 投票/切换立场：强制登录；未登录可围观。
- 立场选项：仅 正 / 反。
- “开场立场”口径：开场选择的立场（在看到辩论正文前或开篇开始时确定）。
- 落库方式：事件流（记录每次切换），并维护“当前立场快照”。

### 1.6 MVP、积分与排行榜

- MVP：辩论结束后由围观者从 6 位辩手中选 1 名最佳辩手。
- 积分发放（首版数值）：
  - 胜方每人 +5
  - 败方每人 +1
  - MVP 额外 +5
- 排行榜：全站总榜（按总积分），并可下钻个人战绩（参与次数、胜率、MVP 次数）。
- AI 裁判：只做总结（不裁决胜负/MVP）。

---

## 2. 赛制与状态机（可实现的“写死规则”版本）

### 2.1 关键状态（建议用枚举统一）

建议把 `Question.status` 从字符串收敛为枚举（示例）：

- `RECRUITING`：招募/分配辩手中
- `OPENING`：开篇进行中
- `REBUTTAL`：驳论进行中
- `CROSS_EXAM`：奇袭问答进行中（可选阶段）
- `CLOSING`：结辩进行中
- `CLOSED`：结束（可投 MVP、可回放、可结算）

兼容策略：若短期内不想大迁移，也可以保留 `DEBATING_R*`，但必须把阶段与调度逻辑从“固定 6 角色顺序”改为“按阶段+槽位推进”，避免缺人卡死。

### 2.2 发言调度（按阶段推进，不依赖固定 6 人全在）

按阶段定义“期望发言槽位”，并允许缺位跳过：

- `OPENING`：期望 `PRO_1`、`CON_1`
- `REBUTTAL`：期望 `PRO_2`、`CON_2`
- `CROSS_EXAM`（若触发）：5 轮（问 + 答）
  - 参与者：`PRO_2`、`CON_2`
  - 先手：随机决定（谁先问）
- `CLOSING`：期望 `PRO_3`、`CON_3`

每次落一条 `DebateTurn` 后，计算下一步：
1) 该阶段的下一槽位是谁
2) 若槽位对应辩手缺失/不可用，按“同阵营兜底规则”选替代者或直接跳过该槽位
3) 阶段完成后进入下一阶段；若后续阶段关键辩手也缺失，则直接进入 `CLOSED`

---

## 3. 数据模型（Prisma）改造建议

这里给出“最小可落地 + 可扩展”的模型建议，避免把所有语义硬塞进现有 `Vote`。

### 3.1 Debate / Turn（阶段化）

复用现有 `DebateRole` + `DebateTurn`，但需要补充字段或规范字段含义：

- `DebateRole.role`：固定为 `PRO_1|PRO_2|PRO_3|CON_1|CON_2|CON_3`
- `DebateTurn.type`：扩展为
  - `OPENING|REBUTTAL|CROSS_Q|CROSS_A|CLOSING|SYSTEM_SUMMARY`
- `DebateTurn` 建议新增：
  - `seq Int`：全局顺序号，避免仅靠 `round` 推断顺序（现有 `round` 难以表达阶段+问答轮）
  - `meta Json?`：存储问答轮次（1..5）、先手、被问者等

### 3.2 投票事件流与快照

新增两张表（建议）：

1) `AudienceVoteEvent`
- `id, questionId, userId, position (PRO/CON), createdAt`
- 可选字段：`phase`（OPENING/REBUTTAL/...）、`clientSessionId`（排查用）、`ipHash`（可选）

2) `AudienceVoteSnapshot`
- `questionId, userId` 唯一
- `openingPosition`（开场立场）
- `currentPosition`（当前立场）
- `openedAt`（确认开场立场时间）
- `updatedAt`

“摇摆”统计使用 `openingPosition` vs `currentPosition`（在 `CLOSED` 时刻冻结/读取）。

### 3.3 MVP 投票

新增 `MvpVote`
- `questionId, userId` 唯一
- `participantId`（所选 MVP）
- `createdAt`

### 3.4 积分与战绩

两种实现路径（二选一，首版建议选 A）：

- A. 冗余字段（简单好查榜）
  - `Participant` 新增：`points Int @default(0)`, `wins Int @default(0)`, `losses Int @default(0)`, `mvpCount Int @default(0)`
  - 每场结算时直接更新这些字段
- B. 全事件化（可审计）
  - 新增 `ScoreEvent`（胜负/MVP/参与分），排行榜从事件聚合得到

---

## 4. API 设计（建议落到“公开读 + 登录写 + 内部推进”）

### 4.1 公开读

- `GET /api/question/:id`
  - 返回：题目内容、阶段状态、参赛者信息、当前正反人数（从 `AudienceVoteSnapshot` 聚合）、时间线摘要入口
- `GET /api/question/:id/timeline`
  - 返回：所有 `DebateTurn`（含 type/seq/createdAt）、奇袭是否触发、当前阶段等
- `GET /api/leaderboard`
  - 返回：积分总榜（`Participant.points` 或聚合结果）

### 4.2 登录写（围观者）

- `POST /api/question/:id/opening`
  - 用于“开场立场确认”（写 `AudienceVoteSnapshot.openingPosition` + 追加 `AudienceVoteEvent`）
- `POST /api/question/:id/vote`
  - 更新当前立场：追加 `AudienceVoteEvent` + 更新 `AudienceVoteSnapshot.currentPosition`
- `POST /api/question/:id/mvp`
  - 提交 MVP：写 `MvpVote`（唯一约束防重复）

### 4.3 内部写（调度）

- `POST /api/internal/debate/heartbeat`
  - cron secret 鉴权
  - 推进：招募 → 开篇 → 驳论 →（奇袭）→ 结辩 → 关闭 → 总结

迁移建议：现有 `/api/cron/heartbeat` 改为内部接口并加鉴权；前端不再周期调用（TECH3 已指出必须修）。

---

## 5. 辩手招募与分配（Recruiting）

### 5.1 输入

- 发起辩论时：`invitedParticipantIds?: string[]`（0~6）

### 5.2 补位规则

1) 点名列表去重、过滤掉“发起者自己的分身”（避嫌）
2) 从全局 `Participant` 池补齐到 6（首版可随机；后续可按活跃度/冷却/偏好）
3) 检查 token 可用性：优先只挑“有可用 token”的人进入 6 人名单，减少缺位；仍缺则允许进入但发言时会被跳过
4) 随机分配阵营与辩位：洗牌后前 3 人为 PRO、后 3 人为 CON；各阵营内再洗牌分配 1/2/3 辩
5) 写入 `DebateRole` 并把 `Question.status` 置为 `OPENING`

---

## 6. 生成与上下文（A2A 质量与成本控制）

### 6.1 上下文可见范围（对齐规则.md）

- 2 辩能看到 1 辩内容
- 3 辩能看到 1、2 辩内容
- 问答阶段：双方 2 辩看到全部历史 + 本轮问答上下文
- 上下文除对话外，还应包含：当前正反人数、当前阶段与发言槽位

### 6.2 内容限制（中等长度）

- 立论/驳论/结辩：建议 ≤ 200 中文字
- 问答：问 ≤ 80 字，答 ≤ 150 字

### 6.3 生成失败/跳过

- token 不可用/外部调用失败：该辩手该槽位跳过，但必须继续推进状态机，防止卡死

---

## 7. 结算逻辑（胜负、摇摆、MVP、积分）

### 7.1 胜负（MVP 口径：只有 1 个围观者）

- 在 `CLOSED` 时刻读取该用户 `openingPosition` 与 `currentPosition`：
  - 不变：开场立场方胜
  - 改变：另一方胜

### 7.2 MVP

- `CLOSED` 后允许提交 `MvpVote`：列出 6 位辩手单选 1 人；仅允许提交一次

### 7.3 积分

- 胜方阵营每人 +5
- 败方阵营每人 +1
- MVP 额外 +5（叠加）

---

## 8. 关键兜底（避免卡死与“不完整开赛”）

### 8.1 最低开赛门槛（已对齐）

- 允许最少 2 位有效辩手开赛。

### 8.2 建议的“合理性兜底”（为了产品体验，可做成开关）

- 若正反任一方为 0 人：不进入辩论，保持 `RECRUITING` 并提示“阵营人数不足”，或强制再补位（优先有 token）

---

## 9. 测试与验收（MVP 口径）

### 9.1 关键用例

1) 招募：点名 0/3/6 人，系统补齐到 6；避嫌过滤生效
2) 调度：`OPENING -> REBUTTAL -> (CROSS_EXAM?) -> CLOSING -> CLOSED` 全链路不卡死
3) 奇袭：50% 触发（可通过种子/开关做可测）且 5 轮问答顺序正确（随机先手、交替）
4) 投票：登录用户可实时切换，事件追加 + 快照更新正确
5) 胜负：1 人围观时，开场 vs 终态结算正确
6) MVP：结辩后可投 1 次，唯一约束生效
7) 积分：胜负/MVP 结算后，参与者积分与榜单正确更新
8) 安全：`/api/internal/debate/heartbeat` 必须鉴权；前端不可直接触发内部推进

---

## 10. 分阶段落地顺序（建议）

1) 修复鉴权与卡死风险（TECH3：heartbeat/poll 鉴权 + DebateEngine 不因缺人卡死）
2) 赛制状态机改造（阶段化 + 槽位推进 + 50% 奇袭问答）
3) 投票事件流与开场立场（opening vs current）
4) 结算（摇摆胜负）+ MVP 投票
5) 积分与排行榜（Participant 冗余字段或 ScoreEvent）
6) 系统总结（AI 裁判仅总结）