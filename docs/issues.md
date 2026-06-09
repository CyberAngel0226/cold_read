# ColdRead GitHub Issues

This document breaks the ColdRead MVP PRD into GitHub-ready implementation issues for multi-person development. Issues are written as vertical slices where possible: each slice should deliver a narrow, verifiable path across contracts, API behavior, UI state, and tests.

Recommended labels:

- `ready-for-agent`
- `afk`
- `hitl`
- `frontend`
- `backend`
- `chain`
- `testing`

Recommended milestones:

- `M1: Contracts & Skeleton`
- `M2: Screening + Evidence`
- `M3: Agents + Scoring`
- `M4: Testnet Audit + Timeline`
- `M5: MVP Polish`

## Issue 1: Define ColdRead domain contracts and timeline states

Type: AFK  
Milestone: M1: Contracts & Skeleton  
Blocked by: None - can start immediately  
User stories covered: 1, 2, 3, 10, 13, 14, 19, 22, 29, 35

### What to build

Define the shared ColdRead MVP contracts used across the app: Decision Topic, Screening Outcome, Screened Market, Evidence Snapshot, Agent Recommendation, Final Decision, Decision Dossier, Audit Anchor, User Approval, Execution Record, and Decision Timeline states.

This slice should create the contract vocabulary that allows frontend, screening, agent, scoring, and audit work to proceed in parallel without guessing each other's payload shapes.

### Acceptance criteria

- [ ] The project has a shared contract for every core ColdRead domain object used in the MVP.
- [ ] Recommendation actions are limited to `BUY_YES_SMALL`, `BUY_NO_SMALL`, and `HOLD`.
- [ ] Agent Recommendation allows at most one target market and one action.
- [ ] Decision Timeline states include the full MVP flow from topic received to execution record created.
- [ ] Contracts distinguish Screening Outcome from Decision Run.
- [ ] Contracts distinguish Wallet Action Proposal, User Approval, and Execution Record.
- [ ] Tests or type checks reject unsupported recommendation actions and malformed recommendations.

## Issue 2: Create the Decision Topic intake and empty Screening Outcome path

Type: AFK  
Milestone: M1: Contracts & Skeleton  
Blocked by: Issue 1  
User stories covered: 1, 2, 3, 22

### What to build

Build the first user-facing path: the user enters a Decision Topic, the system starts a screening flow, and the frontend can display a Screening Outcome when no Screened Market exists.

This slice does not need real Polymarket data yet. It should prove the app can accept a topic, represent timeline progress, and stop cleanly without fabricating a Decision Run.

### Acceptance criteria

- [ ] A user can submit a Decision Topic.
- [ ] The UI shows `topic_received` and a no-market Screening Outcome state.
- [ ] No Decision Run is created when there is no Screened Market.
- [ ] The no-market result is presented as a valid outcome, not as a system error.
- [ ] Tests cover the no-Screened-Market path.

## Issue 3: Fetch related Polymarket markets for a Decision Topic

Type: AFK  
Milestone: M2: Screening + Evidence  
Blocked by: Issue 1, Issue 2  
User stories covered: 1, 4, 27

### What to build

Integrate Polymarket market lookup for a Decision Topic. The app should fetch related prediction markets and display enough raw market fields for later screening and user inspection.

### Acceptance criteria

- [ ] The system fetches related Polymarket markets for a Decision Topic.
- [ ] The response preserves market identifiers, question/title, outcomes, prices, status, volume, liquidity, close time, and resolution/rules text when available.
- [ ] The UI shows fetched markets in the Decision Timeline under `markets_fetched`.
- [ ] Failed Polymarket requests produce a clear recoverable state.
- [ ] Tests cover successful fetch, empty results, and fetch failure.

## Issue 4: Screen Candidate Markets using Polymarket-only one-sided signals

Type: AFK  
Milestone: M2: Screening + Evidence  
Blocked by: Issue 3  
User stories covered: 3, 5, 6, 7, 8, 26

