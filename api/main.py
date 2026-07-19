"""
Sentinel Mesh — FastAPI Backend
================================
Connects the fraud scorer (Python) with the ZK proof registry (Node.js).

Endpoints:
  GET  /score/{address}   → score, tier, flags
  POST /flag/{address}    → generate ZK proof + add to registry
  GET  /query/{address}   → flag status from registry
  GET  /registry          → all flagged addresses
  GET  /graph             → D3 network graph (nodes + edges)
  GET  /health            → uptime check
"""

import sys
import os
import json
import subprocess
import hashlib
import asyncio
import time
import requests
from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Patch sys.path so scorer is importable ─────────────────────────────────────
ROOT = Path(__file__).parent.parent
SCORER_DIR = ROOT / "scorer"
ZKP_DIR    = ROOT / "zkp"
PROOFS_DIR = ZKP_DIR / "proofs"

sys.path.insert(0, str(SCORER_DIR))
from scorer import score_address
from graph_data import WALLET_RELATIONSHIPS, WALLET_LABELS
from simulate_members import run_simulation, MEMBERS
from appeals import create_appeal, get_appeals_for, get_all_appeals, verify_appeal_authorship, _appeal_status

# ── In-memory registry (backed by zkp/proofs/*.json files) ────────────────────

def _load_registry() -> list[dict]:
    """Load all proofs from disk."""
    if not PROOFS_DIR.exists():
        return []
    proofs = []
    for f in PROOFS_DIR.glob("*.json"):
        try:
            proofs.append(json.loads(f.read_text()))
        except Exception:
            pass
    return proofs


def _get_proofs_for(address: str) -> list[dict]:
    return [p for p in _load_registry() if p["address"] == address.lower()]


def _generate_and_save_proof(address: str, score: int) -> Optional[dict]:
    """
    Call the Node.js prover to generate a ZK proof.
    Returns the public proof dict, or None if score <= threshold.
    """
    script = f"""
const {{ generateProof, saveProof }} = require({json.dumps(str(ZKP_DIR / "prover.js").replace(chr(92), "/"))});
const result = generateProof({json.dumps(address)}, {score});
if (result) {{
    saveProof(result.publicProof);
    process.stdout.write(JSON.stringify(result.publicProof));
}} else {{
    process.stdout.write("null");
}}
"""
    try:
        proc = subprocess.run(
            ["node", "-e", script],
            capture_output=True, text=True, timeout=10
        )
        output = proc.stdout.strip()
        if output and output != "null":
            return json.loads(output)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proof generation failed: {e}")
    return None


# ── Consensus logic ────────────────────────────────────────────────────────────

def _get_confidence_tier(proof_count: int) -> str:
    if proof_count == 0:   return "NONE"
    if proof_count == 1:   return "LOW"
    if proof_count == 2:   return "MEDIUM"
    return "HIGH"          # 3+ independent flags


# ── App setup ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Sentinel Mesh API",
    description="Privacy-preserving fraud intelligence network for crypto wallets",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global queue for real-time live ticker events
ticker_queue = asyncio.Queue()

# Global queue for real-time mempool transactions
mempool_queue = asyncio.Queue()

# Global queue for cross-chain bridge events
crosschain_queue = asyncio.Queue()

# Global queue for white-hat bounties
bounty_queue = asyncio.Queue()

# Background task to generate random network events if the network is idle
async def generate_mock_events():
    mock_events = [
        {"text": "DeFi Oracle blocked $50,000 flash loan on 0x3cbd...", "color": "#f59e0b"},
        {"text": "Network Consensus reached on Lazarus Group", "color": "#8b5cf6"},
        {"text": "142 malicious transactions blocked in last hour", "color": "#10b981"},
        {"text": "Cross-chain tracking active: ETH -> SOL bridge monitored", "color": "#3b82f6"},
        {"text": "AI Model detected high-velocity drainer pattern", "color": "#f59e0b"},
        {"text": "Zero-Knowledge commitment verified on Midnight testnet", "color": "#10b981"},
        {"text": "New OFAC sanction list synced with Sentinel Mesh", "color": "#3b82f6"}
    ]
    import random
    while True:
        event = random.choice(mock_events)
        await ticker_queue.put(event)
        await asyncio.sleep(random.uniform(4.0, 8.0))

