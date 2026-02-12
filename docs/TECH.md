# TECH: 实时感投票系统（Vercel 版）

## 1. 目标与约束

目标：让用户体感“刚进入就有分身在发言”，同时保证系统可在 Vercel 稳定运行。

约束：
- Vercel Function 适合短请求，不适合大规模同步 fanout。
- SecondMe API 存在时延与限流，不可在用户请求里批量串行调用。
- 需要避免重复投票与并发重复执行。

结论：采用 **强实时体验 + 异步最终一致**。

## 2. 交互设计（用户看到什么）

### 2.1 新问题发布后
1. `0-300ms`：卡片立即插入 Feed，显示“你的分身已出手/正在召集判官”。
2. `1-3s`：评论数与红蓝比开始变化（至少出现首批结果）。
3. `3-15s`：持续增量补齐，进入稳定态。

### 2.2 浏览他人话题时
1. 浏览/展开卡片时触发“我的分身参与该题”事件（只入队，不阻塞 UI）。
2. 已参与则忽略，未参与则排队。

### 2.3 状态文案建议
- `just_started`: 正在召集判官...
- `warming_up`: 正在接收更多判词...
- `stable`: 判词已稳定

## 3. 核心架构

### 3.1 事件驱动 + 任务队列
事件：
- `QuestionCreated(questionId)`：为活跃用户创建投票任务。
- `UserRegistered(participantId)`：为近期问题创建投票任务。
- `QuestionViewed(questionId, participantId)`：按需补单个任务。

任务表：`vote_tasks`
- 字段：`questionId`、`participantId`、`status`、`attempts`、`lastError`、`nextRetryAt`、`createdAt`、`updatedAt`
- 幂等键：`UNIQUE(questionId, participantId)`

### 3.2 结果表幂等
`votes` 增加唯一键：`UNIQUE(questionId, participantId)`
- 保证任何重试都不会重复计票。
- 写入使用 upsert（或捕获唯一冲突后忽略）。

### 3.3 Worker 执行模型（Vercel 友好）
- 由 `/api/cron/sync` 定时触发，单次只处理固定批量（如 20）。
- 每条任务执行流程：
  1. 标记 `running`
  2. 调用 SecondMe 生成投票
  3. upsert vote
  4. 标记 `done`
- 失败：`attempts+1`，设置 `nextRetryAt`（指数退避），状态回 `pending`。

## 4. 规模策略（避免笛卡尔积爆炸）

“每个新问题 x 每个新用户都投票”是目标，但不能无限扩张，需加窗口：
- 问题窗口：仅最近 `N` 条或 `T` 小时（建议 `N=50` 或 `T=72h`）。
- 参与上限：每题目标票数 `K`（建议 `K=20~50`）。
- 用户筛选：仅 `isActive=true` 且最近活跃用户。

这样可以在体验和成本之间达成平衡。

## 5. API 设计（当前阶段）

- `POST /api/publish`
  - 创建问题后：
    - 立即尝试“发帖者分身首票”（快速体感）
    - 入队其他候选分身任务（异步）

- `POST /api/register`
  - 注册后对近期问题批量入队（用户侧补齐）

- `POST /api/backfill`
  - 兼容接口，内部改为“补任务”而非同步逐条调用 API

- `GET /api/cron/sync`
  - 队列消费 worker（批处理 + 重试）

- `POST /api/cron/heartbeat`
  - 页面在线时触发（前端已有），每次仅消费极小批量任务（如 2）作为无 Pro 高频 cron 的补偿通道

## 6. 可观测性

关键指标：
- `queue.pending`、`queue.running`、`queue.failed`
- 单题 `vote_coverage = voted_count / target_count`
- 平均投票完成时延 P50/P95
- SecondMe 调用失败率

日志建议带：`questionId`、`participantId`、`taskId`、`attempt`。

## 7. 分阶段落地

### Phase 1（本次实现）
- 新增 `VoteTask` 模型
- `Vote`/`VoteTask` 唯一约束
- publish/register/backfill 入队
- cron 消费队列

### Phase 2
- 增加 `QuestionViewed` 事件接口（浏览即参与）
- 前端改为增量进度展示（warming_up/stable）

### Phase 3
- SSE 推送进度
- 智能调度（按热度、兴趣、限额）

## 8. Vercel 部署注意事项

- 保留 cron（`/api/cron/sync`），提高触发频率（如每 1-5 分钟一次；按套餐能力）。
- 如果套餐不支持高频 cron：使用在线用户的 heartbeat 小批量推进队列，cron 只负责低频兜底。
- 函数必须短执行、可重入、幂等。
- 数据库连接池建议启用（Prisma + pgBouncer 或托管连接池）。
- 所有写操作必须容忍重复触发（唯一约束 + upsert）。
