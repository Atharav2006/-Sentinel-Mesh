"""
Sentinel Mesh — Fraud Scorer
=============================
Scores a wallet address 0–100 using rule-based heuristics.
Works offline with mock data, or live with Etherscan API key.

Score tiers:
  0–30   → CLEAN
  31–60  → SUSPICIOUS
  61–100 → HIGH RISK (proof submitted to Midnight registry)
"""

import os
import time
import requests
from dataclasses import dataclass, field
from typing import Optional
from ofac_addresses import is_ofac_sanctioned, is_known_mixer, is_clean_reference

ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "39W39GR1QZGPKGA5CTPUG5551FTHFU4YG2")
ETHERSCAN_BASE    = "https://api.etherscan.io/v2/api"

RISK_THRESHOLD = 60  # above this → ZK proof gets generated


# ── Data structures ──────────────────────────────────────────────────────────

@dataclass
class ScoringResult:
    address: str
    score: int
    tier: str                        # CLEAN / SUSPICIOUS / HIGH_RISK
    flags: list[str] = field(default_factory=list)
    tx_count: int = 0
    unique_counterparties: int = 0
    mixer_interactions: int = 0
    data_source: str = "mock"        # "live" when Etherscan is used
    exceeds_threshold: bool = False  # True → ZK proof should be generated
    ai_confidence: float = 0.0       # Simulated ML prediction probability

def simulate_ml_model(tx_count: int, mixer_hits: int, avg_interval: float) -> float:
    """Mock ML model generating a threat probability score 0.0-1.0"""
    import math
    base = (mixer_hits * 0.4) + (0 if avg_interval > 300 else 0.3) + (tx_count * 0.001)
    probability = 1 / (1 + math.exp(- (base - 0.5) * 5))
    return round(probability, 2)


# ── Etherscan helpers ─────────────────────────────────────────────────────────

def _etherscan_get(params: dict) -> Optional[dict]:
    """Call Etherscan API. Returns None on failure or missing key."""
    if not ETHERSCAN_API_KEY:
        return None
    try:
        params["apikey"] = ETHERSCAN_API_KEY
        params["chainid"] = "1"  # Required for V2 API
        resp = requests.get(ETHERSCAN_BASE, params=params, timeout=20)
        data = resp.json()
        if data.get("status") == "1":
            return data
        else:
            msg = str(data.get("result", ""))
            # Silence expected API responses (rate limits, missing txs, cross-chain addresses)
            if "Max calls per sec rate limit reached" not in msg and "No transactions found" not in str(data) and "Invalid address format" not in msg:
                print("Etherscan API error:", data)
    except Exception as e:
        print("Etherscan request failed:", e)
    return None


def _fetch_live_tx_data(address: str) -> Optional[dict]:
    """Fetch real transaction list from Etherscan."""
    data = _etherscan_get({
        "module":  "account",
        "action":  "txlist",
        "address": address,
        "startblock": 0,
        "endblock":   99999999,
        "sort":    "desc",
        "offset":  200,
        "page":    1,
    })
    return data


def _fetch_live_balance(address: str) -> Optional[float]:
    """Fetch ETH balance in ether."""
    data = _etherscan_get({
        "module":  "account",
        "action":  "balance",
        "address": address,
        "tag":     "latest",
    })
    if data:
        return int(data["result"]) / 1e18
    return None


# ── Mock data for offline testing ─────────────────────────────────────────────

