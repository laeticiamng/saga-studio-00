import { useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SeriesNotFound } from "@/components/SeriesNotFound";
import Footer from "@/components/Footer";
import { useCharacterProfiles, useCreateCharacterProfile, useUpdateCharacterProfile } from "@/hooks/useCharacterProfiles";
import { CharacterProfileCard } from "@/components/series/CharacterProfileCard";
import { useSeries } from "@/hooks/useSeries";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { getSeriesProjectTitle } from "@/lib/series-helpers";

export default function CharacterGallery() {
  const { id } = useParams<{ id: string }>();
  const { data: series, isLoading: seriesLoading } = useSeries(id);
  const { data: characters, isLoading } = useCharacterProfiles(id);
  const createCharacter = useCreateCharacterProfile();
  const updateCharacter = useUpdateCharacterProfile();
  usePageTitle("Personnages");

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [visualDesc, setVisualDesc] = useState("");
  const [personality, setPersonality] = useState("");
  const [voiceNotes, setVoiceNotes] = useState("");

  const resetForm = () => {
    setName("");
    setVisualDesc("");
    setPersonality("");
    setVoiceNotes("");
    setEditId(null);
  };

  const handleSave = async () => {
    if (!name.trim() || !id) return;
    try {
      if (editId) {
        await updateCharacter.mutateAsync({
          id: editId,
          name: name.trim(),
          visual_description: visualDesc.trim() || null,
          personality: personality.trim() || null,
          voice_notes: voiceNotes.trim() || null,
        });
        toast.success("Personnage mis à jour");
      } else {
        await createCharacter.mutateAsync({
          series_id: id,
          name: name.trim(),
          visual_description: visualDesc.trim() || null,
          personality: personality.trim() || null,
          voice_notes: voiceNotes.trim() || null,
        });
        toast.success("Personnage créé");
      }
      setOpen(false);
      resetForm();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
  };

  const handleEdit = (char: { id: string; name: string; visual_description?: string | null; personality?: string | null; voice_notes?: string | null }) => {
    setEditId(char.id);
    setName(char.name);
    setVisualDesc(char.visual_description || "");
    setPersonality(char.personality || "");
    setVoiceNotes(char.voice_notes || "");
    setOpen(true);
  };

  if (isLoading || seriesLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!series) return <SeriesNotFound />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-5xl py-8">
        <Breadcrumbs items={[
          { label: "Mes projets", href: "/dashboard" },
          { label: getSeriesProjectTitle(series), href: `/series/${id}` },
          { label: "Personnages" },
        ]} />
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Personnages</h1>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? "Modifier le personnage" : "Nouveau personnage"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du personnage" />
                </div>
                <div className="space-y-2">
                  <Label>Description visuelle</Label>
                  <Textarea value={visualDesc} onChange={(e) => setVisualDesc(e.target.value)} placeholder="Apparence, taille, style..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Personnalité</Label>
                  <Textarea value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="Traits de caractère, motivations..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Notes vocales</Label>
                  <Input value={voiceNotes} onChange={(e) => setVoiceNotes(e.target.value)} placeholder="Ton, accent, timbre..." />
                </div>
                <Button onClick={handleSave} disabled={createCharacter.isPending || updateCharacter.isPending || !name.trim()} className="w-full">
                  {(createCharacter.isPending || updateCharacter.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editId ? "Sauvegarder" : "Créer"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {characters && characters.length > 0 ? (
            characters.map((char) => (
              <div key={char.id} onClick={() => handleEdit(char)} className="cursor-pointer">
                <CharacterProfileCard character={char} />
              </div>
            ))
          ) : (
            <p className="text-muted-foreground col-span-full">
              Aucun personnage créé. Cliquez sur "Ajouter" ou les agents les créeront automatiquement.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
