import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Send,
  RefreshCw,
  Download,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useContractCatalogRows } from "@/hooks/useContractCatalog";
import { CATALOG_COLOR_CLASSES, mergeCatalog, type CatalogRow } from "@/lib/contracts/contractCatalog";
import {
  CONTRACT_FILTER_LABEL, brDate, contractGroup, matchesContractFilter, pickClientContract,
  type ClientContractLite, type ContractBucket, type ContractFilter,
} from "@/lib/ryka/contractStatus";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { ptBR } from "date-fns/locale";
import { RykaUsageDashboard } from "@/components/ryka/RykaUsageDashboard";

const RYKA_ELIGIBLE_KEYWORDS = ["rykas mentoring", "eternum club"];
const NO_CATALOG_ROWS: CatalogRow[] = [];
const CONTRACT_FILTERS: ContractFilter[] = ["active", "hold", "ended", "none", "all"];
const ACCESS_LABEL = { provisioned: "Com acesso", pending: "Falta liberar", failed: "Falhou" } as const;

type Filter = "all" | "provisioned" | "pending" | "failed" | "ryka_active" | "ryka_inactive";

interface ClientRow {
  id: string;
  full_name: string;
  company_name: string | null;
  phone_e164: string | null;
  emails: any[] | null;
  logo_url: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
  responsible_user_id: string | null;
  client_products: Array<{
    products: { id: string; name: string; color: string | null } | null;
  }>;
}

interface Provision {
  client_id: string;
  email: string | null;
  status: string;
  whatsapp_status: string | null;
  created_at: string;
  ryka_response: any | null;
}

