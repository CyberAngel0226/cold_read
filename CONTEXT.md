# ColdRead

ColdRead is the domain for auditable AI-assisted prediction market decisions. It uses Polymarket data to find one-sided prediction markets, confirms them with external context, asks multiple analysis agents to recommend a small Yes/No position or hold, selects a safe final decision, and anchors the decision dossier on testnet.

## Language

**Decision Run（决策运行）**:
一次围绕单个决策主题及其筛选盘口集合发起的可审计决策周期。它产出一个最终决策；只有当最终决策要求钱包动作时，才关联执行结果。
_Avoid_: Trade, DAO Proposal, Task, Session, 自动交易

**Decision Topic（决策主题）**:
用户或监控系统提交的分析主题。它用于识别候选预测市场，不表示交易指令、新闻搜索请求或钱包授权。
_Avoid_: Trade Intent, Asset Ticker, Natural-Language Command, 交易指令

**Evidence Snapshot（证据快照）**:
一次 Decision Run 在分析前固定下来的外部证据集合。它以筛选盘口为锚点，并补充这些盘口对应的背景信息；多个 Agent 应基于同一个证据快照提出建议。
_Avoid_: API Response, Search Result, Agent Context, 实时数据

**Market Evidence Set（市场证据集）**:
证据快照中与决策主题相关的一组筛选盘口材料。它用于表达预测市场对该主题的当前预期，并允许同一主题下的多个相关盘口共同参与分析。
_Avoid_: Polymarket Market, Market Pick, Price Feed, 单一市场

**Market Screener（盘口筛选器）**:
在完整分析前评估候选预测市场的筛选边界。它先识别值得背景确认的候选盘口，再只让适合判断的盘口进入 Decision Run。
_Avoid_: Analysis Agent, Decision Scorer, Search Filter, 分析 Agent

**Candidate Market（候选盘口）**:
盘口筛选器在背景确认前选出的预测市场问题。它看起来可能适合进一步判断，但还不是高把握盘口。
_Avoid_: Screened Market, High-Conviction Market, Final Pick, 已筛选盘口

**One-Sided Signal（一边倒信号）**:
预测市场数据明显偏向某一结果的筛选信号。它表示盘口可能值得进一步确认，不表示结果确定或建议买入。
_Avoid_: Certainty, Truth, Guaranteed Win, 必胜信号

**Consensus-Following Opportunity（共识跟随机会）**:
高把握盘口中适合跟随市场一边倒方向的小额参与机会。MVP 不把反向挑战市场共识的盘口作为目标机会。
_Avoid_: Contrarian Bet, Arbitrage, Alpha Strategy, 反向下注

**Small Stake（小额仓位）**:
系统允许用于单个预测市场头寸的保守固定投入规模。它限制一边倒盘口的尾部风险，不随 Agent 置信度自动放大。
_Avoid_: Dynamic Sizing, Kelly Bet, Martingale, 加仓策略

**Screened Market（筛选盘口）**:
经过盘口筛选器选中并允许进入完整分析的预测市场问题。没有筛选盘口时，系统不创建 Decision Run，也不生成 Agent 建议。
_Avoid_: Eligible Market, News Topic, Watch Item, 可交易资产

**High-Conviction Market（高把握盘口）**:
盘口筛选器认为具备清晰结算、明显一边倒信号、足够证据和可接受执行条件，适合进入完整 Agent 分析的筛选盘口。它强调可判断性和可审计性，而不是保证结果正确。
_Avoid_: Obvious Question, Sure Bet, Arbitrage, 显而易见问题

**Screening Outcome（筛选结果）**:
盘口筛选结束后返回的前置结果。它说明是否发现筛选盘口；没有筛选盘口时，它是前端展示的终止状态，不是 Decision Run。
_Avoid_: Decision Run, Error, Empty Dossier, 空结果

**Context Evidence Set（背景证据集）**:
证据快照中与筛选盘口相关的一组外部背景材料。它用于表达相关预测市场背后的事件原因、风险因素和环境变化。
_Avoid_: News Feed, Search Results, Sentiment Data, 舆情全集

**Analysis Lens（分析维度）**:
Agent Recommendation 所采用的判断视角。一个 Decision Run 可以包含多个分析维度，每个维度强调不同类型的证据和风险。
_Avoid_: Agent Type, API Source, Feature, 分析模块

**Market Structure Lens（市场结构维度）**:
关注预测市场自身结构的分析维度。它强调价格极端程度、流动性、成交量、截止时间、稳定性和结算规则清晰度。
_Avoid_: Probability Agent, Polymarket Agent, Price Lens, 市场概率 Agent

**External Risk Lens（外部风险维度）**:
关注预测市场外部风险的分析维度。它强调背景材料、重大反例、新闻反转、临近事件和结算争议风险。
_Avoid_: News Agent, Tavily Agent, Sentiment Lens, 新闻 Agent

