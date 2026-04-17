import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card } from "@/components/ui/card";
import { Shield, Lock, Database, FileCheck, Eye, AlertTriangle, KeyRound, ServerCog } from "lucide-react";

export default function Security() {
  usePageTitle("Sécurité & Conformité");

  const pillars = [
    {
      icon: Lock,
      title: "Chiffrement & transport",
      points: [
        "TLS 1.2+ obligatoire sur l'ensemble des appels API et frontaux",
        "Données au repos chiffrées par le fournisseur de stockage (Supabase, AES-256)",
        "Mots de passe hashés (bcrypt) — protection HIBP activée contre les fuites connues",
      ],
    },
    {
      icon: Shield,
      title: "Authentification & accès",
      points: [
        "JWT court-terme + refresh tokens, signés côté serveur",
        "Validation explicite des tokens dans toutes les Edge Functions sensibles",
        "Système de rôles séparé (table dédiée) — pas de privilèges côté client",
      ],
    },
    {
      icon: Database,
      title: "Isolation des données (RLS)",
      points: [
        "Row-Level Security activé sur 100 % des tables applicatives",
        "Politiques user-scoped : chaque projet, asset, document est restreint à son propriétaire",
        "Vue publique dédiée (projects_public) pour les partages — aucune fuite de PII",
      ],
    },
    {
      icon: FileCheck,
      title: "Audit trail immuable (WORM)",
      points: [
        "Journal d'audit append-only avec chaîne de hash SHA-256 (anti-falsification)",
        "Vérification d'intégrité disponible (verify_audit_chain) côté admin",
        "Traçabilité distribuée via correlation_id sur toute la chaîne édition → rendu",
      ],
    },
    {
      icon: KeyRound,
      title: "Secrets & clés API",
      points: [
        "Aucune clé privée côté client — tout transite par Edge Functions sandboxées",
        "Secrets gérés via Supabase Vault, jamais committés en clair",
        "Clés providers (OpenAI, Runway, Luma, Veo, Stripe) isolées par environnement",
      ],
    },
    {
      icon: ServerCog,
      title: "Stockage & assets",
      points: [
        "Bucket renders privé : exports accessibles uniquement via signed URLs (TTL 24 h)",
        "Vérification d'ownership côté serveur avant chaque génération de signed URL",
        "Page de partage publique limitée aux projets explicitement marqués completed",
      ],
    },
    {
      icon: AlertTriangle,
      title: "Anti-abus & quotas",
      points: [
        "Rate-limit token bucket sur tous les endpoints à coût élevé (autopilot, render, IA, ingestion)",
        "Plafonds de crédits par projet (guardrails) avec mode shadow / enforce",
        "Idempotence des opérations critiques (débit crédits, dispatch pipeline)",
      ],
    },
    {
      icon: Eye,
      title: "Gouvernance & validation",
      points: [
        "Pipeline 18 étapes avec gates d'approbation humaine (Human-in-the-loop)",
        "Module Redaction Pass : contrôle conformité avant toute livraison",
        "Validation anti-aberrations multi-passes sur 9 catégories de risques",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main id="main-content" className="container mx-auto max-w-5xl px-4 py-16 md:py-24">
        {/* Hero */}
        <header className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6">
            <Shield className="h-3.5 w-3.5" />
            Sécurité by design
          </div>
          <h1 className="mb-6">Sécurité & Conformité</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Saga Studio gère du contenu créatif sensible — scripts, voix, identités visuelles, livrables clients.
            Notre architecture est conçue pour protéger ces actifs à chaque étape.
          </p>
        </header>

        {/* Piliers */}
        <section className="grid gap-6 md:grid-cols-2 mb-20">
          {pillars.map((p) => (
            <Card key={p.title} className="p-6 border-border/60">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <p.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-3">{p.title}</h3>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {p.points.map((pt, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </section>

        {/* Hébergement */}
        <section className="mb-20">
          <h2 className="text-2xl font-semibold mb-6">Hébergement & sous-traitants</h2>
          <Card className="p-6 border-border/60">
            <div className="prose-legal text-sm space-y-3">
              <p>
                L'infrastructure repose sur <strong>Supabase</strong> (base PostgreSQL, stockage objet, Edge Functions Deno)
                et sur le réseau de distribution de <strong>Lovable Cloud</strong>. Les données sont hébergées au sein de
                l'Union Européenne lorsque le plan applicable le permet.
              </p>
              <p>
                Les fournisseurs IA externes (OpenAI, Runway, Luma, Google Veo) reçoivent uniquement les payloads strictement
                nécessaires à la génération demandée. Aucune information de paiement ni mot de passe ne leur est jamais transmis.
                Les paiements sont délégués à <strong>Stripe</strong> (PCI-DSS niveau 1).
              </p>
              <p>
                L'envoi d'emails transactionnels passe par <strong>Resend</strong> via le domaine
                <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs">notify.emotionscare.com</code>
                avec authentification SPF / DKIM / DMARC.
              </p>
            </div>
          </Card>
        </section>

        {/* Conformité RGPD */}
        <section className="mb-20">
          <h2 className="text-2xl font-semibold mb-6">Conformité RGPD</h2>
          <Card className="p-6 border-border/60">
            <div className="prose-legal text-sm space-y-3">
              <p>
                Saga Studio est édité par <strong>EMOTIONSCARE SASU</strong> (SIREN 944 505 445), responsable de traitement
                au sens du RGPD. Vous disposez à tout moment d'un droit d'accès, de rectification, d'effacement, de
                portabilité et d'opposition sur vos données.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>
                  <strong>Suppression de compte :</strong> bouton dédié dans les paramètres — purge complète des projets,
                  assets et logs personnels (le journal d'audit immuable peut conserver l'événement de suppression à des
                  fins légales).
                </li>
                <li>
                  <strong>Export :</strong> les livrables vidéo restent téléchargeables pendant la durée de l'abonnement
                  via signed URLs.
                </li>
                <li>
                  <strong>Cookies :</strong> uniquement des cookies essentiels (session, préférences). Aucun cookie
                  publicitaire ou de tracking tiers.
                </li>
                <li>
                  <strong>Sous-traitants :</strong> liste détaillée disponible sur demande à{" "}
                  <a href="mailto:contact@emotionscare.com" className="text-primary hover:underline">
                    contact@emotionscare.com
                  </a>.
                </li>
              </ul>
              <p>
                Pour toute question relative à la protection des données ou pour signaler un incident, écrivez à{" "}
                <a href="mailto:contact@emotionscare.com" className="text-primary hover:underline">
                  contact@emotionscare.com
                </a>.
              </p>
            </div>
          </Card>
        </section>

        {/* Divulgation responsable */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Divulgation responsable</h2>
          <Card className="p-6 border-border/60 bg-muted/20">
            <div className="prose-legal text-sm space-y-3">
              <p>
                Si vous découvrez une vulnérabilité de sécurité, merci de nous la signaler en privé avant toute publication.
                Nous nous engageons à :
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>Accuser réception sous 72 h ouvrées</li>
                <li>Ne pas engager de poursuites contre une recherche menée de bonne foi et sans exfiltration de données</li>
                <li>Vous tenir informé du correctif et, sur demande, vous créditer publiquement</li>
              </ul>
              <p>
                Contact dédié :{" "}
                <a href="mailto:contact@emotionscare.com?subject=Security%20disclosure" className="text-primary hover:underline">
                  contact@emotionscare.com
                </a>{" "}
                — objet « Security disclosure ».
              </p>
            </div>
          </Card>
        </section>

        {/* Métadonnées */}
        <footer className="text-center text-xs text-muted-foreground border-t border-border/40 pt-8">
          <p>Dernière mise à jour : 17 avril 2026 — Document susceptible d'évoluer avec la plateforme.</p>
        </footer>
      </main>
      <Footer />
    </div>
  );
}