async def fetch_live_mempool():
    """Fetches real live Ethereum transactions via Etherscan API and streams them to the mempool scanner UI."""
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
    try:
        from scorer.ofac_addresses import is_ofac_sanctioned, is_known_mixer
        from scorer.scorer import ETHERSCAN_API_KEY
    except ImportError:
        ETHERSCAN_API_KEY = "39W39GR1QZGPKGA5CTPUG5551FTHFU4YG2"
        is_ofac_sanctioned = lambda x: False
        is_known_mixer = lambda x: False
        
    seen_txs = set()
    
    while True:
        try:
            if not ETHERSCAN_API_KEY:
                await asyncio.sleep(10)
                continue
                
            def get_block():
                url = f"https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getBlockByNumber&tag=latest&boolean=true&apikey={ETHERSCAN_API_KEY}"
                return requests.get(url, timeout=10).json()
                
            data = await asyncio.to_thread(get_block)
            
            if data.get("result") and data["result"].get("transactions"):
                txs = data["result"]["transactions"]
                # Stream the latest 15 transactions
                for tx in txs[:15]:
                    tx_hash = tx.get("hash")
                    if tx_hash in seen_txs:
                        continue
                    seen_txs.add(tx_hash)
                    if len(seen_txs) > 1000:
                        seen_txs.clear()
                        
                    from_addr = (tx.get("from") or "").lower()
                    to_addr = (tx.get("to") or "").lower()
                    value_wei = int(tx.get("value", "0x0"), 16)
                    value_eth = value_wei / 1e18
                    gas = int(tx.get("gas", "0x0"), 16)
                    
                    is_malicious = False
                    if is_ofac_sanctioned(from_addr) or is_ofac_sanctioned(to_addr):
                        is_malicious = True
                    if is_known_mixer(from_addr) or is_known_mixer(to_addr):
                        is_malicious = True
                        
                    event = {
                        "id": tx_hash,
                        "hash": tx_hash,
                        "amount": f"{value_eth:.4f} ETH",
                        "status": "BLOCKED" if is_malicious else "PENDING",
                        "time": datetime.utcnow().isoformat().split('T')[1][:12],
                        "gas": f"{gas} Gwei"
                    }
                    
                    await mempool_queue.put(event)
                    
                    if is_malicious:
                        # Award a bounty dynamically
                        researcher = "0x" + "".join([random.choice("0123456789abcdef") for _ in range(40)])
                        await bounty_queue.put({
                            "id": tx_hash,
                            "researcher": f"{researcher[:6]}...{researcher[-4:]}",
                            "payout": f"+{random.randint(100, 1500):,} $NIGHT",
                            "reason": "Mempool Exploit Blocked",
                            "time": "Just now"
                        })
                    
                    await asyncio.sleep(0.4) # visual delay
                    
        except Exception as e:
            print(f"Mempool fetch error: {e}")
            
        await asyncio.sleep(12)  # Ethereum average block time

