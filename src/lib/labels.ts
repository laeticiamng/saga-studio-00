export const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  analyzing: "Analyse…",
  planning: "Planification…",
  generating: "Génération…",
  stitching: "Assemblage…",
  completed: "Terminé",
  failed: "Échoué",
  cancelled: "Annulé",
  in_production: "En production",
  processing: "En cours",
  pending: "En attente",
  resolved: "Résolu",
  dismissed: "Rejeté",
  reviewed: "Examiné",
  // Pipeline state machine states
  validating_inputs: "Validation…",
  analyzing_audio: "Analyse audio…",
  planning_storyboard: "Storyboard…",
  resolving_provider: "Provider…",
  generating_shots: "Génération…",
  quality_review: "Revue qualité…",
  rendering: "Rendu…",
  export_ready: "Prêt à exporter",
  failed_retryable: "Échec (relançable)",
  failed_terminal: "Échec définitif",
};

export const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  analyzing: "secondary",
  planning: "secondary",
  generating: "secondary",
  stitching: "secondary",
  completed: "default",
  failed: "destructive",
  cancelled: "outline",
  in_production: "secondary",
  processing: "secondary",
  pending: "outline",
  resolved: "default",
  dismissed: "outline",
  reviewed: "default",
  validating_inputs: "secondary",
  analyzing_audio: "secondary",
  planning_storyboard: "secondary",
  resolving_provider: "secondary",
  generating_shots: "secondary",
  quality_review: "secondary",
  rendering: "secondary",
  export_ready: "default",
  failed_retryable: "destructive",
  failed_terminal: "destructive",
};

export const typeLabels: Record<string, string> = {
  clip: "Clip",
  film: "Film",
  series: "Série",
  music_video: "Clip Musical",
};

export const qualityTierLabels: Record<string, string> = {
  premium: "Premium",
  standard: "Standard",
  economy: "Économique",
};

export const clipTypeLabels: Record<string, string> = {
  live: "Live",
  performance: "Performance",
  narrative: "Narratif",
  hybrid: "Hybride",
};

export const artistPresenceLabels: Record<string, string> = {
  none: "Absent",
  partial: "Partiel",
  full: "Omniprésent",
};

export const renderTargetLabels: Record<string, string> = {
  server_required: "Serveur (obligatoire)",
  server_preferred: "Serveur (préféré)",
  browser_allowed: "Navigateur autorisé",
};

export const styleLabels: Record<string, string> = {
  cinematic: "Cinématique",
  anime: "Anime",
  watercolor: "Aquarelle",
  "3d_render": "Rendu 3D",
  noir: "Noir",
  vintage: "Vintage",
  neon: "Néon",
  realistic: "Réaliste",
  hyperpop: "Hyperpop",
  afrofuturism: "Afrofuturisme",
  synthwave: "Synthwave",
  documentary: "Documentaire",
  fantasy: "Fantaisie",
};
