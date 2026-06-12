# ColdRead 前端页面 Spec

> 设计系统：Modular Bento Showcase
> 配色：Onyx Peach（暗色背景 + 桃色强调）
> 字体：Inter（标题）/ Geist（正文）/ Funnel Sans（标注）

---

## 1. 路由结构

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | 主页（决策列表） | 默认页，展示历史决策 + 新建入口 |
| `/new` | 新建决策 | 输入话题，触发 pipeline |
| `/decision/:id` | 决策详情 | timeline + 推荐 + 批准 |
| `/decision/:id/audit` | 审计详情 | hash 明细 + 链上锚定信息 |

一个页面一个组件，不需要 layout 嵌套，MVP 简单点。

---

## 2. 页面一：主页（决策列表）

### 布局

```
┌──────────────────────────────────────────────┐
│  🏠 ColdRead                      ⚡ 新建分析 │ ← header
├──────────────────────────────────────────────┤
│                                              │
│  📋 最近的决策审计                            │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 💰 美联储7月降息？          BUY_YES    │  │
│  │ 📅 今天 18:30 · ✅ 已批准 · 🔗 已锚定  │  │
│  │ 信心: 高｜风险: 低｜金额: $5 USDC      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 🛡️ ETH ETF 通过？             HOLD     │  │
│  │ 📅 昨天 14:20 · ⛔ 被 veto             │  │
│  │ 原因: 弱收敛 · 外部风险高              │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 💰 BTC减半后走势           BUY_YES    │  │
│  │ 📅 6/10 · ⏳ 待批准 · 🎯 $5 USDC     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│                   [ 加载更多 → ]              │
└──────────────────────────────────────────────┘
```

### 数据来源

```ts
// 每个卡片渲染需要的数据
type DecisionCard = {
  id: string;
  topicText: string;
  action: "BUY_YES_SMALL" | "BUY_NO_SMALL" | "HOLD";
  createdAt: string;
  status: "pending_approval" | "approved" | "vetoed" | "anchored";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  stakeAmount?: string;
  vetoReason?: string;
}

// API: getDecisionList() → DecisionCard[]
// 数据从 localStorage 或后端 JSON 读取
```

### 交互

- 点击卡片 → 跳 `/decision/:id`
- 右上角「新建分析」→ 跳 `/new`
- 空状态：展示 onboarding 引导「输入你的第一个话题→」

---

## 3. 页面二：新建决策

### 布局

```
┌──────────────────────────────────────────────┐
│  ← 返回            新建决策分析              │
├──────────────────────────────────────────────┤
│                                              │
│  你想分析什么话题？                           │
│  ┌──────────────────────────────────────┐    │
│  │ 美联储7月会降息吗？                  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [ 🚀 开始分析 ]                             │
│                                              │
│  (点击后进入加载状态)                         │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  ⏳ 正在分析...                        │  │
│  │  ✓ 获取 Polymarket 盘口               │  │
│  │  ✓ 筛选候选盘口                       │  │
│  │  ✓ Tavily 背景确认                    │  │
│  │  ✓ 证据快照生成                       │  │
│  │  ✓ 市场结构透镜分析                   │  │
│  │  ✓ 外部风险透镜分析                   │  │
│  │  ✓ 评分决策                           │  │
│  │                                       │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━ 78%           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  (完成后自动跳转详情页)                       │
└──────────────────────────────────────────────┘
```

### 数据流

```
用户输入话题 → 点击开始
  → 后端调用 runDecisionPipeline({ topicText, ... })
  → 每一步实时回传进度（WebSocket 或轮询）
  → 完成后拿到 DecisionDossier
  → 存入 localStorage / 后端
  → 跳转 /decision/:id
```

### 交互

- 输入框支持回车提交
- 加载过程中每一步显示 `✓` 动画
- 完成后自动跳转详情页
- 如果返回 `screening_outcome`，加载页显示"没有找到合适的盘口"+ 原因

---

## 4. 页面三：决策详情（核心页面）

### 布局

