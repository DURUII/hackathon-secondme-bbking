# TECH2: BB King（AI版）现状审计与下一步落地方案

> 更新时间：2026-02-12  
> 基于当前仓库代码实测，不是概念 PRD

---

## 1. 现状结论（TL;DR）

项目已经完成了「可发布、可投票、可异步补票、可展示」的主链路，且可构建上线；  
但距离你要的「可视化辩论秀 + 立场摇摆 + 可复盘 + 被理解感」还有明显产品层差距。

---

## 2. 已完成（代码层）

### 2.1 登录与身份
- OAuth 登录/回调/落库/分身同步已完成
- 可稳定拿到 SecondMe 用户并映射本地 `User + Participant`

### 2.2 发布与投票
- 发帖后同步首票 + 异步 fanout 入队
- `vote_tasks` 队列、`votes` 唯一约束、重试退避都已完成
- 支持注册回填、浏览触发补单（QuestionViewed）

### 2.3 前端主流程
- 首页可发布问题、Feed 展示红蓝比例、展开查看观点
- 支持关注/取消关注、删除自己问题、生成分享图

### 2.4 SecondMe 能力接入
- 已有 `act/chat/note/tts` 的代理路由与鉴权透传

### 2.5 运行状态
- `npm run build`：通过
- `npm test`：未通过（主要是测试与现代码不同步）

---

## 3. 未完成（与你目标的核心差距）

### 3.1 “辩论秀体验”还没开始
- Feed API 虽查询了 `debateTurns`，但返回时置空，前端无法观战辩论过程
- 用户看到的仍是「投票结果卡片」，不是「辩论时间轴」

### 3.2 “立场摇摆”算法还不是业务逻辑
- `voteSwing` 当前是随机值，不是由内容说服力驱动
- 没有观众席的连续 stance 演化数据

### 3.3 状态机不统一
- `pending/collected` 与 `DEBATING_R* / CLOSED` 混用
- 前端类型仍主要按 `pending | collected`

### 3.4 关键互动缺失
- 没有「递纸条」
- 没有「回放拖拽」
- 没有「高光时刻」
- 没有「结案陈词（用户分身总结 + 回复模板）」

### 3.5 调度与实时性仍偏弱
- `vercel.json` cron 目前是每日一次（`0 0 * * *`）
- 虽有 heartbeat 补偿，但仍不够“辩论直播感”

### 3.6 体验细节
- 存在中英文混排（`All/Proposed/Subscribed/Follow`）
- 与“中文沉浸讨论场”定位不一致

---

## 4. 数据结构建议（v0.3）

在现有 `Question / DebateRole / DebateTurn / Vote / VoteTask` 基础上，补 4 类数据：

### 4.1 统一状态机（先做）
- `Question.status` 使用枚举：
  - `RECRUITING`
  - `DEBATING_R1`
  - `DEBATING_R2`
  - `DEBATING_R3`
  - `CLOSED`
- 新增字段：
  - `closedAt`
  - `finalSummary`

### 4.2 DebateEvent（新增）
- 统一沉淀“回放事件流”
- 用于时间轴、高光、复盘
- 建议字段：
  - `id, questionId, seq, round, eventType, payload(json), createdAt`

### 4.3 AudienceStanceSnapshot（新增）
- 记录每轮前后立场变化
- 建议字段：
  - `id, questionId, participantId, round, before, after, reason, createdAt`

### 4.4 UserNoteToDebate（新增）
- 支持“递纸条”影响下一轮发言
- 建议字段：
  - `id, questionId, userId, content, targetRound, consumedAt, createdAt`

---

## 5. UI/UX 建议（v0.3）

### 5.1 Feed 卡片（轻改）
- 增加阶段标签：`召集中 / 一辩 / 开杠 / 结辩 / 结案`
- 票条下加一句状态文案：`正在接收更多判词...`

### 5.2 详情页（重点）
- 三段式布局：
  1. 顶部：命题 + 阶段 + 当前比分
  2. 中部：辩论时间轴（按回合）
  3. 右/下：立场摇摆图（按轮次）

### 5.3 回合卡片信息
- 角色位：`正一/反二/观众/主持`
- 人格标签：`理性怪/情绪派/故事派`
- 是否魔鬼代言人：`被迫营业`标识

### 5.4 结案陈词页
- 输出 3 套可直接复制回复：
  - 温和版
  - 边界版
  - 强硬版
- 每条带“适用场景 + 风险提示”

---

## 6. 两周执行计划（建议）

### Week 1
1. 统一状态机与迁移
2. 新增 `DebateEvent` 与 `AudienceStanceSnapshot`
3. 改造 `/api/feed` 与详情接口，返回真实辩论流

### Week 2
1. 详情页时间轴与摇摆图
2. 递纸条 API + 下一轮 prompt 注入
3. 结案陈词生成与回复模板卡片
4. 修复测试（与当前代码一致）

---

## 7. 工程优先级（按风险）

1. **先统一状态机和接口返回**  
   不统一会导致前后端长期分叉，后续成本最高。

2. **再做“可见的辩论过程”**  
   这是用户感知价值最大的一步。

3. **最后做“结案陈词”**  
   这是分享传播和复访的关键点。

---

## 8. 当前阻塞与建议

### 8.1 测试失败（需清理）
- 组件文案改了，测试断言还在旧文案
- API mock 与实际实现不一致（如 `findFirst` / `findUnique`）

### 8.2 调度策略
- 建议把 cron 调高到 5~15 分钟级
- heartbeat 继续保留作补偿

### 8.3 国际化一致性
- 全面替换 Feed 英文标签，统一中文语境

---

## 9. 下一步可直接开工项（可并行）

1. Prisma migration：状态枚举 + `DebateEvent` + `AudienceStanceSnapshot` + `UserNoteToDebate`
2. `/api/feed` 返回真实 `debateTurns` 与事件摘要
3. 新增 `/api/question/[id]/timeline`（回放接口）
4. 前端详情页：时间轴 + 摇摆图 + 递纸条入口
5. 修复现有测试用例，使 CI 重新可用

