//! Cryptographic noise / entropy module.
//!
//! Uses the Ledger hardware wallet as an entropy source: signs a timestamped
//! domain-separation message, then derives a 32-byte seed via SHA-256.
//! That seed initialises a local ChaCha20-based PRNG (via `rand_chacha`)
//! which can be consumed by any subsystem needing randomness — nonce
//! generation, session tokens, ZK blinding factors, etc.
//!
//! The Curve25519 scalar multiplication (`curve25519-dalek`) is used as an
//! additional entropy mixer: the seed is clamped and multiplied by the
//! basepoint, then the resulting point's encoding is hashed back in.
//! This is a one-way transformation that adds computational hardness
//! without reducing entropy.
//!
//! Dev mode (LEDGER_DEV_MODE=1): falls back to a deterministic seed
//! derived from the system timestamp so the rest of the stack works
//! without hardware.

use sha2::{Digest, Sha256};
use tracing::{info, instrument, warn};

/// 32-byte seed suitable for initialising a CSPRNG.
pub type Seed = [u8; 32];

/// Domain-separation prefix — must never change after first deployment.
const NOISE_DOMAIN: &[u8] = b"retrosync:noise-entropy:v1";

// ── Curve25519 entropy mixer ─────────────────────────────────────────────────

/// Mix raw entropy through Curve25519 scalar-basepoint multiplication.
/// Input: 32 bytes of raw seed material.
/// Output: SHA-256( seed ‖ (clamp(seed) · B).encode() )
///
/// This is a one-way function — knowing the output does not reveal the seed.
fn curve25519_mix(raw: &[u8; 32]) -> Seed {
    use curve25519_dalek::{constants::ED25519_BASEPOINT_TABLE, scalar::Scalar};

    // Clamp per RFC 7748 (curve25519_dalek handles this in Scalar::from_bits_clamped)
    let scalar = Scalar::from_bits_clamped(*raw);
    let point = &scalar * &ED25519_BASEPOINT_TABLE;

    let mut hasher = Sha256::new();
    hasher.update(raw);
    hasher.update(point.compress().as_bytes());
    hasher.finalize().into()
}

// ── Seed derivation ──────────────────────────────────────────────────────────

/// Derive a PRNG seed from the Ledger hardware wallet.
///
/// 1. Signs `NOISE_DOMAIN ‖ epoch_nanos` with the Ledger's personal_sign.
/// 2. SHA-256 stretches the 65-byte signature into 32 bytes.
/// 3. Curve25519 mixer adds computational hardness.
///
/// The resulting seed is suitable for `rand_chacha::ChaCha20Rng::from_seed`.
#[instrument]
pub async fn derive_seed() -> anyhow::Result<Seed> {
    // ── Dev fallback ─────────────────────────────────────────────────────
    if std::env::var("LEDGER_DEV_MODE").unwrap_or_default() == "1" {
        warn!("LEDGER_DEV_MODE=1 — using timestamp-derived noise seed");
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let mut hasher = Sha256::new();
        hasher.update(NOISE_DOMAIN);
        hasher.update(now.to_le_bytes());
        let raw: Seed = hasher.finalize().into();
        return Ok(curve25519_mix(&raw));
    }

    // ── Production: sign via Ledger ──────────────────────────────────────
    #[cfg(feature = "ledger")]
    {
        use ethers_signers::{HDPath, Ledger, Signer};

        let chain_id = std::env::var("BTTC_CHAIN_ID")
            .unwrap_or_else(|_| "199".into())
            .parse::<u64>()
            .map_err(|_| anyhow::anyhow!("BTTC_CHAIN_ID must be a u64"))?;

        let ledger = Ledger::new(HDPath::LedgerLive(0), chain_id)
            .await
            .map_err(|e| anyhow::anyhow!("Ledger not found for noise seed: {e}"))?;

        // Timestamped message so each boot gets unique entropy
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let mut msg = NOISE_DOMAIN.to_vec();
        msg.extend_from_slice(&nanos.to_le_bytes());

        let sig = ledger
            .sign_message(&msg)
            .await
            .map_err(|e| anyhow::anyhow!("Ledger noise signing failed: {e}"))?;

        // Extract r ‖ s ‖ v (65 bytes)
        let mut sig_bytes = Vec::with_capacity(65);
        let mut r = [0u8; 32];
        let mut s = [0u8; 32];
        sig.r.to_big_endian(&mut r);
        sig.s.to_big_endian(&mut s);
        sig_bytes.extend_from_slice(&r);
        sig_bytes.extend_from_slice(&s);
        sig_bytes.push(sig.v as u8);

        let mut hasher = Sha256::new();
        hasher.update(NOISE_DOMAIN);
        hasher.update(&sig_bytes);
        let raw: Seed = hasher.finalize().into();

        let seed = curve25519_mix(&raw);
        info!("Noise seed derived from Ledger hardware entropy");
        Ok(seed)
    }

    #[cfg(not(feature = "ledger"))]
    {
        anyhow::bail!(
            "Ledger feature not compiled in. Set LEDGER_DEV_MODE=1 for development."
        )
    }
}

// ── Convenience: get a seeded RNG ────────────────────────────────────────────

/// Create a ChaCha20 PRNG seeded from Ledger entropy.
///
/// Usage:
/// ```ignore
/// let mut rng = noise::seeded_rng().await?;
/// let nonce: [u8; 16] = rng.gen();
/// ```
pub async fn seeded_rng() -> anyhow::Result<rand_chacha::ChaCha20Rng> {
    use rand::SeedableRng;
    let seed = derive_seed().await?;
    Ok(rand_chacha::ChaCha20Rng::from_seed(seed))
}

/// Request `n` random bytes from a Ledger-seeded PRNG.
pub async fn random_bytes(n: usize) -> anyhow::Result<Vec<u8>> {
    use rand::RngCore;
    let mut rng = seeded_rng().await?;
    let mut buf = vec![0u8; n];
    rng.fill_bytes(&mut buf);
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn dev_mode_produces_seed() {
        std::env::set_var("LEDGER_DEV_MODE", "1");
        let seed = derive_seed().await.unwrap();
        assert_eq!(seed.len(), 32);
        // Seed should be non-zero
        assert!(seed.iter().any(|b| *b != 0));
        std::env::remove_var("LEDGER_DEV_MODE");
    }

    #[tokio::test]
    async fn random_bytes_returns_requested_length() {
        std::env::set_var("LEDGER_DEV_MODE", "1");
        let bytes = random_bytes(64).await.unwrap();
        assert_eq!(bytes.len(), 64);
        std::env::remove_var("LEDGER_DEV_MODE");
    }

    #[test]
    fn curve25519_mix_is_deterministic() {
        let input = [42u8; 32];
        let a = curve25519_mix(&input);
        let b = curve25519_mix(&input);
        assert_eq!(a, b);
    }

    #[test]
    fn curve25519_mix_is_not_identity() {
        let input = [42u8; 32];
        let output = curve25519_mix(&input);
        assert_ne!(input, output, "mixer must transform the input");
    }
}