### What to build

Implement the Polymarket-only Market Screener stage. It should transform fetched markets into Candidate Markets only when hard gates pass and a One-Sided Signal is present.

Hard gates should reject closed markets, unclear resolution rules, low-liquidity markets, markets too close to resolution, complex multi-result markets, and problems that require specialized quantitative or insider knowledge.

### Acceptance criteria

- [ ] Closed or paused markets are rejected.
- [ ] Markets without clear Yes/No-style outcomes are rejected for MVP.
- [ ] Markets without usable resolution/rules text are rejected.
- [ ] Low-liquidity markets are rejected.
- [ ] Markets too close to resolution are rejected.
- [ ] Candidate Markets require a One-Sided Signal.
- [ ] When all markets are rejected, the system returns a Screening Outcome and does not create a Decision Run.
- [ ] Tests cover each hard gate and at least one accepted Candidate Market.

## Issue 5: Confirm Screened Markets with Tavily context

Type: AFK  
Milestone: M2: Screening + Evidence  
Blocked by: Issue 4  
User stories covered: 3, 9, 12

### What to build

Add Tavily-backed confirmation for Candidate Markets. Tavily should only be called after Polymarket-only screening has produced Candidate Markets. The confirmation stage should create Context Evidence Set material and promote suitable Candidate Markets into Screened Markets / High-Conviction Markets.

### Acceptance criteria

- [ ] Tavily is not called for markets rejected during Polymarket-only screening.
- [ ] Tavily context is associated with specific Candidate Markets.
- [ ] Major counterevidence or reversal risk prevents promotion to Screened Market.
- [ ] Confirmed Screened Markets include a concise rationale for why they passed.
- [ ] The UI shows `high_conviction_markets_confirmed`.
- [ ] Tests cover no candidate markets, successful confirmation, and confirmation blocked by counterevidence.

## Issue 6: Freeze Evidence Snapshot and create a Decision Dossier draft

Type: AFK  
Milestone: M2: Screening + Evidence  
Blocked by: Issue 5  
User stories covered: 10, 19, 35

### What to build

Create the Evidence Snapshot once Screened Markets exist. The snapshot should freeze the Market Evidence Set and Context Evidence Set so every Analysis Agent sees the same evidence. Generate a Decision Dossier draft that can later receive recommendations, final decision, audit anchors, user approval, and execution records.

### Acceptance criteria

- [ ] A Decision Run is created only when at least one Screened Market exists.
- [ ] Evidence Snapshot contains the Screened Markets and related context evidence.
- [ ] All downstream analysis receives the same Evidence Snapshot reference.
- [ ] Decision Dossier draft includes topic, market evidence, context evidence, and timeline metadata.
- [ ] Tests verify that the Evidence Snapshot is stable across agent runs.

## Issue 7: Generate Market Structure Lens recommendations

Type: AFK  
Milestone: M3: Agents + Scoring  
Blocked by: Issue 6  
User stories covered: 10, 11, 13, 14, 15, 31

### What to build

Implement the Market Structure Lens Analysis Agent. It should evaluate Screened Markets using market-native evidence: price extremity, liquidity, volume, close time, stability, and resolution clarity. It should return one Agent Recommendation at most.

### Acceptance criteria

- [ ] The agent reads only the Evidence Snapshot.
- [ ] The recommendation names at most one target market.
- [ ] The recommendation action is one of `BUY_YES_SMALL`, `BUY_NO_SMALL`, or `HOLD`.
- [ ] Buy recommendations include a Small Stake Wallet Action Proposal.
- [ ] `HOLD` recommendations do not include a Wallet Action Proposal.
- [ ] The recommendation includes confidence, risk level, and evidence-backed rationale.
- [ ] Tests cover buy-yes, buy-no, and hold outputs.

## Issue 8: Generate External Risk Lens recommendations

