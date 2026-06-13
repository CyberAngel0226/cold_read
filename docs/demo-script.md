# ColdRead Demo Script

这份脚本用于向评委快速展示 ColdRead。目标不是讲完所有实现细节，而是在 3-5 分钟内让评委记住一件事：ColdRead 是一个 AI x Web3 可验证审计链路系统，不是交易机器人。

## 一句话介绍

ColdRead 让 GLM-5.1（智谱模型）作为长程 Agent（智能体）分析真实 Polymarket（预测市场）盘口，并把任务拆解、工具调用、校验失败、自我修复和最终审计 hash（哈希）整理成可验证证据，准备锚定到 Sepolia（以太坊测试网）。

## Demo 前准备

安装与验证：

```bash
npm install
npm run test
npm run build
```

可选环境变量：

```text
ZAI_API_KEY=<your Z.AI API key>
SEPOLIA_RPC_URL=<your Sepolia RPC URL>
SEPOLIA_PRIVATE_KEY=<demo wallet private key>
SEPOLIA_ANCHOR_TO=<address that receives the 0 ETH calldata transaction>
```

安全边界：

- 不要展示或提交私钥。
- 不要说 MVP 已经执行真实 Polymarket 交易。
- `--send-anchor` 只发送 0 ETH Sepolia 审计锚点交易，会消耗少量 gas。
- Cobo（钱包）真实执行属于 V2。

## 推荐展示顺序

### 1. 打开项目和 README

讲法：

> ColdRead 的核心不是预测涨跌，而是让 AI 决策过程变成可审计材料。用户可以看到 Agent 看了什么证据、哪一步失败、怎么修复，以及最后生成的 hash 是否能被链上锚点验证。

重点指给评委看：

- `README.md` 中文介绍。
- `README-en.md` 英文版本。
- `docs/user-manual.md` 用户手册。

### 2. 跑 GLM-5.1 长程 Agent CLI

推荐命令：

```bash
npm run demo:agent -- --market new-rhianna-album-before-gta-vi-926 --require-live --pretty
```

如果没有配置 `ZAI_API_KEY`，用可复现缓存模式：

```bash
npm run demo:agent -- --market new-rhianna-album-before-gta-vi-926 --pretty
```

讲法：

> 这里 GLM-5.1 不是一次性回答问题，而是驱动一个多步骤 Web3 审计流程。它先计划任务，再读取真实 Polymarket 盘口，然后生成 Agent Run Trace。中间系统会展示一次校验失败，Agent 再自我修复，最后准备 Sepolia 审计锚点。

评委应该看到：

```text
Step 1 任务拆解 / Plan task
Step 2 读取真实盘口 / Fetch live market
Step 3 生成轨迹草稿 / Draft trace
Step 4 轨迹校验失败 / Trace validation failed
Step 5 自我修复 / Self repair
Step 6 计算哈希并准备锚点 / Compute hash and prepare anchor
```

重点解释：

- `GLM-5.1 live`：模型现场参与长程流程。
- `Trace validation failed`：系统会拦截不完整的审计材料。
- `Self repair`：Agent 能迭代修复。
- `Trace Hash`：最终审计材料的可验证摘要。
- `Calldata`：准备写到链上的最小证据。

### 3. 展示 Sepolia 审计锚点

Dry-run 模式：

```bash
npm run demo:anchor -- --pretty
```

真实发送模式：

```bash
npm run demo:anchor -- --send --pretty
```

或让长程 Agent 直接准备并发送锚点：

```bash
npm run demo:agent -- --market new-rhianna-album-before-gta-vi-926 --require-live --send-anchor --pretty
```

讲法：

> ColdRead 不把完整审计档案放到链上，只把 hash 作为最小可验证引用写进 Sepolia calldata。这样既能证明材料没有被静默篡改，又不会把复杂数据全部上链。

评委应该看：

- `轨迹哈希 / Trace Hash`
- `调用数据 / Calldata`
- `浏览器 / Explorer`
- 真实发送后会出现 Sepolia Etherscan 交易链接。

