import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useScenes } from "@/hooks/useScenes";
import { Loader2, MapPin, Clock, Palette, AlertTriangle } from "lucide-react";

export function SceneBreakdown({ episodeId, durationTargetMin }: { episodeId: string; durationTargetMin?: number }) {
  const { data: scenes, isLoading } = useScenes(episodeId);

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" />;
  }

  if (!scenes || scenes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Aucune scène. Lancez le pipeline pour générer le découpage.
      </p>
    );
  }

  const totalDurationSec = scenes.reduce((sum, s) => sum + (s.duration_target_sec || 0), 0);
  const totalDurationMin = totalDurationSec / 60;
  const targetMin = durationTargetMin || 50;
  const durationProgress = Math.min(100, (totalDurationMin / targetMin) * 100);
  const isDurationShort = totalDurationMin < targetMin * 0.9;
  const isDurationOver = totalDurationMin > targetMin * 1.1;

  return (
    <div className="space-y-4">
      {/* Duration tracker */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Durée planifiée : {totalDurationMin.toFixed(1)} / {targetMin} min
            </span>
            <span className="text-sm text-muted-foreground">
              {scenes.length} scènes
            </span>
          </div>
          <Progress value={durationProgress} className="h-2" />
          {isDurationShort && totalDurationSec > 0 && (
            <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Durée insuffisante — il manque {(targetMin - totalDurationMin).toFixed(1)} min
            </p>
          )}
          {isDurationOver && (
            <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Durée dépasse la cible de {(totalDurationMin - targetMin).toFixed(1)} min
            </p>
          )}
        </CardContent>
      </Card>

      {/* Scene list */}
      {scenes.map((scene) => (
        <Card key={scene.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-muted-foreground">#{scene.idx}</span>
              {scene.title || "Scène sans titre"}
              {scene.duration_target_sec && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {scene.duration_target_sec >= 60
                    ? `${(scene.duration_target_sec / 60).toFixed(1)} min`
                    : `${scene.duration_target_sec}s`}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {scene.description && (
              <p className="text-sm text-muted-foreground">{scene.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {scene.location && (
                <Badge variant="outline" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />{scene.location}
                </Badge>
              )}
              {scene.time_of_day && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />{scene.time_of_day}
                </Badge>
              )}
              {scene.mood && (
                <Badge variant="outline" className="text-xs">
                  <Palette className="h-3 w-3 mr-1" />{scene.mood}
                </Badge>
              )}
              {scene.shot_count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {scene.shot_count} plans
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
