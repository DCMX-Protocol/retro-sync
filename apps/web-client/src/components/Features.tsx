import { motion } from "framer-motion";
import { DollarSign, Eye, Globe, Headphones, Shield, Zap } from "lucide-react";

const features = [
  {
    icon: DollarSign,
    title: "Transparent Payouts",
    description: "The traditional model makes it hard to know where your money goes. We show you every transaction, verified on-chain — so you can see exactly what you earned and why.",
  },
  {
    icon: Eye,
    title: "Privacy by Default",
    description: "Many platforms require extensive personal information just to distribute music. We designed ours so you can release under a pseudonym if you choose.",
  },
  {
    icon: Globe,
    title: "Direct Distribution",
    description: "Your music goes to Spotify, Apple Music, TikTok, and 150+ platforms through industry-standard DDEX integration — the same pipeline major labels use.",
  },
  {
    icon: Headphones,
    title: "Quality Standards",
    description: "We check your audio against platform requirements before submission, helping avoid rejections and delays that cost independent artists time.",
  },
  {
    icon: Shield,
    title: "Decentralized Storage",
    description: "Your files are distributed across a peer-to-peer network. This approach aims to reduce single points of failure compared to centralized hosting.",
  },
  {
    icon: Zap,
    title: "Faster Payment Cycles",
    description: "Traditional distributors often hold earnings for 60–90 days. Our model is designed to shorten that timeline significantly, though actual speed depends on platform reporting.",
  },
];

const Features = () => {
  return (
    <section className="relative py-24 md:py-32 bg-card">
      <div className="container mx-auto px-6">
        {/* Asymmetric header */}
        <motion.div
          className="mb-16 md:mb-20 max-w-2xl"
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs font-mono text-primary/70 tracking-widest uppercase mb-4 block">
            What We're Building
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            A Better Deal <span className="text-gradient-primary">For Artists.</span>
          </h2>
          <p className="text-muted-foreground max-w-md text-base leading-relaxed">
            Independent musicians deserve tools that work for them, not against them. Here's what we're doing differently.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="bg-card p-6 sm:p-8 hover:bg-secondary/50 transition-all group relative"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="absolute top-4 right-4 text-3xl font-bold text-border opacity-50 group-hover:opacity-100 transition-opacity font-mono">
                {String(i + 1).padStart(2, "0")}
              </div>

              <div className="w-10 h-10 bg-secondary border border-border rounded-lg flex items-center justify-center mb-5 group-hover:border-primary/50 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-2 tracking-tight">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
