# PRD: 帮我评评理 - AI分身辩论广场

> **产品定位**: SecondMe官方插件/广场，让用户的AI分身参与"众议院"式辩论
> **MVP目标**: 用户发问题 -> 多个AI分身投票+一句话评论 -> 生成可分享的"判决书"截图
> **核心价值**: 解决"社交失语症"，用AI分身的多元视角给用户"爽感"建议
> **当前版本**: v0.1 | **创建日期**: 2026-02-11

---

## 一、问题与机会

### 1.1 市场痛点
- **社交失语症**: 遇到尴尬社交场景，不知道怎么回复
- **精神内耗**: 发完消息反复揣测对方意思
- **决策纠结**: 两个选择反复权衡，浪费情绪

### 1.2 为什么是现在
- SecondMe已经提供了OAuth2、用户画像、流式对话、TTS能力
- SecondMe的"AI分身"概念天然适合做多元视角辩论
- ChatGPT们太"正确"太"统一"，没有"偏见"反而是痛点

---

## 二、产品设计

### 2.1 核心交互 (MVP)

```
用户: 点击"发布问题" -> 输入/语音/截图 -> 选择"场"(毒舌/安慰/理性)
系统: 广播给N个在线分身 -> 收集投票+一句话评论 -> 生成判决书
用户: 看到红蓝进度条 + TOP 3金句 -> 截图分享
```

### 2.2 用户故事

| 场景 | 用户行为 | 系统反馈 |
|-----|---------|---------|
| 相亲AA | "相亲男让我AA这杯30块的咖啡" | 红方70%: 转给他别纠缠 / 蓝方30%: 不转骂回去 |
| 老板加班 | "老板半夜让我加班" | 生成"判决书" + 最损回复金句 |
| 婆媳矛盾 | "我妈要给我的真皮沙发盖丑沙发套" | 各代际AI分身的不同观点 |

### 2.3 传播杠杆

**MVP阶段: 截图分享**
- 生成一张视觉冲击力强的"判决书"卡片
- 包含: 红蓝进度条 + TOP金句 + "帮我评评理"Logo
- 引导语: "这事儿AI们怎么看？"

---

## 三、技术架构

### 3.1 复用现有能力

| 现有能力 | 用途 |
|---------|------|
| OAuth2登录 | 用户身份 |
| `/user/info` | 获取用户基础信息 |
| `/chat/stream` | 让分身生成评论(核心调用) |
| `/tts/generate` | 后期语音生成 |

### 3.2 新增模块

```
src/
├── app/
│   └── api/
│       └── side/                    # 新增API
│           ├── publish/route.ts     # 发布问题
│           ├── poll/route.ts        # 收集投票(实时调用)
│           └── result/route.ts      # 生成判决书
├── components/
│   ├── QuestionInput.tsx            # 问题输入组件
│   ├── ArenaDisplay.tsx             # 红蓝对抗显示
│   └── JudgmentCard.tsx            # 判决书卡片
└── lib/
    └── participant-manager.ts      # 参与者管理
```

### 3.3 架构说明

> **MVP策略**: 采用**实时调用**方案 - 用户发问题时，后台实时调用其他用户的SecondMe对话接口收集投票。
>
> **后期扩展**: 可参考 voxyz-tutorial的AI公司设计模式，实现观察者引擎让AI分身主动参与。

---

## 四、数据模型 (MVP阶段)

### 4.1 问题表 (Questions)

```prisma
model Question {
  id          String   @id @default(cuid())
  content     String   // 问题内容
  imageUrl    String?  // 截图URL
  arenaType   String   // 场: toxic/comfort/rational
  status      String   // pending/collected/closed
  createdAt   DateTime @default(now())

  votes       Vote[]
  @@map("questions")
}
```

### 4.2 投票表 (Votes)

```prisma
model Vote {
  id            String   @id @default(cuid())
  questionId    String
  participantId  String   // 参与者ID
  position      Int      // 1=红方, -1=蓝方
  comment       String   // 一句话评论
  createdAt     DateTime @default(now())
  @@map("votes")
}
```

### 4.3 参与者表 (Participants)

```prisma
model Participant {
  id          String   @id @default(cuid())
  secondmeId  String   @unique  // 关联SecondMe用户ID
  name        String
  avatarUrl   String?
  interests   String[] // 兴趣标签
  isActive    Boolean  @default(true)
  responseCount Int    @default(0)
  lastActiveAt DateTime
  @@map("participants")
}
```

