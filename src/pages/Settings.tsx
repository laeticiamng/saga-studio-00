import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, ArrowUp, ArrowDown, Webhook, Plus, Trash2, Eye, EyeOff, Copy, KeyRound, CreditCard, Camera, BarChart3, Film, CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useNavigate } from "react-router-dom";

function UsageStats({ userId }: { userId: string | undefined }) {
  const { data: stats } = useQuery({
    queryKey: ["usage-stats", userId],
    queryFn: async () => {
      const [projectsRes, rendersRes, creditsRes] = await Promise.all([
        supabase.from("projects").select("id, status, type", { count: "exact", head: false }),
        supabase.from("renders").select("id, status", { count: "exact", head: false }),
        supabase.from("credit_ledger").select("delta").lt("delta", 0),
      ]);
      const projects = projectsRes.data || [];
      const renders = rendersRes.data || [];
      const totalSpent = (creditsRes.data || []).reduce((s, e) => s + Math.abs(e.delta), 0);
      return {
        totalProjects: projects.length,
        completedProjects: projects.filter(p => p.status === "completed").length,
        totalRenders: renders.filter(r => r.status === "completed").length,
        creditsSpent: totalSpent,
      };
    },
    enabled: !!userId,
  });

  if (!stats) return null;

  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" /> Statistiques d'utilisation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-secondary/30">
            <Film className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{stats.totalProjects}</p>
            <p className="text-xs text-muted-foreground">Projets créés</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/30">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{stats.completedProjects}</p>
            <p className="text-xs text-muted-foreground">Terminés</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/30">
            <Film className="h-5 w-5 mx-auto mb-1 text-accent" />
            <p className="text-2xl font-bold">{stats.totalRenders}</p>
            <p className="text-xs text-muted-foreground">Rendus export</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/30">
            <CreditCard className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{stats.creditsSpent}</p>
            <p className="text-xs text-muted-foreground">Crédits utilisés</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  usePageTitle("Paramètres");
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);
  const [deletingWebhook, setDeletingWebhook] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountEmail, setDeleteAccountEmail] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name || "");
          setAvatarUrl(data.avatar_url || null);
        }
      });
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

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("face-references").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("face-references").getPublicUrl(path);
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      setAvatarUrl(publicUrl);
      toast({ title: "Avatar mis à jour" });
    } catch (err: unknown) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Upload échoué", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setLoading(false);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else toast({ title: "Enregistré", description: "Profil mis à jour." });
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 6 caractères.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mot de passe modifié", description: "Votre nouveau mot de passe est actif." });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleAddWebhook = async () => {
    if (!user || !newWebhookUrl.trim()) return;
    try { new URL(newWebhookUrl); } catch {
      toast({ title: "URL invalide", description: "Entrez une URL valide (https://...)", variant: "destructive" });
      return;
    }
    if (!newWebhookUrl.startsWith("https://") && !newWebhookUrl.startsWith("http://localhost")) {
      toast({ title: "HTTPS requis", description: "L'URL du webhook doit utiliser HTTPS pour la sécurité.", variant: "destructive" });
      return;
    }
    setAddingWebhook(true);
    const { error } = await supabase.from("webhook_endpoints").insert({ user_id: user.id, url: newWebhookUrl.trim() });
    setAddingWebhook(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setNewWebhookUrl("");
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast({ title: "Webhook ajouté" });
    }
  };

  const handleToggleWebhook = async (id: string, currentActive: boolean) => {
    await supabase.from("webhook_endpoints").update({ active: !currentActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["webhooks"] });
  };

  const handleDeleteWebhook = async () => {
    if (!webhookToDelete) return;
    setDeletingWebhook(true);
    await supabase.from("webhook_endpoints").delete().eq("id", webhookToDelete);
    queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    toast({ title: "Supprimé" });
    setDeletingWebhook(false);
    setWebhookToDelete(null);
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
    toast({ title: "Copié", description: "Secret copié dans le presse-papier." });
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteAccountEmail !== user.email) {
      toast({ title: "Erreur", description: "L'email ne correspond pas.", variant: "destructive" });
      return;
    }
    setDeletingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await supabase.auth.signOut();
      navigate("/");
      toast({ title: "Compte supprimé", description: "Votre compte et toutes vos données ont été définitivement supprimés." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inattendue";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeletingAccount(false);
      setDeleteAccountOpen(false);
      setDeleteAccountEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-10 md:py-14 space-y-6">
        <Breadcrumbs items={[{ label: "Paramètres" }]} />
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground mt-1 text-sm">Gérez votre profil, mot de passe et préférences</p>
        </div>

        {/* Profile */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader><CardTitle className="text-lg">Profil</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-lg">{displayName?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
                </label>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{displayName || "Utilisateur"}</p>
                <p className="text-xs">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label>Nom d'affichage</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <Button variant="hero" size="sm" onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enregistrer
            </Button>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-primary" /> Changer le mot de passe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Confirmer le mot de passe</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {newPassword && newPassword.length < 6 && (
              <p className="text-xs text-destructive">Minimum 6 caractères</p>
            )}
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
            )}
            <Button variant="hero" size="sm" onClick={handleChangePassword} disabled={changingPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}>
              {changingPassword && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Modifier le mot de passe
            </Button>
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card className="border-border/50 bg-card/60">
          <details>
            <summary className="cursor-pointer px-6 py-4 flex items-center gap-2 font-semibold text-foreground text-sm">
              <Webhook className="h-4 w-4 text-primary" /> Notifications webhook
              <span className="text-xs font-normal text-muted-foreground ml-2">(avancé)</span>
            </summary>
            <CardContent className="pt-0 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Recevez un appel HTTP quand un rendu vidéo est terminé. Utile pour intégrer Saga Studio à votre propre application.
              </p>
              <div className="flex gap-2">
                <Input value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://votre-service.com/webhook" className="flex-1" />
                <Button variant="hero" size="sm" onClick={handleAddWebhook} disabled={addingWebhook || !newWebhookUrl.trim()}>
                  {addingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              {webhooksLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : !webhooks?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun webhook configuré</p>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((wh) => (
                    <div key={wh.id} className="rounded-lg border border-border/50 bg-secondary/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant={wh.active ? "default" : "secondary"} className="shrink-0 text-xs">
                            {wh.active ? "Actif" : "Inactif"}
                          </Badge>
                          <span className="text-sm truncate">{wh.url}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch checked={wh.active} onCheckedChange={() => handleToggleWebhook(wh.id, wh.active)} />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setWebhookToDelete(wh.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Secret :</span>
                        <code className="bg-background/50 px-1.5 py-0.5 rounded font-mono text-xs">
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

        {/* Usage Stats */}
        <UsageStats userId={user?.id} />

        
        {/* Credit history */}
        <Card className="border-border/50 bg-card/60">
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-lg">
              Historique des crédits
              <div className="flex items-center gap-2">
                {wallet && (
                  <Badge variant="secondary" className="text-sm font-medium w-fit">
                    Solde : {wallet.balance} crédits
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={() => navigate("/pricing")} className="gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Acheter des crédits
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ledgerLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : !ledger?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune transaction pour le moment</p>
            ) : (
              <div className="table-responsive">
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
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Zone de danger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              La suppression de votre compte est irréversible. Tous vos projets, vidéos, crédits et données personnelles seront définitivement supprimés.
            </p>
            <Button variant="destructive" onClick={() => setDeleteAccountOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Supprimer mon compte
            </Button>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={!!webhookToDelete}
          onOpenChange={(open) => { if (!open) setWebhookToDelete(null); }}
          title="Supprimer ce webhook ?"
          description="Cette action est irréversible. Le webhook ne recevra plus de notifications."
          confirmLabel="Supprimer"
          onConfirm={handleDeleteWebhook}
          isPending={deletingWebhook}
        />

        {/* Delete Account Dialog */}
        <ConfirmDialog
          open={deleteAccountOpen}
          onOpenChange={(open) => { if (!open) { setDeleteAccountOpen(false); setDeleteAccountEmail(""); } }}
          title="Supprimer définitivement votre compte ?"
          description={
            <div className="space-y-3">
              <p>Cette action est <strong>irréversible</strong>. Toutes vos données seront supprimées : projets, vidéos, crédits, profil.</p>
              <p className="text-sm">Pour confirmer, saisissez votre adresse email :</p>
              <Input
                value={deleteAccountEmail}
                onChange={(e) => setDeleteAccountEmail(e.target.value)}
                placeholder={user?.email || "votre@email.com"}
                className="mt-1"
              />
            </div>
          }
          confirmLabel={deletingAccount ? "Suppression…" : "Supprimer définitivement"}
          onConfirm={handleDeleteAccount}
          isPending={deletingAccount || deleteAccountEmail !== (user?.email || "")}
        />
      </main>
      <Footer />
    </div>
  );
}
