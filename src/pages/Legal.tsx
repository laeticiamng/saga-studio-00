import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Legal() {
  usePageTitle("Mentions légales");
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold mb-8">Mentions légales</h1>
        <div className="max-w-none space-y-6 text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Éditeur du site</h2>
          <p>
            <strong>EMOTIONSCARE SASU</strong><br />
            SIREN : 944 505 445<br />
            Siège social : 80000 Amiens, France<br />
            Email : <a href="mailto:contact@emotionscare.com" className="text-primary hover:underline">contact@emotionscare.com</a>
          </p>
          <p>
            CineClip AI est un service édité par EMOTIONSCARE SASU, spécialisé dans la génération vidéo par intelligence artificielle.
          </p>

          <h2 className="text-xl font-semibold text-foreground">Directeur de la publication</h2>
          <p>Motongane Laeticia, Présidente d'EMOTIONSCARE SASU.</p>

          <h2 className="text-xl font-semibold text-foreground">Hébergement</h2>
          <p>Ce site est hébergé en Europe par un prestataire cloud professionnel.</p>

          <h2 className="text-xl font-semibold text-foreground">Propriété intellectuelle</h2>
          <p>L'ensemble du contenu du site (textes, images, logo, code) est protégé par le droit d'auteur. Toute reproduction sans autorisation est interdite.</p>

          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p>
            Pour toute question, vous pouvez nous contacter à l'adresse{" "}
            <a href="mailto:contact@emotionscare.com" className="text-primary hover:underline">contact@emotionscare.com</a>.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
