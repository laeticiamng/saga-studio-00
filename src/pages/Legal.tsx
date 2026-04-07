import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Legal() {
  usePageTitle("Mentions légales");
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-16 md:py-20">
        <h1 className="mb-10">Mentions légales</h1>
        <div className="prose-legal">
          <h2>Éditeur du site</h2>
          <p>
            <strong>EMOTIONSCARE SASU</strong><br />
            SIREN : 944 505 445<br />
            Siège social : 80000 Amiens, France<br />
            Email : <a href="mailto:contact@emotionscare.com">contact@emotionscare.com</a>
          </p>
          <p>
            CineClip AI est un service édité par EMOTIONSCARE SASU, spécialisé dans la génération vidéo par intelligence artificielle. Désormais exploité sous le nom <strong>Saga Studio</strong>.
          </p>

          <h2>Directeur de la publication</h2>
          <p>Motongane Laeticia, Présidente d'EMOTIONSCARE SASU.</p>

          <h2>Hébergement</h2>
          <p>Ce site est hébergé en Europe par un prestataire cloud professionnel.</p>

          <h2>Propriété intellectuelle</h2>
          <p>L'ensemble du contenu du site (textes, images, logo, code) est protégé par le droit d'auteur. Toute reproduction sans autorisation est interdite.</p>

          <h2>Contact</h2>
          <p>
            Pour toute question, vous pouvez nous contacter à l'adresse{" "}
            <a href="mailto:contact@emotionscare.com">contact@emotionscare.com</a>.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
