import Hero from "@/components/Hero";
import InBrief from "@/components/InBrief";
import Audience from "@/components/Audience";
import ClientLogos from "@/components/ClientLogos";
import UseCases from "@/components/UseCases";
import PipelineShowcase from "@/components/PipelineShowcase";
import Differentiators from "@/components/Differentiators";
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
  usePageTitle("Studio de production audiovisuelle avec IA");
  return (
    <div className="min-h-screen">
      <Navbar />
      <main id="main-content">
        <Hero />
        <InBrief />
        <ClientLogos />
        <Audience />
        <UseCases />
        <HowItWorks />
        <PipelineShowcase />
        <Differentiators />
        <Features />
        <Gallery />
        <SocialProof />
        <PricingSummary />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
