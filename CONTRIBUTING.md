# Contributing to SecureFlow

Thanks for helping improve SecureFlow. This guide should take you from a clean machine to a pull request without needing maintainer follow-up.

## Prerequisites

Install the core toolchain:

```bash
# Node.js 20+ and npm
node --version
npm --version

# Rust toolchain
rustup update
rustup target add wasm32v1-none

# Stellar CLI and scaffold tooling
cargo install --locked stellar-cli
cargo install --locked stellar-scaffold-cli

# Docker is required for the local Stellar quickstart network
docker --version
```

On Linux CI-like environments, install native packages used by Stellar dependencies:

```bash
sudo apt-get update
sudo apt-get install -y libudev-dev libdbus-1-dev pkg-config
```

## Local setup

Clone and install the frontend workspace:

```bash
git clone https://github.com/Secureflow-protocol/secureflow.git
cd secureflow
npm install
```

Create local environment files:

```bash
touch .env backend/.env
```

Frontend `.env`:

```env
VITE_STELLAR_NETWORK=local
VITE_SECUREFLOW_CONTRACT_ID=
VITE_OWNER_ADDRESS=
VITE_API_URL=http://localhost:3001
```

Backend `backend/.env`:

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GROQ_API_KEY=
PORT=3001
```

Never commit real secrets, private keys, API keys, generated deployment credentials, or `.env` files.

## Running the app

Start a local Stellar network in one terminal:

```bash
docker run --rm -p 8000:8000 stellar/quickstart:testing --local
```

Build the Soroban contracts and generated TypeScript clients:

```bash
STELLAR_SCAFFOLD_ENV=development stellar-scaffold build --build-clients
npm run install:contracts
```

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:5173`.

Start the backend in a separate terminal when testing API-backed flows:

```bash
cd backend
npm install
npm run dev
```

## Test and quality checks

Run the checks that match the layer you touched. Before opening a PR, run the full relevant set and paste the output or a short summary in the PR body.

Frontend:

```bash
npm run lint
npx prettier . --check
npm run build
npm test --if-present
```

Backend:

```bash
cd backend
npm install
npm run build
```

Contracts:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace --locked
STELLAR_SCAFFOLD_ENV=development stellar-scaffold build --build-clients
npm run install:contracts
```

CI currently runs `npm ci`, `npm run lint`, `npx prettier . --check`, `stellar-scaffold build --build-clients`, `npm run install:contracts`, `npm run build`, and `npm test --if-present`.

## Code style

- Keep TypeScript typed and explicit around wallet, contract, and backend API boundaries.
- Use ESLint and Prettier for frontend and shared TypeScript changes.
- Use `cargo fmt` and `cargo clippy` for Rust/Soroban changes.
- Keep generated contract clients in sync with contract changes.
- Add tests for behavior changes. Do not delete or weaken tests without explaining why in the PR.
- Keep security-sensitive code small, auditable, and explicit. Avoid hidden fallbacks around wallet signing, escrow state, dispute resolution, and relayer behavior.

## Commit style

Use Conventional Commits:

```text
type(scope): short imperative summary
```

Common types:

- `feat`: user-visible feature
- `fix`: bug fix
- `docs`: documentation-only change
- `test`: tests or fixtures
- `refactor`: no behavior change
- `chore`: maintenance
- `ci`: GitHub Actions or release automation

Examples:

```text
docs(contributing): add setup guide and PR checklist
fix(contract): validate milestone index before payout
test(backend): cover relay request validation
```

## Pull request checklist

Before requesting review:

- [ ] The PR explains why the change is needed, not only what changed.
- [ ] Related issues are linked with `Closes #...` when applicable.
- [ ] Tests were added or updated for behavior changes.
- [ ] Relevant lint, format, build, and test commands pass, or the PR explains why they were not run.
- [ ] Contract changes document affected functions, events, storage, generated clients, and security implications.
- [ ] Frontend or backend changes document environment variables, API contracts, and user-visible behavior.
- [ ] No secrets, `.env` files, private keys, build artifacts, or generated credentials are committed.

## Reporting issues

Use the GitHub issue templates so maintainers get the affected layer, reproduction steps, environment details, and test evidence. Do not open public issues for vulnerabilities; follow `SECURITY.md` and use the private advisory flow.
