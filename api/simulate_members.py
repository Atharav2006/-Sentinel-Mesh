"""
Sentinel Mesh — Multi-Member Simulation
========================================
Simulates 3 independent network members (exchanges/protocols) each
independently scoring a wallet and submitting a ZK proof to the registry.

This is the core "network effect" demo — shows how confidence escalates
from LOW → MEDIUM → HIGH as more members independently flag the same address.

Members are real organizations in the real world that would join this network:
- Exchange Alpha  (centralized exchange)
- Wallet Beta     (self-custody wallet provider)
- Protocol Gamma  (DeFi lending protocol)

Each runs its own scorer privately. None sees the others' scores.
Only the ZK proof (score > threshold) gets published.
"""

import sys
import os
import json
import time
import subprocess
from pathlib import Path

ROOT       = Path(__file__).parent.parent
ZKP_DIR    = ROOT / "zkp"
SCORER_DIR = ROOT / "scorer"

sys.path.insert(0, str(SCORER_DIR))
from scorer import score_address

# ── Network members ────────────────────────────────────────────────────────────
# In production: each is a separate keypair holder running their own node.
# In demo: we simulate all three from the same machine.

MEMBERS = [
    {
        "id":          "exchange_alpha_v1",
        "name":        "Exchange Alpha",
        "type":        "Centralized Exchange",
        "description": "Major CEX — detects wash trading + withdrawal anomalies",
        "icon":        "EA",
        "color":       "#6366f1",
    },
    {
        "id":          "wallet_beta_v1",
        "name":        "Wallet Beta",
        "type":        "Self-Custody Wallet",
        "description": "Wallet provider — detects drainer approvals + phishing patterns",
        "icon":        "WB",
        "color":       "#8b5cf6",
    },
    {
        "id":          "protocol_gamma_v1",
        "name":        "Protocol Gamma",
        "type":        "DeFi Protocol",
        "description": "Lending protocol — detects flash loan attacks + liquidation fraud",
        "icon":        "PG",
        "color":       "#a78bfa",
    },
]


def _generate_and_save_proof_for_member(address: str, score: int, member_id: str) -> dict | None:
    """
    Call Node.js prover with member identity.
    Returns the public proof, or None if score <= threshold.
    """
    prover_path = str(ZKP_DIR / "prover.js").replace("\\", "/")
    script = f"""
const {{ generateProof, saveProof }} = require({json.dumps(prover_path)});
const result = generateProof({json.dumps(address)}, {score}, {json.dumps(member_id)});
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
        print(f"Proof generation error: {e}", file=sys.stderr)
    return None


def _confidence_tier(count: int) -> str:
    if count == 0: return "NONE"
    if count == 1: return "LOW"
    if count == 2: return "MEDIUM"
    return "HIGH"


def run_simulation(address: str) -> list[dict]:
    """
    Run all 3 members sequentially.
    Returns a list of step results — one per member.
    Each step shows what that member did and the new registry state.
    """
    address = address.strip().lower()
    steps   = []
    flags_so_far = 0

    for i, member in enumerate(MEMBERS):
        # Each member scores the address independently with their own scorer
        scored = score_address(address)

        step: dict = {
            "step":         i + 1,
            "member":       member,
            "scored":       scored.score,
            "tier":         scored.tier,
            "flagged":      False,
            "proof_id":     None,
            "member_tag":   None,
            "confidence_before": _confidence_tier(flags_so_far),
            "confidence_after":  None,
        }

        if scored.exceeds_threshold:
            proof = _generate_and_save_proof_for_member(address, scored.score, member["id"])
            if proof:
                flags_so_far += 1
                step["flagged"]    = True
                step["proof_id"]   = proof["proofId"]
                step["member_tag"] = proof["memberTag"]

        step["confidence_after"] = _confidence_tier(flags_so_far)
        steps.append(step)

    return steps


# ── CLI runner ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    addr = sys.argv[1] if len(sys.argv) > 1 else "0x7f367cc41522ce07553e823bf3be79a889debe1b"
    print(f"\n=== SENTINEL MESH — Multi-Member Simulation ===")
    print(f"Target: {addr}\n")

    steps = run_simulation(addr)
    for step in steps:
        m = step["member"]
        print(f"Step {step['step']}: {m['name']} ({m['type']})")
        print(f"  Score (private):  {step['scored']}/100  [{step['tier']}]")
        print(f"  Submitted proof:  {'YES — proof_id: ' + step['proof_id'] if step['flagged'] else 'NO (below threshold)'}")
        print(f"  Confidence tier:  {step['confidence_before']} -> {step['confidence_after']}")
        print()
