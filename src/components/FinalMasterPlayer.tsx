import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Film, Loader2 } from "lucide-react";
import { useSignedRenderUrl } from "@/hooks/useSignedRenderUrl";

interface Props {
  projectId: string;
  master16Path: string | null;
  master9Path: string | null;
  teaserPath: string | null;
  legacyMaster16: string | null;
  legacyMaster9: string | null;
  legacyTeaser: string | null;
  /** Set to "public" when used inside ShareView (uses sign-share-url instead) */
  mode?: "authenticated" | "public";
}

/**
 * Renders the final master video using a 24h signed URL when a path is available,
 * falling back to legacy public URLs for pre-privatization rows.
 */
export function FinalMasterPlayer({
  projectId,
  master16Path,
  master9Path,
  teaserPath,
  legacyMaster16,
  legacyMaster9,
  legacyTeaser,
  mode = "authenticated",
}: Props) {
  const master16 = useSignedRenderUrl({
    path: master16Path,
    projectId,
    fallbackUrl: legacyMaster16,
    mode,
  });
  const master9 = useSignedRenderUrl({
    path: master9Path,
    projectId,
    fallbackUrl: legacyMaster9,
    mode,
  });
  const teaser = useSignedRenderUrl({
    path: teaserPath,
    projectId,
    fallbackUrl: legacyTeaser,
    mode,
  });

  if (master16.isLoading) {
    return (
      <Card className="border-border/50 bg-card/60 mb-8">
        <CardContent className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Préparation du lien sécurisé…</span>
        </CardContent>
      </Card>
    );
  }

  if (!master16.url) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
      <Card className="border-primary/20 bg-card/80 overflow-hidden">
        <div className="rounded-t-lg overflow-hidden bg-black">
          <video
            src={master16.url}
            controls
            className="w-full aspect-video"
            poster={teaser.url || undefined}
          />
        </div>
        <CardContent className="flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Film className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Master final</span>
            {master9.url && master9.url !== master16.url && (
              <Badge variant="outline" className="text-[10px]">+ Vertical 9:16</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a href={master16.url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Télécharger 16:9
              </Button>
            </a>
            {master9.url && master9.url !== master16.url && (
              <a href={master9.url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> 9:16
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
