import { motion } from "framer-motion";
import { DollarSign, Eye, Globe, Headphones, Shield, Zap } from "lucide-react";

const features = [
  {
    icon: DollarSign,
    title: "Get Paid Fairly",
    description: "Every payout is verified with math — not promises. You see exactly where your money comes from.",
  },
  {
    icon: Eye,
    title: "Your Privacy Matters",
    description: "No real names required. Your identity stays protected while you release music worldwide.",
  },
  {
    icon: Globe,
    title: "No Middlemen",
    description: "Payments go straight from listeners to you. No label taking a cut, no gatekeepers.",
  },
  {
    icon: Headphones,
    title: "Studio-Quality Checks",
    description: "We automatically check your audio quality so your music sounds great everywhere.",
  },
  {
    icon: Shield,
    title: "Always Available",
    description: "Your music is stored across a global network. It can't be taken down or censored.",
  },
  {
    icon: Zap,
    title: "Lightning-Fast Payments",
    description: "Get your earnings right away — no waiting 60-90 days like traditional distributors.",
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
            Why Artists Love Us
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Built <span className="text-gradient-primary">For You.</span>
          </h2>
          <p className="text-muted-foreground max-w-md text-base leading-relaxed">
            Everything you need to release music and get paid — nothing you don't.
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
