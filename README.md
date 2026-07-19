<div align="center">
  <h1>🛡️ Sentinel Mesh</h1>
  <p><b>Privacy-Preserving Zero-Knowledge KYC & Federated AI Security for Decentralized Networks</b></p>
  <p><i>Built for the MLH Hackathon (July 17th - 19th)</i></p>
</div>

---

## 🛑 The Problem
In Web3, malicious actors (like the Lazarus Group) routinely exploit DeFi protocols and subsequently launder funds through centralized exchanges. When an exchange flags a malicious wallet, the hacker simply abandons the wallet and creates a new one, entirely bypassing the ban. Centralized exchanges cannot legally share their users' sensitive KYC data (Passports, IDs, Real Names) with each other or with DeFi protocols to enforce a unified ban.

## 🚀 The Solution
**Sentinel Mesh** is a decentralized threat-intelligence network that bridges the gap between Centralized Exchanges (CEXs) and Decentralized Finance (DeFi) using Zero-Knowledge Proofs (ZKPs) and Federated AI.

Instead of banning a *wallet*, Sentinel Mesh bans the *human identity* across the entire global network—without ever exposing their private KYC data.

### ✨ Key Features
1. **Zero-Knowledge DIDs (ZK-DID):** When a user is flagged for malicious activity, the network uses deterministic cryptography to generate a ZK-DID Hash. This hash uniquely identifies the human behind the wallet without revealing who they are.
2. **Federated AI Threat Scoring:** Wallet activities are continuously analyzed using a simulated off-chain federated learning model to assign real-time fraud probability scores.
3. **P2P Global Broadcast Network:** Once an identity exceeds the malicious threshold, the Sentinel Mesh Relay instantly broadcasts the ZK-DID to all participating standalone nodes (Exchanges, Wallets, Bridges) over a real asynchronous HTTP architecture.

## 🛠️ Architecture & Tech Stack
- **Frontend:** React + Vite, styled with modern SaaS-grade CSS Variables (v0 aesthetic).
- **Backend Relay:** Python + FastAPI (High-performance async I/O).
- **P2P Network:** Standalone Python servers communicating via real HTTP webhooks.
- **ZK Primitives:** Built to integrate with `snarkjs` and Circom.

## 💻 Running the Project Locally

To fully experience the dynamic P2P network and UI, you need to run three separate components:

### 1. Start the Sentinel Mesh Main API
This is the core backend that handles AI scoring and ZK-DID generation.
```bash
cd api
pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```

### 2. Start the Mock Exchange Nodes (P2P Network)
This script spins up 3 standalone background servers (`Exchange Alpha`, `Wallet Beta`, `Exchange Gamma`) on ports 8001, 8002, and 8003 to simulate our decentralized mesh partners.
```bash
# Open a new terminal at the root of the project
.\start_peers.ps1
```

### 3. Start the React Dashboard
```bash
cd frontend
npm install
npm run dev
```

## 🧪 How to Demo
1. Open the Dashboard at `http://localhost:5173`.
2. Navigate to the **Zero-Knowledge KYC** tab.
3. **Test a Safe Wallet:** Enter `0xd8da6bf26964af9d7eed9e03e53415d37aa96045` (Vitalik's address). The backend AI will score it as safe and **reject** the ban.
4. **Test a Malicious Wallet:** Enter `0x7f367cc41522ce07553e823bf3be79a889debe1b` (Lazarus Group). The backend will generate the ZK-DID and broadcast it to the background Exchange nodes. You will see the **real measured network latency** (in milliseconds) as each standalone server enforces the ban!