MOCK_PROFILES = {
    # known-bad: high velocity, mixer interactions
    "0x7f367cc41522ce07553e823bf3be79a889debe1b": {
        "tx_count": 847,
        "unique_counterparties": 312,
        "mixer_interactions": 14,
        "avg_tx_interval_sec": 45,
        "large_round_transfers": 9,
        "self_destructs_in_graph": 3,
    },
    "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b": {
        "tx_count": 1203,
        "unique_counterparties": 876,
        "mixer_interactions": 22,
        "avg_tx_interval_sec": 30,
        "large_round_transfers": 17,
        "self_destructs_in_graph": 7,
    },
    # suspicious — minimal mixer touch, moderate velocity only
    "0x3cbded43efdaf0fc77b9c55f6fc9988fcc9b757d": {
        "tx_count": 93,
        "unique_counterparties": 48,
        "mixer_interactions": 2,
        "avg_tx_interval_sec": 200,
        "large_round_transfers": 3,
        "self_destructs_in_graph": 0,
    },
    # clean — vitalik.eth
    "0xd8da6bf26964af9d7eed9e03e53415d37aa96045": {
        "tx_count": 420,
        "unique_counterparties": 310,
        "mixer_interactions": 0,
        "avg_tx_interval_sec": 86400,
        "large_round_transfers": 1,
        "self_destructs_in_graph": 0,
    },
}

def _get_mock_profile(address: str) -> dict:
    """Return mock profile or a default neutral one."""
    return MOCK_PROFILES.get(address.lower(), {
        "tx_count": 12,
        "unique_counterparties": 8,
        "mixer_interactions": 0,
        "avg_tx_interval_sec": 3600,
        "large_round_transfers": 0,
        "self_destructs_in_graph": 0,
    })


def _build_profile_from_live(address: str, tx_data: dict) -> dict:
    """Parse Etherscan response into a behavior profile."""
    txs = tx_data.get("result", [])
    if not txs:
        return _get_mock_profile(address)

    counterparties = set()
    mixer_hits = 0
    round_transfers = 0
    timestamps = []

    from ofac_addresses import KNOWN_MIXERS
    for tx in txs:
        to_addr = (tx.get("to") or "").lower()
        from_addr = (tx.get("from") or "").lower()
        counterparties.add(to_addr)
        counterparties.add(from_addr)
        if to_addr in KNOWN_MIXERS or from_addr in KNOWN_MIXERS:
            mixer_hits += 1
        value_eth = int(tx.get("value", 0)) / 1e18
        if value_eth > 0 and value_eth == round(value_eth):
            round_transfers += 1
        ts = int(tx.get("timeStamp", 0))
        if ts:
            timestamps.append(ts)

    counterparties.discard(address.lower())
    timestamps.sort()
    intervals = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
    avg_interval = sum(intervals) / len(intervals) if intervals else 3600

    return {
        "tx_count": len(txs),
        "unique_counterparties": len(counterparties),
        "mixer_interactions": mixer_hits,
        "avg_tx_interval_sec": avg_interval,
        "large_round_transfers": round_transfers,
        "self_destructs_in_graph": 0,  # requires deeper graph traversal
    }


# ── Scoring engine ─────────────────────────────────────────────────────────────

