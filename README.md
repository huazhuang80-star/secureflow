<div align="center">

<img src="brand/org-avatar.png" alt="SecureFlow" width="112" height="112" />

# SecureFlow

### Trustless Freelancer Escrow on Stellar

[![Global Hackathon Winner](https://img.shields.io/badge/🏆_Global_Stellar_Hackathon-Winner-FFD700?style=for-the-badge)](https://stellar.org)
[![Built on Stellar](https://img.shields.io/badge/Built_on-Stellar_Soroban-7D00FF?style=for-the-badge&logo=stellar)](https://stellar.org)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Rust](https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![CI](https://img.shields.io/github/actions/workflow/status/Secureflow-protocol/secureflow/node.yml?label=CI&style=flat-square)](https://github.com/Secureflow-protocol/secureflow/actions)

**SecureFlow is a decentralized freelancer marketplace on Stellar (Soroban) providing secure, trustless, milestone-based escrow for freelance work — and a 🏆 winner of a global Stellar hackathon.**

[Live Demo](https://secure-flow-scaffold.vercel.app) · [Roadmap](#-roadmap--vision) · [Documentation](#getting-started) · [Contributing](#contributing) · [Open Issues](https://github.com/Secureflow-protocol/secureflow/issues)

</div>

---

## 🏆 Hackathon Recognition

SecureFlow was built for and **won the [Stellar Scaffold Hackathon](https://stellar.org) — a global competition** challenging builders worldwide to ship production-grade dApps using the Stellar Scaffold CLI toolchain on Soroban. SecureFlow took the top spot.

The project stood out for its complete end-to-end implementation: a Soroban smart contract handling real on-chain escrow logic, a React frontend auto-wired to contract clients via `stellar-scaffold`, and a gasless relay backend that makes blockchain interactions seamless for users.

> "SecureFlow demonstrates exactly what Scaffold is meant to enable — a full-stack Stellar dApp with contract, client, and UI wired together from day one." — Hackathon Judges

---

## What is SecureFlow?

SecureFlow solves the freelance trust problem. When you hire someone online today, you either pay upfront (and risk getting nothing) or pay after (and the freelancer risks getting stiffed). SecureFlow puts funds into a Soroban smart contract that neither party controls — it releases payment automatically when milestones are approved, or triggers dispute resolution when they're not.

**Key properties:**

- **Trustless** — no intermediary holds funds, the contract does
- **Transparent** — all state is on-chain and auditable
- **Fair** — multi-arbiter dispute resolution with on-chain reputation
- **Fast & cheap** — Stellar settles in ~5 seconds for fractions of a cent

---

## Features

### Core

| Feature                   | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| **Smart Contract Escrow** | Funds locked in Soroban until milestone approval               |
| **Milestone Payments**    | Break projects into chunks; each unlocks individually          |
| **Open Job Marketplace**  | Freelancers browse and apply; clients pick the best fit        |
| **Direct Contracts**      | Skip the marketplace and contract a known freelancer           |
| **Dispute Resolution**    | Multi-arbiter voting with admin oversight                      |
| **Reputation System**     | On-chain star ratings and badge tiers (Beginner → Expert)      |
| **Multi-Token Support**   | Native XLM or any whitelisted Stellar asset                    |
| **Gasless Relay**         | Backend relay lets users transact without holding XLM          |
| **Rating Notifications**  | Real-time notification center for ratings and milestone events |

### Security

- All write operations require Stellar account authorization
- Token whitelist — only approved assets accepted
- Arbiter authorization gating
- Configurable platform fees sent to designated collector
- Emergency deadline-based refunds built into contract

---

## 🚀 Roadmap & Vision

SecureFlow is graduating from hackathon winner to a **production-grade, audited, privacy-preserving
escrow protocol**. The work is organized into four public milestones — each tracked as labelled
[issues](https://github.com/Secureflow-protocol/secureflow/issues) and aligned with our
[Stellar Community Fund](https://communityfund.stellar.org) (Build) application.

### 🛡️ M0 — Open-Source Hardening
Make the protocol credible and contributor-ready: a comprehensive Soroban test suite (the contract
currently ships none), migration of per-entity data from `instance` → `persistent` storage so it
scales, structured on-chain events, and contract tests + lint wired into CI.

### 🔐 M1 — Security & Audit Prep
Get audit-ready: fund-conservation invariants and property tests, bounds-checked arbiter awards, a
global emergency circuit-breaker, supply-chain scanning, and reproducible WASM builds. *(Targets the
free **SCF Audit Bank**.)*

### 🕶️ M2 — Zero-Knowledge Privacy Layer  *(our differentiator)*
Bring privacy to on-chain work — features no other Stellar freelancing primitive has:
- **ZK reputation proofs** — prove "completed ≥ N jobs" / "rating ≥ X" without revealing clients or projects.
- **ZK freelancer credentials** — Sybil-resistant, privacy-preserving identity/skill proofs.
- **ZK dispute evidence** — prove a deliverable met the agreed conditions without exposing the work.

### 🌐 M3 — Product Growth
Make it a product people use daily: an event-driven indexer (replacing polling), USDC/stablecoin
settlement, streaming/time-based payments, dispute-escalation tiers with arbiter staking, and a
hardened transaction UX.

> 📋 Track everything on the [public roadmap board](https://github.com/Secureflow-protocol/secureflow/issues)
> and [milestones](https://github.com/Secureflow-protocol/secureflow/milestones). Contributions to any
> milestone are welcome — see [Contributing](#contributing).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      SecureFlow                         │
├─────────────┬──────────────────┬────────────────────────┤
│  Frontend   │     Backend      │   Soroban Contract     │
│  React 19   │  Express (Node)  │   Rust / Soroban SDK   │
│  Vite       │  Supabase        │                        │
│  Zustand    │  Groq AI         │   Admin Module         │
│  Radix UI   │  Gasless Relay   │   Escrow Core          │
│  shadcn/ui  │                  │   Marketplace          │
│             │                  │   Work Lifecycle       │
│             │                  │   Refund System        │
│             │                  │   Dispute Resolution   │
└─────────────┴──────────────────┴────────────────────────┘
         ↓                ↓                   ↓
    Stellar Wallets Kit        Stellar SDK / Horizon
                    ↓
             Stellar Network
```

### Contract Modules

```
contracts/secureflow/src/
├── admin.rs              # Platform config, pause, fee management
├── escrow_core.rs        # Core data model and state machine
├── escrow_management.rs  # Escrow creation and lifecycle
├── marketplace.rs        # Job listings and applications
├── work_lifecycle.rs     # Milestone submit/approve/reject
├── refund_system.rs      # Refund and emergency mechanisms
├── storage_types.rs      # All on-chain data structures
└── lib.rs                # Contract entrypoint
```

---

## Tech Stack

| Layer              | Technology                        |
| ------------------ | --------------------------------- |
| Smart Contract     | Rust, Soroban SDK                 |
| Frontend Framework | React 19, TypeScript, Vite        |
| UI                 | Tailwind CSS, Radix UI, shadcn/ui |
| State              | Zustand                           |
| Routing            | React Router v7                   |
| Forms              | React Hook Form + Zod             |
| Backend            | Node.js, Express, Supabase        |
| AI                 | Groq (cover letter analysis)      |
| Wallet             | @creit.tech/stellar-wallets-kit   |
| Toolchain          | Stellar Scaffold CLI              |
| CI/CD              | GitHub Actions, Vercel, Railway   |

---

## Getting Started

### Prerequisites

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none

# Node.js 22+
node --version  # v22 or higher

# Stellar CLI + Scaffold plugin
cargo install stellar-scaffold-cli
```

### Local Development

```bash
# 1. Clone
git clone https://github.com/Secureflow-protocol/secureflow.git
cd secureflow

# 2. Install frontend dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — see Environment Variables section below

# 4. Start Stellar local network (Docker required)
docker run --rm -p 8000:8000 stellar/quickstart:testing --local

# 5. Build contract and auto-generate TypeScript clients
stellar scaffold build --build-clients

# 6. Start frontend
npm run dev
# → http://localhost:5173

# 7. (Optional) Start backend
cd backend && npm install && npm run dev
```

### Environment Variables

**Frontend (`.env`)**

```env
VITE_STELLAR_NETWORK=testnet           # local | testnet | mainnet
VITE_SECUREFLOW_CONTRACT_ID=           # deployed contract address
VITE_OWNER_ADDRESS=                    # admin stellar address
VITE_API_URL=http://localhost:3001     # backend URL
```

**Backend (`backend/.env`)**

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GROQ_API_KEY=
PORT=3001
```

### Building for Production

```bash
npm run build       # frontend → dist/
cd backend && npm run build   # backend → backend/dist/
```

---

## How It Works

### The Full Flow

```
Client creates job  →  Funds locked in escrow contract
Freelancers apply   →  Client selects best applicant
Freelancer starts   →  start_work() changes status to InProgress
Milestone done      →  submit_milestone() notifies client
Client reviews      →  approve (pay) / reject (revise) / dispute
On dispute          →  Arbiters vote → Admin resolves → XLM released
All done            →  Contract marked Completed, reputation updated
```

### Escrow State Machine

```
Pending ──start_work──▶ InProgress ──all approved──▶ Released
   │                        │
refund()              dispute raised
   │                        │
   ▼                        ▼
Refunded               Disputed ──admin resolves──▶ Resolved
```

### Milestone States

`NotStarted` → `Submitted` → `Approved` (payment released)  
`Submitted` → `Rejected` → (freelancer resubmits)  
`Submitted` → `Disputed` → `Resolved`

---

## Smart Contract API

<details>
<summary>Core Functions (click to expand)</summary>

```rust
// Create a new escrow job
pub fn create_escrow(
    depositor: Address,
    beneficiary: Option<Address>,   // None = open marketplace job
    arbiters: Vec<Address>,
    required_confirmations: u32,
    milestones: Vec<(i128, String)>,
    token: Option<Address>,         // None = native XLM
    total_amount: i128,
    duration: u32,
    project_title: String,
    project_description: String,
) -> Result<u32, Error>

// Marketplace
pub fn apply_to_job(escrow_id: u32, cover_letter: String, proposed_timeline: u32, freelancer: Address) -> Result<(), Error>
pub fn accept_freelancer(escrow_id: u32, freelancer: Address, depositor: Address) -> Result<(), Error>

// Work lifecycle
pub fn start_work(escrow_id: u32, beneficiary: Address) -> Result<(), Error>
pub fn submit_milestone(escrow_id: u32, milestone_index: u32, description: String, beneficiary: Address) -> Result<(), Error>
pub fn approve_milestone(escrow_id: u32, milestone_index: u32, depositor: Address) -> Result<(), Error>
pub fn reject_milestone(escrow_id: u32, milestone_index: u32, reason: String, depositor: Address) -> Result<(), Error>

// Refunds
pub fn refund_escrow(escrow_id: u32, depositor: Address) -> Result<(), Error>
pub fn emergency_refund_after_deadline(escrow_id: u32, depositor: Address) -> Result<(), Error>

// Reputation
pub fn rate_freelancer(escrow_id: u32, rating: u32, review: String, depositor: Address) -> Result<(), Error>
```

</details>

---

## Project Structure

```
secureflow/
├── contracts/
│   └── secureflow/           # Soroban smart contract (Rust)
│       └── src/
├── src/                      # React frontend
│   ├── components/
│   │   ├── admin/
│   │   ├── approvals/
│   │   ├── chat/
│   │   ├── create/
│   │   ├── dashboard/
│   │   ├── jobs/
│   │   └── ui/               # shadcn/ui components
│   ├── contexts/             # Web3 + wallet context
│   ├── contracts/            # Auto-generated Soroban clients
│   ├── hooks/
│   ├── lib/                  # API client, utils
│   ├── pages/
│   └── providers/
├── backend/                  # Express API + Supabase
│   └── src/
│       ├── routes/
│       ├── lib/              # Supabase, Groq clients
│       └── middleware/
├── packages/                 # npm workspace packages
├── supabase/                 # DB migrations
├── environments.toml         # Stellar network configs
├── Cargo.toml
└── package.json
```

---

## Contributing

SecureFlow is an open-source project growing beyond the hackathon. We welcome contributors at every level — Rust contract devs, React engineers, and everything in between.

### Getting Involved

1. Check the [open issues](https://github.com/Secureflow-protocol/secureflow/issues) — they're labelled and scoped to be tackled solo
2. Fork the repo and create a branch: `git checkout -b feat/your-feature`
3. Make your changes (run `npm run lint` and `npm test` before pushing)
4. Open a PR against `main`

### Labels

| Label              | Meaning                                |
| ------------------ | -------------------------------------- |
| `good first issue` | Small, well-scoped — great entry point |
| `contract`         | Soroban / Rust smart contract work     |
| `frontend`         | React / TypeScript UI work             |
| `backend`          | Node.js / Express / Supabase work      |
| `security`         | Security-critical changes              |
| `enhancement`      | New features                           |
| `bug`              | Something broken                       |
| `performance`      | Speed / cost improvements              |
| `testing`          | Test coverage                          |
| `documentation`    | Docs and guides                        |

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before submitting.

---

## Deployment

| Service         | Purpose          | Status                                                                                                               |
| --------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Vercel          | Frontend hosting | [![Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)](https://secure-flow-scaffold.vercel.app) |
| Railway         | Backend API      | Active                                                                                                               |
| Stellar Testnet | Smart contract   | Active                                                                                                               |

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

---

<div align="center">

**🏆 Global Stellar Hackathon Winner**

Built with Rust, React, and the Stellar ecosystem.  
Open source under [Secureflow-protocol](https://github.com/Secureflow-protocol) — contributions welcome.

[Stellar](https://stellar.org) · [Soroban Docs](https://developers.stellar.org/docs/smart-contracts) · [Scaffold CLI](https://github.com/stellar/scaffold-stellar) · [Secureflow-protocol](https://github.com/Secureflow-protocol)

</div>
