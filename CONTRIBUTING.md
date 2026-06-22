# Contributing to Secureflow

Thank you for helping improve Secureflow. This guide is intended to get a new contributor from a clean machine to a focused pull request without needing private project context.

## Prerequisites

Install the tools for the layer you plan to change.

### Frontend

- Node.js 20 or newer
- npm 10 or newer

```bash
node --version
npm --version
```

### Backend

- Node.js 20 or newer
- npm 10 or newer
- Supabase CLI for local database work

```bash
npm install -g supabase
supabase --version
```

### Contracts

- Rust toolchain
- Stellar CLI with Soroban support

```bash
rustup default stable
cargo --version
stellar --version
```

If the Stellar CLI is missing, run the repository helper:

```bash
./install-soroban.sh
```

## Local setup

Clone the repository and install root dependencies:

```bash
git clone https://github.com/Secureflow-protocol/secureflow.git
cd secureflow
npm install
```

Do not commit secrets, private keys, wallet seed phrases, Supabase service-role credentials, or local `.env` files.

## Environment files

Create only the environment files required by the layer you are changing. Prefer local development keys and public testnet values.

Common locations:

- Root frontend: `.env.local`
- Backend API: `backend/.env`
- Supabase local stack: `supabase/.env`, if needed by your local CLI setup
- Contract/testnet scripts: root `.env` values consumed by `deploy.sh` or contract helper scripts

## Frontend workflow

Install dependencies at the repository root, then start Vite:

```bash
npm install
npm run dev
```

Build and lint before opening a PR that changes frontend code:

```bash
npm run lint
npm run build
```

When working with generated contract clients, install and build the generated workspace:

```bash
npm run install:contracts
```

## Backend workflow

Install backend dependencies and start the API:

```bash
cd backend
npm install
npm run dev
```

Build before opening a PR that changes backend TypeScript:

```bash
npm run build
```

Keep request validation, route behavior, and Supabase table fields aligned with `supabase/migrations/` and `supabase/seed.sql`.

## Supabase workflow

The repository includes migrations and local seed data.

```bash
supabase start
supabase db reset
```

`supabase db reset` recreates the local database, applies migrations, and loads `supabase/seed.sql`. The seed data includes sample messages and notifications so local inbox and notification routes have records to return.

Stop the local stack when you are done:

```bash
supabase stop
```

## Contract workflow

Build and test the Soroban contracts from the repository root:

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Use `cargo fmt --all` before committing contract changes. For security-sensitive changes, describe the affected contract functions and expected invariants in the PR.

## Code style

- TypeScript and React code should pass `npm run lint`.
- Format frontend/backend files with Prettier through the existing npm scripts or editor integration.
- Rust code should pass `cargo fmt --all --check` and `cargo clippy`.
- Keep changes focused on one issue. Avoid unrelated formatting churn.
- Prefer small, named helpers over copying route, validation, or contract logic across files.

## Tests

Run the smallest relevant validation command for your change and include the exact command in the PR description.

Useful commands:

```bash
# Frontend
npm run lint
npm run build

# Backend
cd backend
npm run build

# Contracts
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

If you cannot run a relevant command, explain why in the PR and describe the manual review you performed.

## Conventional commits

Use concise conventional commit messages:

```text
type(scope): summary
```

Examples:

- `docs(contributing): expand local setup guide`
- `fix(backend): validate milestone payloads`
- `test(contract): cover escrow cancellation path`

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`.

## Pull request checklist

Before opening a PR:

- Link the issue with `Closes #123` or `Fixes #123`.
- Explain why the change is needed, not only what changed.
- Add or update tests for behavior changes when practical.
- Include test evidence with exact commands and results.
- Update docs when setup, migrations, routes, contracts, or environment variables change.
- Confirm lint/build/format checks pass for the changed layer, or explain why they were not run.
- Confirm no secrets, private keys, wallet seed phrases, or local `.env` files were committed.

## Review expectations

Maintainers may ask for smaller changes, more tests, or clearer setup instructions. Keep follow-up commits focused and reply with the validation command you reran.
