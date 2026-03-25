import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBibles, useCreateBible, useDeleteBible } from "@/hooks/useBibles";
import { Plus, Trash2, BookOpen, Loader2 } from "lucide-react";

type BibleType = "style" | "character" | "world" | "tone" | "custom";

const typeLabels: Record<string, string> = {
  style: "Style visuel",
  character: "Personnages",
  wardrobe: "Costumes",
  location: "Lieux",
  world: "Univers",
  music: "Musique",
  voice: "Voix",
  prop: "Accessoires",
  tone: "Tonalité",
  custom: "Personnalisé",
};

export function BibleEditor({ seriesId }: { seriesId: string }) {
  const [selectedType, setSelectedType] = useState<BibleType | undefined>();
  const { data: bibles, isLoading } = useBibles(seriesId, selectedType);
  const createBible = useCreateBible();
  const deleteBible = useDeleteBible();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<BibleType>("style");
  const [newContent, setNewContent] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    let content = {};
    try { content = JSON.parse(newContent); } catch { content = { text: newContent }; }
    await createBible.mutateAsync({
      series_id: seriesId,
      type: newType,
      name: newName.trim(),
      content,
    });
    setIsAdding(false);
    setNewName("");
    setNewContent("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Bibles
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setIsAdding(!isAdding)}>
            <Plus className="h-4 w-4 mr-1" />Nouvelle
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge
            variant={!selectedType ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedType(undefined)}
          >
            Toutes
          </Badge>
          {(Object.keys(typeLabels) as BibleType[]).map((t) => (
            <Badge
              key={t}
              variant={selectedType === t ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedType(t)}
            >
              {typeLabels[t]}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdding && (
          <div className="border rounded-lg p-3 space-y-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom" />
            <Select value={newType} onValueChange={(v) => setNewType(v as BibleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(typeLabels) as BibleType[]).map((t) => (
                  <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Contenu (texte ou JSON)" rows={3} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={createBible.isPending}>
                {createBible.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Annuler</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : bibles && bibles.length > 0 ? (
          bibles.map((bible) => (
            <div key={bible.id} className="border rounded-lg p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{bible.name}</span>
                  <Badge variant="outline" className="text-xs">{typeLabels[bible.type]}</Badge>
                  <span className="text-xs text-muted-foreground">v{bible.version}</span>
                </div>
                <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap max-h-20 overflow-auto">
                  {JSON.stringify(bible.content, null, 2)}
                </pre>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0"
                onClick={() => deleteBible.mutate({ id: bible.id, seriesId })}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Aucune bible créée</p>
        )}
      </CardContent>
    </Card>
  );
}
