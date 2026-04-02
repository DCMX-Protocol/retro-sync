import { motion } from "framer-motion";
import { Check, Calculator, TrendingUp, Info, Users, Music, Server } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Approximate BTT price in USD.
 * In production this would be fetched from a price oracle or API.
 * Using a conservative reference price — actual price fluctuates.
 */
const BTT_PRICE_USD = 0.0000008;

/**
 * Industry average per-stream payout (USD) across major DSPs.
 * Source: publicly reported averages from Spotify, Apple Music, etc.
 * Actual rates vary by country, subscription tier, and platform.
 */
const AVG_PER_STREAM_USD = 0.004;

/** Platform fee structure */
const RETROSYNC_FEE_PCT = 0.025; // 2.5%
const NODE_SHARE = 0.90; // 90% of fee → nodes
const PLATFORM_SHARE = 0.10; // 10% of fee → platform

const plans = [
  {
    name: "For Independent Artists",
    price: "$0",
    period: "",
    description: "No upfront costs. No annual fees. You only pay when you earn.",
    features: [
      "Distribute to 150+ streaming platforms",
      "Keep 100% of your rights and masters",
      "Real-time earnings dashboard",
      "2.5% fee on payouts only — nothing else",
      "No minimum payout thresholds",
    ],
    cta: "Start Distributing — Free",
    highlighted: true,
  },
  {
    name: "How It Works Financially",
    price: "2.5%",
    period: "on cashout only",
    description: "A small fee when you withdraw keeps the network running for everyone.",
    features: [
      "90% of fees sustain the distribution network",
      "10% covers platform operations",
      "No monthly subscriptions",
      "No per-release charges",
      "No hidden costs — ever",
    ],
    cta: "See the Breakdown",
    highlighted: false,
  },
];

