# ColdRead

中文 | [English](README-en.md)

ColdRead 是一个面向预测市场决策的 AI x Web3 可验证审计链路系统。它使用 Polymarket（预测市场）盘口证据、GLM-5.1（智谱模型）长程 Agent Run Trace（智能体运行轨迹）和链上审计引用，展示 AI Agent（智能体）在决策时看到了什么、如何检查风险，以及哪一份 Decision Dossier（决策档案）被冻结用于后续验证。

ColdRead 不是交易机器人。MVP（最小可行产品）聚焦于可审计推理：它可以生成 Decision Dossier（决策档案）、审计哈希、延迟执行记录，以及 Sepolia（以太坊测试网）Audit Anchor（审计锚点）路径，但不会执行真实 Polymarket 交易。

## 为什么重要

预测市场用户已经可以看到价格、新闻和 AI 评论。缺失的是一份可验证记录：证明 Agent（智能体）在决策时使用了哪些证据，以及它是否遵守风险边界，才给出小额动作或 HOLD（观望）。

ColdRead 把 AI 市场决策当作 Web3 审计材料处理：

- Evidence Snapshot（证据快照）：冻结的市场和上下文证据。
- Agent Run Trace（智能体运行轨迹）：由 GLM-5.1 驱动的长程任务轨迹。
- Final Decision（最终决策）：被选择的建议，或被风险规则降级后的 HOLD。
- Decision Dossier（决策档案）：完整的链下审计包。
- Audit Anchor（审计锚点）：最小链上引用，用来验证档案没有被静默篡改。

## 黑客松定位

ColdRead 面向 AI x Web3 Agentic Builders Hackathon，并重点贴合 Z.AI（智谱 AI）赛道。

赛道匹配点是：GLM-5.1 作为 Agent Engine（智能体引擎）驱动长程市场推理。模型负责生成包含任务规划、观察、风险检查、自我修复、Veto（否决）检查和审计准备的 Agent Run Trace。ColdRead 再把这条运行轨迹和市场证据转成 Decision Dossier，并生成审计哈希与 Sepolia Audit Anchor 证据。

本仓库优先展示可运行代码和可复现路径；PPT 和录屏可以基于同一条故事线展开。

## 架构流程

```text
Decision Topic（决策主题）
  -> 真实 Polymarket 市场证据或 fixture（固定样例）回退
  -> Market Screener（盘口筛选器）
  -> 外部上下文确认
  -> Evidence Snapshot（证据快照）
  -> GLM-5.1 Agent Run Trace（智能体运行轨迹）
  -> Analysis Lens（分析镜头）建议
  -> Decision Scorer（决策评分器）和 Veto Condition（否决条件）检查
  -> Final Decision（最终决策）
  -> Decision Dossier（决策档案）和审计哈希
  -> Sepolia Audit Anchor（审计锚点）演示交易
  -> Vue Dashboard（前端仪表盘）复查
```

如果没有盘口通过筛选，ColdRead 会返回 Screening Outcome（筛选结果），不会创建 Decision Run（决策运行）。

## 当前已实现

- Vue Dashboard（前端仪表盘）和 Decision Run（决策运行）详情页。
- 本地 Decision Pipeline API：`POST /api/decision-runs`。
- 从 Decision Topic 到 Decision Dossier 的 MVP 管线。
- Polymarket、Tavily、分析镜头、评分器、审计锚点、用户确认和延迟执行的领域边界。
- 覆盖 MVP 管线、审计哈希、Python 分析读取器和前端类型检查/build 的测试。
- GLM-5.1 长程 Agent CLI（命令行）演示路径。

## 缓存与演示回退

为了让黑客松录屏和仓库审查更稳定，部分证明路径支持明确标记的回退：

- Polymarket 市场数据在 live API 不可用时可以使用 fixture 响应。
- GLM-5.1 Agent Run Trace 在未配置 `ZAI_API_KEY` 时可以使用仓库内的缓存轨迹。
- Sepolia Audit Anchor 默认 dry-run（试跑），只有显式开启发送模式才会上链。
- MVP 执行仍然是延迟执行，不会下真实 Polymarket 订单。

## 安装与验证

```bash
npm install
npm run build
npm run test
```

