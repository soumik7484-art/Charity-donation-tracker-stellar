# 💝 GiveChain — Blockchain Charity Donation Tracker

<p align="center">
  <img src="https://img.shields.io/badge/React-18.x-blue?logo=react&logoColor=white&style=for-the-badge" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-20.x-green?logo=node.js&logoColor=white&style=for-the-badge" alt="Node" />
  <img src="https://img.shields.io/badge/Stellar-Testnet-lightgrey?logo=stellar&logoColor=black&style=for-the-badge" alt="Stellar" />
  <img src="https://img.shields.io/badge/Soroban-WASM-orange?logo=webassembly&logoColor=white&style=for-the-badge" alt="Soroban" />
  <img src="https://img.shields.io/badge/Pinata-IPFS-purple?logo=ipfs&logoColor=white&style=for-the-badge" alt="IPFS" />
  <img src="https://img.shields.io/badge/Groq_AI-Llama_3.3-cyan?logo=openai&logoColor=white&style=for-the-badge" alt="Groq AI" />
</p>

<p align="center">
  <b>A production-quality transparent charity platform built on the Stellar network using Soroban smart contracts, IPFS storage (Pinata), Vercel Serverless, and Groq Llama-3.3 AI.</b>
</p>

---

## 🔗 Live Deployments

| Resource | URL |
| :--- | :--- |
| 🚀 **Live Production App** | [Click here to view Live Site](https://soumik7484-art.github.io/Charity-donation-tracker-stellar/) |
| 🤖 **Serverless Backend API** | [Click here to view API Info](https://backend-two-gamma-80.vercel.app/api/info) |
| 🔗 **Smart Contract Explorer** | [View CDLC5DAK...3NRP on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDLC5DAK7FOCAO77IWMZHA3UG5HLEZ2DEDGGFSMCRCJ5XXOEJC4P3NRP) |
| 🌐 **Target Network** | Stellar Testnet (RPC: `soroban-testnet.stellar.org`) |

---

## 🚀 Key Hackathon Upgrades

* 🔒 **Milestone-Based Escrow Fund Release**
  Campaign funds remain securely locked in the smart contract escrow. Rather than claiming the entire balance at once, campaign creators release funds milestone-by-milestone only after completing targets.

* 📦 **IPFS Proof-of-Spend Gallery**
  Campaign creators upload receipts, invoices, or photo proofs to IPFS (via Pinata) for each milestone before requesting release. CIDs are stored immutably on-chain and rendered in a public Proof Gallery.

* ↩️ **Decentralized Refund Mechanism**
  Tracks individual contributions on-chain: if a campaign's ledger sequence deadline passes and the target goal is not met, donors can withdraw their exact contribution back directly through the contract.

* ✅ **Charity Verification Badge & Gated Admin Panel**
  Includes a contract owner-gated admin control panel to verify or revoke NGO creator addresses on-chain. Approved creators automatically receive a "✅ Verified Charity" trust badge across the platform.

* 📊 **Dynamic Donor Dashboard**
  A "My Donations" portal showing live transaction history, refund eligibility banners, and proof release status for all campaigns the donor has supported.

---

## 🔧 Smart Contract API

```rust
// Initialize global contract admin
init(admin: Address)

// Create a new fundraising campaign (badge verified if creator allowlisted)
create_campaign(creator: Address, admin: Address, title: String, goal: i128, duration_ledgers: u32) -> u32

// Record a donation on-chain with donor address mapping for refund eligibility
donate_tracked(campaign_id: u32, donor: Address, amount: i128)

// Submit IPFS Proof CID (only creator can submit for pending milestone)
submit_proof(campaign_id: u32, milestone_index: u32, creator: Address, cid: String)

// Admin approves a milestone (unlocks milestone funds)
approve_milestone(campaign_id: u32, milestone_index: u32)

// Creator claims the funds for an approved milestone
claim_milestone(campaign_id: u32, milestone_index: u32)

// Claim refund (returns full XLM contribution if campaign expired + goal unmet)
claim_refund(campaign_id: u32, donor: Address) -> i128

// Add verified creator to allowlist (only global admin can call)
add_verified_creator(admin: Address, creator: Address)
```

---
Dashboard
<img width="1906" height="917" alt="image" src="https://github.com/user-attachments/assets/aa3f9028-056c-4eb9-9360-396b82a6705b" />



Helping Chatbot



<img width="450" height="702" alt="image" src="https://github.com/user-attachments/assets/4776e653-8b45-41df-8409-12ceb057e2f6" />



## 🚀 Getting Started

### 1. Configure Pinata IPFS Keys
Add your Pinata API keys to `/frontend/.env.local`:
```env
VITE_PINATA_API_KEY=7a29580fb935e683de77
VITE_PINATA_API_SECRET=122ef9daa061a7b174ac37da005abfe9cf11ec0875821bb5a2f0f0441db6c83e
VITE_PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJlMGViNTBlNy00ZTg4LTQ2ZjQtOTJhZS1kOTQ0MjI2NTI5MDkiLCJlbWFpbCI6InNvdW1pazc0ODRAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjdhMjk1ODBmYjkzNWU2ODNkZTc3Iiwic2NvcGVkS2V5U2VjcmV0IjoiMTIyZWY5ZGFhMDYxYTdiMTc0YWMzN2RhMDA1YWJmZTljZjExZWMwODc1ODIxYmI1YTJmMGYwNDQxZGI2YzgzZSIsImV4cCI6MTgxNTk5MzMzM30.hux9KYW9izFdfNrhjDl1TuxQ43nTeqMRNl4zKj1MQ3Y
```

### 2. Build and Deploy Contract
```bash
# Compile WASM target
stellar contract build

# Deploy to Stellar Testnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/charity_tracker.wasm \
  --source SBAE77WAY5ZVM3IRAS3SM7I44R565EWRZV3NKP5QXI6XWCWQTDSDXJBZ \
  --network testnet
```

### 3. Initialize Contract
```bash
stellar contract invoke \
  --id CDLC5DAK7FOCAO77IWMZHA3UG5HLEZ2DEDGGFSMCRCJ5XXOEJC4P3NRP \
  --source-account SBAE77WAY5ZVM3IRAS3SM7I44R565EWRZV3NKP5QXI6XWCWQTDSDXJBZ \
  --network testnet \
  -- init --admin SBAE77WAY5ZVM3IRAS3SM7I44R565EWRZV3NKP5QXI6XWCWQTDSDXJBZ
```

### 4. Run Frontend Client
```bash
cd frontend
npm install
npm run dev
```

---

## 📜 License
This project is licensed under the MIT License - feel free to build upon it!
