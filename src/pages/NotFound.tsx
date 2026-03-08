import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Film, Home, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "calc(100vh - 4rem)" }}>
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
          <Film className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
        <p className="text-xl text-muted-foreground mb-2">Page introuvable</p>
        <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <div className="flex gap-3">
          <Button variant="glass" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
          <Button variant="hero" asChild>
            <Link to="/"><Home className="h-4 w-4 mr-2" /> Accueil</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;
