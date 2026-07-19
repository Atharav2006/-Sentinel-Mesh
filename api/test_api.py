"""
Tests for Sentinel Mesh API.
Starts the FastAPI server in-process and tests all endpoints.
Run: python test_api.py
"""

import sys
import os
import json
import shutil
from pathlib import Path

# Patch path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "scorer"))
sys.path.insert(0, str(ROOT / "api"))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Clear proofs before test run
PROOFS_DIR = ROOT / "zkp" / "proofs"
if PROOFS_DIR.exists():
    shutil.rmtree(PROOFS_DIR)
PROOFS_DIR.mkdir(parents=True, exist_ok=True)

passed = 0
failed = 0

def check(condition, name):
    global passed, failed
    if condition:
        print(f"  [PASS] {name}")
        passed += 1
    else:
        print(f"  [FAIL] {name}")
        failed += 1

print("\n=== API Tests ===\n")

# ── /health ───────────────────────────────────────────────────────────────────
print("1. Health endpoint:")
r = client.get("/health")
check(r.status_code == 200, "returns 200")
check(r.json()["status"] == "ok", "status is ok")
check("timestamp" in r.json(), "has timestamp")
check("registry_size" in r.json(), "has registry_size")

# ── /score — HIGH RISK ────────────────────────────────────────────────────────
print("\n2. Score — known HIGH RISK address:")
r = client.get("/score/0x7f367cc41522ce07553e823bf3be79a889debe1b")
check(r.status_code == 200, "returns 200")
data = r.json()
check(data["tier"] == "HIGH_RISK", "tier is HIGH_RISK")
check(data["score"] > 60, "score > 60")
check(data["exceeds_threshold"] == True, "exceeds_threshold is True")
check("OFAC_SANCTIONED" in data["flags"], "OFAC_SANCTIONED flag present")

# ── /score — CLEAN ────────────────────────────────────────────────────────────
print("\n3. Score — known CLEAN address (vitalik.eth):")
r = client.get("/score/0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
check(r.status_code == 200, "returns 200")
data = r.json()
check(data["tier"] == "CLEAN", "tier is CLEAN")
check(data["exceeds_threshold"] == False, "exceeds_threshold is False")

# ── /score — invalid address ──────────────────────────────────────────────────
print("\n4. Score — invalid address:")
r = client.get("/score/notanaddress")
check(r.status_code == 400, "returns 400 for invalid address")

# ── /flag — HIGH RISK gets proof ──────────────────────────────────────────────
print("\n5. Flag — HIGH RISK address gets ZK proof:")
r = client.post("/flag/0x7f367cc41522ce07553e823bf3be79a889debe1b")
check(r.status_code == 200, "returns 200")
data = r.json()
check(data["flagged"] == True, "flagged is True")
check(data["proof_id"] is not None, "proof_id generated")
check(data["commitment"] is not None, "commitment present")
check("..." in data["commitment"], "commitment is truncated (privacy)")
first_proof_id = data["proof_id"]

# ── /flag — CLEAN address gets NO proof ──────────────────────────────────────
print("\n6. Flag — CLEAN address gets no proof:")
r = client.post("/flag/0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
check(r.status_code == 200, "returns 200")
data = r.json()
check(data["flagged"] == False, "flagged is False")
check(data["proof_id"] is None, "no proof_id")

# ── /query — after flagging ───────────────────────────────────────────────────
print("\n7. Query — after flagging HIGH RISK address:")
r = client.get("/query/0x7f367cc41522ce07553e823bf3be79a889debe1b")
check(r.status_code == 200, "returns 200")
data = r.json()
check(data["is_flagged"] == True, "is_flagged is True")
check(data["flag_count"] == 1, "flag_count is 1")
check(data["confidence_tier"] == "LOW", "confidence_tier is LOW (1 flag)")
check(first_proof_id in data["proof_ids"], "proof_id appears in query result")
check("score" not in data, "score NOT exposed in query response")

# ── /query — unflagged address ────────────────────────────────────────────────
print("\n8. Query — unflagged address:")
r = client.get("/query/0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
data = r.json()
check(data["is_flagged"] == False, "is_flagged is False")
check(data["flag_count"] == 0, "flag_count is 0")
check(data["confidence_tier"] == "NONE", "confidence_tier is NONE")

# ── Confidence tiers (multi-flag simulation) ──────────────────────────────────
print("\n9. Confidence tiers — multi-flag simulation:")
ADDR2 = "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b"
# Flag same address twice more (simulates 2 more members flagging it)
client.post(f"/flag/{ADDR2}")
client.post(f"/flag/{ADDR2}")
client.post(f"/flag/{ADDR2}")
r = client.get(f"/query/{ADDR2}")
data = r.json()
check(data["flag_count"] == 3, "3 flags for address")
check(data["confidence_tier"] == "HIGH", "confidence_tier is HIGH at 3+ flags")

# ── /registry ─────────────────────────────────────────────────────────────────
print("\n10. Registry endpoint:")
r = client.get("/registry")
check(r.status_code == 200, "returns 200")
data = r.json()
check(len(data) >= 1, "registry has at least 1 entry")
first = data[0]
check("address" in first, "entry has address")
check("proof_id" in first, "entry has proof_id")
check("commitment" in first, "entry has commitment")
check("score" not in first, "score NOT in registry entry (privacy)")
check("confidence_tier" in first, "entry has confidence_tier")

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*40}")
print(f"Results: {passed} passed, {failed} failed")
print(f"{'='*40}")

if failed > 0:
    sys.exit(1)
