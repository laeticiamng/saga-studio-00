import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function GlobalNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-project-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new?.status;
          const title = payload.new?.title || "Projet";

          if (newStatus === "completed") {
            toast({
              title: "🎬 Vidéo prête !",
              description: `« ${title} » a terminé le rendu`,
            });
          } else if (newStatus === "failed") {
            toast({
              title: "Pipeline échoué",
              description: `« ${title} » a rencontré une erreur`,
              variant: "destructive",
            });
          }

          queryClient.invalidateQueries({ queryKey: ["projects"] });
          queryClient.invalidateQueries({ queryKey: ["project", payload.new?.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast, queryClient]);

  return null;
}