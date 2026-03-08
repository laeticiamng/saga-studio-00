import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Legal() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold mb-8">Mentions légales</h1>
        <div className="max-w-none space-y-6 text-muted-foreground">
          <h2 className="text-xl font-semibold text-foreground">Éditeur du site</h2>
          <p>CineClip AI<br />Service de génération vidéo par intelligence artificielle<br />Contact : contact@cineclip.ai</p>

          <h2 className="text-xl font-semibold text-foreground">Hébergement</h2>
          <p>Ce site est hébergé par Lovable Cloud.</p>

          <h2 className="text-xl font-semibold text-foreground">Directeur de la publication</h2>
          <p>Le directeur de la publication est le représentant légal de CineClip AI.</p>

          <h2 className="text-xl font-semibold text-foreground">Propriété intellectuelle</h2>
          <p>L'ensemble du contenu du site (textes, images, logo, code) est protégé par le droit d'auteur. Toute reproduction sans autorisation est interdite.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
