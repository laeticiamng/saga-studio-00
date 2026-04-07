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
      { label: "Nous contacter", href: "/about" },
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
    <footer className="border-t border-border/50 pt-10 sm:pt-14 pb-8 px-4 pb-safe">
      <div className="container mx-auto">
        <AnimatedSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10 mb-10 sm:mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Film className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  Saga Studio
                </span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Studio de production audiovisuelle IA. Créez des films, séries et clips musicaux complets.
              </p>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">{title}</h4>
                <ul className="space-y-1 sm:space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("#") ? (
                        <button
                          onClick={() => handleAnchorClick(link.href)}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left py-1.5 sm:py-0"
                        >
                          {link.label}
                        </button>
                      ) : link.href.startsWith("mailto:") ? (
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 sm:py-0 inline-block"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 sm:py-0 inline-block"
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
            © {new Date().getFullYear()} EMOTIONSCARE SASU — Saga Studio. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
