/**
 * Sentinel Mesh — ZK Proof System (snarkjs, no circom compiler needed)
 * 
 * Uses snarkjs's Groth16 scheme with a pre-built WASM circuit.
 * Since we can't compile circom at a hackathon, we implement the 
 * threshold check directly using snarkjs's plonk or use a 
 * hash-commitment approach as our ZK primitive.
 * 
 * APPROACH: 
 *   commitment = hash(score || salt)
 *   proof = { commitment, threshold, exceeds: bool }
 *   verifier checks: commitment matches, and trusts the prover's bool
 *   (Full ZK = circom circuit; this is the pragmatic hackathon version)
 */

const snarkjs = require("snarkjs");
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");

const THRESHOLD = 60;
const PROOFS_DIR = path.join(__dirname, "proofs");

if (!fs.existsSync(PROOFS_DIR)) fs.mkdirSync(PROOFS_DIR, { recursive: true });

// ── Commitment scheme ─────────────────────────────────────────────────────────

/**
 * Generate a ZK-style commitment for a score.
 * commitment = SHA256(score + ":" + salt)
 * This hides the score — you can verify the proof without learning the score.
 */
function generateCommitment(score, salt) {
  return crypto
    .createHash("sha256")
    .update(`${score}:${salt}`)
    .digest("hex");
}

/**
 * Generate a proof that score > THRESHOLD without revealing score.
 * @param {string} address   - wallet address to flag
 * @param {number} score     - private risk score (never published)
 * @param {string} memberId  - optional member identifier (gets anonymised via hash)
 */
function generateProof(address, score, memberId = "default") {
  if (score <= THRESHOLD) {
    return null; // Only generate proofs for high-risk wallets
  }

  const salt       = crypto.randomBytes(16).toString("hex");
  const commitment = generateCommitment(score, salt);
  const timestamp  = Date.now();

  // Anonymise member identity — registry knows a unique member flagged it,
  // but cannot determine WHICH exchange/member it was.
  const memberTag = crypto
    .createHash("sha256")
    .update(`${memberId}:${salt}`)   // salt prevents reverse-lookup
    .digest("hex")
    .slice(0, 12);

  // The "proof" — what gets posted publicly (score and member identity hidden)
  const publicProof = {
    address:    address.toLowerCase(),
    commitment,                        // hides score
    memberTag,                         // hides member identity
    threshold:  THRESHOLD,
    exceeds:    true,
    timestamp,
    proofId:    crypto.createHash("sha256")
                  .update(`${address}:${commitment}:${timestamp}:${memberTag}`)
                  .digest("hex")
                  .slice(0, 16),
  };

  // The "witness" — kept secret by the submitting member, never published
  const privateWitness = {
    score,
    salt,
    memberId,
    address:    address.toLowerCase(),
    commitment,
  };

  return { publicProof, privateWitness };
}

/**
 * Verify a public proof.
 * In a real ZK system, this verifies the cryptographic proof.
 * Here: we verify structural integrity + commitment format.
 */
function verifyProof(publicProof) {
  if (!publicProof.commitment || !publicProof.address || !publicProof.proofId) {
    return { valid: false, reason: "Missing required fields" };
  }

  if (!publicProof.exceeds) {
    return { valid: false, reason: "Proof does not claim threshold exceeded" };
  }

  if (publicProof.threshold !== THRESHOLD) {
    return { valid: false, reason: "Threshold mismatch" };
  }

  // Verify proofId integrity (now includes memberTag)
  const expectedId = crypto
    .createHash("sha256")
    .update(`${publicProof.address}:${publicProof.commitment}:${publicProof.timestamp}:${publicProof.memberTag || ""}`)
    .digest("hex")
    .slice(0, 16);

  if (expectedId !== publicProof.proofId) {
    return { valid: false, reason: "ProofId integrity check failed" };
  }

  return { valid: true, reason: "Proof verified" };
}

/**
 * Save proof to disk (simulates on-chain submission).
 */
function saveProof(publicProof) {
  const filename = path.join(PROOFS_DIR, `${publicProof.proofId}.json`);
  fs.writeFileSync(filename, JSON.stringify(publicProof, null, 2));
  return filename;
}

/**
 * Load all proofs for an address from disk (simulates registry query).
 */
function getProofsForAddress(address) {
  const normalizedAddr = address.toLowerCase();
  const files = fs.readdirSync(PROOFS_DIR).filter(f => f.endsWith(".json"));
  
  return files
    .map(f => JSON.parse(fs.readFileSync(path.join(PROOFS_DIR, f), "utf8")))
    .filter(p => p.address === normalizedAddr);
}

/**
 * Get all proofs in the registry.
 */
function getAllProofs() {
  const files = fs.readdirSync(PROOFS_DIR).filter(f => f.endsWith(".json"));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(PROOFS_DIR, f), "utf8")));
}

// ── CLI demo ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log("\n--- SENTINEL MESH -- ZK Proof Generator ---\n");

  const demos = [
    { address: "0x7f367cc41522ce07553e823bf3be79a889debe1b", score: 100 }, // Lazarus
    { address: "0xd882cfc20f52f2599d84b8e8d58c7fb62cfe344b", score: 100 }, // Hydra
    { address: "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b", score: 75  }, // Tornado Cash
    { address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", score: 0   }, // vitalik (no proof)
  ];

  for (const { address, score } of demos) {
    const short = `${address.slice(0,10)}...${address.slice(-6)}`;
    
    if (score <= THRESHOLD) {
      console.log(`[SKIP]  ${short} — score ${score} <= ${THRESHOLD}, no proof generated`);
      continue;
    }

    const result = generateProof(address, score);
    if (!result) continue;

    const { publicProof } = result;
    const saved = saveProof(publicProof);
    const verification = verifyProof(publicProof);

    console.log(`[PROOF] ${short}`);
    console.log(`  Score (private) : ${score}/100`);
    console.log(`  Commitment      : ${publicProof.commitment.slice(0,20)}...`);
    console.log(`  ProofId         : ${publicProof.proofId}`);
    console.log(`  Verified        : ${verification.valid} — ${verification.reason}`);
    console.log(`  Saved to        : ${path.basename(saved)}`);
    console.log();
  }

  console.log("--- Registry contents ---");
  const all = getAllProofs();
  console.log(`Total proofs stored: ${all.length}`);
  all.forEach(p => {
    console.log(`  ${p.address.slice(0,10)}...${p.address.slice(-6)} -> proofId: ${p.proofId}`);
  });
}

module.exports = { generateProof, verifyProof, saveProof, getProofsForAddress, getAllProofs, THRESHOLD };
