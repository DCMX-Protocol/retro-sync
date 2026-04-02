import { motion } from "framer-motion";
import { Upload, CheckCircle, Globe, Banknote } from "lucide-react";

const steps = [
  { icon: Upload, title: "Upload Your Song", description: "Drag and drop your track — we handle the rest. No forms to fill out." },
  { icon: CheckCircle, title: "We Protect It", description: "Your music is automatically registered and protected worldwide." },
  { icon: Globe, title: "It Goes Everywhere", description: "Spotify, Apple Music, TikTok, YouTube — all 150+ stores, instantly." },
  { icon: Banknote, title: "You Get Paid", description: "Money goes straight to your wallet. No delays, no minimums." },
];

const HowItWorks = () => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden bg-card">
      <div className="container mx-auto px-6">
        <motion.div
          className="mb-16 md:mb-20 max-w-lg lg:ml-auto lg:mr-[10%] lg:text-right"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Simple as <span className="text-gradient-primary">1-2-3-4</span>
          </h2>
          <p className="text-muted-foreground text-base">
            No tech knowledge needed. Upload, release, earn.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              className={`p-6 md:p-8 bg-background border border-border rounded-xl hover:border-primary/30 transition-all group ${
                i % 2 !== 0 ? "sm:mt-12" : ""
              }`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-mono text-primary/70 mb-1">Step {i + 1}</div>
                  <h3 className="text-lg font-bold mb-2 tracking-tight">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
