import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Film, LogOut, User, LayoutDashboard, CreditCard, Search, Menu, X } from "lucide-react";
import { CreditDisplay } from "@/components/CreditDisplay";
import CommandPalette from "@/components/CommandPalette";
import ThemeToggle from "@/components/ThemeToggle";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const landingLinks = [
  { label: "Fonctionnalités", href: "#features" },
  { label: "Galerie", href: "#gallery" },
  { label: "Comment ça marche", href: "#how-it-works" },
  { label: "Tarifs", href: "/pricing" },
];

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLandingPage = location.pathname === "/" || location.pathname === "/pricing" || location.pathname === "/privacy" || location.pathname === "/terms" || location.pathname === "/legal";
  const sectionLinks = isLandingPage
    ? landingLinks.filter((l) => !(user && l.href === "/pricing"))
    : [];

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith("#")) {
      if (window.location.pathname !== "/") {
        navigate("/");
        setTimeout(() => {
          const el = document.querySelector(href);
          el?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      } else {
        const el = document.querySelector(href);
        el?.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      navigate(href);
    }
  };

  const mobileNav = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <>
      <CommandPalette />
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <Film className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent" style={{ fontFamily: "var(--font-display)" }}>
                CineClip AI
              </span>
            </Link>

            {sectionLinks.length > 0 && (
              <div className="hidden md:flex items-center gap-1">
                {sectionLinks.map((l) => (
                  <button
                    key={l.href}
                    onClick={() => scrollTo(l.href)}
                    className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search shortcut — only show for logged-in users */}
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex gap-2 text-muted-foreground"
                onClick={() => {
                  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
                }}
              >
                <Search className="h-4 w-4" />
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
            )}

            <ThemeToggle />

            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <>
                  <CreditDisplay />
                  <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="hidden lg:inline">Mes projets</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/pricing")} className="gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="hidden lg:inline">Tarifs</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden lg:inline">Mon compte</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-muted-foreground">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate("/pricing")}>
                    Tarifs
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                    Se connecter
                  </Button>
                  <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>
                    Essai gratuit
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-16 right-0 bottom-0 z-50 w-72 bg-card border-l border-border shadow-2xl md:hidden overflow-y-auto"
            >
              <div className="flex flex-col p-6 gap-2">
                {sectionLinks.map((l, i) => (
                  <motion.button
                    key={l.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    onClick={() => scrollTo(l.href)}
                    className="text-left px-4 py-3 rounded-lg text-foreground hover:bg-muted/50 transition-colors font-medium"
                  >
                    {l.label}
                  </motion.button>
                ))}

                {sectionLinks.length > 0 && <div className="h-px bg-border my-3" />}

                {user ? (
                  <>
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                      <CreditDisplay />
                    </motion.div>
                    <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} onClick={() => mobileNav("/dashboard")} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <LayoutDashboard className="h-4 w-4 text-primary" /> Mes projets
                    </motion.button>
                    <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} onClick={() => mobileNav("/pricing")} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <CreditCard className="h-4 w-4 text-primary" /> Tarifs
                    </motion.button>
                    <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} onClick={() => mobileNav("/settings")} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <User className="h-4 w-4 text-primary" /> Mon compte
                    </motion.button>
                    <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }} onClick={() => { setMobileOpen(false); signOut(); }} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground">
                      <LogOut className="h-4 w-4" /> Déconnexion
                    </motion.button>
                  </>
                ) : (
                  <>
                    <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} onClick={() => mobileNav("/pricing")} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors font-medium">
                      <CreditCard className="h-4 w-4 text-primary" /> Tarifs
                    </motion.button>
                    <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }} onClick={() => mobileNav("/auth")} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors">
                      Se connecter
                    </motion.button>
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.22 }}>
                      <Button variant="hero" className="w-full" onClick={() => mobileNav("/auth")}>
                        Essai gratuit
                      </Button>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