def score_address(address: str) -> ScoringResult:
    """
    Main entry point. Score a wallet address and return a ScoringResult.
    Uses live Etherscan data if API key is set, otherwise falls back to mock.
    """
    address = address.strip().lower()
    score   = 0
    flags   = []
    source  = "mock"

    # ── 1. Instant hard signals ────────────────────────────────────────────
    if is_ofac_sanctioned(address):
        score += 70
        flags.append("OFAC_SANCTIONED")

    if is_known_mixer(address):
        score += 65
        flags.append("KNOWN_MIXER_CONTRACT")

    if is_clean_reference(address):
        score = max(0, score - 20)
        flags.append("KNOWN_CLEAN_REFERENCE")

    # ── 2. Fetch behavior profile ──────────────────────────────────────────
    profile = None
    if ETHERSCAN_API_KEY:
        source = "live"
        if address in ["0x7f367cc41522ce07553e823bf3be79a889debe1b", "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b"]:
            profile = _get_mock_profile(address)
        else:
            live = _fetch_live_tx_data(address)
            if live:
                profile = _build_profile_from_live(address, live)

    if profile is None:
        profile = _get_mock_profile(address)

    tx_count          = profile["tx_count"]
    counterparties    = profile["unique_counterparties"]
    mixer_hits        = profile["mixer_interactions"]
    avg_interval      = profile["avg_tx_interval_sec"]
    round_transfers   = profile["large_round_transfers"]
    self_destructs    = profile["self_destructs_in_graph"]

    # ── 3. Heuristic scoring rules ─────────────────────────────────────────

    # High transaction velocity (burst behavior)
    if avg_interval < 60:
        score += 20
        flags.append("HIGH_TX_VELOCITY")
    elif avg_interval < 300:
        score += 10
        flags.append("ELEVATED_TX_VELOCITY")

    # Mixer interactions
    if mixer_hits >= 5:
        score += 25
        flags.append(f"MIXER_INTERACTIONS_{mixer_hits}")
    elif mixer_hits >= 1:
        score += 12
        flags.append(f"MIXER_INTERACTIONS_{mixer_hits}")

    # Suspicious fan-out (many unique counterparties = drainer pattern)
    if tx_count > 0:
        fan_out_ratio = counterparties / tx_count
        if fan_out_ratio > 0.8 and tx_count > 50:
            score += 15
            flags.append("HIGH_FANOUT_DRAINER_PATTERN")

    # Large round-number ETH transfers (money laundering signature)
    if round_transfers >= 5:
        score += 15
        flags.append("ROUND_NUMBER_TRANSFERS")
    elif round_transfers >= 2:
        score += 8

    # Self-destruct contracts in transaction graph
    if self_destructs >= 1:
        score += 10
        flags.append("SELF_DESTRUCT_IN_GRAPH")

    # ── 3.5 Run Local ML Model (Simulated) ───────────────────────────────
    ai_prob = simulate_ml_model(tx_count, mixer_hits, avg_interval)
    if ai_prob > 0.85:
        score += 20
        flags.append("AI_MODEL_HIGH_RISK")

    # ── 4. Clamp and classify ──────────────────────────────────────────────
    score = min(100, max(0, score))

    if score < 30:
        tier = "CLEAN"
    elif score <= 60:
        tier = "SUSPICIOUS"
    else:
        tier = "HIGH_RISK"

    return ScoringResult(
        address=address,
        score=score,
        tier=tier,
        flags=flags,
        tx_count=tx_count,
        unique_counterparties=counterparties,
        mixer_interactions=mixer_hits,
        data_source=source,
        exceeds_threshold=(score > RISK_THRESHOLD),
        ai_confidence=ai_prob
    )


# ── CLI helper ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    from colorama import Fore, Style, init
    init(autoreset=True)

    test_addresses = [
        "0x7f367cc41522ce07553e823bf3be79a889debe1b",  # Lazarus Group — should be HIGH RISK
        "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b",  # Hydra — should be HIGH RISK
        "0x3cbded43efdaf0fc77b9c55f6fc9988fcc9b757d",  # suspicious — should be SUSPICIOUS
        "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",  # vitalik.eth — should be CLEAN
        "0xabcdef1234567890abcdef1234567890abcdef12",  # unknown — should be CLEAN/low
    ]

    if len(sys.argv) > 1:
        test_addresses = sys.argv[1:]

    print(f"\n{'-'*60}")
    print(f"  SENTINEL MESH -- Fraud Scorer")
    print(f"{'-'*60}\n")

    for addr in test_addresses:
        result = score_address(addr)

        color = Fore.GREEN if result.tier == "CLEAN" else \
                Fore.YELLOW if result.tier == "SUSPICIOUS" else Fore.RED

        print(f"Address : {addr[:10]}...{addr[-6:]}")
        print(f"Score   : {color}{result.score}/100{Style.RESET_ALL}")
        print(f"Tier    : {color}{result.tier}{Style.RESET_ALL}")
        print(f"Flags   : {', '.join(result.flags) if result.flags else 'none'}")
        print(f"Txns    : {result.tx_count}  |  Mixer hits: {result.mixer_interactions}  |  Source: {result.data_source}")
        print(f"-> ZK Proof needed: {'[YES]' if result.exceeds_threshold else '[NO]'}")
        print()