### 4. 打开 Vue Dashboard

启动：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5173/
```

详情页：

```text
http://127.0.0.1:5173/runs/run_glm_1
```

讲法：

> CLI 展示的是 Agent 怎么跑，Dashboard 展示的是用户事后怎么审计。用户不需要看到 chain-of-thought（思维链），只需要看到工具调用、证据引用、失败修复、最终 hash 和链上验证入口。

重点指给评委看：

- 首页的 GLM-5.1 长程审计状态。
- 最近审计运行卡片。
- 详情页的 6 步 Agent Run Trace。
- Step 4 校验失败和 Step 5 自我修复。
- `traceHash`、`calldata`、Sepolia explorer。
- Cobo 钱包执行标记为 V2 preview。

### 5. 说明产品边界和 V2

讲法：

> 当前 MVP 完成的是可审计决策链路，不做真实交易。V2 会加入 Investment Plan（投资计划）、Cobo Wallet Executor（Cobo 钱包执行器）和小额 Polymarket 主网买入，但执行会被严格的策略参数、风险预算和人工确认边界保护。

不要说：

- 不要说“已经自动买入 Polymarket”。
- 不要说“已经完整接入 Cobo 钱包执行”。
- 不要说“自动扫全市场并选择最佳盘口”。

可以说：

- 已经读取真实 Polymarket 盘口材料。
- 已经支持 GLM-5.1 长程 Agent 运行记录。
- 已经支持 trace hash 和 Sepolia calldata anchor。
- 已经有可复现缓存路径，方便评委本地跑。

## 3 分钟口播稿

> ColdRead 是一个 AI x Web3 可验证审计链路系统。它不是交易机器人，而是解决 AI 决策黑箱的问题：当一个 Agent 分析预测市场时，我们希望知道它看了什么证据、调用了哪些工具、哪一步失败过、最后的材料有没有被篡改。
>
> 这里我输入一个真实 Polymarket 市场 slug。GLM-5.1 会作为长程 Agent 驱动整个流程：先拆解任务，再读取真实盘口，然后生成 Agent Run Trace。注意这里有一个校验失败步骤，系统发现 trace 缺少风险字段，所以拒绝进入审计载荷。接着 Agent 自我修复，把建议降级为 HOLD。最后系统计算 trace hash，并准备写入 Sepolia calldata。
>
> 这个 hash 就是可验证证据。完整审计材料保留在链下，链上只存最小引用。评委可以通过 Sepolia Etherscan 查看交易，也可以用本地生成的 Agent Run Record 复核每一步。Dashboard 则展示用户视角：不用看思维链，只看工具调用、证据引用、校验失败、自我修复和链上锚点。
>
> V2 会继续接入 Investment Plan 和 Cobo 钱包执行，但 MVP 的重点是先把 AI 决策过程变成可审计、可复现、可验证的 Web3 证据链。

## 常见评委问题

### 这是交易机器人吗？

不是。MVP 不执行真实 Polymarket 交易，只生成可审计决策材料和 Sepolia 审计锚点。

### GLM-5.1 在哪里用到了？

`demo:agent` 的长程 Agent 流程使用 GLM-5.1 进行多步骤计划、工具调用决策、轨迹生成和修复。无 key 时会明确回退到缓存 replay。

### Web3 部分是什么？

Web3 部分是把审计材料 hash 准备写入 Sepolia calldata，形成可验证链上锚点。真实交易执行是 V2。

### 为什么不把完整审计材料上链？

完整材料可能很大，也可能包含不适合公开的上下文。ColdRead 只上链最小 hash 引用，链下保留完整 Decision Dossier 和 Agent Run Record。

### 评委怎么复现？

```bash
npm install
npm run test
npm run build
npm run demo:agent -- --market new-rhianna-album-before-gta-vi-926 --pretty
```

有 `ZAI_API_KEY` 时：

```bash
npm run demo:agent -- --market new-rhianna-album-before-gta-vi-926 --require-live --pretty
```
