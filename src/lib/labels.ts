export const statusLabels: Record<string, string> = {
  // Core lifecycle
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

  // Pipeline state machine
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

  // Governance states
  identity_review: "Revue identité",
  world_review: "Revue univers",
  scene_review: "Revue scènes",
  rough_cut: "Rough Cut",
  rough_cut_review: "Revue Rough Cut",
  fine_cut: "Fine Cut",
  fine_cut_review: "Revue Fine Cut",
  finishing: "Finishing",
  exporting: "Export…",
  delivered: "Livré",
  archived: "Archivé",

  // Approvals
  approved: "Approuvé",
  rejected: "Rejeté",
  blocked: "Bloqué",
  awaiting_review: "En attente de revue",

  // Validation
  passed: "Validé",
  warning: "Attention",
  validation_pending: "Validation…",
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

  // Governance
  identity_review: "secondary",
  world_review: "secondary",
  scene_review: "secondary",
  rough_cut: "secondary",
  rough_cut_review: "secondary",
  fine_cut: "secondary",
  fine_cut_review: "secondary",
  finishing: "secondary",
  exporting: "secondary",
  delivered: "default",
  archived: "outline",

  // Approvals
  approved: "default",
  rejected: "destructive",
  blocked: "destructive",
  awaiting_review: "outline",

  // Validation
  passed: "default",
  warning: "secondary",
  validation_pending: "outline",
};

export const typeLabels: Record<string, string> = {
  clip: "Clip",
  film: "Film",
  series: "Série",
  music_video: "Clip Musical",
  hybrid_video: "Vidéo Hybride",
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

/** Lifecycle step labels for project progress rail */
export const lifecycleSteps = [
  { key: "draft", label: "Brief" },
  { key: "identity_review", label: "Identité" },
  { key: "world_review", label: "Univers" },
  { key: "scene_review", label: "Scènes" },
  { key: "generating", label: "Génération" },
  { key: "rough_cut", label: "Rough Cut" },
  { key: "fine_cut", label: "Fine Cut" },
  { key: "finishing", label: "Finishing" },
  { key: "export_ready", label: "Export" },
  { key: "delivered", label: "Livré" },
];
