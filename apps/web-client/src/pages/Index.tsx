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
                <span className="text-gradient-primary">Artist, for Artists</span>
              </h2>
              <a href="/docs/whitepaper.md" className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:underline mt-2">
                Read Our Story →
              </a>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <div className="space-y-5 text-base text-muted-foreground leading-relaxed">
                <p>
                  RetroSync was born from a simple frustration: as an independent artist and mother, I watched royalty checks get lost, delayed, or mysteriously shrink. The music industry's payment system is broken — and artists are the ones who pay the price.
                </p>
                <p>
                  So we built something better. RetroSync puts you in control of your music and your money. No gatekeepers, no hidden fees, no waiting months to get paid. Just upload, release, and earn — the way it should be.
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
