/**
 * Sentinel Mesh — ZK Proof Tests
 * Run: node test_prover.js
 */

const { generateProof, verifyProof, saveProof, getProofsForAddress, getAllProofs, THRESHOLD } = require("./prover");
const fs   = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failed++;
  }
}

// Clean proofs dir before tests
const proofsDir = path.join(__dirname, "proofs");
if (fs.existsSync(proofsDir)) {
  fs.readdirSync(proofsDir).forEach(f => fs.unlinkSync(path.join(proofsDir, f)));
}

console.log("\n=== ZK Prover Tests ===\n");

// ── Test 1: High-risk address gets a proof ────────────────────────────────────
console.log("1. Proof generation for high-risk wallet:");
const highRiskAddr = "0x7f367cc41522ce07553e823bf3be79a889debe1b";
const result = generateProof(highRiskAddr, 100);
assert(result !== null, "generateProof returns result for score=100");
assert(result.publicProof !== undefined, "publicProof exists");
assert(result.privateWitness !== undefined, "privateWitness exists");
assert(result.publicProof.exceeds === true, "exceeds flag is true");
assert(result.publicProof.threshold === THRESHOLD, `threshold is ${THRESHOLD}`);
assert(result.publicProof.address === highRiskAddr, "address stored correctly");
assert(result.publicProof.commitment.length === 64, "commitment is 64-char hex");
assert(result.publicProof.proofId.length === 16, "proofId is 16-char hex");
assert(result.privateWitness.score === 100, "private witness holds real score");

// ── Test 2: Clean address gets NO proof ───────────────────────────────────────
console.log("\n2. No proof for clean wallet:");
const cleanAddr = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
const noResult = generateProof(cleanAddr, 0);
assert(noResult === null, "generateProof returns null for score <= threshold");

// ── Test 3: Score exactly at threshold gets no proof ─────────────────────────
console.log("\n3. Boundary — score exactly at threshold:");
const boundaryResult = generateProof("0xaabbccddaabbccddaabbccddaabbccddaabbccdd", THRESHOLD);
assert(boundaryResult === null, `score=${THRESHOLD} (at boundary) returns null — must be strictly above`);

// ── Test 4: Score one above threshold gets proof ──────────────────────────────
console.log("\n4. Boundary — score one above threshold:");
const aboveResult = generateProof("0xaabbccddaabbccddaabbccddaabbccddaabbccdd", THRESHOLD + 1);
assert(aboveResult !== null, `score=${THRESHOLD + 1} gets a proof`);
assert(aboveResult.publicProof.exceeds === true, "exceeds is true");

// ── Test 5: Proof verification ─────────────────────────────────────────────────
console.log("\n5. Proof verification:");
const { publicProof } = result;
const verification = verifyProof(publicProof);
assert(verification.valid === true, "valid proof verifies successfully");
assert(verification.reason === "Proof verified", "correct verification message");

// ── Test 6: Tampered proof fails verification ─────────────────────────────────
console.log("\n6. Tampered proof rejection:");
const tampered = { ...publicProof, proofId: "0000000000000000" };
const tamperedResult = verifyProof(tampered);
assert(tamperedResult.valid === false, "tampered proofId fails verification");

const missingFields = { commitment: "abc" };
const missingResult = verifyProof(missingFields);
assert(missingResult.valid === false, "missing fields fail verification");

const wrongThreshold = { ...publicProof, threshold: 70 };
const wrongThresholdResult = verifyProof(wrongThreshold);
assert(wrongThresholdResult.valid === false, "wrong threshold fails verification");

// ── Test 7: Save and retrieve proofs ──────────────────────────────────────────
console.log("\n7. Proof persistence:");
saveProof(publicProof);
const retrieved = getProofsForAddress(highRiskAddr);
assert(retrieved.length === 1, "one proof stored for address");
assert(retrieved[0].proofId === publicProof.proofId, "retrieved proofId matches");

// Save second proof for another address
const { publicProof: proof2 } = generateProof("0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b", 100);
saveProof(proof2);
const all = getAllProofs();
assert(all.length === 2, "registry contains 2 proofs total");

// ── Test 8: Commitment uniqueness (two runs produce different commitments) ─────
console.log("\n8. Commitment randomness (salt ensures uniqueness):");
const r1 = generateProof("0x1111111111111111111111111111111111111111", 80);
const r2 = generateProof("0x1111111111111111111111111111111111111111", 80);
assert(r1.publicProof.commitment !== r2.publicProof.commitment, "same score, different commitments (salt works)");

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(40));

if (failed > 0) process.exit(1);