async def fetch_live_crosschain():
    """Monitors real Ethereum smart contracts for cross-chain bridges."""
    import random
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
    try:
        from scorer.scorer import ETHERSCAN_API_KEY
        from scorer.ofac_addresses import is_ofac_sanctioned
    except ImportError:
        ETHERSCAN_API_KEY = "39W39GR1QZGPKGA5CTPUG5551FTHFU4YG2"
        is_ofac_sanctioned = lambda x: False
        
    # Real Bridge Contracts on Ethereum
    BRIDGES = {
        "Wormhole": "0x3ee18B2214AD9cE6C1CE9d423352CF1C8724fd5F",
        "Stargate": "0x8731d54E9D02c286767d56ac03e8037C07e01e98"
    }
    
    seen_txs = set()
    
    while True:
        try:
            if not ETHERSCAN_API_KEY:
                await asyncio.sleep(10)
                continue
                
            bridge_name = random.choice(list(BRIDGES.keys()))
            bridge_addr = BRIDGES[bridge_name]
            
            def get_txs():
                url = f"https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address={bridge_addr}&startblock=0&endblock=99999999&page=1&offset=5&sort=desc&apikey={ETHERSCAN_API_KEY}"
                return requests.get(url, timeout=10).json()
                
            data = await asyncio.to_thread(get_txs)
            
            if data.get("status") == "1" and data.get("result"):
                txs = data["result"]
                for tx in txs:
                    tx_hash = tx.get("hash")
                    if not tx_hash or tx_hash in seen_txs:
                        continue
                        
                    seen_txs.add(tx_hash)
                    if len(seen_txs) > 1000:
                        seen_txs.clear()
                        
                    sender = tx.get("from", "").lower()
                    value_wei = int(tx.get("value", "0"))
                    value_eth = value_wei / 1e18
                    
                    # Estimate a dollar value for visual impact (assuming $3000/ETH for demo)
                    amount_usd = value_eth * 3000
                    if amount_usd < 1:
                        amount_usd = random.randint(500, 50000) # Fallback if value is 0 (ERC20 transfer)
                        
                    # 10% demo chance to flag, OR if actually sanctioned
                    is_anomaly = random.random() < 0.10 or is_ofac_sanctioned(sender)
                    
                    event = {
                        "id": tx_hash,
                        "source_chain": "Ethereum",
                        "target_chain": random.choice(["Solana", "Avalanche", "Arbitrum", "Optimism"]),
                        "bridge": bridge_name,
                        "amount": f"${amount_usd:,.2f}",
                        "status": "INTERCEPTED" if is_anomaly else "CLEARED",
                        "time": datetime.utcnow().isoformat().split('T')[1][:12],
                        "zk_did": f"ZK-DID: {tx_hash[2:18].upper()}" if is_anomaly else None
                    }
                    
                    await crosschain_queue.put(event)
                    
                    if is_anomaly:
                        await ticker_queue.put({
                            "text": f"CROSS-CHAIN INTERCEPT: {event['amount']} blocked on {bridge_name} bridge.",
                            "color": "#ef4444"
                        })
                        
                        # Award a bounty dynamically
                        researcher = "0x" + "".join([random.choice("0123456789abcdef") for _ in range(40)])
                        await bounty_queue.put({
                            "id": tx_hash,
                            "researcher": f"{researcher[:6]}...{researcher[-4:]}",
                            "payout": f"+{random.randint(200, 2500):,} $NIGHT",
                            "reason": f"Cross-Chain Intercept ({bridge_name})",
                            "time": "Just now"
                        })
                        
                    await asyncio.sleep(1.0) # stagger visual delivery
                    
        except Exception as e:
            print(f"Crosschain fetch error: {e}")
            
        await asyncio.sleep(8) # Fetch new bridge txs every 8 seconds

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(generate_mock_events())
    asyncio.create_task(fetch_live_mempool())
    asyncio.create_task(fetch_live_crosschain())

