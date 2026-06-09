# ColdRead MVP PRD

## Problem Statement

预测市场用户可以看到市场价格、新闻和 AI 生成的评论，但他们很难获得一条清晰、可审计的决策链，说明 AI 系统为什么选择某个具体的市场动作。对于那些看起来“显而易见”、市场数据明显一边倒的 Polymarket 盘口，这个问题尤其明显：用户希望系统帮助过滤噪声、检查隐藏风险，并保留一份可验证的记录，证明系统当时看到了什么、如何分析、为什么做出最终决策。

ColdRead 的第一个版本要解决的是可审计的预测市场推理，而不是真钱自动下注。

## Solution

ColdRead 允许用户提交一个 Decision Topic，系统先获取相关 Polymarket 盘口，再筛选出具有一边倒信号的 High-Conviction Market，并用 Tavily 搜索到的外部背景信息确认风险。随后，多个 Analysis Agent 基于同一份 Evidence Snapshot 进行分析并输出 Agent Recommendation。Decision Scorer 从这些建议中选择一个作为 Final Decision，或在出现 Veto Condition 时安全降级为 `HOLD`。

系统会生成完整的 Decision Dossier，并把关键内容的 Audit Anchor 写入测试网，使决策过程后续可以被验证。

MVP 保留 User Approval 按钮，但用户确认的只是拟执行计划。MVP 不会真实执行 Polymarket 下单；系统只记录执行已后置。

## User Stories

1. 作为预测市场用户，我想输入一个 Decision Topic，以便 ColdRead 找到相关的 Polymarket 盘口。
2. 作为预测市场用户，我想让 ColdRead 忽略没有有效相关盘口的主题，以免收到编造出来的 AI 分析。
3. 作为预测市场用户，我想在没有 Screened Market 时看到 Screening Outcome，以便理解为什么分析停止。
4. 作为预测市场用户，我想让 ColdRead 在一次运行中筛选多个相关盘口，以便不用手动逐个打开市场。
5. 作为预测市场用户，我想让 Market Screener 找到一边倒盘口，以便分析聚焦在高把握机会。
6. 作为预测市场用户，我想让 Market Screener 拒绝结算规则不清晰的盘口，以免模糊规则产生误导性建议。
7. 作为预测市场用户，我想让低流动性盘口被拒绝，以免 Small Stake 也带来不合理的执行风险。
8. 作为预测市场用户，我想让临近结算的盘口被谨慎处理，以免过晚或过时的建议被当成可执行动作。
9. 作为预测市场用户，我想让 Tavily 背景搜索只在候选筛选之后发生，以便外部研究成本花在更可能有价值的盘口上。
10. 作为预测市场用户，我想让所有 Analysis Agent 使用同一份 Evidence Snapshot，以便不同建议可以公平比较。
11. 作为预测市场用户，我想看到 Market Structure Lens 的分析，以便理解 Polymarket 数据本身意味着什么。
12. 作为预测市场用户，我想看到 External Risk Lens 的分析，以便理解新闻或背景事实是否削弱了一边倒信号。
13. 作为预测市场用户，我想让每条 Agent Recommendation 明确一个目标盘口，以便拟议动作没有歧义。
14. 作为预测市场用户，我想把动作限制为 `BUY_YES_SMALL`、`BUY_NO_SMALL` 和 `HOLD`，以便 MVP 建议保持清晰易懂。
15. 作为预测市场用户，我想让建议使用固定 Small Stake，以免 Agent 置信度悄悄放大风险。
16. 作为预测市场用户，我想让 Decision Scorer 比较多个 Agent Recommendation，以免最终决策只是选了听起来最有说服力的 Agent。
17. 作为预测市场用户，我想让 Decision Scorer 在出现 Veto Condition 时降级为 `HOLD`，以免安全问题被加权分数平均掉。
18. 作为预测市场用户，我想看到 Final Decision 被选中的原因，以便评估系统推理。
19. 作为预测市场用户，我想阅读完整 Decision Dossier，以便检查证据、建议、评分和审计元数据。
20. 作为预测市场用户，我想让 Audit Anchor 写入测试网，以便验证档案没有被静默篡改。
21. 作为预测市场用户，我想在前端看到 hash 和测试网交易引用，以便审计链路更具体可信。
22. 作为预测市场用户，我想看到 Decision Timeline，以便按步骤回放完整流程。
23. 作为预测市场用户，我想让 MVP 保留 User Approval 按钮，以便确认拟执行计划。
24. 作为预测市场用户，我想让 UI 清楚说明 MVP 不会真实下注，以免把确认误解为实际执行。
25. 作为预测市场用户，我想在确认后看到 Execution Record，以便档案记录“执行计划已确认，但执行已后置”。
26. 作为产品评审者，我想让 ColdRead 在 MVP 中避免反向挑战市场共识，以便第一版先验证审计能力，而不是先追求 alpha 策略复杂度。
27. 作为产品评审者，我想让 MVP 使用真实 Polymarket 数据，以便 demo 反映真实市场状态。
28. 作为产品评审者，我想让 MVP 写入真实测试网 Audit Anchor，以便审计故事可验证。
29. 作为工程师，我想让筛选、证据、建议、评分、锚定和执行之间有清晰领域边界，以便系统可以安全演进。
30. 作为工程师，我想把真实钱包执行后置，以便 MVP 避免同时承担资金、签名和合规风险。
31. 作为工程师，我想让未来的 Analysis Lens 可以增量添加，以便 V2 和 V3 能扩展到两个 Agent 之外。
32. 作为工程师，我想把 Autonomous Execution Policy 放到 V2，以便无人值守下注必须先有明确限额和风控。
33. 作为审计方，我想让链上锚点引用链下 Decision Dossier，以便不用把完整内容写链上也能验证内容完整性。
34. 作为审计方，我想保留被拒绝或执行后置的状态，以便解释为什么没有真实交易。
35. 作为审计方，我想让 Agent Recommendation 引用 Evidence Snapshot 中的材料，以便把推理追溯到 Agent 当时看到的证据。

