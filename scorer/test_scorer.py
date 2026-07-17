"""
Tests for the Sentinel Mesh fraud scorer.
Run: pytest test_scorer.py -v
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from scorer import score_address, RISK_THRESHOLD, ScoringResult


# ── Known HIGH RISK addresses ─────────────────────────────────────────────────

def test_lazarus_group_is_high_risk():
    """US Treasury OFAC sanctioned — Lazarus Group (North Korea)."""
    result = score_address("0x7f367cc41522ce07553e823bf3be79a889debe1b")
    assert result.tier == "HIGH_RISK", f"Expected HIGH_RISK, got {result.tier} (score={result.score})"
    assert result.score > RISK_THRESHOLD
    assert result.exceeds_threshold is True
    assert "OFAC_SANCTIONED" in result.flags

def test_hydra_marketplace_is_high_risk():
    """OFAC sanctioned darknet marketplace."""
    result = score_address("0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b")
    assert result.tier == "HIGH_RISK"
    assert result.exceeds_threshold is True
    assert "OFAC_SANCTIONED" in result.flags

def test_known_mixer_is_high_risk():
    """Tornado Cash contract should be flagged as mixer."""
    result = score_address("0xd90e2f925da726b50c4ed8d0fb90ad053324f31b")
    assert result.tier == "HIGH_RISK"
    assert "KNOWN_MIXER_CONTRACT" in result.flags


# ── Known CLEAN addresses ─────────────────────────────────────────────────────

def test_vitalik_is_clean():
    """vitalik.eth — well-known legitimate address."""
    result = score_address("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
    assert result.tier == "CLEAN", f"Expected CLEAN, got {result.tier} (score={result.score})"
    assert result.score <= 30
    assert result.exceeds_threshold is False

def test_eth2_deposit_contract_is_clean():
    """ETH2 deposit contract — highest-value legitimate contract."""
    result = score_address("0x00000000219ab540356cbb839cbe05303d7705fa")
    assert result.tier == "CLEAN"


# ── Suspicious addresses ───────────────────────────────────────────────────────

def test_suspicious_address_in_middle_tier():
    """Address with some mixer contact but not fully flagged."""
    result = score_address("0x3cbded43efdaf0fc77b9c55f6fc9988fcc9b757d")
    assert result.tier == "SUSPICIOUS", f"Expected SUSPICIOUS, got {result.tier} (score={result.score})"
    assert 30 <= result.score <= 60


# ── Unknown / default address ─────────────────────────────────────────────────

def test_unknown_address_returns_clean():
    """Random unknown address should get a low/clean score."""
    result = score_address("0xabcdef1234567890abcdef1234567890abcdef12")
    assert result.tier == "CLEAN"
    assert result.score <= 30
    assert result.exceeds_threshold is False


# ── Score bounds ──────────────────────────────────────────────────────────────

def test_score_never_exceeds_100():
    result = score_address("0x7f367cc41522ce07553e823bf3be79a889debe1b")
    assert result.score <= 100

def test_score_never_below_zero():
    result = score_address("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
    assert result.score >= 0


# ── Address normalization ─────────────────────────────────────────────────────

def test_address_is_case_insensitive():
    lower  = score_address("0x7f367cc41522ce07553e823bf3be79a889debe1b")
    upper  = score_address("0x7F367cC41522Ce07553e823bf3be79A889DEbe1B")
    assert lower.score == upper.score
    assert lower.tier  == upper.tier

def test_address_handles_whitespace():
    result = score_address("  0xd8da6bf26964af9d7eed9e03e53415d37aa96045  ")
    assert result.tier == "CLEAN"


# ── Result structure ──────────────────────────────────────────────────────────

def test_result_has_all_fields():
    result = score_address("0x7f367cc41522ce07553e823bf3be79a889debe1b")
    assert isinstance(result, ScoringResult)
    assert isinstance(result.address, str)
    assert isinstance(result.score, int)
    assert isinstance(result.tier, str)
    assert isinstance(result.flags, list)
    assert isinstance(result.exceeds_threshold, bool)
    assert result.data_source in ("mock", "live")
