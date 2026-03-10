import { cn } from "@/lib/utils";

const STYLE_PRESETS = [
  { id: "cinematic", label: "Cinématique", emoji: "🎬", color: "from-amber-500/20 to-orange-500/20" },
  { id: "anime", label: "Anime", emoji: "🌸", color: "from-pink-500/20 to-purple-500/20" },
  { id: "realistic", label: "Réaliste", emoji: "📷", color: "from-slate-500/20 to-gray-500/20" },
  { id: "noir", label: "Noir", emoji: "🌑", color: "from-gray-500/20 to-gray-800/20" },
  { id: "watercolor", label: "Aquarelle", emoji: "🎨", color: "from-blue-500/20 to-teal-500/20" },
  { id: "3d_render", label: "Rendu 3D", emoji: "🧊", color: "from-violet-500/20 to-blue-500/20" },
  { id: "vintage", label: "Vintage", emoji: "📼", color: "from-amber-600/20 to-yellow-500/20" },
  { id: "neon", label: "Néon", emoji: "💡", color: "from-fuchsia-500/20 to-cyan-500/20" },
  { id: "hyperpop", label: "Hyperpop", emoji: "💿", color: "from-cyan-500/20 to-fuchsia-500/20" },
  { id: "afrofuturism", label: "Afrofuturisme", emoji: "✨", color: "from-yellow-500/20 to-violet-500/20" },
  { id: "synthwave", label: "Synthwave", emoji: "🌆", color: "from-indigo-500/20 to-pink-500/20" },
  { id: "documentary", label: "Documentaire", emoji: "📹", color: "from-stone-500/20 to-slate-500/20" },
  { id: "fantasy", label: "Fantaisie", emoji: "🐉", color: "from-emerald-500/20 to-teal-500/20" },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function StylePresetPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
      {STYLE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onChange(preset.id)}
          className={cn(
            "flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border p-2.5 sm:p-4 transition-all min-h-[72px]",
            "hover:scale-105 hover:shadow-lg active:scale-95",
            value === preset.id
              ? "border-primary bg-primary/10 shadow-md"
              : "border-border/50 bg-card/40"
          )}
        >
          <span className="text-xl sm:text-2xl">{preset.emoji}</span>
          <span className="text-xs sm:text-sm font-medium text-center leading-tight">{preset.label}</span>
        </button>
      ))}
    </div>
  );
}
