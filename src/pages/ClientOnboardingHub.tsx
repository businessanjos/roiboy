import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { OnboardingOrchestrated } from "@/components/client/OnboardingOrchestrated";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Rocket, Search, Sparkles, Users, AlertCircle, RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { usePendingOnboardingCount } from "@/hooks/usePendingOnboardingCount";
import { StageChecklistEditor } from "@/components/client/StageChecklistEditor";

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  emails?: any;
  company_name?: string;
  avatar_url?: string;
  stage_id?: string | null;
  status: string;
  client_products?: Array<{ product_id: string; products?: { id: string; name: string } }>;
}

interface ClientStage {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

export default function ClientOnboardingHub() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const [clients, setClients] = useState<Client[]>([]);
  const [stages, setStages] = useState<ClientStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const { newCount, inProgressCount } = usePendingOnboardingCount();

  const fetchStages = async () => {
    if (!accountId) return;
    const { data, error } = await supabase
      .from("client_stages")
      .select("id, name, color, display_order")
      .eq("account_id", accountId)
      .order("display_order");
    if (!error) setStages(data || []);
  };

  const fetchClients = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      // Get stages first to know the onboarding range
      const { data: stagesData } = await supabase
        .from("client_stages")
        .select("id, display_order")
        .eq("account_id", accountId);

      const ONBOARDING_DONE_ORDER = 9;
      const onboardingStageIds = (stagesData ?? [])
        .filter(s => s.display_order < ONBOARDING_DONE_ORDER)
        .map(s => s.id);

      // Janela de 30 dias para clientes sem etapa (evita arrastar legado)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Active clients in onboarding stages OR (sem etapa AND criado nos últimos 30 dias)
      const { data, error } = await supabase
        .from("clients")
        .select(`
          id, full_name, phone_e164, emails, company_name, avatar_url, stage_id, status,
          client_products(product_id, products(id, name))
        `)
        .eq("account_id", accountId)
        .eq("status", "active")
        .or(`and(stage_id.is.null,created_at.gte.${thirtyDaysAgo}),stage_id.in.(${onboardingStageIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setClients((data as any[]) || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar clientes em onboarding");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountId) {
      fetchStages();
      fetchClients();
    }
  }, [accountId]);

  const handleStageChange = async (clientId: string, stageId: string | null) => {
    const { error } = await supabase
      .from("clients")
      .update({ stage_id: stageId })
      .eq("id", clientId);
    if (error) {
      toast.error("Erro ao mover cliente");
      throw error;
    }
    setClients(prev => prev.map(c => (c.id === clientId ? { ...c, stage_id: stageId } : c)));
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.phone_e164?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  if (loading && clients.length === 0) return <LoadingScreen />;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Onboarding de Clientes</h1>
            <p className="text-sm text-muted-foreground">
              Jornada completa após o ganho da venda — do "Boas-Vindas" ao Plano de Ação.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchStages(); fetchClients(); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" /> Configurar Etapas
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className={newCount > 0 ? "border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/10" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`rounded-lg p-2 ${newCount > 0 ? "bg-amber-200/60 dark:bg-amber-900/30" : "bg-muted"}`}>
              <Sparkles className={`h-5 w-5 ${newCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`} />
            </div>
            <div>
              <div className="text-2xl font-bold">{newCount}</div>
              <div className="text-xs text-muted-foreground">Aguardando início</div>
            </div>
            {newCount > 0 && (
              <Badge variant="outline" className="ml-auto border-amber-400 text-amber-700 dark:text-amber-300">
                Novo!
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-950/30 p-2">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{inProgressCount}</div>
              <div className="text-xs text-muted-foreground">Em andamento</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/30 p-2">
              <AlertCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stages.length}</div>
              <div className="text-xs text-muted-foreground">Etapas configuradas</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Banner para novos */}
      {newCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">
              {newCount === 1
                ? "1 cliente acabou de chegar e está aguardando o início do onboarding."
                : `${newCount} clientes acabaram de chegar e estão aguardando o início do onboarding.`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Comece pela etapa "Boas-Vindas — Consultor se apresenta" para ativar a jornada.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente, empresa ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Orquestrador (jornada completa) */}
      {accountId && (
        <OnboardingOrchestrated
          clients={filtered}
          stages={stages}
          accountId={accountId}
          onStageChange={handleStageChange}
          onRefreshStages={fetchStages}
        />
      )}

      <StageChecklistEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        stages={stages}
        accountId={accountId || ""}
        onRefresh={fetchStages}
      />
    </div>
  );
}
