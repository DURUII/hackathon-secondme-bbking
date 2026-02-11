# Unsaid Design System

> "视觉极简 ≠ 设计简单"

本文档定义了 Unsaid 的设计语言：**现代人文极简主义 (Modern Humanist Minimalism)**。
这套风格像瑞典的房子——不堆砌、不炫技，处处是平衡。

## 1. 核心视觉 (Visual Core)

### 1.1 色彩体系 (Color Palette)
一共三种主色：**白、黑、灰**。
- **特征**：没有任何跳色、没有重阴影、没有渐变。看起来非常“安静”。
- **色板 (Tailwind)**：
  - 背景：`bg-stone-50` (暖灰，纸张感) / `bg-white`
  - 文字：`text-stone-900` (黑，主内容) / `text-stone-500` (灰，次要信息) / `text-stone-300` (极淡，占位符)
  - 强调：`bg-stone-900` (主按钮)

### 1.2 排版 (Typography)
- **字体**：系统默认 Sans-serif (SF Pro / Inter)。
- **排版原则**：
  - **看不腻**：舒适的行距，合理的留白。
  - **层级区分**：
    - **标题**：`font-light tracking-tight` (细字体 + 紧凑字间距，显得优雅)。
    - **标签/微文案**：`text-xs uppercase tracking-widest` (全大写 + 宽字间距，增加仪式感)。
  - **大圆角**：`rounded-3xl` (卡片), `rounded-2xl` (按钮)。

### 1.3 插画与头像 (Illustrations & Avatars)
- **风格**：[DiceBear Notionists](https://www.dicebear.com/styles/notionists/)
- **特征**：黑白线稿风格，极简、略带手绘感，与界面的“人文感”完美融合。
- **用途**：用户头像、空状态占位。

## 2. 细节与交互 (Details & Interaction)

> "不显山不露水，但处处是雕琢。"

### 2.1 "消失边缘"的设计
动效、线条、图标都在“消失边缘”：
- **图标**：超简化的圆角线条风格 (Lucide)。
- **Tab 标签**：浅灰边框 (`border-stone-100`)，不强行吸睛。
- **按钮**：做成“泡泡”状，既有存在感但不突兀。
- **分割线**：能不用则不用，用留白代替分割。

### 2.2 动效语言 (Motion Language)
> "动效不是装饰，而是物理规则的延伸。"

- **物理质感**：
  - **Spring (弹簧)**：标准配置 `stiffness: 100, damping: 20`。用于所有位移和显现，模拟真实的物体惯性，拒绝机械的匀速运动。
  - **Stagger (交错)**：列表元素进场必须带 `0.1s` 的交错延迟，减少信息轰炸的压迫感。
- **转场隐喻**：
  - **进门/出门**：页面切换采用 `Scale (0.98 -> 1)` + `Blur (10px -> 0)` + `Opacity`。
  - **隐喻**：模拟视线聚焦的过程，或者穿过一道门的物理空间感。
- **微交互 (Micro-interactions)**：
  - **"有生命"的图标**：图标不仅是标记，更是氛围的一部分。
    - *猫*：悬停时慵懒摇摆 (Wiggle)。
    - *播客*：悬停时声波律动 (ScaleX)。
    - *茶*：悬停时热气上浮 (Float)。
  - **智能加载**：图片/头像加载必须使用 **Blur-up** (模糊渐变清晰) 和 **Skeleton Pulse** (骨架屏呼吸)，杜绝生硬的白屏闪烁。

## 3. 信息架构 (Information Architecture)

> "设计得漂亮不够，还要好用。"

### 3.1 极简层级
- **原则**：一个页面只做一件事。
- **结构示例**：
  - **顶部**：欢迎词 / 状态指示。
  - **中间**：卡片式核心内容 / 对话流。
  - **底部**：轻量导航 / 设置入口。

### 3.2 阅读/对话页体验
- **核心**：内容是主角，设计退后一步。
- **元素**：
  - 作者/角色 + 场景氛围。
  - 插画 (Notionists 风格)。
  - 正文 (舒缓的节奏)。
  - 分享 (克制的入口)。
- **无干扰**：没有繁杂的功能，不出现广告或无关推荐。

## 4. 适用性
这种克制的留白方式特别适合：
- **情感/阅读类 App** (Unsaid)：提供安全感和沉浸感。
- **To B 效率工具**：传达专业、干净、有体系。

---

## 5. UI 组件库映射 (Tailwind)

| 组件 | 样式类 (Utility Classes) | 备注 |
|------|--------------------------|------|
| **卡片容器** | `bg-white rounded-3xl shadow-sm border border-stone-100 p-8` | 核心容器 |
| **主按钮** | `bg-stone-900 text-white rounded-2xl hover:bg-black transition-all active:scale-95` | 克制按压感 |
| **次要按钮** | `bg-white border border-stone-100 text-stone-600 rounded-2xl hover:border-stone-300` | 消失边缘 |
| **输入框** | `bg-stone-50 rounded-xl px-4 py-3 border-transparent focus:bg-white focus:ring-2 focus:ring-stone-200` | 默认无框 |
| **微标签** | `text-[10px] uppercase tracking-widest opacity-50` | 杂志感 |