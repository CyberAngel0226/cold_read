# ColdRead

ColdRead is an AI x Web3 Verifiable Audit Trail system for prediction market decisions. It uses Polymarket market evidence, GLM-5.1 long-horizon Agent Run Trace generation, and on-chain audit references to show what an AI agent saw, how it checked risk, and which Decision Dossier was frozen for later verification.

ColdRead is not a trading bot. The MVP focuses on auditable reasoning: it can produce a Decision Dossier, audit hashes, a deferred Execution Record, and a Sepolia Audit Anchor path without placing real prediction market trades.

## Why It Matters

Prediction market users can already see prices, news, and AI commentary. The missing piece is a verifiable record that proves what evidence an agent used at decision time and whether the agent obeyed the risk boundary before recommending a small action or HOLD.

ColdRead treats AI market decisions like Web3 audit artifacts:

- Evidence Snapshot: the frozen market and context evidence.
- Agent Run Trace: the GLM-5.1 powered long-horizon task trace.
- Final Decision: the selected recommendation or safe HOLD downgrade.
- Decision Dossier: the complete off-chain audit packet.
- Audit Anchor: the minimal on-chain reference to verify the dossier was not silently changed.

## Hackathon Positioning

ColdRead is submitted for an AI x Web3 Agentic Builders Hackathon with a Z.AI track focus.

The Z.AI fit is GLM-5.1 as an Agent Engine for long-horizon market reasoning. The model is used to produce an Agent Run Trace with planning, observation, risk checks, self-correction, veto checks, and audit preparation. ColdRead then turns that trace plus market evidence into a Decision Dossier with audit hashes and Sepolia Audit Anchor evidence.

The repo-first submission goal is to show the system clearly in GitHub first; slides and recording can expand the same story afterward.

## Architecture Flow

```text
Decision Topic
  -> Live Polymarket market evidence or fixture fallback
  -> Market Screener
  -> External context confirmation
  -> Evidence Snapshot
  -> GLM-5.1 Agent Run Trace
  -> Analysis Lens recommendations
  -> Decision Scorer and Veto Condition checks
  -> Final Decision
  -> Decision Dossier and audit hashes
  -> Sepolia Audit Anchor demo transaction
  -> Vue Dashboard review
```

If no market passes screening, ColdRead returns a Screening Outcome and does not create a Decision Run.

## Live today

- Vue dashboard and Decision Run detail UI.
- Local Decision Pipeline API: `POST /api/decision-runs`.
- MVP pipeline from Decision Topic to Decision Dossier.
- Polymarket, Tavily, analysis lens, scorer, audit anchor, user approval, and deferred execution domain boundaries.
- Tests for the MVP pipeline, audit hashes, Python lens readers, and frontend typecheck/build.

## Cached/demo fallback

Some Hackathon proof paths are intentionally fallback-friendly so recording and repo review stay stable:

- Polymarket market data can use fixture responses when live API access is unavailable.
- GLM-5.1 Agent Run Trace can use a committed cached trace when `ZAI_API_KEY` is not configured.
- Sepolia Audit Anchor can run in dry-run mode unless explicit send mode is requested.
- MVP execution remains deferred and does not place real Polymarket trades.

## Setup

```bash
npm install
npm run build
npm run test
```

Run the local dashboard:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/runs/run_1
```

## Demo CLI

The Hackathon live proof path is planned around:

```bash
npm run demo:live -- --market <polymarket-market-slug-or-id>
```

The command is intended to read real Polymarket market evidence, generate or load a GLM-5.1 Agent Run Trace, produce a Decision Dossier hash, and optionally write a Sepolia 0 ETH calldata Audit Anchor transaction.

## Environment Variables

```text
ZAI_API_KEY=<your Z.AI API key>
ZAI_MODEL=glm-5.1
SEPOLIA_RPC_URL=<your Sepolia RPC URL>
SEPOLIA_PRIVATE_KEY=<demo wallet private key>
SEPOLIA_ANCHOR_TO=<address that receives the 0 ETH calldata transaction>
```

Safety notes:

- Use a demo wallet only.
- Keep only small test funds in the Sepolia wallet.
- Never commit private keys.
- The Sepolia sender should dry-run by default and send only when explicitly requested.

## Demo narrative

1. Show ColdRead as an AI x Web3 Verifiable Audit Trail system, not a trading bot.
2. Submit or open a Decision Topic in the Vue dashboard.
3. Walk through the Decision Timeline: market fetch, screening, evidence freeze, GLM-5.1 Agent Run Trace, recommendations, final decision, audit anchor, and execution record.
4. Show the Veto Condition path: the agent can downgrade to HOLD when risk evidence fails.
5. Show the Decision Dossier hash and the Sepolia Audit Anchor transaction link.
6. Explain the next V2 path: Investment Plan guarded autonomous execution, Cobo Wallet Executor integration, and small Polymarket mainnet BUY_YES_SMALL execution after strict Execution Gate checks.

## Repository Map

- [CONTEXT.md](CONTEXT.md): canonical glossary and domain language.
- [docs/prd.md](docs/prd.md): MVP and V2 product direction.
- [docs/adr](docs/adr): architecture decisions.
- [docs/github-workflow.md](docs/github-workflow.md): branch, commit, push, and PR rules.
- [app](app): Vue dashboard.
- [src](src): TypeScript domain, pipeline, audit, and API modules.
- [tests](tests): TypeScript and Python integration tests.

## Product Boundaries

- MVP follows one-sided market consensus; it does not seek contrarian alpha.
- Recommendation actions are limited to `BUY_YES_SMALL`, `BUY_NO_SMALL`, and `HOLD`.
- Small Stake sizing is fixed and conservative.
- Full Decision Dossiers are stored off-chain.
- Audit Anchors store only minimal verifiable references such as hashes.
- User Approval confirms a proposed execution plan only.
- Real Cobo Wallet Executor execution and autonomous Polymarket buying are V2 work.
