import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, AlertTriangle, Loader2, Radio } from "lucide-react";
import { fetchHourlySeries, type OracleSample } from "@/lib/api3";
import { computePublishPayload, type PublishPayload } from "@/lib/oracleWasm";
import { useWallet } from "@/hooks/useWallet";

// Set this once OracleZKVerifier is deployed.
const ORACLE_VERIFIER_ADDRESS = (import.meta.env.VITE_ORACLE_VERIFIER_ADDRESS as string) || "";

// keccak256("publish(uint256,uint256,uint256,bytes)")[0..4]
const PUBLISH_SELECTOR = "0xb7a9f900";

function pad32(hex: string) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return h.padStart(64, "0");
}
function bigintToHex(n: bigint) { return pad32(n.toString(16)); }

/** abi.encode(uint256,uint256,uint256,bytes) */
function encodePublishCall(p: PublishPayload, proof: Uint8Array): string {
  const proofHex = Array.from(proof).map((b) => b.toString(16).padStart(2, "0")).join("");
  // 4 head slots: twap, n, commitment, offset(0x80=128)
  const head =
    bigintToHex(p.twap) +
    bigintToHex(BigInt(p.n_samples)) +
    bigintToHex(BigInt(p.samples_commitment)) +
    bigintToHex(0x80n);
  const len = bigintToHex(BigInt(proof.length));
  // pad proof to multiple of 32
  const padded = proofHex.padEnd(Math.ceil(proofHex.length / 64) * 64, "0");
  return "0x" + PUBLISH_SELECTOR.slice(2) + head + len + padded;
}

const OracleFeed = () => {
  const { wallet } = useWallet();
  const [samples, setSamples] = useState<OracleSample[]>([]);
  const [payload, setPayload] = useState<PublishPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const series = await fetchHourlySeries();
      setSamples(series);
      const now = Math.floor(Date.now() / 1000);
      const out = await computePublishPayload(series, now);
      setPayload(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load oracle data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function publish() {
    if (!payload || !wallet.connected || !window.ethereum) return;
    setPublishing(true); setErr(null); setTxHash(null);
    try {
      if (!ORACLE_VERIFIER_ADDRESS) {
        throw new Error("OracleZKVerifier address not configured (VITE_ORACLE_VERIFIER_ADDRESS).");
      }
      // Demo proof bytes — in production fetched from the prover service that
      // runs `libs/zk-circuits::twap` over the same samples.
      const proof = new Uint8Array(192);
      const data = encodePublishCall(payload, proof);
      const hash = (await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.address, to: ORACLE_VERIFIER_ADDRESS, data }],
      })) as string;
      setTxHash(hash);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  const usd = payload ? Number(payload.twap) / 1e18 : 0;

  return (
    <section className="py-20 md:py-28 bg-background border-t border-border" id="oracle">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid lg:grid-cols-12 gap-10 items-start"
        >
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Radio className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-mono text-primary">api3 · zk · bttc</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight mb-4">
              Verifiable BTT/USD price,{" "}
              <span className="text-gradient-primary">on-chain</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              We pull BTT/USD from an API3 dAPI, compute a 24-hour TWAP inside a
              deterministic WASM module, and publish the result to BTTC only when
              a Groth16 proof verifies the computation against the source samples.
              No trusted relayer. No off-chain "trust me" math.
            </p>
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-secondary text-sm font-semibold disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4 text-primary" />}
              Refresh feed
            </button>
          </div>

          <div className="lg:col-span-7">
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs font-mono text-muted-foreground">24h TWAP · BTT/USD</div>
                  <div className="text-3xl font-bold tabular-nums">
                    ${loading ? "—" : usd.toFixed(10)}
                  </div>
                </div>
                {payload && (
                  <div className={`flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded-full border ${
                    payload.policy_passed
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-destructive/40 bg-destructive/10 text-destructive"
                  }`}>
                    {payload.policy_passed ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {payload.policy_passed ? "policy ok" : "rejected"}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-secondary/40 p-3">
                  <div className="text-muted-foreground font-mono">samples</div>
                  <div className="font-mono mt-1">{payload?.n_samples ?? "—"}</div>
                </div>
                <div className="rounded-lg bg-secondary/40 p-3">
                  <div className="text-muted-foreground font-mono">freshest</div>
                  <div className="font-mono mt-1">
                    {payload ? new Date(payload.publish_after * 1000).toLocaleTimeString() : "—"}
                  </div>
                </div>
                <div className="rounded-lg bg-secondary/40 p-3 col-span-2">
                  <div className="text-muted-foreground font-mono">samples_commitment</div>
                  <div className="font-mono mt-1 break-all text-[11px]">
                    {payload?.samples_commitment ?? "—"}
                  </div>
                </div>
              </div>

              {samples.length > 0 && (
                <div className="h-20 flex items-end gap-[3px]">
                  {samples.map((s, i) => {
                    const max = Math.max(...samples.map((x) => x.usd));
                    const min = Math.min(...samples.map((x) => x.usd));
                    const h = max === min ? 50 : ((s.usd - min) / (max - min)) * 100;
                    return (
                      <div
                        key={i}
                        title={`${new Date(s.timestamp * 1000).toLocaleTimeString()} · $${s.usd.toFixed(10)}`}
                        className="flex-1 bg-primary/30 hover:bg-primary/60 transition-colors rounded-sm"
                        style={{ height: `${Math.max(6, h)}%` }}
                      />
                    );
                  })}
                </div>
              )}

              <button
                onClick={publish}
                disabled={!wallet.connected || !payload?.policy_passed || publishing}
                className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
              >
                {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                {wallet.connected
                  ? publishing ? "Publishing…" : "Publish proof to BTTC"
                  : "Connect MetaMask to publish"}
              </button>

              {txHash && (
                <div className="text-xs font-mono text-primary break-all">
                  tx: {txHash}
                </div>
              )}
              {err && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {err}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default OracleFeed;