@app.get("/ticker/stream")
async def ticker_stream(request: Request):
    """
    Server-Sent Events (SSE) endpoint to stream live network events to the frontend ticker.
    """
    async def event_generator():
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break
            
            try:
                # Wait for a real event (or mock event) from the global queue
                event = await asyncio.wait_for(ticker_queue.get(), timeout=2.0)
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Send a keep-alive ping if queue is empty to prevent connection drop
                yield ": keep-alive\n\n"
            except Exception as e:
                print("Client disconnected from ticker stream")
                break
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/mempool/stream")
async def mempool_stream(request: Request):
    """
    Server-Sent Events (SSE) endpoint to stream live Ethereum transactions to the UI.
    """
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            
            try:
                # Wait for a mempool event
                event = await asyncio.wait_for(mempool_queue.get(), timeout=15.0)
                # Send SSE format
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Keep-alive ping
                yield ": keep-alive\n\n"
            except Exception as e:
                print(f"Mempool stream error: {e}")
                if await request.is_disconnected():
                    break
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/crosschain/stream")
async def crosschain_stream(request: Request):
    """
    Server-Sent Events (SSE) endpoint to stream cross-chain bridge anomalies to the UI.
    """
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            
            try:
                event = await asyncio.wait_for(crosschain_queue.get(), timeout=15.0)
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"
            except Exception as e:
                print(f"Crosschain stream error: {e}")
                if await request.is_disconnected():
                    break
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/staking/bounties")
async def bounties_stream(request: Request):
    """
    Server-Sent Events (SSE) endpoint to stream dynamic white-hat bounties.
    """
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(bounty_queue.get(), timeout=15.0)
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"
            except Exception:
                if await request.is_disconnected():
                    break
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/staking/nodes")
async def get_staking_nodes():
    """
    Pings the actual locally running P2P mock nodes (Alpha, Beta, Gamma) 
    to retrieve their real uptime and status for the Cryptoeconomics panel.
    """
    nodes_info = []
    
    # Configuration matches the start_peers.ps1 script
    peers_config = [
        {"name": "Exchange Alpha", "port": 8001, "type": "Centralized Exchange", "staked": "50,000", "base_rep": 92},
        {"name": "Wallet Beta", "port": 8002, "type": "Self-Custody Provider", "staked": "25,000", "base_rep": 85},
        {"name": "Protocol Gamma", "port": 8003, "type": "DeFi Lending Protocol", "staked": "10,000", "base_rep": 72},
        {"name": "Yield Farm Delta", "port": 8004, "type": "DeFi Yield Protocol", "staked": "42,000", "base_rep": 88},
        {"name": "Bridge Node Epsilon", "port": 8005, "type": "Cross-Chain Bridge", "staked": "100,000", "base_rep": 96},
        {"name": "Custodian Zeta", "port": 8006, "type": "Institutional Custody", "staked": "250,000", "base_rep": 99}
    ]
    
    async def fetch_node(peer):
        try:
            url = f"http://127.0.0.1:{peer['port']}/health"
            res = await asyncio.to_thread(requests.get, url, timeout=1.0)
            if res.status_code == 200:
                data = res.json()
                uptime_hrs = data.get("uptime", 0) / 3600
                return {
                    "name": peer["name"],
                    "type": peer["type"],
                    "staked": f"{peer['staked']} $NIGHT",
                    "slashed": "0",
                    "uptime": f"{min(99.99, 90 + (uptime_hrs * 10) + (peer['base_rep'] / 100)):.2f}%", 
                    "status": "Active Node",
                    "reputation": min(100, peer['base_rep'] + int(uptime_hrs * 2))
                }
        except Exception:
            pass
            
        # If node is offline or crashes
        return {
            "name": peer["name"],
            "type": peer["type"],
            "staked": f"{peer['staked']} $NIGHT",
            "slashed": "500 $NIGHT",
            "uptime": "OFFLINE",
            "status": "Warned",
            "reputation": 45
        }
        
    tasks = [fetch_node(p) for p in peers_config]
    results = await asyncio.gather(*tasks)
    return results

# ── Response models ───────────────────────────────────────────────────────────

class ScoreResponse(BaseModel):
    address: str
    score: int
    tier: str
    flags: list[str]
    tx_count: int
    mixer_interactions: int
    exceeds_threshold: bool
    data_source: str
    ai_confidence: float

class FlagResponse(BaseModel):
    address: str
    flagged: bool
    proof_id: Optional[str]
    commitment: Optional[str]
    message: str

class QueryResponse(BaseModel):
    address: str
    is_flagged: bool
    flag_count: int
    confidence_tier: str
    proof_ids: list[str]
    latest_flag_ts: Optional[int]

class RegistryEntry(BaseModel):
    address: str
    proof_id: str
    commitment: str
    threshold: int
    timestamp: int
    confidence_tier: str

class PropagationNode(BaseModel):
    name: str
    status: str
    time: str
    icon: str

class KycBanResponse(BaseModel):
    address: str
    success: bool
    zk_did: str
    nodes_broadcasted: int
    propagation_details: list[PropagationNode]
    message: str
    zk_proof: Optional[dict] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    registry_size: int

class GraphNode(BaseModel):
    id: str           # wallet address
    label: str        # short display name
    tier: str         # CLEAN / SUSPICIOUS / HIGH_RISK / UNKNOWN
    flag_count: int
    confidence_tier: str
    is_flagged: bool

class GraphEdge(BaseModel):
    source: str
    target: str
    weight: int       # 1=known relationship, 2=both flagged

class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    flagged_count: int
    total_nodes: int


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow().isoformat(),
        registry_size=len(_load_registry()),
    )


@app.get("/score/{address}", response_model=ScoreResponse)
def get_score(address: str):
    """Score a wallet address. Does NOT store anything — pure query."""
    if not address.startswith("0x") or len(address) < 10:
        raise HTTPException(status_code=400, detail="Invalid address format")
    
    result = score_address(address)
    return ScoreResponse(
        address=result.address,
        score=result.score,
        tier=result.tier,
        flags=result.flags,
        tx_count=result.tx_count,
        mixer_interactions=result.mixer_interactions,
        exceeds_threshold=result.exceeds_threshold,
        data_source=result.data_source,
        ai_confidence=result.ai_confidence,
    )


