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
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const RYKA_ELIGIBLE_KEYWORDS = ["rykas mentoring", "eternum club"];

type Filter = "all" | "provisioned" | "pending" | "failed";

interface ClientRow {
  id: string;
  full_name: string;
  company_name: string | null;
  phone_e164: string | null;
  emails: string[] | null;
  logo_url: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
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
}

export default function ClinicaRyka() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const clientsQuery = useQuery({
    queryKey: ["ryka-eligible-clients", accountId],
    enabled: !!accountId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          `id, full_name, company_name, phone_e164, emails, logo_url, avatar_url, status, created_at,
           client_products(products(id, name, color))`,
        )
        .eq("account_id", accountId!)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ClientRow[];
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
      const { data, error } = await supabase
        .from("client_ryka_provisions")
        .select("client_id, email, status, whatsapp_status, created_at")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Provision[];
    },
  });

  // Latest provision per client
  const provisionByClient = useMemo(() => {
    const map = new Map<string, Provision>();
    for (const p of provisionsQuery.data ?? []) {
      if (!map.has(p.client_id)) map.set(p.client_id, p);
    }
    return map;
  }, [provisionsQuery.data]);

  const enriched = useMemo(() => {
    return (clientsQuery.data ?? []).map((client) => {
      const prov = provisionByClient.get(client.id) ?? null;
      const state: "provisioned" | "pending" | "failed" =
        prov?.status === "success"
          ? "provisioned"
          : prov?.status === "error" || prov?.status === "failed"
            ? "failed"
            : "pending";
      return { client, prov, state };
    });
  }, [clientsQuery.data, provisionByClient]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ client, state }) => {
      if (filter !== "all" && state !== filter) return false;
      if (!q) return true;
      const haystack = [
        client.full_name,
        client.company_name,
        ...(client.emails ?? []),
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
    return { total, provisioned, pending, failed };
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

  const loading = clientsQuery.isLoading || provisionsQuery.isLoading;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" />
            Clínica Ryka
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Clientes com produto Rykas Mentoring ou Eternum Club e o status do acesso ao sistema Ryka.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSyncFromRyka} disabled={syncing || loading}>
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Sincronizar com Ryka
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total elegíveis" value={counts.total} />
        <SummaryCard label="Já com acesso" value={counts.provisioned} accent="text-emerald-600" />
        <SummaryCard label="Falta liberar" value={counts.pending} accent="text-amber-600" />
        <SummaryCard label="Falhas" value={counts.failed} accent="text-rose-600" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Clientes</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, e-mail, telefone..."
                  className="pl-8 w-[280px]"
                />
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabsTrigger value="all">Todos ({counts.total})</TabsTrigger>
                  <TabsTrigger value="provisioned">Com acesso ({counts.provisioned})</TabsTrigger>
                  <TabsTrigger value="pending">Falta liberar ({counts.pending})</TabsTrigger>
                  <TabsTrigger value="failed">Falhas ({counts.failed})</TabsTrigger>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status Ryka</TableHead>
                  <TableHead>E-mail acesso</TableHead>
                  <TableHead>Última liberação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ client, prov, state }) => {
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
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={photo} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
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
                        <StatusBadge state={state} whatsapp={prov?.whatsapp_status ?? null} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {prov?.email || client.emails?.[0] || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {prov?.created_at
                          ? formatDistanceToNow(new Date(prov.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })
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
            </Table>
          )}
        </CardContent>
      </Card>
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
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Com acesso
        </Badge>
        {whatsapp && whatsapp !== "sent" && (
          <Badge variant="outline" className="text-amber-700 border-amber-500/40">
            WhatsApp: {whatsapp}
          </Badge>
        )}
      </div>
    );
  }
  if (state === "failed") {
    return (
      <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 hover:bg-rose-500/15">
        <AlertCircle className="h-3 w-3 mr-1" /> Falhou
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-amber-700 border-amber-500/40">
      <Clock className="h-3 w-3 mr-1" /> Falta liberar
    </Badge>
  );
}
