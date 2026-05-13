//! TWAP attestation circuit.
//!
//! Public inputs:
//!   1. `twap`               — integer TWAP * 1e18 (matches WASM output)
//!   2. `n_samples`          — number of samples (≤ MAX_SAMPLES)
//!   3. `samples_commitment` — first 248 bits of SHA-256 over the samples
//!                             (truncated to fit BN254 Fr).
//!
//! Private witness:
//!   - `samples[N] = (timestamp, raw_price)` — the actual dAPI readings.
//!
//! Circuit asserts:
//!   a. Σ raw_i * Δt_i  ==  twap * Σ Δt_i   (integer TWAP, no rounding)
//!   b. SHA256("retrosync.oracle.v1" || (ts,raw)*) truncated == commitment
//!   c. n_samples matches the witness length
//!
//! This is a sketch wired to the same arkworks tooling used by
//! `royalty_split.rs`. The full SHA-256 gadget is left unconstrained here
//! (it is instantiated via `ark-crypto-primitives::sha256` in the prover
//! binary) — see docs/zk-twap.md for the full constraint list.

use ark_bn254::Fr;
use ark_ff::PrimeField;

pub const MAX_SAMPLES: usize = 24;

#[derive(Clone, Debug)]
pub struct TwapSample {
    pub timestamp: u64,
    pub raw: u128,
}

#[derive(Clone, Debug)]
pub struct TwapWitness {
    pub samples: Vec<TwapSample>,
    pub now: u64,
}

#[derive(Clone, Debug)]
pub struct TwapPublicInputs {
    pub twap: u128,
    pub n_samples: u32,
    /// 31-byte (248-bit) truncation of SHA-256(samples)
    pub samples_commitment: [u8; 31],
}

impl TwapPublicInputs {
    pub fn to_field(&self) -> [Fr; 3] {
        let mut comm = [0u8; 32];
        comm[1..32].copy_from_slice(&self.samples_commitment);
        [
            Fr::from(self.twap),
            Fr::from(self.n_samples as u64),
            Fr::from_be_bytes_mod_order(&comm),
        ]
    }
}

/// Helper used by the prover binary AND by the WASM module:
/// integer TWAP, no rounding, last sample carries weight to `now`.
pub fn integer_twap(samples: &[TwapSample], now: u64) -> u128 {
    let mut sum_pw: u128 = 0;
    let mut sum_w: u128 = 0;
    let mut sorted = samples.to_vec();
    sorted.sort_by_key(|s| s.timestamp);
    for i in 0..sorted.len() {
        let next = if i + 1 < sorted.len() { sorted[i + 1].timestamp } else { now };
        let dt = next.saturating_sub(sorted[i].timestamp) as u128;
        sum_pw = sum_pw.saturating_add(sorted[i].raw.saturating_mul(dt));
        sum_w = sum_w.saturating_add(dt);
    }
    if sum_w == 0 { 0 } else { sum_pw / sum_w }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn twap_matches_wasm_constant_series() {
        let samples: Vec<TwapSample> = (0..10)
            .map(|i| TwapSample { timestamp: i * 60, raw: 5_000 })
            .collect();
        assert_eq!(integer_twap(&samples, 1_000), 5_000);
    }
}