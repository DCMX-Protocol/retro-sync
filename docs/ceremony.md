# Retrosync ZK Trusted Setup Ceremony — Runbook

## Overview

The `RoyaltySplitCircuit` requires a Groth16 powers-of-tau trusted setup.
The resulting verifying key is deployed to `ZKVerifier.sol` on BTTC.

- **Testnet**: single-party ceremony via `cargo run --bin ceremony`
- **Mainnet**: multi-party MPC ceremony (at least 3 independent parties)

---

## Testnet (single-party)

```bash
cargo run --bin ceremony -- --output vk.json --artists 16
```

This outputs `vk.json` with all G1/G2 coordinates.

**Warning**: single-party setup means the operator knows the toxic waste τ.
This is acceptable for testnet. Never use for mainnet.

---

## Mainnet (MPC)

Use [SnarkJS](https://github.com/iden3/snarkjs) phase2 MPC:

```bash
# 1. Export circuit as R1CS
cargo test --package zk_circuits -- export_r1cs --nocapture

# 2. Download powers of tau (Hermez ceremony, supports up to 2^28 constraints)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau

# 3. Phase 2 initialization
snarkjs groth16 setup royalty_split.r1cs powersOfTau28_hez_final_16.ptau circuit_0000.zkey

# 4. Each party contributes (minimum 3)
snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey --name="Party 1"
snarkjs zkey contribute circuit_0001.zkey circuit_0002.zkey --name="Party 2"
snarkjs zkey contribute circuit_0002.zkey circuit_final.zkey --name="Party 3"

# 5. Verify final zkey
snarkjs zkey verify royalty_split.r1cs powersOfTau28_hez_final_16.ptau circuit_final.zkey

# 6. Export verifying key
snarkjs zkey export verificationkey circuit_final.zkey vk.json
```

---

## Deploy VK On-chain

```bash
# Parse vk.json and call ZKVerifier.setVerifyingKey()
# band=0 (Common), band=1 (Rare), band=2 (Legendary) — same VK for all bands
ALPHA_X=$(cat vk.json | jq -r '.vk_alpha_1[0]')
ALPHA_Y=$(cat vk.json | jq -r '.vk_alpha_1[1]')
# ... (full cast call in scripts/deploy_vk.sh)

bash scripts/deploy_vk.sh $ZK_VERIFIER_ADDR vk.json
```

---

## Security

| Threat | Mitigation |
|--------|-----------|
| Toxic waste known to setup party | Multi-party MPC (≥3 parties) |
| VK replaced post-deploy | `ZKVerifier` uses `immutable verifier` ref in `RoyaltyDistributor` |
| Malicious proof generation | On-chain Groth16 verification in `ZKVerifier.verifyProof()` |
| Circuit soundness bugs | `cargo test --package zk_circuits` + Foundry fuzz tests |
