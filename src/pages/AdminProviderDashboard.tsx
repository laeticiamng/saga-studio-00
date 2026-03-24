import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProviders } from "@/hooks/useProviders";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Loader2, Server, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

const statusIcons: Record<string, React.ReactNode> = {
  ok: <CheckCircle className="h-4 w-4 text-green-500" />,
  missing_key: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  unknown: <HelpCircle className="h-4 w-4 text-muted-foreground" />,
};

export default function AdminProviderDashboard() {
  const { data: providers, isLoading } = useProviders();
  usePageTitle("Fournisseurs");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-4xl py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Server className="h-6 w-6" />
          Fournisseurs de génération
        </h1>

        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        ) : (
          <div className="space-y-3">
            {providers?.map((provider) => (
              <Card key={provider.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcons[provider.health_status || "unknown"]}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{provider.display_name}</h3>
                        <Badge variant="outline">{provider.provider_type}</Badge>
                      </div>
                      {provider.health_checked_at && (
                        <p className="text-xs text-muted-foreground">
                          Vérifié: {new Date(provider.health_checked_at).toLocaleString("fr-FR")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={provider.is_enabled ? "default" : "secondary"}>
                    {provider.is_enabled ? "Activé" : "Désactivé"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
