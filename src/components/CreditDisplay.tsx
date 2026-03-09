import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Coins } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CreditDisplay() {
  const { user } = useAuth();

  const { data: balance } = useQuery({
    queryKey: ["credits", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from("credit_wallets")
        .select("balance")
        .eq("id", user.id)
        .single();
      if (error) return 0;
      return data?.balance ?? 0;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium cursor-default">
          <Coins className="h-4 w-4 text-primary" />
          <span>{balance ?? 0}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-center">
        <p className="text-xs">Vos crédits CineClip. Chaque projet consomme des crédits. Rechargez dans Tarifs.</p>
      </TooltipContent>
    </Tooltip>
  );
}
