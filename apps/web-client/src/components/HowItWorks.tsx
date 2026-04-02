import { motion } from "framer-motion";
import { Upload, CheckCircle, Globe, Banknote } from "lucide-react";

const steps = [
  { icon: Upload, title: "Upload Your Music", description: "Drop your tracks, add metadata, and submit. We handle format validation and platform requirements." },
  { icon: CheckCircle, title: "Quality & Rights Check", description: "Automated checks ensure your audio meets platform standards. Your ownership is registered and protected." },
  { icon: Globe, title: "Distributed Worldwide", description: "Your music goes to Spotify, Apple Music, TikTok, YouTube, and 150+ platforms via industry-standard DDEX feeds." },
  { icon: Banknote, title: "Earn & Cash Out", description: "Track your earnings in real time. When you withdraw, a 2.5% fee is applied — 90% goes to network nodes, 10% to platform operations." },
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
            How <span className="text-gradient-primary">Distribution</span> Works
          </h2>
          <p className="text-muted-foreground text-base">
            Four steps from your studio to every major streaming platform.
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