---

## 五、验收标准 (MVP)

### 5.1 功能验收

- [ ] 用户可以OAuth登录
- [ ] 用户可以发布一个问题(文字/语音/截图)
- [ ] 用户可以选择"场"(毒舌/安慰/理性)
- [ ] 系统返回投票结果(红/蓝比例)
- [ ] 系统返回TOP 3金句评论
- [ ] 生成可截图的"判决书"卡片

### 5.2 体验验收

- [ ] 问题发布后3秒内返回结果
- [ ] 投票结果有清晰的视觉呈现
- [ ] 金句有吸引力(用户愿意截图)

---

## 六、Roadmap

### Phase 1: MVP (1-2周)
- [ ] OAuth2集成 (复用)
- [ ] 问题发布 + 投票 + 评论
- [ ] 判决书截图卡片
- [ ] 基础UI

---

## 七、测试用例清单

### Unit Tests

#### API层

| 文件 | 测试项 | 测试内容 |
|-----|--------|---------|
| `__tests__/api/side/publish.test.ts` | `POST /api/side/publish` | 问题发布、参数验证、数据库写入 |
| `__tests__/api/side/poll.test.ts` | `POST /api/side/poll` | 收集投票、SecondMe调用、结果聚合 |
| `__tests__/api/side/result.test.ts` | `GET /api/side/result` | 结果查询、TOP金句筛选 |

#### Component层

| 文件 | 测试项 | 测试内容 |
|-----|--------|---------|
| `__tests__/components/QuestionInput.test.tsx` | `QuestionInput` | 输入验证、提交按钮、加载状态 |
| `__tests__/components/ArenaDisplay.test.tsx` | `ArenaDisplay` | 红蓝进度条渲染、动态更新 |
| `__tests__/components/JudgmentCard.test.tsx` | `JudgmentCard` | 卡片渲染、截图导出、分享按钮 |

#### Lib层

| 文件 | 测试项 | 测试内容 |
|-----|--------|---------|
| `__tests__/lib/participant-manager.test.ts` | `ParticipantManager` | 参与者查询、资格验证 |

### Integration Tests

| 文件 | 测试场景 |
|-----|---------|
| `__tests__/integration/publish-flow.test.ts` | 完整流程: 发布 -> 等待投票 -> 查看结果 |
| `__tests__/integration/oauth-flow.test.ts` | OAuth2 登录流程 |
| `__tests__/integration/secondme-api.test.ts` | SecondMe API 代理调用 |

### UI Tests (手动)

| 编号 | 测试项 | 验收标准 |
|-----|--------|---------|
| UI-01 | 问题发布页 | 输入框可正常输入，语音按钮可点击 |
| UI-02 | 场选择器 | 三个场(毒舌/安慰/理性)可切换 |
| UI-03 | 加载动画 | 发布后有加载反馈，3秒内完成 |
| UI-04 | 投票结果显示 | 红蓝进度条清晰，TOP金句有吸引力 |
| UI-05 | 判决书卡片 | 可正常截图，文字清晰 |
| UI-06 | 移动端适配 | 在iPhone/Android上显示正常 |

---

## 八、TODO清单

### Phase 1: 基础设施

- [ ] **TASK-001**: Add Prisma model: Participant, Vote, Question
- [ ] **TASK-002**: Create `participant-manager.ts` lib
- [ ] **TASK-003**: Run database migration

### Phase 2: API层

- [ ] **TASK-004**: Create `POST /api/side/publish`
- [ ] **TASK-005**: Create `POST /api/side/poll`
- [ ] **TASK-006**: Create `GET /api/side/result`

### Phase 3: 组件层

- [ ] **TASK-007**: Create `QuestionInput.tsx`
- [ ] **TASK-008**: Create `ArenaDisplay.tsx`
- [ ] **TASK-009**: Create `JudgmentCard.tsx`

### Phase 4: 集成

- [ ] **TASK-010**: Integrate into homepage
- [ ] **TASK-011**: Add unit tests for all new code
- [ ] **TASK-012**: Add integration tests
- [ ] **TASK-013**: UI Testing Session

---

## 九、待讨论项

- [ ] 分身"兴趣匹配"算法
- [ ] 投票的有效性验证
- [ ] 用户激励方案

---

*文档版本: v0.1 | 最后更新: 2026-02-11*
