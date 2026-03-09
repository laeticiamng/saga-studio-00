

# AUDIT BETA-TESTEUR NON TECHNIQUE — CineClip AI

---

## 1. RESUME EXECUTIF

### Ce qu'un novice comprend en arrivant
En 5 secondes, le hero est clair : "Transformez votre musique en clip video avec l'IA". La promesse est immediate, le sous-titre concret ("Uploadez votre musique, choisissez un style visuel, recevez une video"). Les reassurances sous le hero ("Donnees securisees en Europe", "Video prete en 5-15 min") renforcent la comprehension. **La homepage fait un bon travail de premiere impression.**

### Ce qu'il ne comprend PAS
1. **"Credits"** — le mot "credits" est utilise partout (hero, pricing, CTA) sans jamais etre explique avant la page pricing. Un novice ne sait pas combien de credits coute un clip, ni ce que ca represente concretement. Le hero dit "10 credits offerts" mais 10 credits = combien de videos ? Une ? Dix ? Zero ?
2. **Difference clip vs film** — le dashboard propose "Nouveau clip" et "Nouveau film" sans aucune explication de la difference. Un novice hesite.
3. **"Démo video bientôt disponible"** — la galerie montre 3 images fixes et un placeholder "demo bientot disponible". Pour un produit qui vend des VIDEOS, ne pas montrer un seul resultat video est un frein majeur a la confiance.
4. **Temoignages non verifies** — 3 temoignages avec prenoms tronques ("Lea M.", "Thomas R.") sans photo, sans lien, sans preuve. Semblent inventes.
5. **Qui est derriere ?** — aucun lien "A propos" dans la navbar principale. Il faut aller dans le footer pour trouver "A propos". Pour un produit qui demande un paiement, c'est un manque de transparence.

### 5 plus gros freins a la conversion
1. **Aucune video de demonstration** — le produit vend des videos mais n'en montre aucune
2. **"Credits" non expliques dans le hero/CTA** — "10 credits offerts" ne veut rien dire pour un novice
3. **Temoignages peu credibles** — pas de photos, pas de noms complets, pas de liens
4. **Pas de lien "A propos" dans la navbar** — l'utilisateur ne sait pas qui est derriere
5. **Sections repetitives sur la homepage** — Features, SocialProof/"Pourquoi choisir", HowItWorks disent des choses similaires, la page est trop longue

### 5 priorites absolues
1. Ajouter une explication concrete des credits dans le hero ("10 credits offerts = 1 clip complet")
2. Supprimer ou remplacer le placeholder "Demo video bientot disponible" — il nuit a la credibilite
3. Rendre les temoignages plus credibles (ajouter des avatars, meme generiques)
4. Ajouter "A propos" dans la navbar
5. Simplifier la homepage — fusionner les sections redundantes

---

## 2. TABLEAU D'AUDIT COMPLET

