import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COOKIE_KEY = "saga-studio-cookie-consent";
const LEGACY_COOKIE_KEY = "cineclip-cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Migration: read legacy key once and copy to new key
    const legacy = localStorage.getItem(LEGACY_COOKIE_KEY);
    if (legacy && !localStorage.getItem(COOKIE_KEY)) {
      localStorage.setItem(COOKIE_KEY, legacy);
      localStorage.removeItem(LEGACY_COOKIE_KEY);
    }
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on load
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  };

  const refuse = () => {
    localStorage.setItem(COOKIE_KEY, "refused");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-lg mb-safe"
        >
          <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm text-foreground leading-relaxed">
                  Ce site utilise uniquement des <strong>cookies essentiels</strong> pour le fonctionnement de votre session et de l'authentification. Aucun cookie publicitaire n'est utilisé.
                </p>
                <p className="text-xs text-muted-foreground">
                  En savoir plus dans notre{" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    politique de confidentialité
                  </Link>.
                </p>
                <div className="flex gap-2">
                  <Button variant="hero" size="sm" onClick={accept}>
                    Accepter
                  </Button>
                  <Button variant="ghost" size="sm" onClick={refuse}>
                    Refuser
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
