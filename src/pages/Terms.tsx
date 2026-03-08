import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Terms() {
  usePageTitle("Conditions Générales d'Utilisation");
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold mb-8">Conditions Générales d'Utilisation</h1>
        <div className="max-w-none space-y-6 text-muted-foreground">
          <p>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

          <h2 className="text-xl font-semibold text-foreground">1. Objet</h2>
          <p>Les présentes CGU régissent l'utilisation de la plateforme CineClip AI, service de génération vidéo par intelligence artificielle.</p>

          <h2 className="text-xl font-semibold text-foreground">2. Inscription</h2>
          <p>L'accès aux fonctionnalités de génération nécessite la création d'un compte avec une adresse email valide. L'utilisateur est responsable de la confidentialité de ses identifiants.</p>

          <h2 className="text-xl font-semibold text-foreground">3. Crédits et facturation</h2>
          <p>La génération de vidéos consomme des crédits. Les crédits achetés ne sont ni remboursables ni transférables, sauf en cas de dysfonctionnement avéré du service.</p>

          <h2 className="text-xl font-semibold text-foreground">4. Propriété intellectuelle</h2>
          <p>Les vidéos générées par CineClip AI sont la propriété de l'utilisateur. L'utilisateur garantit détenir les droits sur les médias (musiques, images) uploadés sur la plateforme.</p>

          <h2 className="text-xl font-semibold text-foreground">5. Contenu interdit</h2>
          <p>Il est interdit d'utiliser CineClip AI pour générer du contenu illégal, diffamatoire, pornographique ou portant atteinte aux droits de tiers. Tout abus entraînera la suspension du compte.</p>

          <h2 className="text-xl font-semibold text-foreground">6. Limitation de responsabilité</h2>
          <p>CineClip AI est fourni « en l'état ». Nous ne garantissons pas une disponibilité ininterrompue ni un résultat spécifique de la génération IA.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
