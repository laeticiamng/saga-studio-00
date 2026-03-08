import { Film } from "lucide-react";
import { Link } from "react-router-dom";
import AnimatedSection from "./AnimatedSection";

const footerLinks = {
  Produit: [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Galerie", href: "#gallery" },
    { label: "Tarifs", href: "/pricing" },
    { label: "Comment ça marche", href: "#how-it-works" },
  ],
  Ressources: [
    { label: "Comment ça marche", href: "#how-it-works" },
    { label: "Tarifs", href: "/pricing" },
    { label: "Créer un clip", href: "/create/clip" },
    { label: "Créer un film", href: "/create/film" },
  ],
  Légal: [
    { label: "Confidentialité", href: "/privacy" },
    { label: "CGU", href: "/terms" },
    { label: "Mentions légales", href: "/legal" },
  ],
};

const Footer = () => {
  return (
    <footer className="border-t border-border/50 pt-16 pb-8 px-4">
      <div className="container mx-auto">
        <AnimatedSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Film className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  CineClip AI
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                La première plateforme de création vidéo IA avec cohérence visuelle parfaite et export 4K.
              </p>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-foreground mb-4">{title}</h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      {link.href.startsWith("/") ? (
                        <Link
                          to={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </a>
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
          <div className="flex gap-6">
            {["Twitter", "Discord", "YouTube"].map((s) => (
              <a
                key={s}
                href="#"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
