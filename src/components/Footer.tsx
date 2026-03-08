import { Film } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AnimatedSection from "./AnimatedSection";

const Footer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const footerLinks = {
    Produit: [
      { label: "Fonctionnalités", href: "#features" },
      { label: "Galerie", href: "#gallery" },
      { label: "Comment ça marche", href: "#how-it-works" },
      { label: "Tarifs", href: "/pricing" },
    ],
    Ressources: [
      { label: "FAQ", href: "#faq" },
      { label: "À propos", href: "/about" },
      ...(user ? [{ label: "Mes projets", href: "/dashboard" }] : []),
      { label: "Contact", href: "mailto:contact@cineclip.ai" },
    ],
    Légal: [
      { label: "Confidentialité", href: "/privacy" },
      { label: "CGU", href: "/terms" },
      { label: "Mentions légales", href: "/legal" },
    ],
  };

  const handleAnchorClick = (href: string) => {
    if (href.startsWith("#")) {
      if (window.location.pathname !== "/") {
        navigate("/");
        setTimeout(() => {
          document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      } else {
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <footer className="border-t border-border/50 pt-16 pb-8 px-4">
      <div className="container mx-auto">
        <AnimatedSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Film className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  CineClip AI
                </span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Créez des clips vidéo et courts-métrages complets grâce à l'IA, directement depuis votre navigateur.
              </p>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("#") ? (
                        <button
                          onClick={() => handleAnchorClick(link.href)}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                        >
                          {link.label}
                        </button>
                      ) : link.href.startsWith("mailto:") ? (
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </AnimatedSection>

        <div className="border-t border-border/30 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CineClip AI. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