```
┌──────────────────────────────────────────────┐
│  ← 返回          📋 决策详情          🔗 审计 │ ← header
├──────────────────────────────────────────────┤
│                                              │
│  话题: 美联储7月会降息吗？                    │
│  📅 2026-06-11 18:30                         │
│                                              │
│  ──── Timeline ────                          │
│                                              │
│  ✅ Topic received                   18:30   │
│  ✅ Markets fetched                  18:30   │
│     ↓ 3个盘口，1个通过筛选                    │
│  ✅ Candidate screened               18:30   │
│     ↓ YES 88% / NO 12%, $1.2M vol           │
│  ✅ High conviction confirmed        18:30   │
│  ✅ Evidence snapshot created        18:30   │
│  ✅ Agent recommendations created    18:30   │
│  ✅ Final decision selected          18:30   │
│  🔗 Audit anchor written            18:31   │
│  ☐ User approval recorded            等待   │  ← 高亮闪烁
│  ☐ Execution record created          等待   │
│                                              │
│  ──── Agent 推荐对比 ────                     │
│                                              │
│  ┌──────────────┐  ┌──────────────┐          │
│  │ 📊 市场结构   │  │ 🌍 外部风险   │          │
│  │ BUY_YES      │  │ BUY_YES      │          │
│  │ 信心: MEDIUM │  │ 信心: HIGH   │ ← 选中   │
│  │ 风险: LOW    │  │ 风险: LOW    │          │
│  │ 评分: 12     │  │ 评分: 13 🏆  │          │
│  └──────────────┘  └──────────────┘          │
│                                              │
│  ──── 最终决策 ────                            │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  🟢 BUY_YES_SMALL · $5 USDC            │  │
│  │  选择了 rec_external_risk_1             │  │
│  │  理由: 最高评分，低风险，置信度最高    │  │
│  │                                         │  │
│  │  [ ✅ 批准执行 $5 USDC ]                │  │
│  │  ⚠️ MVP仅记录，不执行真实交易           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ──── Audit ────                              │
│                                              │
│  Dossier:       8fa3da35cff2...              │
│  Evidence:      daee548f69da...              │
│  Recommendations: a7d2c68f76c2...            │
│  Final Decision: de333631c4d8...             │
│                                              │
└──────────────────────────────────────────────┘
```

### 数据来源

```ts
// 详情页数据直接来自 DecisionTimelineView
type DecisionTimelineView = {
  kind: "decision_timeline";
  topic: DecisionTopic;
  decisionRunId: string;
  timeline: DecisionTimelineEntry[];
  steps: DecisionTimelineStepView[];
  finalDecision: FinalDecision;
  approval: UserApprovalView;
  auditAnchors: AuditAnchor[];
  userApproval?: UserApproval;
  executionRecord?: ExecutionRecord;
  mvpDisclosure: string;
};
```

### 交互

**Timeline 步骤：**
- 点击任意 `✅` 行 → 展开详情面板
  - `topic_received` → 显示话题文本
  - `markets_fetched` → 显示几个盘口
  - `candidate_markets_screened` → 显示被拒盘口数量 + 原因
  - `evidence_snapshot_created` → 显示证据摘要
  - `agent_recommendations_created` → 展开推荐对比
  - `final_decision_selected` → 显示决策理由
  - `audit_anchor_written` → 显示 hash

**批准按钮：**
- `canApproveExecution: true` → 按钮可点，点击弹出确认弹窗
  ```
  ┌── 确认批准 ──┐
  │ 批准执行 $5   │
  │ USDC 购买 YES │
  │               │
  │ [取消] [确认]  │
  └───────────────┘
  ```
- `canApproveExecution: false` → 按钮禁用，显示 veto 原因
- 已批准的决策 → 按钮灰掉，显示「✅ 已批准」

**右上角「审计」按钮：**
- 跳转 `/decision/:id/audit`

---

## 5. 页面四：审计详情

### 布局

```
┌──────────────────────────────────────────────┐
│  ← 决策详情          🔒 审计锚定             │
├──────────────────────────────────────────────┤
│                                              │
│  决策 ID: dossier_1                          │
│  话题: 美联储7月会降息吗？                    │
│                                              │
│  ──── 审计载荷 ────                           │
│                                              │
│  网络: testnet                               │
│  版本: coldread.audit-anchor.v1              │
│  算法: sha256                                │
│  序列化: coldread-json-v1                    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Dossier Hash                          │  │
│  │  8fa3da35cff23fbca749336a6da7beb3      │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │ 复制                              │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Evidence Snapshot:     daee548f69da...      │
│  Recommendations:       a7d2c68f76c2...      │
│  Final Decision:        de333631c4d8...      │
│                                              │
│  ──── 链上状态 ────                           │
│                                              │
│  🔗 已锚定                                   │
│  交易哈希: 0xtx_1                            │
│  [ 在浏览器查看 ↗ ]                          │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 6. 组件树

```
App
├── DecisionListPage (/)             ← 主页
│   ├── Header
│   ├── DecisionCard[]               ← 每条决策的摘要卡片
│   └── EmptyState                   ← 无历史时显示
│
├── NewDecisionPage (/new)           ← 新建
│   ├── TopicInput                   ← 输入框 + 提交按钮
│   └── PipelineProgress             ← 加载动画 + 进度条
│
├── DecisionDetailPage (/decision/:id) ← 详情
│   ├── DecisionHeader
│   ├── TimelineView                 ← 步骤列表
│   │   └── TimelineStep[]           ← 单步（可展开）
│   ├── RecommendationCompare        ← 双卡片对比
│   │   └── LensCard[]               ← 每个Lens的评分卡
│   ├── FinalDecisionCard            ← 最终决策 + 批准按钮
│   │   └── ApprovalButton           ← 批准/已批准/禁用
│   └── AuditHashSection             ← hash 展示
│
└── AuditDetailPage (/decision/:id/audit) ← 审计
    ├── AuditPayloadInfo
    ├── HashDisplay[]                 ← 可复制
    └── ChainStatus                  ← 链上状态