@app.post("/flag/{address}", response_model=FlagResponse)
def flag_address(address: str):
    """
    Score address, generate ZK proof if HIGH RISK, submit to registry.
    The proof proves 'score > threshold' without revealing the score.
    """
    if not address.startswith("0x") or len(address) < 10:
        raise HTTPException(status_code=400, detail="Invalid address format")

    result = score_address(address)

    if not result.exceeds_threshold:
        return FlagResponse(
            address=result.address,
            flagged=False,
            proof_id=None,
            commitment=None,
            message=f"Score {result.score} does not exceed threshold. No proof generated.",
        )

    proof = _generate_and_save_proof(result.address, result.score)
    if not proof:
        return FlagResponse(
            address=result.address,
            flagged=False,
            proof_id=None,
            commitment=None,
            message="Proof generation failed.",
        )

    return FlagResponse(
        address=result.address,
        flagged=True,
        proof_id=proof["proofId"],
        commitment=proof["commitment"][:20] + "...",
        message="ZK proof generated and submitted to registry.",
    )


@app.post("/kyc/ban/{address}", response_model=KycBanResponse)
async def ban_identity(address: str):
    """
    Simulates a Zero-Knowledge Identity Ban using a real P2P broadcast.
    Broadcasts the ZK-DID to actual standalone peer nodes and measures real network latency.
    """
    if not address.startswith("0x") or len(address) < 10:
        raise HTTPException(status_code=400, detail="Invalid address format")

    result = score_address(address)

    if not result.exceeds_threshold:
        return KycBanResponse(
            address=address,
            success=False,
            zk_did="",
            nodes_broadcasted=0,
            propagation_details=[],
            message=f"Identity Ban Rejected: Wallet score ({result.score}) does not exceed malicious threshold.",
            zk_proof=None
        )

    # Generate a deterministic but secure-looking DID based on the address
    GLOBAL_IDENTITY_SALT = "SENTINEL_MESH_KYC_SALT"
    hash_obj = hashlib.sha256(f"{address.lower()}:{GLOBAL_IDENTITY_SALT}".encode())
    digest = hash_obj.hexdigest().upper()
    zk_did = f"ZK-DID: {digest[:16]}-{digest[16:20]}-{digest[20:24]}"

    # Define our P2P network peers
    # Using 127.0.0.1 instead of localhost prevents a 2-second IPv6 fallback delay on Windows
    PEERS = [
        {"url": "http://127.0.0.1:8001/p2p/receive-ban", "name": "Exchange Alpha", "icon": "\U0001f3e6"},
        {"url": "http://127.0.0.1:8002/p2p/receive-ban", "name": "Wallet Beta", "icon": "\U0001f4bc"},
        {"url": "http://127.0.0.1:8003/p2p/receive-ban", "name": "Protocol Gamma", "icon": "\U0001f3db"},
        {"url": "http://127.0.0.1:8004/p2p/receive-ban", "name": "Yield Farm Delta", "icon": "\U0001f33e"},
        {"url": "http://127.0.0.1:8005/p2p/receive-ban", "name": "Bridge Node Epsilon", "icon": "\U0001f30d"},
        {"url": "http://127.0.0.1:8006/p2p/receive-ban", "name": "Custodian Zeta", "icon": "\U0001f4b0"},
    ]

    async def notify_peer(peer):
        start_time = time.time()
        try:
            # We use asyncio.to_thread because requests is synchronous and we want to broadcast in parallel
            res = await asyncio.to_thread(requests.post, peer["url"], json={"zk_did": zk_did}, timeout=2.0)
            latency = time.time() - start_time
            if res.status_code == 200:
                return PropagationNode(name=peer["name"], status="BANNED", time=f"{latency:.2f}s", icon=peer["icon"])
            else:
                return PropagationNode(name=peer["name"], status="FAILED", time=f"{latency:.2f}s", icon=peer["icon"])
        except Exception:
            latency = time.time() - start_time
            return PropagationNode(name=peer["name"], status="TIMEOUT (OFFLINE)", time=f"{latency:.2f}s", icon="\u274c")

    # Broadcast to all peers simultaneously and wait for responses
    broadcast_tasks = [notify_peer(peer) for peer in PEERS]
    nodes = await asyncio.gather(*broadcast_tasks)

    # Add the DeFi bridge as a simulated smart-contract automated response (faster latency)
    nodes.append(PropagationNode(name="DeFi Bridge", status="ADDRESS BLOCKED", time="0.05s", icon="\U0001f309"))

    # Push the real event to the live ticker instantly!
    await ticker_queue.put({
        "text": f"GLOBAL BAN ENFORCED: {zk_did} across {len(nodes)} nodes.",
        "color": "#ef4444" # Red for HIGH ALERT
    })

    # Load actual ZK-Proof from disk for the UI terminal
    zk_proof_payload = None
    try:
        import os
        proof_path = os.path.join(os.path.dirname(__file__), "..", "zkp", "appeals", "423993c33e3b012d.json")
        with open(proof_path, "r") as f:
            zk_proof_payload = json.load(f)
    except Exception as e:
        print(f"Error loading ZK proof: {e}")

    return KycBanResponse(
        address=address,
        success=True,
        zk_did=zk_did,
        nodes_broadcasted=len(nodes),
        propagation_details=nodes,
        message="Address successfully banned globally across all Sentinel Mesh nodes.",
        zk_proof=zk_proof_payload
    )


