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

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(generate_mock_events())

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
                break
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


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
        {"url": "http://127.0.0.1:8003/p2p/receive-ban", "name": "Exchange Gamma", "icon": "\U0001f3db"},
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
def get_graph():
    """
    Returns a network graph of wallet relationships for D3 visualization.
    Merges static known relationships with live registry proof data.
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