## Implementation Decisions

- 产品名为 ColdRead。
- MVP 采用 market-first 流程：先获取 Polymarket 盘口，再请求 Tavily 背景信息。
- Decision Topic 不是交易指令、搜索命令或钱包授权。
- 只有 Market Screener 找到至少一个 Screened Market 时，系统才创建 Decision Run。
- Market Screener 采用两阶段流程：Polymarket-only 粗筛，然后 Tavily-backed 背景确认。
- Candidate Market 只有在外部背景确认其适合分析后，才成为 High-Conviction Market。
- MVP 只针对 Consensus-Following Opportunity：跟随清晰的一边倒市场共识，不寻找反向下注机会。
- 一个 Decision Run 可以包含多个 Screened Market，但每条 Agent Recommendation 最多只能指向一个盘口和一个动作。
- MVP 动作限制为 `BUY_YES_SMALL`、`BUY_NO_SMALL` 和 `HOLD`。
- MVP 使用固定 Small Stake，仓位大小不根据置信度动态调整。
- MVP 包含两个 Analysis Lens：Market Structure Lens 和 External Risk Lens。
- Analysis Agent 必须使用同一份 Evidence Snapshot，不应独立抓取新证据。
- Decision Scorer 从 Agent Recommendation 中选择一个作为 Final Decision；如果出现 Veto Condition，则安全降级为 `HOLD`。
- Decision Scorer 不从多个建议中合成新的钱包动作。
- 历史表现可以为未来记录，但不参与 MVP 评分。
- 完整 Decision Dossier 存储在链下。
- Audit Anchor 将 hash 或内容标识符写入测试网。
- MVP 保留 User Approval，但确认的是拟执行计划，不是真实下注。
- MVP 不执行真实预测市场交易。
- cawPact 和 caw 是未来执行集成，不属于 MVP 的真实执行要求。
- Autonomous Execution Policy 属于 V2 范围。
- 前端围绕 Decision Timeline 和 Screening Outcome 组织体验。

## Testing Decisions

- 测试应优先覆盖外部行为和最高层可观察边界，而不是私有 helper 的实现细节。
- Market Screener 测试应验证已关闭、规则不清、低流动性、过近结算、复杂多结果市场会被拒绝。
- Market Screener 测试应验证一边倒、流动性足够、结算清晰的盘口会成为 Candidate Market。
- Tavily 确认测试应验证重大反证会阻止 Candidate Market 成为 Screened Market。
- Evidence Snapshot 测试应验证所有 Analysis Agent 接收到的是同一份冻结证据。
- Agent Recommendation 契约测试应验证每条建议最多只有一个目标盘口和一个动作。
- Recommendation Action 测试应拒绝 `BUY_YES_SMALL`、`BUY_NO_SMALL` 和 `HOLD` 之外的动作。
- Decision Scorer 测试应验证正常情况下能从 Agent Recommendation 中选择 Final Decision。
- Decision Scorer 测试应验证每个 Veto Condition 都能触发安全降级为 `HOLD`。
- Decision Dossier 测试应验证证据、建议、最终决策、锚点、用户确认和执行记录被完整保留且不会被修改。
- Audit Anchor 测试应验证 canonical hash 生成和测试网锚点元数据处理。
- 前端测试应验证 Decision Timeline 阶段、无筛选盘口的 Screening Outcome、最终决策解释、用户确认和执行后置记录。
- 集成测试应覆盖从 Decision Topic 到测试网 Audit Anchor 的 happy path。
- 集成测试应覆盖无 Screened Market 路径，并确认不会创建 Decision Run 或 Audit Anchor。
- 集成测试应覆盖 User Approval 创建 deferred Execution Record，且不会真实下单。

## Out of Scope

- 真实 Polymarket 交易执行。
- 主网 Audit Anchor。
- 无人值守自动下注。
- 反向 alpha 策略。
- 动态仓位管理。
- Kelly 仓位、Martingale 策略或基于置信度的加仓。
- 多盘口组合执行。
- DAO 国库流程。
- 历史表现评分。
- 地区合规自动化。
- 将完整 Decision Dossier 直接存到链上。

## Further Notes

- 相关 ADR 已记录当前产品和架构边界：链下档案与链上锚点、先选择建议再考虑综合、先跟随共识再考虑反向下注、先用户确认再考虑自主执行、MVP 使用测试网锚点，以及后置真实预测市场执行。
- `CONTEXT.md` 中的 glossary 是本 PRD 的 canonical language source。
- 后续版本可以增加更多 Analysis Lens，而不改变核心 Decision Run 模型。
- 未来钱包执行应保持同样的审计模型：Agent Recommendation 和 Final Decision 必须与 Execution Record 分离。
