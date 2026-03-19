import { motion } from "framer-motion";
import { Upload, Send, DollarSign } from "lucide-react";

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Upload Your Music",
    description:
      "Drag and drop your masters, add metadata and artwork. We validate everything with industry-standard ISRC codes and DDEX formatting.",
  },
  {
    icon: Send,
    step: "02",
    title: "Distribute Globally",
    description:
      "Your release is submitted to 50+ collecting societies and platforms worldwide. CWR registrations are generated automatically.",
  },
  {
    icon: DollarSign,
    step: "03",
    title: "Get Paid Transparently",
    description:
      "Royalty splits are verified on-chain so every collaborator can see exactly what they're owed. Payments settle directly to your wallet.",
  },
];

const HowItWorks = () => {
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
            How <span className="text-gradient-primary">It Works</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Three steps from your studio to the world.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              className="relative text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-border" />
              )}
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 relative">
                <s.icon className="w-8 h-8 text-primary" />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center font-mono">
                  {s.step}
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-3">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {s.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
