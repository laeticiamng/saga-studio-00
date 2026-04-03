import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalNotifications } from "@/components/GlobalNotifications";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import CookieBanner from "@/components/CookieBanner";
import { NetworkStatus } from "@/components/NetworkStatus";
import { Loader2 } from "lucide-react";

// Eager: landing page (critical path)
import Index from "./pages/Index";

// Lazy: everything else
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CreateClip = lazy(() => import("./pages/CreateClip"));
const CreateFilm = lazy(() => import("./pages/CreateFilm"));
const CreateMusicVideo = lazy(() => import("./pages/CreateMusicVideo"));
const ProjectView = lazy(() => import("./pages/ProjectView"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Settings = lazy(() => import("./pages/Settings"));
const ShareView = lazy(() => import("./pages/ShareView"));
const Admin = lazy(() => import("./pages/Admin"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Legal = lazy(() => import("./pages/Legal"));
const About = lazy(() => import("./pages/About"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Series Studio pages
const CreateSeries = lazy(() => import("./pages/CreateSeries"));
const SeriesView = lazy(() => import("./pages/SeriesView"));
const SeasonView = lazy(() => import("./pages/SeasonView"));
const EpisodeView = lazy(() => import("./pages/EpisodeView"));
const BibleManager = lazy(() => import("./pages/BibleManager"));
const CharacterGallery = lazy(() => import("./pages/CharacterGallery"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const AdminAgentManager = lazy(() => import("./pages/AdminAgentManager"));
const AdminProviderDashboard = lazy(() => import("./pages/AdminProviderDashboard"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));

// Autopilot & Workflow pages
const AutopilotDashboard = lazy(() => import("./pages/AutopilotDashboard"));
const ApprovalInbox = lazy(() => import("./pages/ApprovalInbox"));
const ContinuityCenter = lazy(() => import("./pages/ContinuityCenter"));
const DeliveryCenter = lazy(() => import("./pages/DeliveryCenter"));
const DocumentsCenter = lazy(() => import("./pages/DocumentsCenter"));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <NetworkStatus />
            <GlobalNotifications />
            <CookieBanner />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/create/clip" element={<ProtectedRoute><CreateClip /></ProtectedRoute>} />
                <Route path="/create/film" element={<ProtectedRoute><CreateFilm /></ProtectedRoute>} />
                <Route path="/create/music-video" element={<ProtectedRoute><CreateMusicVideo /></ProtectedRoute>} />
                <Route path="/project/:id" element={<ProtectedRoute><ProjectView /></ProtectedRoute>} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/share/:id" element={<ShareView />} />
                <Route path="/create/series" element={<ProtectedRoute><CreateSeries /></ProtectedRoute>} />
                <Route path="/series/:id" element={<ProtectedRoute><SeriesView /></ProtectedRoute>} />
                <Route path="/series/:id/season/:seasonId" element={<ProtectedRoute><SeasonView /></ProtectedRoute>} />
                <Route path="/series/:id/episode/:episodeId" element={<ProtectedRoute><EpisodeView /></ProtectedRoute>} />
                <Route path="/series/:id/bibles" element={<ProtectedRoute><BibleManager /></ProtectedRoute>} />
                <Route path="/series/:id/characters" element={<ProtectedRoute><CharacterGallery /></ProtectedRoute>} />
                <Route path="/series/:id/agents" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
                <Route path="/series/:id/autopilot" element={<ProtectedRoute><AutopilotDashboard /></ProtectedRoute>} />
                <Route path="/series/:id/approvals" element={<ProtectedRoute><ApprovalInbox /></ProtectedRoute>} />
                <Route path="/series/:id/continuity" element={<ProtectedRoute><ContinuityCenter /></ProtectedRoute>} />
                <Route path="/series/:id/delivery" element={<ProtectedRoute><DeliveryCenter /></ProtectedRoute>} />
                <Route path="/series/:id/documents" element={<ProtectedRoute><DocumentsCenter /></ProtectedRoute>} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                <Route path="/admin/agents" element={<AdminRoute><AdminAgentManager /></AdminRoute>} />
                <Route path="/admin/providers" element={<AdminRoute><AdminProviderDashboard /></AdminRoute>} />
                <Route path="/admin/audit" element={<AdminRoute><AdminAuditLog /></AdminRoute>} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