| Priorite | Page / Zone | Probleme | Ressenti novice | Impact | Recommandation | Faisable ? |
|----------|------------|----------|-----------------|--------|----------------|------------|
| P0 | Hero | "10 credits offerts" sans explication de ce que ca represente | "C'est combien de videos, 10 credits ?" | Confusion, abandon | Ajouter "(= 1 clip complet)" apres "10 credits offerts" | Oui |
| P0 | Gallery | Placeholder "Demo video bientot disponible" | "Ils n'ont meme pas de demo ? Le produit est-il reel ?" | Perte de confiance majeure | Supprimer le placeholder, garder uniquement les images | Oui |
| P0 | SocialProof | Temoignages sans photos, noms tronques | "Ces gens existent-ils vraiment ?" | Credibilite | Ajouter des avatars (initiales colorees), ajouter "Utilisateur beta" | Oui |
| P1 | SocialProof | Compteurs "10" / "13" / "5 min" sont des chiffres trop petits pour impressionner | "10 credits ? 13 styles ? C'est tout ?" | Anti-social-proof | Reformuler : "10 credits offerts" → supprimer les compteurs, garder uniquement les highlights | Oui |
| P1 | Navbar | Pas de lien "A propos" visible | "Qui fait ce site ?" | Manque de confiance | Ajouter un lien dans le footer ET dans la navbar pour les pages non-landing | Oui |
| P1 | Homepage | Sections trop nombreuses et repetitives (Features + "Pourquoi choisir" + HowItWorks) | "Ca repete la meme chose" | Fatigue de lecture, scroll excessif | Fusionner "Pourquoi choisir" dans Features ou le supprimer | Oui |
| P1 | Pricing | "1 credit ≈ 1 scene generee" — un novice ne sait pas ce qu'est une scene | "C'est quoi une scene ?" | Confusion pricing | Reformuler : "1 clip de 2 min ≈ 15-25 credits" plus visiblement | Oui |
| P1 | CTA final | Repete quasi-mot pour mot le hero | "J'ai deja lu ca" | Inutile | Varier le message : mettre l'accent sur "gratuit, sans engagement, 1 clip complet offert" | Oui |
| P2 | Auth | Titre "Content de vous revoir" pour un premier visiteur qui n'a jamais eu de compte | "Je ne suis jamais venu ici" | Legere confusion | Mettre le mode signup par defaut quand venant du CTA "Essai gratuit" | Oui |
| P2 | Dashboard vide | "Creez votre premiere video propulsee par l'IA" — pas d'explication clip vs film | "C'est quoi la difference ?" | Hesitation | Ajouter une phrase sous chaque bouton | Deja fait partiellement |
| P2 | CreateClip | "Moteur IA" dans les options avancees — Runway Gen-4, Luma, Google Veo | "C'est quoi tout ca ? Je veux juste ma video" | Surcharge technique | OK car cache dans "Options avancees", mais le label devrait etre plus clair | Oui |
| P2 | Cookies | Banner dit "cookies essentiels" mais propose "Refuser" — si essentiels, pourquoi refuser ? | Confusion | Legere incoherence | Reformuler : "Accepter" uniquement, ou clarifier | Oui |
| P2 | Footer | "Contact" renvoie vers /about — pas evident | "Ou est la page contact ?" | Friction | OK car formulaire est dans About, mais le label pourrait etre "Nous contacter" | Oui |
| P3 | Homepage | ClientLogos section nommee "ClientLogos" mais ne contient aucun logo — ce sont des reassurances | Pas visible par l'utilisateur | Cosmetique | Renommer internement seulement | Non prioritaire |
| P3 | Gallery images | 3 images statiques avec "Exemple" badge — correct mais pourrait montrer plus de variete | "C'est tout ?" | Leger | Acceptable en l'etat | Non urgent |
| P3 | Mobile | Homepage est longue a scroller — sections nombreuses | Scroll fatigue | Mineur | Acceptable mais ideal serait de reduire | Lie a P1 |

---

## 3. AMELIORATIONS PRIORITAIRES A IMPLEMENTER

### Textes a reecrire
1. **Hero badge** : "🎁 10 credits offerts — Aucune carte bancaire requise" → "🎁 Votre premier clip offert — Aucune carte bancaire requise"
2. **Hero sub-features** : "Jusqu'a 4K selon le plan" est technique → "Qualite HD et 4K"
3. **CTA final** : Varier le titre → "Pret a creer votre clip ?" au lieu de repeter le hero

### Sections a modifier
1. **Supprimer le placeholder "Demo video bientot disponible"** de la galerie — il nuit plus qu'il n'aide
2. **Supprimer les compteurs SocialProof** (10, 13, 5 min) — ces chiffres sont trop petits pour impressionner, ils ont l'effet inverse
3. **Ajouter des avatars aux temoignages** — meme de simples initiales dans des cercles colores

### CTA a renommer
- "Essai gratuit — Creer ma video" est bien mais long. Alternative : "Creer mon premier clip gratuitement"

### Elements de confiance a ajouter
- Ajouter le lien "A propos" dans le footer de la navbar sur les pages non-landing (deja present dans le footer, mais plus visible dans la nav)

---

## 4. PLAN D'IMPLEMENTATION

Les modifications suivantes seront implementees :

1. **Hero.tsx** : Remplacer "10 credits offerts" par "Votre premier clip offert" dans le badge. Simplifier les sub-features.
2. **Gallery.tsx** : Supprimer le bloc placeholder "Demo video bientot disponible".
3. **SocialProof.tsx** : Supprimer la section compteurs. Ajouter des avatars (initiales colorees) aux temoignages.
4. **CTA.tsx** : Varier le titre et le message par rapport au hero.
5. **Navbar.tsx** : Ajouter "A propos" dans les landingLinks.
6. **Auth.tsx** : Passer le mode signup par defaut quand l'utilisateur arrive depuis un CTA "Essai gratuit".

