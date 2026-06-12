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
npm run demo:trace -- --market <polymarket-market-slug-or-id>
npm run demo:anchor -- --hash <sha256-dossier-or-trace-hash>
npm run demo:agent -- --market <polymarket-market-slug-or-id> --pretty
```

`demo:live` reads real Polymarket market evidence and prints the normalized evidence packet with source identifiers preserved.

`demo:trace` reads the same live market evidence, then generates or loads a GLM-5.1 Agent Run Trace. It prints `glmTraceHash`, the stable audit hash for the trace material. When `ZAI_API_KEY` is missing or the model response is malformed, the command falls back to the committed cached trace at `demo/glm-agent-run-trace.json` and reports the fallback reason.

Both commands accept a Polymarket market slug, market id, or condition id. These steps do not require a wallet and do not place trades.

`demo:anchor` prepares a Sepolia 0 ETH calldata Audit Anchor transaction for a dossier or trace hash. It dry-runs by default and prints the target address, calldata, and pending Sepolia Etherscan URL shape. Add `--send` only when `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`, and `SEPOLIA_ANCHOR_TO` point to a funded demo wallet:

```bash
npm run demo:anchor -- --hash <sha256-dossier-or-trace-hash> --send
```

If `--hash` is omitted, `demo:anchor` uses the committed demo dossier anchor hash derived from the cached GLM-5.1 Agent Run Trace.

Add `--pretty` for a bilingual Chinese / English presentation view. The default output stays JSON for scripts:

```bash
npm run demo:anchor -- --pretty
npm run demo:anchor -- --send --pretty
```

`demo:agent` is the Z.AI long-horizon proof path. It asks GLM-5.1 to drive a bounded Web3 audit workflow: plan the task, call ColdRead tools, observe results, validate the Agent Run Trace, repair a failed validation once, compute a trace hash, and prepare a Sepolia Audit Anchor. It writes `demo/agent-run-record.latest.json` at runtime and the repo includes `demo/agent-run-record.cached.json` as reproducible Hackathon evidence.

```bash
npm run demo:agent -- --market <polymarket-market-slug-or-id> --pretty
npm run demo:agent -- --market <polymarket-market-slug-or-id> --require-live --pretty
npm run demo:agent -- --market <polymarket-market-slug-or-id> --send-anchor --pretty
npm run demo:agent -- --market <polymarket-market-slug-or-id> --require-live --send-anchor --pretty --no-wait
```

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--market <slug>` | Yes | Polymarket market slug, market id, or condition id to audit. |
| `--require-live` | No | Force live GLM-5.1 call; disables cached trace fallback. Without it, the agent falls back to `demo/agent-run-record.cached.json` when `ZAI_API_KEY` is missing or the live call fails. |
| `--send-anchor` | No | Send a real 0 ETH Sepolia Audit Anchor transaction. Without it, the agent dry-runs the anchor and prints the calldata without broadcasting. Requires `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`, and `SEPOLIA_ANCHOR_TO`. |
| `--pretty` | No | Enable the spinner-animated audit Agent output with bilingual Chinese / English presentation. Without it, the default CLI mode runs interactively (when stdin is a TTY). |
| `--no-wait` | No | Skip the "press Enter to exit" prompt on failure when `--pretty` mode is active. Only meaningful with `--pretty`. |

When `ZAI_API_KEY` is configured, `demo:agent` attempts a live GLM-5.1 planner call. Without a key, or if the live call fails, it falls back to an explicitly labeled cached replay unless `--require-live` is set. `--send-anchor` is the only mode that sends a real Sepolia transaction.

## Environment Variables

```text
ZAI_API_KEY=<your Z.AI API key>
ZAI_MODEL=glm-5.1
ZAI_API_BASE_URL=<optional OpenAI-compatible Z.AI chat completions endpoint>
SEPOLIA_RPC_URL=<your Sepolia RPC URL>
SEPOLIA_PRIVATE_KEY=<demo wallet private key>
SEPOLIA_ANCHOR_TO=<address that receives the 0 ETH calldata transaction>
```

Safety notes:

- Use a demo wallet only.
- Keep only small test funds in the Sepolia wallet; the demo transaction sends 0 ETH but still pays gas.
- Never commit private keys.
- The Sepolia sender dry-runs by default and sends only with `--send`.

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
