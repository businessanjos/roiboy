import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { OmieIntegrationTab } from "@/components/integrations/OmieIntegrationTab";
import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Activity,
} from "lucide-react";

interface SyncStats {
  isConnected: boolean;
  isEnabled: boolean;
  lastInbound?: string | null;
  lastOutbound?: string | null;
  totalLogs: number;
  successLogs: number;
  errorLogs: number;
}

export default function FinancialOmieIntegrationPage() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [stats, setStats] = useState<SyncStats>({
    isConnected: false,
    isEnabled: false,
    totalLogs: 0,
    successLogs: 0,
    errorLogs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);

  const loadStats = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    const accountId = currentUser.account_id;

    const [{ data: settings }, { data: logs, count }] = await Promise.all([
      supabase
        .from("omie_settings")
        .select("app_key, app_secret, is_enabled")
        .eq("account_id", accountId)
        .maybeSingle(),
      supabase
        .from("omie_integration_logs")
        .select("action, status, created_at", { count: "exact" })
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const inbound = (logs || []).find((l) => l.action?.includes("sync") || l.action?.includes("import"));
    const outbound = (logs || []).find((l) => l.action?.includes("create_os") || l.action?.includes("export"));
    const success = (logs || []).filter((l) => l.status === "success").length;
    const error = (logs || []).filter((l) => l.status === "error").length;

    setStats({
      isConnected: !!(settings?.app_key && settings?.app_secret),
      isEnabled: !!settings?.is_enabled,
      lastInbound: inbound?.created_at || null,
      lastOutbound: outbound?.created_at || null,
      totalLogs: count || 0,
      successLogs: success,
      errorLogs: error,
    });
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, [currentUser?.account_id]);

  const handlePullFromOmie = async () => {
    if (!currentUser?.account_id) return;
    setPulling(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-omie", {
        body: {
          account_id: currentUser.account_id,
          sync_all: true,
          enrich_data: true,
          use_cpf_cnpj: true,
        },
      });
      if (error) throw error;
      toast({
        title: "Importação concluída",
        description: `${data?.synced || 0} sincronizados · ${data?.enriched || 0} enriquecidos · ${data?.errors || 0} erros · ${data?.not_found || 0} não encontrados`,
      });
      await loadStats();
    } catch (err: any) {
      toast({
        title: "Erro ao importar do Omie",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setPulling(false);
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "Nunca";
    return new Date(iso).toLocaleString("pt-BR");
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
            Integração Omie ↔ ROY
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conexão bidirecional. Importe contas a receber, clientes e enriquecimento de dados do Omie. Envie automaticamente vendas Ganhas como Ordens de Serviço.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Status Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusBlock
              label="Conexão"
              value={
                stats.isConnected ? (
                  <Badge variant="default" className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" /> Não configurado
                  </Badge>
                )
              }
            />
            <StatusBlock
              label="Automação ROY → Omie"
              value={
                stats.isEnabled ? (
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/20">Ativa</Badge>
                ) : (
                  <Badge variant="outline">Pausada</Badge>
                )
              }
            />
            <StatusBlock
              label="Eventos registrados"
              value={
                <span className="text-lg font-semibold">
                  {stats.totalLogs}
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    ({stats.successLogs} ok · {stats.errorLogs} erro)
                  </span>
                </span>
              }
            />
            <StatusBlock
              label="Último evento"
              value={
                <span className="text-sm">
                  {fmtDate(stats.lastInbound || stats.lastOutbound)}
                </span>
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Bidirectional Sync Cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Omie → ROY */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
              Omie → ROY (importar)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Busca todos os clientes da conta no Omie por CPF/CNPJ, telefone ou nome e atualiza:
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Dados cadastrais (endereço, e-mails, telefones)</li>
              <li>Contas a receber em aberto e atrasadas</li>
              <li>Próxima data de vencimento e status de pagamento</li>
            </ul>
            <div className="text-xs text-muted-foreground">
              Última importação: <span className="font-medium">{fmtDate(stats.lastInbound)}</span>
            </div>
            <Button
              onClick={handlePullFromOmie}
              disabled={pulling || !stats.isConnected}
              className="w-full"
            >
              {pulling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sincronizar todos os clientes agora
            </Button>
            {!stats.isConnected && (
              <p className="text-xs text-destructive">Configure as credenciais Omie abaixo antes de importar.</p>
            )}
          </CardContent>
        </Card>

        {/* ROY → Omie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpFromLine className="h-5 w-5 text-primary" />
              ROY → Omie (exportar)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Quando a automação está ativa, vendas marcadas como <strong>Ganhas</strong> geram automaticamente:
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Cliente cadastrado/atualizado no Omie (por CPF/CNPJ)</li>
              <li>Ordem de Serviço com valor, descrição e categoria padrão</li>
              <li>Lançamento financeiro vinculado à conta corrente configurada</li>
            </ul>
            <div className="text-xs text-muted-foreground">
              Último envio: <span className="font-medium">{fmtDate(stats.lastOutbound)}</span>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 flex items-start gap-2">
              <Activity className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                Para ativar/desativar a exportação automática, use o switch <strong>Ativar Automação</strong> no painel de configuração abaixo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Configuration */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Configuração & mapeamento</h2>
        <OmieIntegrationTab />
      </div>
    </div>
  );
}

function StatusBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div>{value}</div>
    </div>
  );
}
