import { motion } from "framer-motion";

const platforms = [
  "Spotify", "Apple Music", "YouTube Music", "TikTok", "Amazon Music",
  "Deezer", "Tidal", "Pandora", "SoundCloud", "iHeartRadio",
  "Shazam", "Instagram", "Facebook", "Snapchat", "Tencent",
];

const Compliance = () => {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-card">
      <div className="container mx-auto px-6">
        <motion.div
          className="mb-16 md:mb-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
            Your Music,{" "}
            <span className="text-gradient-primary">Everywhere</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto text-base leading-relaxed">
            We deliver to every major streaming platform through standard industry feeds — the same infrastructure used by established distributors.
          </p>
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {platforms.map((platform, i) => (
            <motion.span
              key={platform}
              className="px-4 py-2 text-sm text-muted-foreground border border-border bg-background rounded-lg hover:text-primary hover:border-primary/30 transition-colors cursor-default"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.02 }}
            >
              {platform}
            </motion.span>
          ))}
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          {[
            { label: "Rights Registration", desc: "Your music is registered with content ID systems to help protect against unauthorized use." },
            { label: "Your Data, Your Choice", desc: "Export or delete your data anytime. We don't lock you in." },
            { label: "On-Chain Payments", desc: "Earnings are recorded on the BTTC network for transparency. You can verify any transaction." },
          ].map((item) => (
            <div key={item.label} className="p-5 border border-border bg-background rounded-xl text-center">
              <div className="text-accent font-bold text-sm mb-2">{item.label}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Compliance;
