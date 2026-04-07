import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Privacy() {
  usePageTitle("Politique de confidentialité");
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-16 md:py-20">
        <h1 className="mb-10">Politique de confidentialité</h1>
        <div className="prose-legal">
          <p>Dernière mise à jour : 9 mars 2026</p>

          <p>
            <strong>EMOTIONSCARE SASU</strong> (SIREN 944 505 445), dont le siège social est situé à 80000 Amiens, France, est responsable du traitement des données personnelles collectées via la plateforme Saga Studio.
          </p>

          <h2>1. Collecte des données</h2>
          <p>Saga Studio collecte les données suivantes lors de votre utilisation de la plateforme :</p>
          <ul>
            <li>Adresse email et nom d'affichage lors de l'inscription</li>
            <li>Fichiers médias (audio, images) uploadés pour la génération de vidéos</li>
            <li>Données d'utilisation et métriques de performance</li>
          </ul>

          <h2>2. Utilisation des données</h2>
          <p>Vos données sont utilisées exclusivement pour fournir et améliorer nos services de génération vidéo par IA. Nous ne vendons jamais vos données à des tiers.</p>

          <h2>3. Conservation</h2>
          <p>Les fichiers médias sont conservés pendant la durée de votre compte. Les projets terminés sont archivés après 90 jours d'inactivité. Vous pouvez demander la suppression de vos données à tout moment.</p>

          <h2>4. Droits RGPD</h2>
          <p>
            Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. Contactez-nous à{" "}
            <a href="mailto:contact@emotionscare.com">contact@emotionscare.com</a>{" "}
            pour exercer vos droits.
          </p>

          <h2>5. Cookies</h2>
          <p>Nous utilisons uniquement des cookies essentiels au fonctionnement de l'authentification et de la session utilisateur.</p>

          <h2>6. Responsable du traitement</h2>
          <p>
            EMOTIONSCARE SASU<br />
            80000 Amiens, France<br />
            Email : <a href="mailto:contact@emotionscare.com">contact@emotionscare.com</a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
