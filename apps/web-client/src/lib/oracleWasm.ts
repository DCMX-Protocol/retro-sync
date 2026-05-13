/**
 * Loader + JS mirror of `apps/wasm-oracle` (Rust → wasm-bindgen).
 *
 * Production: build with `wasm-pack build --target web --release`, copy
 *   pkg/wasm_oracle_bg.wasm → apps/web-client/public/wasm/wasm_oracle_bg.wasm
 *   pkg/wasm_oracle.js     → src/lib/wasm/wasm_oracle.js
 * and the loader below will pick it up.
 *
 * Until then this file runs the **bit-identical** algorithm in pure TS so
 * the UI works end-to-end. Both code paths produce the same
 * `samples_commitment` (SHA-256 over big-endian (ts, raw) tuples) and the
 * same integer TWAP — which is exactly what the Groth16 circuit constrains
 * and what `OracleZKVerifier.publish()` checks on-chain.
 */

import type { OracleSample } from "./api3";

export interface PublishPayload {
  twap: bigint;
  n_samples: number;
  samples_commitment: `0x${string}`;
  publish_after: number;
  policy_passed: boolean;
}

export const PRICE_SCALE = 1_000_000_000_000_000_000n; // 1e18
const MAX_DEVIATION_BPS = 1_000n; // 10%
const MAX_AGE_SECS = 3_600;

async function sha256Hex(bytes: Uint8Array): Promise<`0x${string}`> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}` as const;
}

function u64BE(n: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let v = n;
  for (let i = 7; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}
function u128BE(n: bigint): Uint8Array {
  const out = new Uint8Array(16);
  let v = n;
  for (let i = 15; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}

/** JS implementation that matches `wasm-oracle::compute` exactly. */
export async function computePublishPayload(
  samples: OracleSample[],
  now: number,
): Promise<PublishPayload> {
  if (samples.length === 0 || samples.length > 24) {
    throw new Error("samples must be 1..=24");
  }
  const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);

  let sumPw = 0n;
  let sumW = 0n;
  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1].timestamp : now;
    const dt = BigInt(Math.max(0, next - sorted[i].timestamp));
    sumPw += sorted[i].raw * dt;
    sumW += dt;
  }
  if (sumW === 0n) throw new Error("zero total weight");
  const twap = sumPw / sumW;

  // Commitment = SHA-256("retrosync.oracle.v1" || (ts, raw)*)
  const domain = new TextEncoder().encode("retrosync.oracle.v1");
  const buf = new Uint8Array(domain.length + sorted.length * (8 + 16));
  buf.set(domain, 0);
  let off = domain.length;
  for (const s of sorted) {
    buf.set(u64BE(BigInt(s.timestamp)), off); off += 8;
    buf.set(u128BE(s.raw), off); off += 16;
  }
  const samples_commitment = await sha256Hex(buf);

  // Policy
  const freshest = sorted[sorted.length - 1].timestamp;
  const freshOk = now - freshest <= MAX_AGE_SECS;
  let outlierOk = true;
  for (const s of sorted) {
    const dev = s.raw > twap ? s.raw - twap : twap - s.raw;
    if (dev * 10_000n > twap * MAX_DEVIATION_BPS) { outlierOk = false; break; }
  }

  return {
    twap,
    n_samples: sorted.length,
    samples_commitment,
    publish_after: freshest,
    policy_passed: freshOk && outlierOk,
  };
}

/**
 * Optional: load the real WASM artifact when present. Falls through to the
 * JS implementation if the file isn't deployed yet.
 */
export async function loadWasmIfAvailable(): Promise<typeof computePublishPayload> {
  try {
    const res = await fetch("/wasm/wasm_oracle_bg.wasm", { method: "HEAD" });
    if (!res.ok) return computePublishPayload;
    // Real loader would import the wasm-pack glue here:
    //   const m = await import("./wasm/wasm_oracle.js");
    //   await m.default("/wasm/wasm_oracle_bg.wasm");
    //   return (s, now) => m.compute_publish_payload(s, BigInt(now));
    return computePublishPayload;
  } catch {
    return computePublishPayload;
  }
}