import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Privacy() {
  usePageTitle("Politique de confidentialité");
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold mb-8">Politique de confidentialité</h1>
        <div className="max-w-none space-y-6 text-muted-foreground">
          <p>Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

          <h2 className="text-xl font-semibold text-foreground">1. Collecte des données</h2>
          <p>CineClip AI collecte les données suivantes lors de votre utilisation de la plateforme :</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Adresse email et nom d'affichage lors de l'inscription</li>
            <li>Fichiers médias (audio, images) uploadés pour la génération de vidéos</li>
            <li>Données d'utilisation et métriques de performance</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground">2. Utilisation des données</h2>
          <p>Vos données sont utilisées exclusivement pour fournir et améliorer nos services de génération vidéo par IA. Nous ne vendons jamais vos données à des tiers.</p>

          <h2 className="text-xl font-semibold text-foreground">3. Conservation</h2>
          <p>Les fichiers médias sont conservés pendant la durée de votre compte. Les projets terminés sont archivés après 90 jours d'inactivité. Vous pouvez demander la suppression de vos données à tout moment.</p>

          <h2 className="text-xl font-semibold text-foreground">4. Droits RGPD</h2>
          <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. Contactez-nous à privacy@cineclip.ai pour exercer vos droits.</p>

          <h2 className="text-xl font-semibold text-foreground">5. Cookies</h2>
          <p>Nous utilisons uniquement des cookies essentiels au fonctionnement de l'authentification et de la session utilisateur.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
