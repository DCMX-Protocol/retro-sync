import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Comparison from "@/components/Comparison";
import HowItWorks from "@/components/HowItWorks";
import Pricing from "@/components/Pricing";
import Compliance from "@/components/Compliance";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />

      {/* Mission — editorial offset layout */}
      <section className="py-24 md:py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight mb-4">
                Built by an{" "}
                <span className="text-gradient-primary">Independent Artist</span>
              </h2>
              <a href="/docs/whitepaper.md" className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:underline mt-2">
                Read Our Story →
              </a>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <div className="space-y-5 text-base text-muted-foreground leading-relaxed">
                <p>
                  RetroSync started because I experienced the problem firsthand. As an independent artist and mother, I watched royalty statements arrive months late, with numbers that never quite added up. I talked to other indie musicians — the story was always the same. Opaque systems, slow payments, and fees that chip away at already-thin margins.
                </p>
                <p>
                  We're building RetroSync to offer an alternative. A distribution platform where the fee structure is simple (2.5% on cashout — that's it), where payments are recorded on-chain so you can verify them yourself, and where you keep ownership of your masters and your data. We're not pretending the music industry is easy — but we think the tools can be fairer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="features"><Features /></div>
      <div id="comparison"><Comparison /></div>
      <div id="how-it-works"><HowItWorks /></div>
      <div id="pricing"><Pricing /></div>
      <div id="trust"><Compliance /></div>
      <Footer />
    </div>
  );
};

export default Index;