Type: AFK  
Milestone: M3: Agents + Scoring  
Blocked by: Issue 6  
User stories covered: 10, 12, 13, 14, 15, 31, 35

### What to build

Implement the External Risk Lens Analysis Agent. It should evaluate Screened Markets using context evidence: major counterexamples, news reversal risk, late-breaking events, and resolution dispute risk. It should return one Agent Recommendation at most.

### Acceptance criteria

- [ ] The agent reads only the Evidence Snapshot.
- [ ] The recommendation names at most one target market.
- [ ] The recommendation action is one of `BUY_YES_SMALL`, `BUY_NO_SMALL`, or `HOLD`.
- [ ] The agent recommends `HOLD` when external risk materially undermines the one-sided signal.
- [ ] The recommendation includes confidence, risk level, and citations to context evidence.
- [ ] Tests cover low-risk consensus-following, major counterevidence, and unclear-context scenarios.

## Issue 9: Select Final Decision with Decision Scorer and Veto Conditions

Type: AFK  
Milestone: M3: Agents + Scoring  
Blocked by: Issue 7, Issue 8  
User stories covered: 16, 17, 18, 26

### What to build

Implement the Decision Scorer. It should compare Agent Recommendations, select one as the Final Decision, or safely downgrade to `HOLD` when a Veto Condition appears. It must not synthesize a new wallet action from multiple recommendations.

### Acceptance criteria

- [ ] The scorer selects one Agent Recommendation in the normal path.
- [ ] The scorer can safely downgrade to `HOLD` for Veto Conditions.
- [ ] Veto Conditions include unclear resolution rules, insufficient liquidity, too-near resolution, major external counterevidence, incomplete Evidence Snapshot, and recommendations that cannot cite evidence.
- [ ] The Final Decision includes selected recommendation metadata and selection rationale.
- [ ] The scorer does not create a new Wallet Action Proposal.
- [ ] Tests cover normal selection and every Veto Condition.

## Issue 10: Build Decision Dossier hashing and canonical audit payloads

Type: AFK  
Milestone: M4: Testnet Audit + Timeline  
Blocked by: Issue 9  
User stories covered: 19, 20, 21, 33, 35

### What to build

Create canonical payloads and hashes for the Decision Dossier and its audit-relevant parts: Evidence Snapshot, Agent Recommendations, Final Decision, and optional Execution Record. This prepares the system for testnet Audit Anchors without depending on the chain integration being complete.

### Acceptance criteria

- [ ] The system generates deterministic hashes for audit-relevant dossier sections.
- [ ] Hashes are stable for equivalent canonical payloads.
- [ ] Hashes change when audit-relevant content changes.
- [ ] The Decision Dossier records hash metadata for evidence, recommendations, final decision, and execution record when present.
- [ ] Tests verify deterministic canonicalization and mutation detection.

## Issue 11: Write Audit Anchors to testnet

Type: HITL  
Milestone: M4: Testnet Audit + Timeline  
Blocked by: Issue 10  
User stories covered: 20, 21, 28, 33

### What to build

Write real Audit Anchors to a testnet. The anchor should store minimal verifiable references for a Decision Run, such as hashes or content identifiers, timestamp, selected action, and related metadata. The UI should expose testnet transaction references.

HITL note: before implementation, the team must confirm the target testnet, contract shape, deployment owner, RPC provider, private key handling, and explorer URL format.

### Acceptance criteria

- [ ] The team confirms the target testnet and deployment approach.
- [ ] A testnet transaction is created for a completed Decision Run.
- [ ] The anchor stores only minimal verifiable references, not the full Decision Dossier.
- [ ] The Decision Dossier records Audit Anchor metadata.
- [ ] The UI links to the testnet transaction or displays the transaction reference.
- [ ] Tests cover transaction payload construction and anchor metadata persistence.

## Issue 12: Record User Approval and deferred Execution Record

