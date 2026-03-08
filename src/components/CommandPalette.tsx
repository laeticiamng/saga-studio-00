import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LayoutDashboard, CreditCard, Settings, Film, Sparkles, Layers } from "lucide-react";

const pages = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Créer un clip", icon: Film, path: "/create/clip" },
  { label: "Créer un film", icon: Layers, path: "/create/film" },
  { label: "Tarifs", icon: CreditCard, path: "/pricing" },
  { label: "Paramètres", icon: Settings, path: "/settings" },
];

const sections = [
  { label: "Fonctionnalités", icon: Sparkles, anchor: "#features" },
  { label: "Galerie", icon: Film, anchor: "#gallery" },
  { label: "Comment ça marche", icon: Layers, anchor: "#how-it-works" },
  { label: "Témoignages", icon: CreditCard, anchor: "#proof" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    if (path.startsWith("#")) {
      const el = document.querySelector(path);
      el?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(path);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher une page ou section…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((p) => (
            <CommandItem key={p.path} onSelect={() => go(p.path)}>
              <p.icon className="mr-2 h-4 w-4" />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Sections">
          {sections.map((s) => (
            <CommandItem key={s.anchor} onSelect={() => go(s.anchor)}>
              <s.icon className="mr-2 h-4 w-4" />
              {s.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
