# 💝 CharityChain — Blockchain Charity Donation Tracker

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3.1-blue?logo=react&logoColor=white&style=for-the-badge" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-20.x-green?logo=node.js&logoColor=white&style=for-the-badge" alt="Node" />
  <img src="https://img.shields.io/badge/Stellar-Testnet-lightgrey?logo=stellar&logoColor=black&style=for-the-badge" alt="Stellar" />
  <img src="https://img.shields.io/badge/Soroban-WASM-orange?logo=webassembly&logoColor=white&style=for-the-badge" alt="Soroban" />
  <img src="https://img.shields.io/badge/Groq_AI-Llama_3.3-cyan?logo=openai&logoColor=white&style=for-the-badge" alt="Groq AI" />
  <img src="https://img.shields.io/badge/License-MIT-yellowgreen?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <b>A modern decentralized charity platform built on the Stellar network using Soroban smart contracts, Vercel Serverless routing, and Groq Llama-3.3 AI diagnostics.</b>
</p>

---

### 🌟 Introduction
CharityChain is a fully transparent, decentralized donation platform. Unlike traditional platforms that require you to trust a centralized middleman, CharityChain operates directly on-chain using smart contracts. Every campaign registration, donor transaction, and milestone fund release is executed securely via WebAssembly-compiled logic on the Stellar network.

---

## 🔗 Live Deployments

| Resource | URL |
| :--- | :--- |
| 🚀 **Live Production App** | [Click here to view Live Site](https://soumik7484-art.github.io/Charity-donation-tracker-stellar/) |
| 🤖 **Serverless Backend API** | [Click here to view API Info](https://backend-two-gamma-80.vercel.app/api/info) |
| 🔗 **Smart Contract Explorer** | [View CBNOEZI2...QXXX6 on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBNOEZI2KQW2LT3PMYQLULE73YQ2RQMTMQNBQ5OJFYGUM2YGZ33QXXX6) |
| 🌐 **Target Network** | Stellar Testnet (RPC: `soroban-testnet.stellar.org`) |

---

## ✨ Features

* 🚀 **On-Chain Campaigns** — Create and fundraise directly on Stellar Testnet.
* 💸 **Immutable Transactions** — Every donation is permanent and transparently audit-mapped.
* 🔒 **Secure Milestone Escrow** — Funds are released to NGOs only upon milestone sign-off.
* 🤖 **AI Assistant Chatbot** — Powered by Groq's **Llama-3.3-70b-versatile** model to help donors navigate the platform.
* 🏷️ **AI Auto-Classifier** — Campaigns are automatically classified under tags like *Health & Water* or *Environment* based on description.
* 📄 **Downloadable PDF Receipts** — Automatically generates clean donation slips using `jsPDF`.
* 💻 **Integrated RPC Console** — Real-time logging of Stellar ledger closures and transactions.
* 🎨 **Premium Glassmorphic Theme** — Modern, responsive pale-green aesthetic (`#f2f8f4`).

---

## 🛠️ Technology Stack

### Smart Contract Layer
* **Soroban SDK v25.3.1**: Smart contract framework.
* **Rust (2021 edition)**: Safe, fast language for contract logic.
* **WebAssembly (WASM)**: Compilation target for high-performance execution.

### Frontend Layer
* **React 18 + TypeScript**: Dynamic UI layout.
* **Vite**: Ultra-fast hot module reloading & build tool.
* **@stellar/stellar-sdk**: Wallet signing and RPC query integration.
* **jsPDF & html2canvas**: High-fidelity PDF document rendering.

### Backend & AI Layer
* **Express.js (Node)**: Middleware API for AI processing.
* **Vercel Serverless**: Serverless backend hosting.
* **Groq SDK**: Connection client to the Llama-3.3-70b model.

---

## 🔧 Smart Contract API

```rust
// Create a new fundraising campaign
create_campaign(creator: Address, title: String, goal: i128, duration_ledgers: u32) -> u32

// Record a donation on-chain
donate(campaign_id: u32, amount: i128)

// Creator claims funds after goal is reached
claim(campaign_id: u32)

// Read details of a campaign
get_campaign(campaign_id: u32) -> Campaign

// Get total campaigns count
get_count() -> u32

// Fetch all campaigns
get_all() -> Vec<Campaign>
```

---

## 📁 Project Architecture

```
charity-donation-tracker/
│
├── contracts/
│   └── charity-tracker/          ← Soroban smart contract source code
│       ├── Cargo.toml
│       └── src/lib.rs            ← Rust Smart Contract Logic
│
├── backend/
│   ├── server.js                 ← Express Router (Vercel Serverless Function)
│   ├── db.js                     ← Temporary database fallback handler (/tmp writeable cache)
│   └── vercel.json               ← Deployment config
│
└── frontend/
    ├── src/
    │   ├── App.tsx               ← Main React application
    │   ├── stellar.ts            ← Stellar/Freighter wallet connection layer
    │   └── DonationReceipt.tsx   ← jsPDF template layout
    └── package.json
```

---

## 🚀 Getting Started

### 1. Build the Smart Contract
```bash
stellar contract build
```

### 2. Deploy to Stellar Testnet
```bash
stellar keys generate donor --network testnet --fund

stellar contract deploy \
  --wasm target/wasm32v1-none/release/charity_tracker.wasm \
  --source-account donor \
  --network testnet
```

### 3. Start Frontend & Backend
Configure contract IDs in `frontend/src/stellar.ts`, then start the client:
```bash
# In /frontend
npm install
npm run dev
```

---

## 📊 Performance & Metrics

* **Contract Size**: 5,665 bytes
* **Average Transaction Speed**: ~6 seconds (Stellar ledger close time)
* **Gas / Network Fees**: ~0.00216 XLM ($0.00003 USD)
* **Escrow Platform Fee**: **0%** (Decentralized contract execution)

---

## 📜 License
This project is licensed under the MIT License - feel free to build upon it!
