import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Lock, Unlock, Clock, Film, Image as ImageIcon } from "lucide-react";
import { useUpdateClip } from "@/hooks/useTimelineClips";
import { useToast } from "@/hooks/use-toast";

interface ClipPreviewDrawerProps {
  clip: Record<string, unknown> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClipPreviewDrawer({ clip, open, onOpenChange }: ClipPreviewDrawerProps) {
  const updateClip = useUpdateClip();
  const { toast } = useToast();

  if (!clip) return null;

  const sourceUrl = clip.source_url as string | null;
  const isImage = sourceUrl
    ? /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)|placehold\.co/i.test(sourceUrl)
    : false;
  const durationMs = (Number(clip.end_time_ms) || 0) - (Number(clip.start_time_ms) || 0);
  const isLocked = !!clip.locked;

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const ms_ = ms % 1000;
    return `${m}:${String(sec).padStart(2, "0")}.${String(Math.floor(ms_ / 100))}`;
  };

  const handleToggleLock = async () => {
    try {
      await updateClip.mutateAsync({ id: String(clip.id), locked: !isLocked });
      toast({ title: isLocked ? "Clip déverrouillé" : "Clip verrouillé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            {String(clip.name || "Clip")}
          </SheetTitle>
          <SheetDescription>Détails et prévisualisation du clip</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Preview */}
          <div className="rounded-lg overflow-hidden bg-black aspect-video relative">
            {sourceUrl ? (
              isImage ? (
                <img src={sourceUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <video
                  src={sourceUrl}
                  className="w-full h-full object-contain"
                  controls
                  muted
                  playsInline
                  preload="auto"
                />
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground/50">Pas de média source</span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Position</Label>
              <span className="text-sm font-mono">
                {formatTime(Number(clip.start_time_ms))} → {formatTime(Number(clip.end_time_ms))}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Durée</Label>
              <Badge variant="outline" className="gap-1 font-mono">
                <Clock className="h-3 w-3" />
                {(durationMs / 1000).toFixed(1)}s
              </Badge>
            </div>

            {clip.provider && (
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <Badge variant="secondary">{String(clip.provider)}</Badge>
              </div>
            )}

            {clip.model && (
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Modèle</Label>
                <span className="text-sm">{String(clip.model)}</span>
              </div>
            )}

            {clip.status && (
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Statut</Label>
                <Badge variant="outline">{String(clip.status)}</Badge>
              </div>
            )}
          </div>

          {/* Lock toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              {isLocked ? <Lock className="h-4 w-4 text-primary" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">Verrouiller le clip</p>
                <p className="text-xs text-muted-foreground">Empêche le réassemblage automatique</p>
              </div>
            </div>
            <Switch
              checked={isLocked}
              onCheckedChange={handleToggleLock}
              disabled={updateClip.isPending}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
