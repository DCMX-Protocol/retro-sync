const Footer = () => {
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="font-bold text-lg text-gradient-primary mb-4">Retrosync</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Transparent music distribution for independent artists and labels.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Product</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a href="#features" className="block hover:text-primary transition-colors">Features</a>
              <a href="#pricing" className="block hover:text-primary transition-colors">Pricing</a>
              <a href="#" className="block hover:text-primary transition-colors">API Docs</a>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Company</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a href="#" className="block hover:text-primary transition-colors">About</a>
              <a href="#" className="block hover:text-primary transition-colors">Blog</a>
              <a href="#" className="block hover:text-primary transition-colors">Careers</a>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Legal</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a href="#" className="block hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="block hover:text-primary transition-colors">Terms of Service</a>
              <a href="#" className="block hover:text-primary transition-colors">DMCA</a>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Retrosync Media Group. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">Twitter</a>
            <a href="#" className="hover:text-primary transition-colors">Discord</a>
            <a href="#" className="hover:text-primary transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
