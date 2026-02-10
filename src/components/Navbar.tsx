import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Film, LogOut, User, LayoutDashboard, CreditCard, Shield } from "lucide-react";
import { CreditDisplay } from "@/components/CreditDisplay";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            CineClip AI
          </span>
        </Link>

        <div className="flex items-center gap-3">
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
  );
}
