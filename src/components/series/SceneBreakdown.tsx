import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useScenes } from "@/hooks/useScenes";
import { Loader2, MapPin, Clock, Palette } from "lucide-react";

export function SceneBreakdown({ episodeId }: { episodeId: string }) {
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

  return (
    <div className="space-y-3">
      {scenes.map((scene) => (
        <Card key={scene.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-muted-foreground">#{scene.idx}</span>
              {scene.title || "Scène sans titre"}
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
              {scene.duration_target_sec && (
                <Badge variant="outline" className="text-xs">
                  {scene.duration_target_sec}s
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