@app.get("/query/{address}", response_model=QueryResponse)
def query_address(address: str):
    """
    Public query — check if an address is flagged in the registry.
    Returns ONLY flag count and confidence tier — never reveals scores or evidence.
    """
    if not address.startswith("0x") or len(address) < 10:
        raise HTTPException(status_code=400, detail="Invalid address format")

    proofs = _get_proofs_for(address)
    latest = max((p["timestamp"] for p in proofs), default=None)

    return QueryResponse(
        address=address.lower(),
        is_flagged=len(proofs) > 0,
        flag_count=len(proofs),
        confidence_tier=_get_confidence_tier(len(proofs)),
        proof_ids=[p["proofId"] for p in proofs],
        latest_flag_ts=latest,
    )


@app.get("/registry", response_model=list[RegistryEntry])
def get_registry():
    """Return all flagged addresses with proof metadata. No scores. No evidence."""
    all_proofs = _load_registry()

    # Group by address to get confidence tier
    addr_counts: dict[str, int] = {}
    for p in all_proofs:
        addr_counts[p["address"]] = addr_counts.get(p["address"], 0) + 1

    entries = []
    for p in all_proofs:
        entries.append(RegistryEntry(
            address=p["address"],
            proof_id=p["proofId"],
            commitment=p["commitment"],
            threshold=p["threshold"],
            timestamp=p["timestamp"],
            confidence_tier=_get_confidence_tier(addr_counts[p["address"]]),
        ))

    return sorted(entries, key=lambda e: e.timestamp, reverse=True)


@app.get("/graph", response_model=GraphResponse)
def get_graph(focus: Optional[str] = None):
    """
    Returns a network graph of wallet relationships for D3 visualization.
    Merges static known relationships with live registry proof data.
    If 'focus' is provided, dynamically injects connections to known malicious nodes for the demo.
    """
    all_proofs  = _load_registry()
    addr_counts: dict[str, int] = {}
    for p in all_proofs:
        addr_counts[p["address"]] = addr_counts.get(p["address"], 0) + 1

    # Collect all unique addresses from relationships + registry
    all_addrs: set[str] = set()
    for src, dst in WALLET_RELATIONSHIPS:
        all_addrs.add(src.lower())
        all_addrs.add(dst.lower())
    for addr in addr_counts:
        all_addrs.add(addr)

    # Build nodes
    nodes = []
    for addr in all_addrs:
        count = addr_counts.get(addr, 0)
        is_flagged = count > 0
        # Score to get tier (fast, no side effects)
        scored = score_address(addr)
        nodes.append(GraphNode(
            id=addr,
            label=WALLET_LABELS.get(addr, f"{addr[:6]}...{addr[-4:]}"),
            tier=scored.tier,
            flag_count=count,
            confidence_tier=_get_confidence_tier(count),
            is_flagged=is_flagged,
        ))

    # Build edges
    flagged_set = set(addr_counts.keys())
    edges = []
    seen_edges: set[tuple] = set()
    for src, dst in WALLET_RELATIONSHIPS:
        src, dst = src.lower(), dst.lower()
        key = (min(src, dst), max(src, dst))
        if key not in seen_edges:
            seen_edges.add(key)
            weight = 2 if (src in flagged_set and dst in flagged_set) else 1
            edges.append(GraphEdge(source=src, target=dst, weight=weight))

    # Demo Magic: Dynamically link the focused node to malicious hubs
    if focus:
        focus = focus.lower()
        if focus not in all_addrs:
            # If it wasn't already in the graph, we need to add the node manually here
            count = addr_counts.get(focus, 0)
            scored = score_address(focus)
            nodes.append(GraphNode(
                id=focus,
                label=f"{focus[:6]}...{focus[-4:]}",
                tier=scored.tier,
                flag_count=count,
                confidence_tier=_get_confidence_tier(count),
                is_flagged=count > 0,
            ))
            all_addrs.add(focus)
        
        # Draw red laser lines to Lazarus Group and Tornado Cash
        malicious = ["0x7f367cc41522ce07553e823bf3be79a889debe1b", "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b"]
        for m in malicious:
            key = (min(focus, m), max(focus, m))
            if key not in seen_edges:
                seen_edges.add(key)
                edges.append(GraphEdge(source=focus, target=m, weight=3)) # 3 for red laser

    return GraphResponse(
        nodes=nodes,
        edges=edges,
        flagged_count=len(flagged_set),
        total_nodes=len(nodes),
    )


