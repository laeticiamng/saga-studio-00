import Hero from "@/components/Hero";
import ClientLogos from "@/components/ClientLogos";
import Features from "@/components/Features";
import Gallery from "@/components/Gallery";
import SocialProof from "@/components/SocialProof";
import HowItWorks from "@/components/HowItWorks";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <ClientLogos />
      <Features />
      <Gallery />
      <SocialProof />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
