# ColdRead

ColdRead is an auditable AI-assisted decision system for prediction markets. The MVP uses Polymarket data to find one-sided markets, confirms risk with external context, asks multiple analysis agents to recommend a small Yes/No position or `HOLD`, selects a safe final decision, and anchors the decision dossier on testnet.

The first version is about auditable market reasoning. It does not place real prediction market trades.

## MVP Flow

```text
Decision Topic
  -> Fetch related Polymarket markets
  -> Screen Candidate Markets
  -> Confirm High-Conviction Markets with external context
  -> Freeze Evidence Snapshot
  -> Generate Analysis Agent Recommendations
  -> Select Final Decision or downgrade to HOLD
  -> Build Decision Dossier
  -> Write testnet Audit Anchor
  -> Optionally record User Approval
  -> Create deferred Execution Record
```

If no market passes screening, ColdRead returns a `ScreeningOutcome` and does not create a `DecisionRun`.

## Repository Map

- [CONTEXT.md](CONTEXT.md): canonical glossary and domain language.
- [docs/prd.md](docs/prd.md): MVP product requirements.
- [docs/mvp.md](docs/mvp.md): condensed MVP flow and boundaries.
- [docs/issues.md](docs/issues.md): 14 implementation issues.
- [docs/adr](docs/adr): architecture decisions.
- [docs/github-workflow.md](docs/github-workflow.md): branch, commit, push, and PR rules for collaborators and Codex agents.
- [src/domain.ts](src/domain.ts): shared TypeScript domain contracts.
- [tests/domain-contracts.test.ts](tests/domain-contracts.test.ts): type-level contract tests.

## Setup

```bash
npm install
npm run test
```

`npm run test` currently runs TypeScript contract checks with `tsc --noEmit`.

## Development Rules

Start every issue from `dev` and use a feature branch named after the issue:

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c feat/issue-2-decision-topic-intake
```

Before pushing, run:

```bash
npm run test
git status --short --branch
```

Then push the feature branch:

```bash
git push -u origin feat/issue-2-decision-topic-intake
```

See [docs/github-workflow.md](docs/github-workflow.md) for the full rules.

## Product Boundaries

- MVP follows one-sided market consensus; it does not seek contrarian alpha.
- Recommendation actions are limited to `BUY_YES_SMALL`, `BUY_NO_SMALL`, and `HOLD`.
- Small Stake sizing is fixed and conservative.
- Full Decision Dossiers are stored off-chain.
- Testnet Audit Anchors store only minimal verifiable references such as hashes or CIDs.
- User Approval confirms a proposed execution plan only.
- Real Polymarket execution, caw/cawPact integration, and autonomous execution are deferred beyond MVP.

---

![直接commit到master分支](assets/direct-commit-master.jpg)