# ── Simulate models ───────────────────────────────────────────────────────────

class MemberInfo(BaseModel):
    id: str
    name: str
    type: str
    description: str
    icon: str
    color: str

class SimulateStep(BaseModel):
    step: int
    member: MemberInfo
    scored: int
    tier: str
    flagged: bool
    proof_id: Optional[str]
    member_tag: Optional[str]
    confidence_before: str
    confidence_after: str

class SimulateResponse(BaseModel):
    address: str
    steps: list[SimulateStep]
    final_confidence: str
    total_flags: int
    members_info: list[MemberInfo]


@app.post("/simulate/{address}", response_model=SimulateResponse)
def simulate_network(address: str):
    """
    Simulate 3 independent network members each scoring and flagging a wallet.
    Shows real-time confidence escalation: NONE -> LOW -> MEDIUM -> HIGH.
    This is the core demo endpoint for the hackathon presentation.
    """
    if not address.startswith("0x") or len(address) < 10:
        raise HTTPException(status_code=400, detail="Invalid address format")

    raw_steps = run_simulation(address)

    steps = []
    for s in raw_steps:
        steps.append(SimulateStep(
            step=s["step"],
            member=MemberInfo(**s["member"]),
            scored=s["scored"],
            tier=s["tier"],
            flagged=s["flagged"],
            proof_id=s.get("proof_id"),
            member_tag=s.get("member_tag"),
            confidence_before=s["confidence_before"],
            confidence_after=s["confidence_after"],
        ))

    total_flags     = sum(1 for s in steps if s.flagged)
    final_confidence = steps[-1].confidence_after if steps else "NONE"

    return SimulateResponse(
        address=address.lower(),
        steps=steps,
        final_confidence=final_confidence,
        total_flags=total_flags,
        members_info=[MemberInfo(**m) for m in MEMBERS],
    )


@app.get("/members", response_model=list[MemberInfo])
def get_members():
    """Return the list of simulated network members."""
    return [MemberInfo(**m) for m in MEMBERS]


# ── Appeal models ──────────────────────────────────────────────────────────────

class AppealRequest(BaseModel):
    reason: str          # kept private — only commitment stored
    evidence_urls: list[str] = []

class AppealPublic(BaseModel):
    appeal_id: str
    address: str
    reason_commitment: str
    evidence_count: int
    evidence_hashes: list[str]
    timestamp: int
    status: str

class AppealResponse(BaseModel):
    public: AppealPublic
    private_witness: dict    # shown ONCE to appellant — contains salt + reason
    appeal_status: str       # NONE / PENDING / DISPUTED
    flag_count: int
    appeal_count: int
    message: str

class AppealStatusResponse(BaseModel):
    address: str
    flag_count: int
    appeal_count: int
    appeal_status: str       # NONE / PENDING / DISPUTED
    appeals: list[AppealPublic]

class VerifyAppealRequest(BaseModel):
    appeal_id: str
    reason: str
    salt: str

class AppealChatRequest(BaseModel):
    message: str

class AppealChatResponse(BaseModel):
    reply: str
    status: str


# ── Appeal routes ──────────────────────────────────────────────────────────────

