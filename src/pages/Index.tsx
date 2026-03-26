import Hero from "@/components/Hero";
import ClientLogos from "@/components/ClientLogos";
import AnimatedCounters from "@/components/AnimatedCounters";
import Features from "@/components/Features";
import Gallery from "@/components/Gallery";
import SocialProof from "@/components/SocialProof";
import HowItWorks from "@/components/HowItWorks";
import PricingSummary from "@/components/PricingSummary";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { usePageTitle } from "@/hooks/usePageTitle";

const Index = () => {
  usePageTitle("Créez films, séries et vidéos avec l'IA");
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <ClientLogos />
      <AnimatedCounters />
      <Features />
      <Gallery />
      <SocialProof />
      <HowItWorks />
      <PricingSummary />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
