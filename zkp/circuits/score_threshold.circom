pragma circom 2.0.0;

/*
 * ScoreThreshold — Sentinel Mesh ZK Circuit
 * 
 * Public inputs:  threshold (e.g. 60)
 * Private inputs: score     (e.g. 87)
 * Public output:  1 if score > threshold, else 0
 *
 * Proves: "I know a score that exceeds the threshold"
 * Without revealing: the actual score value
 */

template ScoreThreshold(BITS) {
    // Private witness — the actual risk score (kept secret)
    signal input score;

    // Public input — the threshold (everyone knows this is 60)
    signal input threshold;

    // Public output — 1 = exceeds threshold, 0 = does not
    signal output exceeds;

    // We need to prove: score > threshold
    // Equivalently:     score - threshold - 1 >= 0
    // We do this by decomposing the difference into bits (range proof)

    signal diff;
    diff <== score - threshold - 1;

    // Bit decomposition of diff to prove it's non-negative (< 2^BITS)
    signal bits[BITS];
    var lc = 0;
    var e2 = 1;

    for (var i = 0; i < BITS; i++) {
        bits[i] <-- (diff >> i) & 1;
        bits[i] * (bits[i] - 1) === 0;  // enforce bit is 0 or 1
        lc += bits[i] * e2;
        e2 *= 2;
    }

    // Reconstruct diff from bits — must match original
    lc === diff;

    // If we get here, diff >= 0, meaning score > threshold
    exceeds <== 1;
}

// Score is 0-100, threshold is 0-100, diff fits in 7 bits (128 values)
component main {public [threshold]} = ScoreThreshold(7);
