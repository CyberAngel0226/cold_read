# ColdRead MVP

ColdRead 使用 Polymarket 数据筛出一边倒预测盘口，用 Tavily 背景信息确认风险，再让多个分析 Agent 建议小额买 Yes、买 No 或观望，由评分器选择安全最终决策，并把决策档案锚定到测试网以供审计。

## Goals

- 从用户输入的 Decision Topic 获取相关 Polymarket 盘口。
- 用 Market Screener 先粗筛 Candidate Market，再用 Tavily 背景确认 High-Conviction Market。
- 对同一个 Evidence Snapshot 运行多个 Analysis Agent。
- 让 Decision Scorer 选择一个 Agent Recommendation，或在 Veto Condition 出现时安全降级为 `HOLD`。
- 生成 Decision Dossier，并把关键内容 Hash / CID 写入测试网 Audit Anchor。
- 前端用 Decision Timeline 展示筛选、证据、建议、最终决策、审计锚点和用户确认。

## Non-Goals

- MVP 不做真实 Polymarket 下单。
- MVP 不做无人值守自动下注。
- MVP 不做反向挑战市场共识的 contrarian bet。
- MVP 不做组合下注或多盘口同时执行。
- MVP 不用历史表现参与评分。
- MVP 不把完整 Decision Dossier 写到链上。

## Core Flow

```text
Decision Topic
        ↓
Fetch related Polymarket markets
        ↓
Market Screener prefilters Candidate Markets
        ↓
Tavily confirms external context for candidates
        ↓
Screened Markets / High-Conviction Markets
        ↓
Evidence Snapshot
        ↓
Market Structure Lens Agent Recommendation
        ↓
External Risk Lens Agent Recommendation
        ↓
Decision Scorer selects Final Decision or downgrades to HOLD
        ↓
Decision Dossier
        ↓
Testnet Audit Anchor
        ↓
Optional User Approval for the deferred execution plan
        ↓
Execution Record showing execution deferred for MVP
```

If the Market Screener finds no Screened Market, the system returns a Screening Outcome and does not create a Decision Run.

## Market Screener

The Market Screener works in two stages.

First, it uses only Polymarket data to identify Candidate Markets. Hard gates should exclude closed markets, unclear resolution rules, low-liquidity markets, markets too close to resolution, complex multi-result markets, and problems that require specialized quantitative or insider knowledge.

Second, it uses Tavily-backed context to confirm whether a Candidate Market is a High-Conviction Market. A High-Conviction Market must have a One-Sided Signal, sufficient external context, acceptable manipulation risk, clear resolution rules, and practical execution conditions for a Small Stake.

MVP focuses on Consensus-Following Opportunities: if the market is strongly one-sided and external context does not reveal major contrary risk, the recommendation may follow the consensus direction. MVP does not seek contrarian opportunities.

## Analysis Agents

Each Decision Run uses one shared Evidence Snapshot. Analysis Agents must not fetch private or fresh evidence outside that snapshot.

MVP includes two Analysis Lens roles:

- Market Structure Lens: evaluates price extremity, liquidity, volume, deadline, stability, and resolution clarity.
- External Risk Lens: evaluates background evidence, major counterexamples, news reversal risk, late-breaking events, and resolution dispute risk.

Each Analysis Agent can compare all Screened Markets in the Evidence Snapshot, but each Agent Recommendation can choose at most one target market and one Recommendation Action.

Allowed MVP actions:

- `BUY_YES_SMALL`
- `BUY_NO_SMALL`
- `HOLD`

Only `BUY_YES_SMALL` and `BUY_NO_SMALL` can include a Wallet Action Proposal. A Wallet Action Proposal is not execution authorization.

## Decision Scorer

The Decision Scorer compares Agent Recommendations and selects one as the Final Decision. It does not synthesize a new wallet action. It may safely downgrade to `HOLD` when a Veto Condition appears.

MVP scoring may consider:

- Agent confidence
- Risk level
- Evidence quality
- Liquidity and execution practicality
- Whether the recommendation requires a Wallet Action Proposal

MVP does not use historical performance as a scoring factor.

Veto Conditions include:

- Agents do not converge on a target market strongly enough for action.
- External Risk Lens finds a major counterexample or reversal risk.
- Resolution rules are unclear or disputed.
- Liquidity cannot support a Small Stake.
- Market is too close to resolution.
- Recommendation reasoning cannot cite the Evidence Snapshot.
- A critical data source fails and the Evidence Snapshot is incomplete.

## Audit Model

Each completed Decision Run creates a Decision Dossier containing:

- Decision Topic
- Market Evidence Set
- Context Evidence Set
- Evidence Snapshot
- Agent Recommendations
- Final Decision
- Audit Anchor metadata
- Optional User Approval
- Optional Execution Record

Full Decision Dossiers are stored off-chain. Testnet Audit Anchors store only verifiable references such as hashes, CIDs, timestamps, selected agent IDs, final action, and related execution record hashes.

## Execution Boundary

MVP keeps the User Approval button. The user confirms the proposed execution plan, not a real bet. After confirmation, the system can create an Execution Record showing that execution was deferred for MVP.

Real wallet execution through cawPact and caw is deferred to V2. V2 may introduce Autonomous Execution Policy after the audit trail, limits, and risk controls have been proven.

## Frontend

The primary frontend surface is the Decision Timeline:

1. `topic_received`
2. `markets_fetched`
3. `candidate_markets_screened`
4. `high_conviction_markets_confirmed`
5. `evidence_snapshot_created`
6. `agent_recommendations_created`
7. `final_decision_selected`
8. `audit_anchor_written`
9. `user_approval_recorded`
10. `execution_record_created`

The frontend should also show Screening Outcome when no Screened Market exists.

## V2 Candidates

- Real prediction market execution through cawPact and caw.
- Autonomous Execution Policy with limits and per-market constraints.
- Additional Analysis Lens roles, such as social sentiment, on-chain flows, and historical market behavior.
- Performance Record and historical scoring.
- Contrarian opportunities.
- Portfolio or multi-market execution.
