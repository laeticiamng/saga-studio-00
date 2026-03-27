import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Tv, ArrowLeft } from "lucide-react";

export function SeriesNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <Tv className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h1 className="text-xl font-bold mb-2">Série non trouvée</h1>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm">
          Cette série n'existe pas ou a été supprimée.
        </p>
        <Button variant="outline" asChild>
          <Link to="/dashboard" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
          </Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
}
