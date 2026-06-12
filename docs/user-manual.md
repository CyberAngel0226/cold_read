# ColdRead 用户手册

## 这是什么

ColdRead 是一个可审计的 AI 预测市场决策系统。你输入一个分析主题，系统帮你找 Polymarket 盘口、筛出有明确信号的筛选盘口、用 GLM-5.1 分析风险和机会，最后产出一份链上可验证的 Decision Dossier。

**ColdRead 不是交易机器人。MVP 不下真实注，它的产出是可验证的审计档案。**

## 快速开始

```bash
npm install
npm run build
npm run dev
```

打开 `http://127.0.0.1:5173/` 进入控制台。

## 两种用法

### 1. 控制台界面（Dashboard）

浏览器打开 `http://127.0.0.1:5173/`：

1. 在首页输入 Decision Topic（比如 "Will the Fed cut rates in July 2026?"）
2. 点击提交，系统自动跑完整流水线
3. 进入 `http://127.0.0.1:5173/runs/run_1` 查看 Decision Timeline
4. 时间线展示每一步：盘口抓取 → 筛选 → 证据冻结 → Agent 分析 → 最终决策 → 锚点 → 用户确认

如果提交的主题找不到合适盘口，你会看到 Screening Outcome（筛选结果），告诉你为什么没有继续分析。

### 2. 命令行（CLI Demo）

测试链上审计锚定：

```bash
npm run demo:anchor -- --hash <sha256-hash> --send --pretty
```

跑长程 Agent 审计（GLM-5.1 驱动）：

```bash
npm run demo:agent -- --market <polymarket-slug> --pretty
npm run demo:agent -- --market <polymarket-slug> --require-live --send-anchor --pretty
```

| 参数 | 必填 | 作用 |
|------|------|------|
| `--market <slug>` | 是 | Polymarket 市场 slug（从 Polymarket 网址尾部复制） |
| `--require-live` | 否 | 强制实时 GLM-5.1 调用，禁用缓存回退 |
| `--send-anchor` | 否 | 真实发送 Sepolia 测试网交易 |
| `--pretty` | 否 | 动画 spinner + 中英双语展示 |
| `--no-wait` | 否 | 失败时不等待回车（仅搭配 --pretty 有效） |

运行后产物写入 `demo/agent-run-record.latest.json`。

## Decision Run 生命周期

一次完整的分析走以下阶段：

| 阶段 | 说明 | 产物 |
|------|------|------|
| 1. 主题接收 | 系统接收 Decision Topic | Decision Topic |
| 2. 市场抓取 | 从 Polymarket 拉相关盘口 | 原始行情数据 |
| 3. 候选筛选 | Market Screener 粗筛 | Candidate Market（候选盘口） |
| 4. 背景确认 | Tavily 搜索外部背景，排除风险 | High-Conviction Market（高把握盘口） |
| 5. 证据快照 | 冻结所有证据，所有 Agent 共用 | Evidence Snapshot（证据快照） |
| 6. Agent 分析 | Market Structure Lens + External Risk Lens 并行分析 | Agent Recommendation（Agent 建议） |
| 7. 决策评分 | Scorer 选最终决策，或 Veto 降级 | Final Decision（最终决策） |
| 8. 档案生成 | 打包全部材料 + 审计哈希 | Decision Dossier（决策档案） |
| 9. 锚点上链 | 审计哈希写入 Sepolia 测试网 | Audit Anchor（审计锚点） |
| 10. 用户确认 | 确认拟执行计划（MVP 不下真实注） | Execution Record（执行记录） |

**如果没有盘口通过筛选，流程在第 3 步终止，返回 Screening Outcome。**

## 如何理解结果

### Final Decision 的三个动作

| 动作 | 含义 |
|------|------|
| `BUY_YES_SMALL` | 小额买入 YES，跟随市场共识方向 |
| `BUY_NO_SMALL` | 小额买入 NO，跟随市场共识方向 |
| `HOLD` | 观望，不动作 |

MVP 只跟随一边倒的市场共识，不反向挑战。

### Veto Condition（否决条件）

当以下情况出现，系统安全降级为 HOLD：

- 外部证据存在重大反例
- 盘口结算规则不清晰
- 临近结算时间，风险过高
- Agent 置信度过低

Veto 是安全机制，不是错误。

### 审计哈希验证

Decision Dossier 包含 `auditHash`。这个哈希写入 Sepolia 测试网后，任何人可以：

1. 拿到链上锚点中的哈希
2. 对链下档案重新计算哈希
3. 比对一致 → 档案未被篡改

## 环境变量

```text
# GLM-5.1 Agent（必需，否则回退到缓存）
ZAI_API_KEY=<你的 Z.AI API Key>
ZAI_MODEL=glm-5.1                     # 默认值
ZAI_API_BASE_URL=<可选的自定义地址>    # 默认使用 Z.AI 官方地址

# Sepolia 锚点（仅 --send-anchor 需要）
SEPOLIA_RPC_URL=<Sepolia RPC URL>
SEPOLIA_PRIVATE_KEY=<演示钱包私钥>
SEPOLIA_ANCHOR_TO=<接收 0 ETH calldata 的地址>
```

**安全提醒**：只用演示钱包，只放少量测试 ETH 付 gas，不要提交私钥到仓库。

## 常见问题

**Q: 输入主题后显示 "No Screened Markets" 是什么意思？**

系统在 Polymarket 上没找到符合筛选条件的盘口，或者找到的盘口有重大风险（规则不清、流动性不足、外部证据矛盾等）。这是正常终止，不是错误。

**Q: 如何获取 Polymarket 市场 slug？**

打开 `polymarket.com`，搜索你关心的主题，进入市场页面。URL 中 `/event/` 后面的那段文字就是 slug。例如 `https://polymarket.com/event/will-the-fed-cut-rates-in-july-2026`，slug 是 `will-the-fed-cut-rates-in-july-2026`。

**Q: --require-live 和 --send-anchor 有什么区别？**

`--require-live` 控制是否强制实时调 GLM-5.1 模型。`--send-anchor` 控制是否真实往 Sepolia 发链上交易。两者互不依赖。

**Q: 为什么确认了但还是没有真交易？**

MVP 不下真实注。User Approval 确认的只是"执行计划"，真实执行推迟到 V2 的 Investment Plan + Execution Gate 体系。
