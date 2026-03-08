import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, ArrowUp, ArrowDown, Webhook, Plus, Trash2, Eye, EyeOff, Copy, KeyRound } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  usePageTitle("Paramètres");
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  // Webhook state
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

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

  const { data: webhooks, isLoading: webhooksLoading } = useQuery({
    queryKey: ["webhooks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
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

  const handleAddWebhook = async () => {
    if (!user || !newWebhookUrl.trim()) return;
    try {
      new URL(newWebhookUrl); // validate URL
    } catch {
      toast({ title: "URL invalide", description: "Entrez une URL valide (https://...)", variant: "destructive" });
      return;
    }
    setAddingWebhook(true);
    const { error } = await supabase.from("webhook_endpoints").insert({
      user_id: user.id,
      url: newWebhookUrl.trim(),
    });
    setAddingWebhook(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setNewWebhookUrl("");
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast({ title: "Webhook ajouté", description: "Vous recevrez des notifications quand un rendu sera terminé." });
    }
  };

  const handleToggleWebhook = async (id: string, currentActive: boolean) => {
    await supabase.from("webhook_endpoints").update({ active: !currentActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["webhooks"] });
  };

  const handleDeleteWebhook = async (id: string) => {
    await supabase.from("webhook_endpoints").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    toast({ title: "Supprimé" });
  };

  const toggleSecret = (id: string) => {
    setRevealedSecrets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({ title: "Copié", description: "Secret copié dans le presse-papier" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Paramètres</h1>

        {/* Profile */}
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

        {/* Webhooks — Advanced, collapsible */}
        <Card className="border-border/50 bg-card/60 mb-6">
          <details>
            <summary className="cursor-pointer px-6 py-4 flex items-center gap-2 font-semibold text-foreground">
              <Webhook className="h-5 w-5 text-primary" /> Notifications webhook
              <span className="text-xs font-normal text-muted-foreground ml-2">(avancé)</span>
            </summary>
            <CardContent className="pt-0 space-y-4">
              <p className="text-sm text-muted-foreground">
                Recevez automatiquement un appel HTTP sur votre serveur quand un rendu vidéo est terminé. Utile si vous intégrez CineClip à votre propre application ou workflow.
              </p>
            {/* Add new webhook */}
            <div className="flex gap-2">
              <Input
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://votre-service.com/webhook"
                className="flex-1"
              />
              <Button variant="hero" size="sm" onClick={handleAddWebhook} disabled={addingWebhook || !newWebhookUrl.trim()}>
                {addingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {/* List */}
            {webhooksLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : !webhooks?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun webhook configuré</p>
            ) : (
              <div className="space-y-3">
                {webhooks.map((wh: any) => (
                  <div key={wh.id} className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant={wh.active ? "default" : "secondary"} className="shrink-0">
                          {wh.active ? "Actif" : "Inactif"}
                        </Badge>
                        <span className="text-sm truncate">{wh.url}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch checked={wh.active} onCheckedChange={() => handleToggleWebhook(wh.id, wh.active)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteWebhook(wh.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Secret :</span>
                      <code className="bg-background/50 px-1.5 py-0.5 rounded font-mono">
                        {revealedSecrets.has(wh.id) ? wh.secret : "••••••••••••••••"}
                      </code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSecret(wh.id)}>
                        {revealedSecrets.has(wh.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copySecret(wh.secret)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
          </details>
        </Card>

        {/* Credit history */}
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
      <Footer />
    </div>
  );
}