Type: AFK  
Milestone: M4: Testnet Audit + Timeline  
Blocked by: Issue 9, Issue 10  
User stories covered: 23, 24, 25, 30, 34

### What to build

Keep the User Approval button in MVP. When a user confirms a Final Decision with a Wallet Action Proposal, the system should record User Approval and create an Execution Record showing that real prediction market execution is deferred.

This issue must not place real Polymarket trades.

### Acceptance criteria

- [ ] `HOLD` decisions do not offer execution approval.
- [ ] Buy decisions show a clear approval action for the proposed execution plan.
- [ ] The UI explicitly says MVP does not place real bets.
- [ ] User Approval creates an Execution Record with a deferred execution status.
- [ ] The Execution Record is included in the Decision Dossier.
- [ ] Tests verify that no real trade execution path is called.

## Issue 13: Render the complete Decision Timeline

Type: AFK  
Milestone: M4: Testnet Audit + Timeline  
Blocked by: Issue 2, Issue 5, Issue 6, Issue 9, Issue 10, Issue 11, Issue 12  
User stories covered: 18, 19, 21, 22, 24

### What to build

Render the complete Decision Timeline as the primary frontend experience. The timeline should show each major stage from Decision Topic intake through market fetching, screening, evidence snapshot creation, agent recommendations, final decision, audit anchor, user approval, and execution record.

### Acceptance criteria

- [ ] The timeline shows `topic_received`.
- [ ] The timeline shows `markets_fetched`.
- [ ] The timeline shows `candidate_markets_screened`.
- [ ] The timeline shows `high_conviction_markets_confirmed`.
- [ ] The timeline shows `evidence_snapshot_created`.
- [ ] The timeline shows `agent_recommendations_created`.
- [ ] The timeline shows `final_decision_selected`.
- [ ] The timeline shows `audit_anchor_written`.
- [ ] The timeline shows `user_approval_recorded` when applicable.
- [ ] The timeline shows `execution_record_created` when applicable.
- [ ] The no-Screened-Market path is displayed as Screening Outcome, not a broken timeline.
- [ ] Frontend tests cover happy path, no-Screened-Market path, Veto downgrade, and deferred execution.

## Issue 14: Run MVP end-to-end QA and demo hardening

Type: AFK  
Milestone: M5: MVP Polish  
Blocked by: Issue 1, Issue 2, Issue 3, Issue 4, Issue 5, Issue 6, Issue 7, Issue 8, Issue 9, Issue 10, Issue 11, Issue 12, Issue 13  
User stories covered: 18, 19, 20, 21, 22, 24, 27, 28

### What to build

Harden the MVP for demo and handoff. Verify the full path from Decision Topic to testnet Audit Anchor, including no-Screened-Market, Veto downgrade, and User Approval with deferred Execution Record.

### Acceptance criteria

- [ ] Happy path works from Decision Topic to testnet Audit Anchor.
- [ ] No-Screened-Market path stops before Decision Run creation.
- [ ] Veto downgrade path produces `HOLD` with clear rationale.
- [ ] User Approval path records deferred Execution Record and does not place real trades.
- [ ] The UI clearly distinguishes recommendations, final decisions, audit anchors, user approval, and execution records.
- [ ] The project has documented environment variables and setup steps for Polymarket, Tavily, and testnet anchoring.
- [ ] Automated tests cover the MVP-critical paths.
- [ ] A short demo script exists for reviewers.

## Suggested dependency graph

```text
Issue 1
  ↓
Issue 2
  ↓
Issue 3
  ↓
Issue 4
  ↓
Issue 5
  ↓
Issue 6
  ├── Issue 7
  └── Issue 8
        ↓
      Issue 9
        ↓
      Issue 10
        ├── Issue 11
        └── Issue 12
              ↓
            Issue 13
              ↓
            Issue 14
```

Issue 11 is the only HITL issue in this MVP plan because testnet anchoring needs human confirmation of chain, contract, deployment, RPC, key management, and explorer conventions.
