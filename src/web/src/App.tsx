import { Nav } from "./sections/Nav";
import { Hero } from "./sections/Hero";
import { LogoStrip } from "./sections/LogoStrip";
import { HowItWorks } from "./sections/HowItWorks";
import { Features } from "./sections/Features";
import { Bento } from "./sections/Bento";
import { Showcase } from "./sections/Showcase";
import { Principles } from "./sections/Principles";
import { Pricing } from "./sections/Pricing";
import { FAQ } from "./sections/FAQ";
import { Footer } from "./sections/Footer";

export default function App() {
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <LogoStrip />
        <HowItWorks />
        <Features />
        <Bento />
        <Showcase />
        <Principles />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