const Pricing = () => {
  const [streams, setStreams] = useState(100000);
  const [viewMode, setViewMode] = useState<"artist" | "node" | "listener">("artist");

  const totalRevenueUsd = streams * AVG_PER_STREAM_USD;
  const totalRevenueBtt = totalRevenueUsd / BTT_PRICE_USD;

  // Traditional distributor costs (industry typical: ~15-20% + annual fee)
  const traditionalFeeUsd = totalRevenueUsd * 0.15 + 20;

  // RetroSync fee
  const retroFeeUsd = totalRevenueUsd * RETROSYNC_FEE_PCT;
  const retroFeeBtt = retroFeeUsd / BTT_PRICE_USD;

  // Breakdown of the 2.5% fee
  const nodeEarningsUsd = retroFeeUsd * NODE_SHARE;
  const nodeEarningsBtt = nodeEarningsUsd / BTT_PRICE_USD;
  const platformEarningsUsd = retroFeeUsd * PLATFORM_SHARE;

  // What artist keeps
  const artistKeepsUsd = totalRevenueUsd - retroFeeUsd;
  const artistKeepsBtt = artistKeepsUsd / BTT_PRICE_USD;
  const artistKeepsTraditional = totalRevenueUsd - traditionalFeeUsd;
  const savingsUsd = artistKeepsUsd - artistKeepsTraditional;

  // Per-stream micro-fee for listeners
  const perStreamFeeUsd = AVG_PER_STREAM_USD * RETROSYNC_FEE_PCT;
  const perStreamFeeBtt = perStreamFeeUsd / BTT_PRICE_USD;

  const formatUsd = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatBtt = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
  };

  return (
    <section className="relative py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          className="mb-16 md:mb-20 max-w-xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-mono text-primary/70 tracking-widest uppercase mb-4 block">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Transparent <span className="text-gradient-primary">Earnings</span>
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            We believe artists deserve to understand exactly where their money goes.
            Drag the slider to explore realistic earnings based on current BTT rates and industry-average stream payouts.
          </p>
        </motion.div>

        {/* Revenue Calculator */}
        <motion.div
          className="max-w-5xl mx-auto mb-20 p-6 md:p-10 border border-primary/20 bg-primary/[0.02] relative overflow-hidden rounded-2xl"
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Calculator className="w-40 h-40 text-primary" />
          </div>

          <div className="relative z-10">
            {/* View mode tabs */}
            <div className="flex flex-wrap gap-2 mb-8">
              {[
                { key: "artist" as const, label: "Artist View", icon: Music },
                { key: "node" as const, label: "Node Operator", icon: Server },
                { key: "listener" as const, label: "Listener", icon: Users },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors ${
                    viewMode === key
                      ? "border-primary/50 bg-primary/10 text-primary font-medium"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-10 items-start">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold">Earnings Calculator</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">Annual Streams</label>
                      <span className="text-primary font-mono font-bold text-sm">{streams.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="10000"
                      max="1000000"
                      step="10000"
                      value={streams}
                      onChange={(e) => setStreams(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>10K streams</span>
                      <span>1M streams</span>
                    </div>
                  </div>

                  <div className="p-3 bg-secondary/50 border border-border rounded-lg flex items-start gap-3">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                      <p>
                        Estimates use ~${AVG_PER_STREAM_USD} per stream (industry average across major DSPs) and BTT ≈ ${BTT_PRICE_USD} USD.
                      </p>
                      <p>
                        Actual earnings vary by platform, region, and market conditions. These figures are illustrative, not guaranteed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results panel — changes based on viewMode */}
              <div className="bg-card p-6 border border-border rounded-xl">
                {viewMode === "artist" && (
                  <div className="space-y-4">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
                      What You'd Earn
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Gross Revenue</span>
                      <div className="text-right">
                        <span className="text-foreground font-mono">${formatUsd(totalRevenueUsd)}</span>
                        <span className="text-muted-foreground text-xs ml-2">≈ {formatBtt(totalRevenueBtt)} BTT</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Traditional Distributor Fees</span>
                      <span className="text-destructive font-mono text-xs">-${formatUsd(traditionalFeeUsd)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-border pb-4">
                      <span className="text-muted-foreground">RetroSync Fee (2.5%)</span>
                      <div className="text-right">
                        <span className="text-primary font-mono">-${formatUsd(retroFeeUsd)}</span>
                        <span className="text-muted-foreground text-xs ml-2">≈ {formatBtt(retroFeeBtt)} BTT</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">You Keep (RetroSync)</span>
                      <div className="text-right">
                        <span className="text-primary font-mono font-bold">${formatUsd(artistKeepsUsd)}</span>
                        <span className="text-muted-foreground text-xs ml-2">≈ {formatBtt(artistKeepsBtt)} BTT</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">You Keep (Traditional)</span>
                      <span className="text-muted-foreground font-mono">${formatUsd(artistKeepsTraditional)}</span>
                    </div>
                    <div className="pt-3 border-t border-border">
                      <div className="text-xs text-muted-foreground mb-1">Estimated annual difference</div>
                      <div className="text-2xl md:text-3xl font-bold text-primary font-mono">
                        +${formatUsd(savingsUsd)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">more in your pocket with RetroSync</div>
                    </div>
                  </div>
                )}

                {viewMode === "node" && (
                  <div className="space-y-4">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
                      Node Operator Earnings
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Nodes host and distribute music files across the network. They earn 90% of the 2.5% fee collected when artists cash out.
                    </p>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Fees Collected</span>
                      <span className="text-foreground font-mono">${formatUsd(retroFeeUsd)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Node Share (90%)</span>
                      <div className="text-right">
                        <span className="text-primary font-mono font-bold">${formatUsd(nodeEarningsUsd)}</span>
                        <span className="text-muted-foreground text-xs ml-2">≈ {formatBtt(nodeEarningsBtt)} BTT</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-border pt-4">
                      <span className="text-muted-foreground">Platform Share (10%)</span>
                      <span className="text-muted-foreground font-mono">${formatUsd(platformEarningsUsd)}</span>
                    </div>
                    <div className="p-3 bg-secondary/50 border border-border rounded-lg mt-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Node rewards are proportional to uptime, storage contributed, and requests served. Higher reliability means a larger share of the node pool.
                      </p>
                    </div>
                  </div>
                )}

                {viewMode === "listener" && (
                  <div className="space-y-4">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
                      Listener Micro-Fees
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      When you listen on-platform, a small micro-fee per stream helps keep the decentralized network fast and reliable.
                    </p>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Per-stream fee</span>
                      <div className="text-right">
                        <span className="text-foreground font-mono">${perStreamFeeUsd.toFixed(6)}</span>
                        <span className="text-muted-foreground text-xs ml-2">≈ {formatBtt(perStreamFeeBtt)} BTT</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">100 songs listened</span>
                      <span className="text-foreground font-mono">${(perStreamFeeUsd * 100).toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-border pt-4">
                      <span className="text-muted-foreground">Where it goes</span>
                      <span className="text-primary text-xs">90% nodes · 10% platform</span>
                    </div>
                    <div className="p-3 bg-secondary/50 border border-border rounded-lg mt-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        These micro-fees replace traditional subscription models. You pay fractions of a cent per play — supporting artists and the network directly.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BTT price note */}
            <div className="mt-6 text-center">
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                BTT reference price: ${BTT_PRICE_USD} USD · Prices fluctuate · Not financial advice
              </span>
            </div>
          </div>
        </motion.div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className={`p-6 md:p-8 flex flex-col rounded-xl ${
                plan.highlighted
                  ? "border-2 border-primary/50 bg-primary/[0.03] glow-primary"
                  : "border border-border bg-card"
              }`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <div className="mt-3 mb-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-muted-foreground text-sm ml-1">{plan.period}</span>}
              </div>
              <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlighted ? "default" : "outline"}
                className={`w-full py-6 font-bold rounded-lg ${plan.highlighted ? "glow-primary" : ""}`}
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
