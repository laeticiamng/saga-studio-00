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
          const title = payload.new?.title || "Project";

          if (newStatus === "completed") {
            toast({
              title: "🎬 Video Ready!",
              description: `"${title}" has finished rendering`,
            });
          } else if (newStatus === "failed") {
            toast({
              title: "Pipeline Failed",
              description: `"${title}" encountered an error`,
              variant: "destructive",
            });
          }

          // Invalidate project queries globally
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
