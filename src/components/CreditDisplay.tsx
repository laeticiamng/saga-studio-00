import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Coins } from "lucide-react";

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
  });

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium">
      <Coins className="h-4 w-4 text-primary" />
      <span>{balance ?? 0}</span>
    </div>
  );
}