@app.post("/appeal/{address}", response_model=AppealResponse)
def submit_appeal(address: str, body: AppealRequest):
    """
    Submit a counter-proof appeal for a flagged wallet.
    The reason is committed to via SHA256(reason+salt) — never stored in plaintext.
    Returns the private witness ONCE — appellant must save their salt.
    """
    if not address.startswith("0x") or len(address) < 10:
        raise HTTPException(status_code=400, detail="Invalid address format")
    if not body.reason or len(body.reason.strip()) < 10:
        raise HTTPException(status_code=400, detail="Reason must be at least 10 characters")

    proofs  = _get_proofs_for(address)
    if not proofs:
        raise HTTPException(status_code=400, detail="Address is not flagged — no appeal needed")

    result  = create_appeal(address, body.reason.strip(), body.evidence_urls)
    appeals = get_appeals_for(address)

    flag_count   = len(proofs)
    appeal_count = len(appeals)
    status       = _appeal_status(appeal_count, flag_count)

    return AppealResponse(
        public=AppealPublic(**result["public"]),
        private_witness=result["private_witness"],
        appeal_status=status,
        flag_count=flag_count,
        appeal_count=appeal_count,
        message=(
            f"Appeal submitted. Status: {status}. "
            f"Save your private_witness — it proves authorship. "
            f"It will NOT be stored on the server."
        ),
    )


@app.get("/appeal/{address}", response_model=AppealStatusResponse)
def get_appeal_status(address: str):
    """
    Public query — returns appeal status for an address.
    Only commitments visible — reason text is never revealed.
    """
    if not address.startswith("0x") or len(address) < 10:
        raise HTTPException(status_code=400, detail="Invalid address format")

    proofs  = _get_proofs_for(address)
    appeals = get_appeals_for(address)

    return AppealStatusResponse(
        address=address.lower(),
        flag_count=len(proofs),
        appeal_count=len(appeals),
        appeal_status=_appeal_status(len(appeals), len(proofs)),
        appeals=[AppealPublic(**a) for a in appeals],
    )


@app.post("/appeal/verify")
def verify_appeal(body: VerifyAppealRequest):
    """
    Prove authorship of an appeal without revealing the reason.
    Recomputes SHA256(reason+salt) and checks against stored commitment.
    This is the 'due process' step — shows the appeal was filed by the wallet owner.
    """
    result = verify_appeal_authorship(body.appeal_id, body.reason, body.salt)
    return result


@app.get("/appeals")
def list_all_appeals():
    """Admin view — all appeals across all addresses."""
    return get_all_appeals()

@app.post("/appeal/chat/{address}", response_model=AppealChatResponse)
async def appeal_chat(address: str, body: AppealChatRequest):
    """
    AI Court of Appeals Chatbot.
    Simulates a Federated AI responding to user arguments based on on-chain heuristics.
    """
    msg = body.message.lower()
    
    # Simulate thinking delay
    import asyncio
    await asyncio.sleep(1.5)
    
    if "tornado" in msg or "mixer" in msg:
        return AppealChatResponse(
            reply="Analysis of on-chain heuristics confirms Tornado Cash usage. Privacy tools do not exempt you from AML compliance. The zero-knowledge proof of your transaction velocity exceeds the threshold. Appeal Denied.",
            status="DENIED"
        )
    elif "hack" in msg or "stolen" in msg or "exploit" in msg:
        return AppealChatResponse(
            reply="Funds traced to the Lazarus Group exploit. The graph algorithms show a 94% probability of correlation. We cannot un-ban addresses linked to sanctioned entities. Appeal Denied.",
            status="DENIED"
        )
    elif "innocent" in msg or "mistake" in msg:
        return AppealChatResponse(
            reply="The decentralized registry has flagged this address across 3 independent nodes. A deterministic ZK-proof was verified on the Midnight network. Mathematical proofs do not make mistakes.",
            status="DENIED"
        )
    elif "kyc" in msg or "identity" in msg:
        return AppealChatResponse(
            reply="Your Identity Hash is permanently banned across the Sentinel Mesh. We do not know your real name, but this cryptographic identity will be blocked from all partner exchanges.",
            status="DENIED"
        )
    else:
        return AppealChatResponse(
            reply="Your argument has been analyzed by the Sentinel Mesh Federated AI. Based on the immutable on-chain evidence, your risk score remains critical. Provide further verifiable cryptographic proof to proceed.",
            status="PENDING"
        )
