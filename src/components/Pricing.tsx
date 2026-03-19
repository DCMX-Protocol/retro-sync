import { motion } from "framer-motion";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Indie",
    price: "Free",
    period: "",
    description: "For solo artists getting started",
    features: [
      "Unlimited uploads",
      "15 collecting societies",
      "On-chain royalty verification",
      "Basic analytics",
      "Community support",
    ],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    description: "For serious artists and producers",
    features: [
      "Everything in Indie",
      "50+ collecting societies",
      "Master Pattern rarity classification",
      "Priority distribution (< 12h)",
      "Dedicated support",
      "Custom splits (up to 16 collaborators)",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
  {
    name: "Label",
    price: "Custom",
    period: "",
    description: "For labels and enterprise catalogs",
    features: [
      "Everything in Pro",
      "Unlimited artists",
      "SAP/ERP integration",
      "API access",
      "White-label options",
      "Dedicated account manager",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const Pricing = () => {
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
            Simple, <span className="text-gradient-primary">Fair Pricing</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            No hidden fees. No middlemen. Just transparent music distribution.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              className={`rounded-xl p-6 flex flex-col ${
                plan.highlighted
                  ? "border-2 border-primary/50 bg-primary/5 glow-primary"
                  : "glass"
              }`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {plan.highlighted && (
                <div className="text-xs font-mono font-semibold text-primary mb-3 tracking-wider uppercase">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <div className="mt-3 mb-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                )}
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

              <button
                className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:brightness-110"
                    : "glass hover:bg-secondary"
                }`}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