export default function ClinicaRyka() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"painel" | "clientes">("painel");
  const [search, setSearch] = useState("");
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [contractFilter, setContractFilter] = useState<ContractFilter>("active");
  const { data: catalogRows } = useContractCatalogRows();
  const statusMeta = useMemo(
    () => new Map(mergeCatalog("contract_status", catalogRows ?? NO_CATALOG_ROWS).map((i) => [i.value, i])),
    [catalogRows],
  );

  const clientsQuery = useQuery({
    queryKey: ["ryka-eligible-clients", accountId],
    enabled: !!accountId,
    staleTime: 30_000,
    queryFn: async () => {
      // Carrega em lotes (sem .limit) para não truncar silenciosamente os clientes elegíveis.
      const { data, error } = await fetchAllRows<ClientRow>((from, to) =>
        supabase
          .from("clients")
          .select(
            `id, full_name, company_name, phone_e164, emails, logo_url, avatar_url, status, created_at, responsible_user_id,
             client_products(products(id, name, color))`,
          )
          .eq("account_id", accountId!)
          .in("status", ["active", "churn_risk", "paused"])
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to) as any,
      );
      if (error) throw error;
      const rows = data;
      return rows.filter((c) =>
        (c.client_products || []).some((cp) => {
          const name = (cp.products?.name || "").toLowerCase();
          return RYKA_ELIGIBLE_KEYWORDS.some((k) => name.includes(k));
        }),
      );
    },
  });

  const provisionsQuery = useQuery({
    queryKey: ["ryka-provisions", accountId],
    enabled: !!accountId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await fetchAllRows<Provision>((from, to) =>
        supabase
          .from("client_ryka_provisions")
          .select("id, client_id, email, status, whatsapp_status, created_at, ryka_response")
          .eq("account_id", accountId!)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to) as any,
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const contractsQuery = useQuery({
    queryKey: ["ryka-client-contracts", accountId],
    enabled: !!accountId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await fetchAllRows<ClientContractLite>((from, to) =>
        supabase
          .from("client_contracts")
          .select("id, client_id, status, start_date, end_date, created_at, product_id")
          .eq("account_id", accountId!)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to) as any,
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const productsQuery = useQuery({
    queryKey: ["ryka-contract-products", accountId],
    enabled: !!accountId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, color").eq("account_id", accountId!);
      if (error) throw error;
      return data ?? [];
    },
  });
  const productById = useMemo(
    () => new Map((productsQuery.data ?? []).map((p: any) => [p.id as string, p as { id: string; name: string; color: string | null }])),
    [productsQuery.data],
  );

  // Contrato que representa cada cliente (o em vigor vence; senão o mais recente)
  const contractByClient = useMemo(() => {
    const bucketOf = (status: string | null) => (statusMeta.get(status || "")?.metric_bucket ?? "neutral") as ContractBucket;
    const grouped = new Map<string, ClientContractLite[]>();
    for (const c of contractsQuery.data ?? []) grouped.set(c.client_id, [...(grouped.get(c.client_id) ?? []), c]);
    const map = new Map<string, { contract: ClientContractLite; bucket: ContractBucket }>();
    for (const [clientId, list] of grouped) {
      const contract = pickClientContract(list, bucketOf);
      if (contract) map.set(clientId, { contract, bucket: bucketOf(contract.status) });
    }
    return map;
  }, [contractsQuery.data, statusMeta]);

  // Latest provision per client
  const provisionByClient = useMemo(() => {
    const map = new Map<string, Provision>();
    for (const p of provisionsQuery.data ?? []) {
      if (!map.has(p.client_id)) map.set(p.client_id, p);
    }
    return map;
  }, [provisionsQuery.data]);

  const enrichedAll = useMemo(() => {
    return (clientsQuery.data ?? []).map((client) => {
      const prov = provisionByClient.get(client.id) ?? null;
      const state: "provisioned" | "pending" | "failed" =
        prov?.status === "success"
          ? "provisioned"
          : prov?.status === "error" || prov?.status === "failed"
            ? "failed"
            : "pending";
      const rykaStatus: "active" | "inactive" | null =
        prov?.ryka_response?.ryka_status === "active"
          ? "active"
          : prov?.ryka_response?.ryka_status === "inactive"
            ? "inactive"
            : null;
      const picked = contractByClient.get(client.id) ?? null;
      return { client, prov, state, rykaStatus, contract: picked?.contract ?? null, contractBucket: picked?.bucket ?? null };
    });
  }, [clientsQuery.data, provisionByClient, contractByClient]);

  const contractCounts = useMemo(() => {
    const n: Record<ContractFilter, number> = { active: 0, hold: 0, ended: 0, none: 0, all: enrichedAll.length };
    for (const e of enrichedAll) n[contractGroup(e.contractBucket)] += 1;
    return n;
  }, [enrichedAll]);

  // A aba inteira (painel e lista) segue a situação do contrato escolhida.
  const enriched = useMemo(
    () => enrichedAll.filter((e) => matchesContractFilter(e.contractBucket, contractFilter)),
    [enrichedAll, contractFilter],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ client, state, rykaStatus }) => {
      if (filter === "ryka_active" && rykaStatus !== "active") return false;
      if (filter === "ryka_inactive" && rykaStatus !== "inactive") return false;
      if (["provisioned", "pending", "failed"].includes(filter) && state !== filter) return false;
      if (!q) return true;
      const haystack = [
        client.full_name,
        client.company_name,
        ...((client.emails ?? []).map((e: any) => (typeof e === "string" ? e : e?.email)).filter(Boolean)),
        client.phone_e164,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [enriched, filter, search]);

  const counts = useMemo(() => {
    const total = enriched.length;
    const provisioned = enriched.filter((e) => e.state === "provisioned").length;
    const pending = enriched.filter((e) => e.state === "pending").length;
    const failed = enriched.filter((e) => e.state === "failed").length;
    const rykaActive = enriched.filter((e) => e.rykaStatus === "active").length;
    const rykaInactive = enriched.filter((e) => e.rykaStatus === "inactive").length;
    return { total, provisioned, pending, failed, rykaActive, rykaInactive };
  }, [enriched]);

  const handleProvision = async (clientId: string) => {
    setProvisioningId(clientId);
    try {
      const { data, error } = await supabase.functions.invoke(
        "provision-ryka-access",
        { body: { client_id: clientId } },
      );
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Falha desconhecida");
      toast.success(
        data.whatsapp_status === "sent"
          ? "Acesso criado e WhatsApp enviado!"
          : "Acesso criado, mas WhatsApp falhou.",
      );
      await queryClient.invalidateQueries({ queryKey: ["ryka-provisions", accountId] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao liberar acesso Ryka");
    } finally {
      setProvisioningId(null);
    }
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ryka-eligible-clients", accountId] });
    queryClient.invalidateQueries({ queryKey: ["ryka-provisions", accountId] });
    queryClient.invalidateQueries({ queryKey: ["ryka-client-contracts", accountId] });
  };

  const handleExport = () => {
    const list = view === "clientes" ? filtered : enriched;
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Cliente", "Empresa", "Produto", "Status do contrato", "Produto do contrato", "Início do contrato", "Fim do contrato", "Acesso no ROY", "Situação na Ryka", "E-mail de acesso"];
    const lines = list.map(({ client, prov, state, rykaStatus, contract }) => {
      const products = client.client_products.map((cp) => cp.products?.name).filter(Boolean).join(" / ");
      const firstEmail = client.emails?.[0];
      const email = prov?.email || (typeof firstEmail === "string" ? firstEmail : (firstEmail as any)?.email) || "";
      return [
        client.full_name, client.company_name, products,
        contract ? statusMeta.get(contract.status || "")?.label ?? contract.status : "Sem contrato",
        contract?.product_id ? productById.get(contract.product_id)?.name : "",
        contract ? brDate(contract.start_date) : "", contract ? brDate(contract.end_date) : "",
        ACCESS_LABEL[state], rykaStatus === "active" ? "Ativo" : rykaStatus === "inactive" ? "Inativo" : "",
        email,
      ].map(cell).join(";");
    });
    const blob = new Blob(["\ufeff" + [header.map(cell).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinica-ryka-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Relatório gerado com ${list.length} clientes.`);
  };

  const handleSyncFromRyka = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-ryka-clinics", { body: {} });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Falha na sincronização");
      const matched = data.matched_count ?? 0;
      const inserted = data.inserted ?? 0;
      const updated = data.updated ?? 0;
      const unmatched = data.unmatched_count ?? 0;
      toast.success(
        `Sync Ryka: ${matched} clientes com acesso (novos: ${inserted}, atualizados: ${updated}). ${unmatched} elegíveis sem conta no Ryka.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["ryka-provisions", accountId] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar com Ryka");
    } finally {
      setSyncing(false);
    }
  };

  const loading = clientsQuery.isLoading || provisionsQuery.isLoading || contractsQuery.isLoading;
  const pg = usePagedList(filtered, { resetKey: [filter, search, contractFilter], isLoading: loading });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Heart className="h-6 w-6 text-danger" />
            Clínica Ryka
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Clientes com produto Rykas Mentoring ou Eternum Club, pela situação do contrato e do acesso ao sistema Ryka.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncFromRyka} disabled={syncing || loading}>
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Sincronizar com Ryka
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || enriched.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar relatório
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="painel">Painel</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={contractFilter} onValueChange={(v) => setContractFilter(v as ContractFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-[260px]" aria-label="Situação do contrato">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTRACT_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {CONTRACT_FILTER_LABEL[f]} ({contractCounts[f]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "painel" ? <RykaUsageDashboard rows={enriched as any} accountId={accountId} /> : (<>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total elegíveis" value={counts.total} />
        <SummaryCard label="Já com acesso" value={counts.provisioned} accent="text-success" />
        <SummaryCard label="Falta liberar" value={counts.pending} accent="text-warning" />
        <SummaryCard label="Falhas" value={counts.failed} accent="text-danger" />
        <SummaryCard label="Ativos no Ryka" value={counts.rykaActive} accent="text-success" />
        <SummaryCard label="Inativos no Ryka" value={counts.rykaInactive} accent="text-muted-foreground" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3"><CardTitle className="text-base">Clientes <span className="ml-1 text-sm font-normal text-muted-foreground">{filtered.length}</span></CardTitle></div>
            <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative w-full sm:w-auto">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, e-mail, telefone..."
                  className="pl-8 w-full lg:w-[300px]"
                />
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList className="h-auto w-full justify-start overflow-x-auto lg:w-auto [&>button]:whitespace-nowrap">
                  <TabsTrigger value="all">Todos ({counts.total})</TabsTrigger>
                  <TabsTrigger value="provisioned">Com acesso ({counts.provisioned})</TabsTrigger>
                  <TabsTrigger value="pending">Falta liberar ({counts.pending})</TabsTrigger>
                  <TabsTrigger value="failed">Falhas ({counts.failed})</TabsTrigger>
                  <TabsTrigger value="ryka_active">Ativos Ryka ({counts.rykaActive})</TabsTrigger>
                  <TabsTrigger value="ryka_inactive">Inativos Ryka ({counts.rykaInactive})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado para este filtro.
            </div>
          ) : (
            <div className="overflow-x-auto"><Table className="table-fixed min-w-[1240px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="w-[150px]">Produto</TableHead>
                  <TableHead className="w-[170px]">Contrato</TableHead>
                  <TableHead className="w-[120px]">Acesso</TableHead>
                  <TableHead className="w-[100px]">Ryka</TableHead>
                  <TableHead className="w-[220px]">E-mail acesso</TableHead>
                  <TableHead className="w-[130px] whitespace-nowrap">Liberado</TableHead>
                  <TableHead className="w-[150px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.items.map(({ client, prov, state, rykaStatus, contract }) => {
                  const contractMeta = contract ? statusMeta.get(contract.status || "") : null;
                  const initials = client.full_name
                    ?.split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();
                  const photo = client.logo_url || client.avatar_url || undefined;
                  const rykaProduct = client.client_products.find((cp) => {
                    const n = (cp.products?.name || "").toLowerCase();
                    return RYKA_ELIGIBLE_KEYWORDS.some((k) => n.includes(k));
                  })?.products;
                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={photo} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/clients/${client.id}`}
                              className="text-sm font-medium hover:underline truncate block"
                            >
                              {client.full_name}
                            </Link>
                            {client.company_name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {client.company_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rykaProduct && (
                          <Badge
                            variant="outline"
                            className="whitespace-nowrap max-w-full truncate"
                            title={rykaProduct.name.replace(/^[A-Z+ ]{2,8}\s*[lI|]\s+/, "")}
                            style={{
                              backgroundColor: `${rykaProduct.color || "#6b7280"}20`,
                              color: rykaProduct.color || "#6b7280",
                              borderColor: `${rykaProduct.color || "#6b7280"}40`,
                            }}
                          >
                            {rykaProduct.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {contract ? (
                          <div className="min-w-0">
                            <Badge
                              variant="outline"
                              className={cn("whitespace-nowrap max-w-full truncate", CATALOG_COLOR_CLASSES[contractMeta?.color ?? "muted"])}
                              title={contract.product_id ? productById.get(contract.product_id)?.name : undefined}
                            >
                              {contractMeta?.label ?? contract.status ?? "—"}
                            </Badge>
                            <p className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
                              {brDate(contract.start_date)} → {brDate(contract.end_date)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem contrato</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge state={state} whatsapp={prov?.whatsapp_status ?? null} />
                      </TableCell>
                      <TableCell>
                        <RykaStatusBadge status={rykaStatus} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate" title={prov?.email || undefined}>
                        {prov?.email || (typeof client.emails?.[0] === "string" ? client.emails?.[0] : (client.emails?.[0] as any)?.email) || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {prov?.created_at
                          ? formatDistanceToNow(new Date(prov.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            }).replace("cerca de ", "").replace("aproximadamente ", "")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/clients/${client.id}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {state !== "provisioned" && (
                            <Button
                              size="sm"
                              onClick={() => handleProvision(client.id)}
                              disabled={provisioningId === client.id}
                            >
                              {provisioningId === client.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              ) : (
                                <Send className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Liberar
                            </Button>
                          )}
                          {state === "provisioned" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProvision(client.id)}
                              disabled={provisioningId === client.id}
                            >
                              {provisioningId === client.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Reenviar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></div>
          )}
          {!loading && filtered.length > 0 && <PagerFor state={pg} itemLabel="clientes" />}
        </CardContent>
      </Card>
      </>)}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  state,
  whatsapp,
}: {
  state: "provisioned" | "pending" | "failed";
  whatsapp: string | null;
}) {
  if (state === "provisioned") {
    return (
      <div className="flex items-center gap-1.5">
        <Badge className="whitespace-nowrap bg-success/15 text-success-strong border-success/30 hover:bg-success/15">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Com acesso
        </Badge>
        {whatsapp && whatsapp !== "sent" && (
          <Badge variant="outline" className="whitespace-nowrap text-warning-strong border-warning/40">
            WhatsApp: {whatsapp}
          </Badge>
        )}
      </div>
    );
  }
  if (state === "failed") {
    return (
      <Badge className="whitespace-nowrap bg-danger/15 text-danger-strong border-danger/30 hover:bg-danger/15">
        <AlertCircle className="h-3 w-3 mr-1" /> Falhou
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="whitespace-nowrap text-warning-strong border-warning/40">
      <Clock className="h-3 w-3 mr-1" /> Falta liberar
    </Badge>
  );
}

function RykaStatusBadge({ status }: { status: "active" | "inactive" | null }) {
  if (status === "active") {
    return (
      <Badge className="whitespace-nowrap bg-success/15 text-success-strong border-success/30 hover:bg-success/15">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
      </Badge>
    );
  }
  if (status === "inactive") {
    return (
      <Badge variant="outline" className="whitespace-nowrap text-muted-foreground border-border/50">
        <AlertCircle className="h-3 w-3 mr-1" /> Inativo
      </Badge>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}
