import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BibleEditor } from "@/components/series/BibleEditor";
import { useSeries } from "@/hooks/useSeries";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2 } from "lucide-react";

export default function BibleManager() {
  const { id } = useParams<{ id: string }>();
  const { data: series, isLoading } = useSeries(id);
  usePageTitle("Bibles");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-4xl py-8">
        <h1 className="text-2xl font-bold mb-6">Bibles de la série</h1>
        {id && <BibleEditor seriesId={id} />}
      </main>
      <Footer />
    </div>
  );
}
