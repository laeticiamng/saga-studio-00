import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).single()
      .then(({ data }) => { if (data) setDisplayName(data.display_name || ""); });
  }, [user]);

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["credit-ledger", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("credit_wallets").select("balance").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setLoading(false);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else toast({ title: "Enregistré", description: "Profil mis à jour" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Paramètres</h1>

        <Card className="border-border/50 bg-card/60 mb-6">
          <CardHeader><CardTitle>Profil</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Nom d'affichage</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <Button variant="hero" onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enregistrer
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Historique des crédits
              {wallet && (
                <Badge variant="secondary" className="text-base">
                  Solde : {wallet.balance} crédits
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ledgerLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : !ledger?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune transaction pour le moment</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Raison</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(entry.created_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{entry.reason.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center gap-1 text-sm font-medium ${entry.delta > 0 ? "text-green-500" : "text-destructive"}`}>
                          {entry.delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {entry.delta > 0 ? "+" : ""}{entry.delta}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
