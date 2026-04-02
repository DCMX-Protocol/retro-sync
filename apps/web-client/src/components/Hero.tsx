import { motion } from "framer-motion";
import { ArrowRight, Music, Shield, Zap, Heart } from "lucide-react";
import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-end pb-16 md:pb-24 lg:items-center overflow-hidden pt-24">
      <div className="absolute inset-0 grid-pattern opacity-10" />

      {/* Asymmetric glow orbs */}
      <div className="absolute top-[10%] right-[5%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-[20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />

      <div className="relative z-10 container mx-auto px-6">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-end lg:items-center">
          {/* Left — Main content */}
          <div className="lg:col-span-7 xl:col-span-6">
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary/20 bg-primary/5 mb-8 rounded-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span className="text-xs font-mono text-primary/80 tracking-wide">Independent Music Distribution</span>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Distribute
              <br />
              Your Music.
              <br />
              <span className="text-gradient-primary">Own Your</span>
              <br />
              <span className="text-gradient-primary">Earnings.</span>
            </motion.h1>

            <motion.p
              className="text-base sm:text-lg text-muted-foreground max-w-md mb-10 leading-relaxed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Get your music on Spotify, Apple Music, TikTok &amp; 150+ platforms.
              No annual fees. No per-release charges. Just a small 2.5% on cashout.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Link to="/upload">
                <button className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-bold tracking-wide rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-base">
                  Start Distributing <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link to="/marketplace">
                <button className="w-full sm:w-auto px-8 py-4 border border-border bg-card text-foreground font-medium tracking-wide rounded-lg hover:border-primary/40 transition-all flex items-center justify-center gap-2 text-base">
                  <Music className="w-4 h-4 text-muted-foreground" /> Browse Music
                </button>
              </Link>
            </motion.div>
          </div>

          {/* Right — Benefit cards */}
          <motion.div
            className="lg:col-span-5 xl:col-span-6 grid grid-cols-2 gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {[
              { value: "Your Rights", label: "Keep 100% ownership", icon: Shield, offset: false },
              { value: "Fast Payouts", label: "No 60–90 day waits", icon: Zap, offset: true },
              { value: "150+ Stores", label: "Global distribution", icon: Music, offset: false },
              { value: "No Upfront Cost", label: "Free to start", icon: Heart, offset: true },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className={`p-5 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors group ${
                  stat.offset ? "mt-6" : ""
                }`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
              >
                <stat.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary mb-3 transition-colors" />
                <div className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
