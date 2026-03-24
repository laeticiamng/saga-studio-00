import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { User } from "lucide-react";

export function CharacterProfileCard({
  character,
}: {
  character: Tables<"character_profiles">;
}) {
  const refImages = (character.reference_images as string[]) || [];

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            {refImages.length > 0 ? (
              <img
                src={refImages[0]}
                alt={character.name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <User className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-medium">{character.name}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {character.visual_description}
            </p>
            {character.voice_notes && (
              <Badge variant="outline" className="mt-1 text-xs">
                Voix: {character.voice_notes}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
