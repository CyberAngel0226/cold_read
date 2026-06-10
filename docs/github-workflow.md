# GitHub Workflow

This workflow is the default for ColdRead collaborators and Codex agents working in the repository.

## Branch Model

- `main`: stable project history. Do not develop directly on `main`.
- `dev`: integration branch for completed issues. Start new work from `dev`.
- `feat/issue-N-short-name`: one feature branch per issue.
- `fix/issue-N-short-name`: one fix branch per bug issue.
- `docs/issue-N-short-name`: documentation-only issue branch when useful.

Use lowercase branch names and hyphen-separated words.

Examples:

```text
feat/issue-1-domain-contracts
feat/issue-2-decision-topic-intake
fix/issue-4-low-liquidity-gate
docs/issue-14-demo-script
```

## Starting An Issue

Always sync first:

```bash
git fetch origin
git switch dev
git pull --ff-only origin dev
```

Create the issue branch from `dev`:

```bash
git switch -c feat/issue-2-decision-topic-intake
```

If `dev` does not exist locally yet:

```bash
git fetch origin
git switch -c dev --track origin/dev
```

## TDD And Verification

For implementation issues, prefer a vertical TDD loop:

1. Add one behavior test or type-level contract check.
2. Run the test and confirm it fails for the expected reason.
3. Implement the smallest change that makes it pass.
4. Repeat for the next acceptance criterion.
5. Run the full test command before committing.

Current verification command:

```bash
npm run test
```

Future issues may add build, lint, integration, or frontend smoke commands. Run every relevant command before commit and mention any command that could not be run.

## Commit Rules

Make focused commits that correspond to one issue or one coherent slice of an issue.

Recommended commit format:

```text
Issue N: short imperative summary
```

Examples:

```text
Issue 1: define domain contracts
Issue 2: add empty screening outcome path
Issue 4: reject low-liquidity candidate markets
```

Keep generated dependency lockfiles when package dependencies change. Do not commit `node_modules/`.

## Push Rules

Push feature branches to GitHub:

```bash
git push -u origin feat/issue-2-decision-topic-intake
```

Do not push unrelated local changes. Check first:

```bash
git status --short --branch
```

If the network fails during push, keep the local commit and report:

- current branch
- commit hash
- failed command
- exact network error

## Pull Request Rules

Open pull requests from the feature branch into `dev`.

PR title:

```text
Issue N: short summary
```

PR body should include:

- issue number and acceptance criteria covered
- important domain or ADR constraints followed
- tests run
- known gaps or follow-up issues

After review and tests pass, merge into `dev`. Promote `dev` to `main` only when the integration state is intentionally ready.

## Codex Agent Checklist

When a Codex agent starts work:

1. Read [CONTEXT.md](../CONTEXT.md), [docs/prd.md](prd.md), and relevant ADRs.
2. Sync `dev`.
3. Create a branch matching the issue.
4. Implement only the requested issue scope.
5. Preserve user changes and avoid unrelated refactors.
6. Run relevant tests.
7. Commit with the issue number.
8. Push the feature branch.
9. Report branch, commit hash, tests, and any push or network failure.

When the user asks for "next issue", assume the base branch is `dev` unless they explicitly say otherwise.
