# Security Policy — Retrosync Media Group

## Supported Versions

| Branch | Supported |
|--------|-----------|
| `main` | ✅        |

## Threat Model

Retrosync is a decentralised music distribution and royalty management platform.
Assets in scope for security review:

| Component | Path | Language |
|-----------|------|----------|
| Backend API | `apps/api-server/` | Rust / Axum |
| Smart contracts | `libs/contracts/` | Solidity / Foundry |
| ZK circuits | `libs/zk-circuits/` | Arkworks Groth16 |
| WASM frontend | `apps/wasm-frontend/` | Rust / Yew |
| React client | `apps/web-client/` | TypeScript / Vite |

## Security Properties

| Property | Mechanism |
|----------|-----------|
| Input validation | LangSec `nom` all-consuming recognisers — every input passes through `langsec.rs` before business logic |
| Authentication | EIP-191 wallet challenge/response + HMAC-SHA256 JWT; TronLink signMessageV2 for Tron |
| Authorisation | Zero-Trust middleware on every route; `ZERO_TRUST_DISABLED` blocked in production |
| Smart-contract integrity | ZK Groth16 proof required for every royalty distribution |
| Value caps | MAX_DISTRIBUTION_BTT (1M BTT), MAX_TRX_DISTRIBUTION (1M TRX), MAX_CHARGE_CENTS ($1,000) |
| Reentrancy | Non-reentrant modifier (CEI pattern) on all state-mutating contract functions |
| Rate limiting | Per-IP sliding-window: 10/60s auth, 5/60s upload, 120/60s general |
| Injection prevention | XML: `xml_escape()` on all user inputs; CSV: `sanitise_csv_cell()`; SAP: `sanitise_sap_str()` |
| Unicode safety | `validate_free_text()` rejects BOM (U+FEFF) and C0/C1 control characters |
| TLS enforcement | `BTFS_API_URL`, `TRON_API_URL` must be HTTPS in production |
| Webhook verification | Coinbase Commerce webhooks: HMAC-SHA256 with constant-time comparison |
| Tron address validation | Base58Check + 0x41 prefix byte + SHA-256 double-hash checksum |
| Audit trail | Append-only ISO 9001 §7.5 LMDB audit log for every mutation |
| Dependency vetting | `deny.toml` blocks unmaintained crates and non-allowlisted licences |
| Secrets management | All secrets via environment variables; never committed to VCS |
| ZK ceremony | Verifying key must be set and attested before distribution contracts accept proofs |

## Dependency Security

### xz-utils (liblzma)
- **Status**: ✅ SECURE
- **Version**: 5.8.x (nixpkgs-unstable)
- **Note**: CVE-2024-3094 affected only 5.6.0 and 5.6.1; our Nix pins 5.8.x which is clean

### OpenSSL
- **Status**: ✅ SECURE
- **Supplied by**: nixpkgs (latest patched)
- **Environment**: `OPENSSL_DIR` / `OPENSSL_LIB_DIR` set in `flake.nix`

### Rust Toolchain
- **Status**: ✅ SECURE
- **Version**: Latest stable via rust-overlay
- **Updated**: Automatically via `nix flake update`

### Node.js
- **Status**: ✅ SECURE
- **Version**: nodejs_22 LTS from nixpkgs
- **npm audit**: 0 vulnerabilities

## Build Integrity

1. **Reproducible builds**: `flake.lock` pins all Nix inputs to exact git revisions
2. **Source verification**: nixpkgs mirrors with official hash verification
3. **Sandboxed environments**: No system pollution during builds
4. **cargo-deny**: `deny.toml` enforces licence allowlist and advisory database block
5. **ZK ceremony**: `tools/ceremony/` produces a verifiable `vk.json`; attestation published alongside contract deployment

## Known Security Assumptions

* The Ledger hardware wallet key is the sole authorised royalty distribution signer.
  Compromise of the Ledger device breaks the royalty distribution guarantee.
* The ZK ceremony output (`vk.json`) must be verified against the published attestation
  before deploying `ZKVerifier.sol`. An unset VK causes all distribution calls to revert.
* In-memory rate-limit counters reset on server restart.  For multi-instance deployments,
  replace with a Redis-backed limiter (add `redis` workspace dep + rate_limit refactor).
* LMDB environments are not encrypted at rest.  Use LUKS / FileVault on the host for
  sensitive deployments.
* TRON_PRIVATE_KEY must be stored in a signing sidecar, not in the API server process.
  The `tron.rs` module bails if no signing sidecar is connected in production mode.
* BTFS nodes should be behind a TLS-terminating reverse proxy (nginx/Caddy) in production.

## Updating Security Patches

```bash
# Update all Nix inputs (Rust, OpenSSL, xz, etc.)
nix flake update

# Run cargo-deny to check for new advisories
cargo deny check advisories

# Check npm dependencies
npm audit
```

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Report to: **security@retrosync.media**

Include:
1. Affected component and version / git SHA
2. Steps to reproduce or proof-of-concept
3. Potential impact (CVSS 3.1 score if possible)
4. Any suggested mitigations

**Response times:**
- Acknowledgement: 48 hours
- Remediation timeline: 7 days
- Critical/high severity patch: 14 days
- Coordinated disclosure window: 90 days

Researchers acting in good faith will not face legal action.

## Additional Resources

- [LangSec](https://langsec.org) — Language-Theoretic Security
- [Arkworks Groth16](https://github.com/arkworks-rs/groth16) — ZK proof system
- [DDEX](https://ddex.net) — Music metadata exchange standards
- [The MLC](https://themlc.com) — Mechanical Licensing Collective
- [NixOS Security](https://nixos.org/guides/security.html)