**Analysis Agent（分析 Agent）**:
基于同一个证据快照和特定分析维度生成 Agent 建议的分析参与者。一次 Decision Run 中的多个分析 Agent 应覆盖不同分析维度，后续版本可以增加更多参与者。
_Avoid_: Agent A, Agent B, Polymarket Agent, Tavily Agent

**Agent Recommendation（Agent 建议）**:
单个分析 Agent 基于证据快照提出的候选决策。它最多选择一个目标筛选盘口和一个建议动作，并包含分析维度、理由、置信度、风险等级，以及可选的钱包动作建议；钱包动作建议不表示已经获准执行。
_Avoid_: Signal, Prediction, Order, 待执行交易

**Decision Scorer（决策评分器）**:
比较多个 Agent 建议并选择最终决策的评估边界。它可以说明评分和选择理由，但不创造新的钱包动作提案；当否决条件出现时，它可以安全降级为观望。
_Avoid_: Analysis Agent, Strategy Agent, Synthesizer, 策略生成器

**Final Decision（最终决策）**:
评分器产生的 Decision Run 结论。它通常选择一个 Agent 建议；当否决条件出现时，它可以安全降级为观望，但不合成新的钱包动作方案。
_Avoid_: Best Agent, Trade Decision, Composite Plan, 评分结果

**Veto Condition（否决条件）**:
阻止 Agent 建议成为可执行最终决策的风险或证据失败。它不是普通扣分项，出现时可以使最终决策安全降级为观望。
_Avoid_: Score Penalty, Warning, Low Confidence, 普通扣分

**Recommendation Action（建议动作）**:
Agent Recommendation 或 Final Decision 中表达预测市场头寸方向的受控动作词。MVP 限定为 `BUY_YES_SMALL`、`BUY_NO_SMALL` 和 `HOLD`；只有 `BUY_YES_SMALL` 与 `BUY_NO_SMALL` 可以关联钱包动作建议。
_Avoid_: Free-Text Action, Strategy, Order Type, 操作类型

**Wallet Action Proposal（钱包动作提案）**:
建议中描述的潜在预测市场钱包动作。它仅表示系统可能请求执行的头寸动作内容，在通过执行网关前不具备执行资格。
_Avoid_: Transaction, Order, Wallet Authorization, Asset Swap, 钱包操作

**User Approval（用户确认）**:
用户对最终决策中的钱包动作提案给予的显式执行许可。MVP 中它确认的是执行计划，不表示真实下注已经发生。
_Avoid_: Implicit Consent, Login, Wallet Connection, 默认授权

**Autonomous Execution Policy（自主执行策略）**:
允许系统在预设限额、盘口条件和风控约束内跳过逐次用户确认的执行规则。它属于 V2 范围。
_Avoid_: Auto-Trading, Bot Mode, Unrestricted Execution, 无限制自动下注

**Execution Gate（执行网关）**:
对最终决策中的钱包动作提案进行授权和风控判断的边界。它只决定是否允许执行，不表示钱包动作已经发生。
_Avoid_: Wallet Gateway, Wallet Executor, caw, 钱包网关

**Wallet Executor（钱包执行器）**:
执行已经通过执行网关的钱包动作的能力边界，并返回执行结果。执行结果不得改写产生它的最终决策。
_Avoid_: Execution Gate, Agent, Scorer, 钱包风控

**Execution Record（执行记录）**:
一次最终决策进入执行阶段后产生的结果记录。它说明执行网关判断、钱包执行状态和相关链上交易信息；用户确认后被执行网关拒绝的动作也应留下执行记录。MVP 中它可以记录执行计划已确认且真实下注已后置。
_Avoid_: Tx Hash, Wallet History, Final Decision, 交易记录

**Audit Anchor（审计锚点）**:
写入测试网或主网的最小可验证引用。它用于锚定某个 Decision Run 的证据快照、Agent 建议、最终决策或执行记录，而不是保存完整内容；被执行网关拒绝的执行记录也可以被锚定。
_Avoid_: On-Chain Record, Proof, Full Audit Log, 链上完整记录

**Decision Dossier（决策档案）**:
一次 Decision Run 的完整可读审计材料。它汇集证据快照、Agent 建议、最终决策、审计锚点信息，以及可选的执行记录。
_Avoid_: Audit Log, Report, Database Row, 展示报告

**Decision Timeline（决策时间线）**:
前端展示一次决策从主题接收到执行记录的阶段化叙事。它让用户按顺序查看盘口获取、筛选、证据快照、Agent 建议、最终决策、审计锚点、用户确认和执行记录。
_Avoid_: Activity Feed, Debug Log, Wizard Steps, 流程日志
