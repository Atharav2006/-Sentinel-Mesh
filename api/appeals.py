"""
Sentinel Mesh — Counter-Proof Appeal System
============================================
Allows a flagged wallet owner to submit a privacy-preserving appeal.

Privacy design:
  - The appeal reason is NEVER stored in plaintext.
  - Only a SHA256(reason + salt) commitment is stored publicly.
  - The wallet owner retains the salt as proof they authored the appeal.
  - If appeals >= flags for an address, confidence tier is DISPUTED.

Appeal states:
  NONE      – no appeal filed
  PENDING   – appeal filed, under review (appeals < flags)
  DISPUTED  – strong appeal, appeal_count >= flag_count
  RESOLVED  – manual resolution (out of scope for hackathon demo)
"""

import json
import hashlib
import secrets
from pathlib import Path
from datetime import datetime

APPEALS_DIR = Path(__file__).parent.parent / "zkp" / "appeals"
APPEALS_DIR.mkdir(parents=True, exist_ok=True)


def _appeal_status(appeal_count: int, flag_count: int) -> str:
    if appeal_count == 0:
        return "NONE"
    if appeal_count >= flag_count:
        return "DISPUTED"
    return "PENDING"


def create_appeal(address: str, reason: str, evidence_urls: list[str] = None) -> dict:
    """
    Create a privacy-preserving appeal for a flagged address.
    The reason is committed to but never stored in plaintext.

    Returns the public appeal record + private witness (shown once to user).
    """
    address = address.lower().strip()
    salt    = secrets.token_hex(16)

    # Commit to the reason without revealing it
    reason_commitment = hashlib.sha256(
        f"{reason}:{salt}".encode()
    ).hexdigest()

    # Evidence: store only hashes of URLs, not the URLs themselves
    evidence_hashes = []
    if evidence_urls:
        for url in evidence_urls[:5]:  # max 5 evidence items
            evidence_hashes.append(
                hashlib.sha256(url.encode()).hexdigest()[:20]
            )

    appeal_id = hashlib.sha256(
        f"{address}:{reason_commitment}:{salt}".encode()
    ).hexdigest()[:16]

    timestamp = int(datetime.utcnow().timestamp() * 1000)

    public_appeal = {
        "appeal_id":         appeal_id,
        "address":           address,
        "reason_commitment": reason_commitment,   # hides reason
        "evidence_count":    len(evidence_hashes),
        "evidence_hashes":   evidence_hashes,     # hides URLs
        "timestamp":         timestamp,
        "status":            "PENDING",
    }

    # Private witness — shown ONCE to the appellant, never stored
    private_witness = {
        "appeal_id": appeal_id,
        "address":   address,
        "reason":    reason,
        "salt":      salt,
        "evidence":  evidence_urls or [],
    }

    # Persist public record
    path = APPEALS_DIR / f"{appeal_id}.json"
    path.write_text(json.dumps(public_appeal, indent=2))

    return {"public": public_appeal, "private_witness": private_witness}


def get_appeals_for(address: str) -> list[dict]:
    """Load all appeals for an address."""
    address = address.lower().strip()
    return [
        json.loads(f.read_text())
        for f in APPEALS_DIR.glob("*.json")
        if json.loads(f.read_text()).get("address") == address
    ]


def get_all_appeals() -> list[dict]:
    """Load all appeals across all addresses."""
    return [json.loads(f.read_text()) for f in APPEALS_DIR.glob("*.json")]


def verify_appeal_authorship(appeal_id: str, reason: str, salt: str) -> dict:
    """
    Allow an appellant to prove they authored an appeal (ZK-style ownership).
    Recomputes the commitment and checks against the stored one.
    """
    path = APPEALS_DIR / f"{appeal_id}.json"
    if not path.exists():
        return {"valid": False, "reason": "Appeal not found"}

    stored = json.loads(path.read_text())
    expected = hashlib.sha256(f"{reason}:{salt}".encode()).hexdigest()

    if expected == stored["reason_commitment"]:
        return {"valid": True, "reason": "Authorship verified — commitment matches"}
    return {"valid": False, "reason": "Commitment mismatch — cannot verify authorship"}
