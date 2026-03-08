import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Film, LogOut, User, LayoutDashboard, CreditCard, Shield, Search } from "lucide-react";
import { CreditDisplay } from "@/components/CreditDisplay";
import CommandPalette from "@/components/CommandPalette";
import { useState } from "react";

const sectionLinks = [
  { label: "Fonctionnalités", href: "#features" },
  { label: "Galerie", href: "#gallery" },
  { label: "Tarifs", href: "/pricing" },
];

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);

  const scrollTo = (href: string) => {
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(href);
    }
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

            {/* Section links — hidden on mobile */}
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
          </div>

          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => {
                // Dispatch ⌘K
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
              }}
            >
              <Search className="h-4 w-4" />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </Button>

            {user ? (
              <>
                <CreditDisplay />
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/pricing")} className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Pricing</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-muted-foreground">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>
                Get Started
              </Button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