```

---

## 7. 数据流概要

```
runDecisionPipeline()       ← 后端管线，返回 DecisionDossier
    ↓
renderDecisionTimeline()    ← ViewModel 转换
    ↓
DecisionTimelineView        ← 前端直接消费的数据
    ↓
Vue 组件渲染
```

**存储 MVP：** 所有决策存 `localStorage`（keyed by dossier id），刷新页面后从 localStorage 加载历史列表。

---

## 8. 颜色参考（Onyx Peach）

| Token | 色值 | 用途 |
|---|---|---|
| 背景 | `#1A1A1A` | 页面背景（暗色） |
| 卡片 | `#2A2A2A` | 卡片背景 |
| 强调 | `#FF7B54` | 按钮、高亮、桃色 |
| 文字主 | `#FFFFFF` | 标题/正文 |
| 文字次 | `#A0A0A0` | 小字/标注 |
| 成功 | `#4ADE80` | timeline ✅ |
| 警告 | `#FBBF24` | veto/等待 |
| 错误 | `#F87171` | 拒绝/失败 |

---

## 9. V2 预留：用户策略配置入口

> 此章节标记 v2 扩展点，MVP 不做实现，但架构上预留接口。

### 9.1 哪里加

**决策详情页**——在最终决策卡片和审计信息之间，预留一个「策略」区域：

```
┌──────────────────────────────────────────────┐
│  ──── 最终决策 ────                            │
│  🟢 BUY_YES_SMALL · $5 USDC                  │
│  [ ✅ 批准执行 ]                               │
│                                              │
│  ──── 投资策略 ────            ← v2 新加 🚧    │
│  ┌────────────────────────────────────────┐  │
│  │ ⚙️ 当前策略: 默认（保守型）            │  │
│  │   风险承受: 低  ·  偏好HOLD            │  │
│  │   [ 调整策略 → ]                       │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ──── Audit ────                              │
│  Dossier: 8fa3da35...                         │
└──────────────────────────────────────────────┘
```

**或者主页右上角**——放一个「策略管理」入口：

```
┌──────────────────────────────────────────────┐
│  🏠 ColdRead              ⚙️ 策略  ⚡ 新建    │
├──────────────────────────────────────────────┤
```

### 9.2 策略配置页（v2 路由）

| 路径 | 页面 |
|---|---|
| `/settings/strategy` | 策略配置页 |
| `/settings/strategy/new` | 新建自定义策略 |

### 9.3 策略模型（前端预留类型）

```ts
// v2 时实现，MVP 只保留类型定义
type UserStrategy = {
  id: string;
  name: string;               // "保守型" / "激进型" / "自定义"
  riskTolerance: "LOW" | "MEDIUM" | "HIGH";
  lensWeights: {
    MARKET_STRUCTURE: number;  // 0-100
    EXTERNAL_RISK: number;     // 0-100
  };
  vetoOverrides: {
    ignoreInsufficientLiquidity?: boolean;
    ignoreTooNearResolution?: boolean;
    ignoreUnclearResolutionRules?: boolean;
  };
  actionPreference: "BUY_FIRST" | "HOLD_FIRST";
  maxStakePerDecision: string; // "$5.00"
};
```

### 9.4 MVP 架构预留

| 层 | MVP 做法 | v2 改法 |
|---|---|---|
| 路由 | 不加策略路由 | 加 `/settings/strategy` |
| 详情页 | 没有策略区域 | 在决策卡片和审计之间插入策略卡片 |
| `domain.ts` | 不加 `UserStrategy` 类型 | 加策略类型 + 默认值 |
| `decision-scorer.ts` | 硬编码规则 | 从策略配置读取权重/Veto开关 |
| 存储 | 存 localStorage | 存链上（Issue #47） |

### 9.5 前端代码预留方式

在 `src/` 下创建一个空占位文件：

```ts
// src/user-strategy.ts
// v2: User strategy configuration
// Placeholder — see docs/frontend-spec.md §9
export type UserStrategy = Record<string, never>;
```

这样以后改 `domain.ts` 里的类型时，不会忘记还有策略这个依赖点。
