import { motion } from "framer-motion";
import { Check, X, Zap, Shield, Clock, DollarSign, Eye, Music, Heart } from "lucide-react";

const comparisonData = [
  { feature: "Cost", legacy: "$20–$100 per year", retro: "Free forever", icon: DollarSign },
  { feature: "Your Privacy", legacy: "Requires personal info", retro: "Stay anonymous", icon: Eye },
  { feature: "How Fast You're Paid", legacy: "2–3 months", retro: "Instantly", icon: Clock },
  { feature: "Payment Accuracy", legacy: "Trust them", retro: "Mathematically proven", icon: Shield },
  { feature: "Audio Quality Check", legacy: "Basic or none", retro: "Professional-grade", icon: Music },
  { feature: "Your Data", legacy: "They control it", retro: "You control it", icon: Heart },
  { feature: "Can Be Taken Down?", legacy: "Yes", retro: "Never", icon: Zap },
];

const Comparison = () => {
  return (
    <section className="py-24 md:py-32 relative bg-background overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="mb-16 md:mb-20 lg:ml-[8%]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Why <span className="text-gradient-primary">Switch?</span>
          </h2>
          <p className="text-muted-foreground max-w-lg text-base">
            See how RetroSync compares to traditional distributors.
          </p>
        </motion.div>

        <div className="space-y-2 max-w-5xl mx-auto">
          {/* Column headers — hidden on mobile */}
          <div className="hidden md:grid grid-cols-12 gap-px text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4 px-5">
            <div className="col-span-4">Feature</div>
            <div className="col-span-4">Traditional</div>
            <div className="col-span-4">RetroSync</div>
          </div>

          {comparisonData.map((item, i) => (
            <motion.div
              key={item.feature}
              className="grid grid-cols-3 md:grid-cols-12 gap-px bg-border overflow-hidden rounded-lg"
              initial={{ opacity: 0, x: i % 2 === 0 ? -15 : 15 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="col-span-1 md:col-span-4 bg-card p-4 md:p-5 flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
                <span className="font-medium text-sm text-foreground">{item.feature}</span>
              </div>
              <div className="col-span-1 md:col-span-4 bg-card p-4 md:p-5 flex items-center gap-2">
                <X className="w-3.5 h-3.5 text-destructive/50 shrink-0" />
                <span className="text-sm text-muted-foreground">{item.legacy}</span>
              </div>
              <div className="col-span-1 md:col-span-4 bg-primary/5 p-4 md:p-5 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm font-medium text-primary">{item.retro}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Comparison;
