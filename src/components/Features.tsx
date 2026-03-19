import { motion } from "framer-motion";
import { Shield, Music, Zap, Globe, BarChart3, Wallet } from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Transparent Royalties",
    description: "Every royalty payment is cryptographically verified on-chain. See exactly who gets paid, how much, and when — no black boxes.",
  },
  {
    icon: Music,
    title: "Global Distribution",
    description: "Submit your catalog to 50+ collecting societies worldwide with automated DDEX-compliant rights registration.",
  },
  {
    icon: Zap,
    title: "Track Rarity Classification",
    description: "Our Master Pattern algorithm analyzes every track and assigns a rarity tier — Common, Rare, or Legendary — driving collector interest.",
  },
  {
    icon: Globe,
    title: "Permanent Storage",
    description: "Your masters are stored on decentralized infrastructure with archival mirroring. Your music can never be deleted or lost.",
  },
  {
    icon: Shield,
    title: "Rights Protection",
    description: "Built-in DMCA takedown workflow, EU Article 17 compliance, and automated mechanical licensing through The MLC.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Track your streams, royalty accruals, and distribution performance across every territory in real time.",
  },
];

const Features = () => {
  return (
    <section className="relative py-32">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything You Need to{" "}
            <span className="text-gradient-primary">Own Your Music</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From upload to payout — a complete platform built for independent artists and labels.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="glass rounded-xl p-6 hover:border-primary/30 transition-colors group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