启动本地仪表盘：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/runs/run_1
```

## Demo CLI

黑客松主要演示路径：

```bash
npm run demo:live -- --market <polymarket-market-slug-or-id>
npm run demo:trace -- --market <polymarket-market-slug-or-id>
npm run demo:anchor -- --hash <sha256-dossier-or-trace-hash>
npm run demo:agent -- --market <polymarket-market-slug-or-id> --pretty
```

`demo:live` 读取真实 Polymarket 市场材料，并打印保留来源标识的标准化证据包。

`demo:trace` 读取同一个真实市场材料，然后生成或加载 GLM-5.1 Agent Run Trace。它会打印 `glmTraceHash`，也就是轨迹材料的稳定审计哈希。如果缺少 `ZAI_API_KEY`，或模型响应格式错误，命令会回退到仓库内提交的缓存轨迹 `demo/glm-agent-run-trace.json`，并明确说明回退原因。

这两个命令都接受 Polymarket 的市场 slug、市场 id 或 condition id。它们不需要钱包，也不会执行交易。

`demo:anchor` 会为 dossier（档案）或 trace（轨迹）哈希准备一笔 Sepolia 0 ETH calldata Audit Anchor 交易。默认 dry-run，只打印目标地址、calldata 和 pending 状态的 Sepolia Etherscan 链接格式。只有当 `SEPOLIA_RPC_URL`、`SEPOLIA_PRIVATE_KEY` 和 `SEPOLIA_ANCHOR_TO` 指向有少量测试币的钱包时，才应该加 `--send`：

```bash
npm run demo:anchor -- --hash <sha256-dossier-or-trace-hash> --send
```

如果省略 `--hash`，`demo:anchor` 会使用基于缓存 GLM-5.1 Agent Run Trace 生成的演示 dossier anchor hash。

添加 `--pretty` 可以启用中英双语展示视图。默认输出仍然是适合脚本调用的 JSON：

```bash
npm run demo:anchor -- --pretty
npm run demo:anchor -- --send --pretty
```

`demo:agent` 是 Z.AI 长程任务证明路径。它让 GLM-5.1 驱动一个有边界的 Web3 审计工作流：拆解任务、调用 ColdRead 工具、观察结果、校验 Agent Run Trace、在校验失败后修复一次、计算 trace hash，并准备 Sepolia Audit Anchor。运行时会写入 `demo/agent-run-record.latest.json`；仓库里也包含 `demo/agent-run-record.cached.json`，作为可复现的黑客松证据。

```bash
npm run demo:agent -- --market <polymarket-market-slug-or-id> --pretty
npm run demo:agent -- --market <polymarket-market-slug-or-id> --require-live --pretty
npm run demo:agent -- --market <polymarket-market-slug-or-id> --send-anchor --pretty
npm run demo:agent -- --market <polymarket-market-slug-or-id> --require-live --send-anchor --pretty --no-wait
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `--market <slug>` | 是 | 要审计的 Polymarket 市场 slug、市场 id 或 condition id。 |
| `--require-live` | 否 | 强制实时调用 GLM-5.1，并禁用缓存轨迹回退。不加时，如果缺少 `ZAI_API_KEY` 或 live 调用失败，会回退到 `demo/agent-run-record.cached.json`。 |
| `--send-anchor` | 否 | 发送真实 0 ETH Sepolia Audit Anchor 交易。不加时只 dry-run 并打印 calldata，不广播。需要 `SEPOLIA_RPC_URL`、`SEPOLIA_PRIVATE_KEY` 和 `SEPOLIA_ANCHOR_TO`。 |
| `--pretty` | 否 | 启用中英双语展示输出，包含大字标题、状态提示和分步进度。不加时默认输出适合脚本和交互终端。 |
| `--no-wait` | 否 | 在 `--pretty` 模式失败时跳过“按 Enter 退出”。只对 `--pretty` 有意义。 |

配置 `ZAI_API_KEY` 后，`demo:agent` 会尝试实时 GLM-5.1 planner（规划器）调用。未配置 key 或 live 调用失败时，会明确标记为 cached replay（缓存回放），除非设置了 `--require-live`。`--send-anchor` 是唯一会发送真实 Sepolia 交易的模式。

## 环境变量

```text
ZAI_API_KEY=<your Z.AI API key>
SEPOLIA_RPC_URL=<your Sepolia RPC URL>
SEPOLIA_PRIVATE_KEY=<demo wallet private key>
SEPOLIA_ANCHOR_TO=<address that receives the 0 ETH calldata transaction>
```

安全说明：

- 只使用演示钱包。
- Sepolia 钱包只放少量测试币；演示交易发送 0 ETH，但仍会消耗 gas。
- 永远不要提交私钥。
- Sepolia sender 默认 dry-run，只有加 `--send` 或 `--send-anchor` 才会发送。

## 演示叙事

1. 介绍 ColdRead：它是 AI x Web3 Verifiable Audit Trail（可验证审计链路），不是交易机器人。
2. 在 Vue Dashboard 中提交或打开一个 Decision Topic。
3. 讲 Decision Timeline：市场读取、盘口筛选、证据冻结、GLM-5.1 Agent Run Trace、建议、最终决策、审计锚点和执行记录。
4. 展示 Veto Condition 路径：当风险证据不合格时，Agent 可以降级为 HOLD。
5. 展示 Decision Dossier hash 和 Sepolia Audit Anchor 交易链接。
6. 说明 V2 路线：Investment Plan（投资计划）保护下的自主执行、Cobo Wallet Executor（Cobo 钱包执行器）集成，以及通过严格 Execution Gate（执行门控）后的小额 Polymarket 主网买入。

## 仓库结构

- [CONTEXT.md](CONTEXT.md)：核心术语表和领域语言。
- [docs/prd.md](docs/prd.md)：MVP 和 V2 产品方向。
- [docs/adr](docs/adr)：架构决策记录。
- [docs/github-workflow.md](docs/github-workflow.md)：分支、提交、推送和 PR 规则。
- [docs/user-manual.md](docs/user-manual.md)：用户手册。
- [app](app)：Vue Dashboard 前端。
- [src](src)：TypeScript 领域、管线、审计和 API 模块。
- [tests](tests)：TypeScript 和 Python 集成测试。

## 产品边界

- MVP 遵循单边市场共识，不追求逆向 alpha。
- 推荐动作只包括 `BUY_YES_SMALL`、`BUY_NO_SMALL` 和 `HOLD`。
- Small Stake（小额仓位）固定且保守。
- 完整 Decision Dossier 存储在链下。
- Audit Anchor 只存储最小可验证引用，例如 hash。
- User Approval（用户确认）只确认拟议执行计划。
- 真实 Cobo Wallet Executor 执行和 Polymarket 自主买入属于 V2 工作。
