import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Film, Music, Plus, Clock, CheckCircle, AlertCircle, Loader2, Tv, Clapperboard, Search, ChevronLeft, ChevronRight, ArrowUpDown, BarChart3 } from "lucide-react";
import { OnboardingTour } from "@/components/OnboardingTour";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { statusLabels, typeLabels, styleLabels } from "@/lib/labels";

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-destructive" />,
  generating: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  analyzing: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  planning: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  stitching: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  in_production: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
};

const PAGE_SIZE = 12;

export default function Dashboard() {
  const { user } = useAuth();
  usePageTitle("Mes projets");
  const seriesEnabled = useFeatureFlag("series_enabled");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [page, setPage] = useState(0);

  type ProjectWithSeries = Database["public"]["Tables"]["projects"]["Row"] & { _seriesId: string | null };

  const { data: projects, isLoading, isError, refetch } = useQuery<ProjectWithSeries[]>({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const seriesProjects = data?.filter(p => p.type === "series") || [];
      let seriesMap: Record<string, string> = {};
      if (seriesProjects.length > 0) {
        const { data: seriesData } = await supabase
          .from("series")
          .select("id, project_id")
          .in("project_id", seriesProjects.map(p => p.id));
        if (seriesData) {
          seriesData.forEach((s) => { seriesMap[s.project_id] = s.id; });
        }
      }

      return (data || []).map(p => ({
        ...p,
        _seriesId: seriesMap[p.id] || null,
      }));
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!projects) return [];
    let result = projects.filter(p => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !(p.synopsis || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
    // Sort
    if (sortBy === "oldest") result = [...result].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortBy === "name") result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === "status") result = [...result].sort((a, b) => a.status.localeCompare(b.status));
    // "newest" is default from API
    return result;
  }, [projects, search, typeFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(0); };
  const handleType = (v: string) => { setTypeFilter(v); setPage(0); };
  const handleStatus = (v: string) => { setStatusFilter(v); setPage(0); };
  const handleSort = (v: string) => { setSortBy(v); setPage(0); };

  // Stats
  const stats = useMemo(() => {
    if (!projects) return null;
    const completed = projects.filter(p => p.status === "completed").length;
    const inProgress = projects.filter(p => ["analyzing", "planning", "generating", "stitching", "in_production"].includes(p.status)).length;
    return { total: projects.length, completed, inProgress, draft: projects.filter(p => p.status === "draft").length };
  }, [projects]);

  return (
    <div className="min-h-screen bg-background">
      <OnboardingTour />
      <Navbar />
      <main className="container mx-auto px-4 py-10 md:py-14">
        <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Mes projets</h1>
            <p className="text-muted-foreground mt-1 text-sm">Retrouvez et gérez toutes vos créations vidéo</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="hero" size="sm" asChild>
              <Link to="/create" className="gap-2">
                <Plus className="h-4 w-4" /> Nouveau projet
              </Link>
            </Button>
            <Button variant="glass" size="sm" asChild>
              <Link to="/create/clip" className="gap-2">
                <Music className="h-4 w-4" /> Clip rapide
              </Link>
            </Button>
            {seriesEnabled && (
              <Button variant="glass" size="sm" asChild>
                <Link to="/create/series" className="gap-2">
                  <Tv className="h-4 w-4" /> Nouvelle série
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card className="border-border/50 bg-card/40">
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total projets</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/40">
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Terminés</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/40">
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-bold text-primary">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/40">
              <CardContent className="py-3 px-4 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{stats.draft}</p>
                <p className="text-xs text-muted-foreground">Brouillons</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search & Filters */}
        {projects && projects.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher un projet…"
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={handleType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="film">Film</SelectItem>
                <SelectItem value="music_video">Clip Musical</SelectItem>
                <SelectItem value="series">Série</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="failed">Échoué</SelectItem>
                <SelectItem value="generating">En cours</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={handleSort}>
              <SelectTrigger className="w-[150px]">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Trier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Plus récent</SelectItem>
                <SelectItem value="oldest">Plus ancien</SelectItem>
                <SelectItem value="name">Nom A-Z</SelectItem>
                <SelectItem value="status">Statut</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <Card className="border-destructive/50 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertCircle className="h-12 w-12 text-destructive/60" />
              <h3 className="text-lg font-medium">Impossible de charger vos projets</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Une erreur est survenue lors du chargement. Vérifiez votre connexion et réessayez.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <Loader2 className="h-4 w-4" /> Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : !projects?.length ? (
          <Card className="border-dashed border-border/50 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-20 md:py-24">
              <Film className="h-16 w-16 text-muted-foreground/50 mb-5" />
              <h3 className="text-lg font-medium mb-2">Aucun projet pour le moment</h3>
              <p className="text-muted-foreground mb-8 text-center max-w-md text-sm">
                Créez votre première vidéo propulsée par l'IA
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="text-center">
                  <Button variant="hero" asChild>
                    <Link to="/create/clip"><Music className="h-4 w-4 mr-2" /> Créer un clip</Link>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">À partir de votre musique</p>
                </div>
                <div className="text-center">
                  <Button variant="glass" asChild>
                    <Link to="/create/film"><Film className="h-4 w-4 mr-2" /> Créer un film</Link>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">À partir d'un scénario</p>
                </div>
                {seriesEnabled && (
                  <div className="text-center">
                    <Button variant="glass" asChild>
                      <Link to="/create/series"><Tv className="h-4 w-4 mr-2" /> Créer une série</Link>
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">Multi-épisodes</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-border/50 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Search className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">Aucun projet trouvé</p>
              <p className="text-xs text-muted-foreground">Essayez de modifier vos filtres</p>
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}>
                Réinitialiser les filtres
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paginated.map((project) => {
                const linkTo = project.type === "series" && project._seriesId
                  ? `/series/${project._seriesId}`
                  : `/project/${project.id}`;
                return (
                <Card key={project.id} className="border-border/50 bg-card/60 hover:bg-card/80 transition-all h-full">
                  <Link to={linkTo}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {project.type === "series" ? <Tv className="h-3 w-3 mr-1" /> : project.type === "clip" ? <Music className="h-3 w-3 mr-1" /> : <Film className="h-3 w-3 mr-1" />}
                          {typeLabels[project.type] || project.type}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {statusIcons[project.status] || <Clock className="h-4 w-4" />}
                          {statusLabels[project.status] || project.status}
                        </div>
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors mt-2">
                        {project.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{styleLabels[project.style_preset || ""] || project.style_preset || "Pas de style"}</span>
                        <span>{project.duration_sec ? `${Math.round(project.duration_sec / 60)} min` : "—"}</span>
                      </div>
                    </CardContent>
                  </Link>
                  <div className="px-6 pb-4 pt-0">
                    <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
                      <Link to={`/project/${project.id}/studio`}>
                        <Clapperboard className="h-3.5 w-3.5" /> Ouvrir le Studio
                      </Link>
                    </Button>
                  </div>
                </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}