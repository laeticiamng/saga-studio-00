import { useCallback, useRef, useState } from "react";
import { Upload, FileText, Image, Music, Video, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface CorpusFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  role?: string;
  roleConfidence?: number;
  entitiesFound?: number;
  errorMessage?: string;
}

interface Props {
  files: CorpusFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  uploading: boolean;
  progress: { done: number; total: number } | null;
}

const ACCEPT = ".pdf,.docx,.doc,.txt,.md,.rtf,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.m4a,.mp4,.mov";

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) return Image;
  if (["mp3", "wav", "m4a", "flac"].includes(ext)) return Music;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return Video;
  return FileText;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function roleLabel(role?: string): string {
  const map: Record<string, string> = {
    script_master: "Script principal",
    episode_script: "Script épisode",
    film_script: "Script film",
    music_video_concept: "Concept clip",
    series_bible: "Bible série",
    short_pitch: "Pitch",
    producer_bible: "Bible producteur",
    one_pager: "One-pager",
    continuity_doc: "Continuité",
    governance_doc: "Gouvernance",
    character_sheet: "Fiche personnage",
    world_pack_doc: "Univers",
    moodboard_doc: "Moodboard",
    wardrobe_doc: "Costumes",
    music_doc: "Musique",
    lyric_doc: "Paroles",
    reference_images: "Référence visuelle",
    production_notes: "Notes de prod",
    unknown: "À classifier",
  };
  return map[role || "unknown"] || role || "Document";
}

export default function CorpusUploader({ files, onAddFiles, onRemoveFile, uploading, progress }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length) onAddFiles(dropped);
    },
    [onAddFiles]
  );

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corpus du projet</CardTitle>
        <CardDescription>
          Glissez-déposez tous vos documents, images de référence et fichiers média.
          La plateforme les analysera automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all ${
            dragOver ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"
          }`}
        >
          <Upload className={`h-10 w-10 mb-3 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
          <p className="font-medium text-sm">Glissez vos fichiers ici</p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, DOCX, TXT, Markdown, images, audio, vidéo
          </p>
          <Button variant="outline" size="sm" className="mt-4" type="button">
            Parcourir
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={handleSelect}
          />
        </div>

        {/* Progress bar */}
        {uploading && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyse en cours…
              </span>
              <span className="font-medium">{progress.done}/{progress.total}</span>
            </div>
            <Progress value={(progress.done / progress.total) * 100} />
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {files.map((f) => {
              const Icon = getFileIcon(f.file.name);
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border p-3 bg-card"
                >
                  <div className="p-2 rounded-lg bg-secondary flex-shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatSize(f.file.size)}</span>
                      {f.status === "done" && f.role && (
                        <Badge variant="secondary" className="text-xs">
                          {roleLabel(f.role)}
                        </Badge>
                      )}
                      {f.status === "done" && f.entitiesFound != null && (
                        <span className="text-xs text-muted-foreground">
                          {f.entitiesFound} entité{f.entitiesFound !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {f.status === "uploading" || f.status === "processing" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : f.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : f.status === "error" ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : null}
                  </div>
                  {!uploading && (
                    <button
                      onClick={() => onRemoveFile(f.id)}
                      className="flex-shrink-0 h-6 w-6 rounded-full hover:bg-destructive/10 flex items-center justify-center"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
