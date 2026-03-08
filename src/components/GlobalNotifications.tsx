import { useEffect, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { createContext } from "react";

// Import the context directly to avoid the throwing hook during HMR
import { useAuth } from "@/contexts/AuthContext";

export function GlobalNotifications() {
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch {
    // AuthProvider not yet mounted (HMR race) — render nothing
    return null;
  }
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