import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Briefcase,
  DollarSign,
  TrendingUp,
  GraduationCap,
  Stethoscope,
  Target,
  Sparkles,
  BookOpen,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Trophy,
  Activity,
  MapPin,
} from "lucide-react";
import { ClientClinicsManager } from "./ClientClinicsManager";
import { PracticeAreaSelect } from "@/components/PracticeAreaSelect";
import { PracticeAreaMultiSelect } from "@/components/PracticeAreaMultiSelect";
import { CountryStateCity, type LocationFields } from "@/components/operations/CountryStateCity";
import { COUNTRIES, BRAZIL_STATES } from "@/lib/countries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface ClientBusinessProfileProps {
  clientId: string;
  variant?: "card" | "full";
}

interface ClientRow {
  id: string;
  account_id: string;
  initial_revenue: number | null;
  current_revenue: number | null;
  current_revenue_month: string | null;
  differential: string | null;
  method_name: string | null;
  education: string | null;
  education_specialty: string | null;
  business_niche: string | null;
  onboarding_started_at: string | null;
  contract_start_date: string | null;
  created_at: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  business_zip_code: string | null;
  business_city: string | null;
  business_state: string | null;
  cpf: string | null;
  cnpj: string | null;
}

interface HistoryRow {
  id: string;
  client_id: string;
  month: string;
  revenue: number;
  notes: string | null;
  updated_at: string;
}

const currency = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(v);

const monthLabel = (yyyyMm: string | null | undefined) => {
  if (!yyyyMm) return "—";
  try {
    const d = parse(yyyyMm, "yyyy-MM", new Date());
    return format(d, "MMM/yyyy", { locale: ptBR });
  } catch {
    return yyyyMm;
  }
};

const parseCurrencyInput = (raw: string): number | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

const growthPct = (initial: number | null, current: number | null) => {
  if (!initial || initial <= 0 || current == null) return null;
  return ((current - initial) / initial) * 100;
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Seletor de mês/ano com o mês atual como padrão e anos recentes agrupados. */
function MonthYearSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear, currentYear - 1];

  const options = years.map((year) => ({
    year,
    months: MONTH_NAMES.map((name, idx) => ({
      key: `${year}-${String(idx + 1).padStart(2, "0")}`,
      label: name,
      disabled: year === currentYear && idx > now.getMonth(),
    })).filter((m) => !m.disabled),
  }));

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-[150px] text-[11px] px-2">
        <SelectValue placeholder="Selecione o mês" />
      </SelectTrigger>
      <SelectContent className="max-h-72 bg-popover z-50">
        {options.map((group) => (
          <SelectGroup key={group.year}>
            <SelectLabel className="text-[10px] uppercase tracking-wider">{group.year}</SelectLabel>
            {group.months.map((m) => (
              <SelectItem key={m.key} value={m.key} className="text-xs">
                {m.label} de {group.year}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}


export function ClientBusinessProfile({
  clientId,
  variant = "full",
}: ClientBusinessProfileProps) {
  const { currentUser } = useCurrentUser();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [rykaStatus, setRykaStatus] = useState<"active" | "pending" | "error" | "none">("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [rowDraft, setRowDraft] = useState<{ month: string; revenue: string; notes: string }>({
    month: format(new Date(), "yyyy-MM"),
    revenue: "",
    notes: "",
  });

  // Local drafts for inline editable text fields
  const [drafts, setDrafts] = useState<Partial<Record<keyof ClientRow, string>>>({});

  const fetchAll = async () => {
    setLoading(true);
    const { data: c, error: cErr } = await supabase
      .from("clients")
      .select(
        "id, account_id, initial_revenue, current_revenue, current_revenue_month, differential, method_name, education, education_specialty, business_niche, onboarding_started_at, contract_start_date, created_at, city, state, country, zip_code, business_zip_code, business_city, business_state, cpf, cnpj"
      )
      .eq("id", clientId)
      .single();

    if (cErr) {
      console.error(cErr);
      toast.error("Erro ao carregar perfil");
      setLoading(false);
      return;
    }
    setClient(c as any);

    const { data: h } = await supabase
      .from("client_revenue_history")
      .select("id, client_id, month, revenue, notes, updated_at")
      .eq("client_id", clientId)
      .order("month", { ascending: true });
    setHistory((h || []) as any);

    const { data: ryka } = await supabase
      .from("client_ryka_provisions")
      .select("status")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ryka) setRykaStatus("none");
    else if (ryka.status === "success" || ryka.status === "active") setRykaStatus("active");
    else if (ryka.status === "error" || ryka.status === "failed") setRykaStatus("error");
    else setRykaStatus("pending");

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const saveField = async (patch: Partial<ClientRow>) => {
    if (!client) return;
    setSaving(true);
    const { error } = await supabase.from("clients").update(patch as any).eq("id", client.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Atualizado");
    fetchAll();
  };

  const commitText = async (key: keyof ClientRow) => {
    if (!client) return;
    const raw = drafts[key];
    if (raw === undefined) return;
    const value = raw.trim() === "" ? null : raw.trim();
    if ((client[key] ?? null) === value) {
      setDrafts((d) => {
        const n = { ...d };
        delete n[key];
        return n;
      });
      return;
    }
    await saveField({ [key]: value } as any);
    setDrafts((d) => {
      const n = { ...d };
      delete n[key];
      return n;
    });
  };

  const commitInitialRevenue = async (raw: string) => {
    const value = parseCurrencyInput(raw);
    if ((client?.initial_revenue ?? null) === value) return;
    await saveField({ initial_revenue: value } as any);
  };

  const commitCurrentRevenue = async (raw: string, month?: string) => {
    const value = parseCurrencyInput(raw);
    const targetMonth = month || client?.current_revenue_month || format(new Date(), "yyyy-MM");
    if (
      (client?.current_revenue ?? null) === value &&
      (client?.current_revenue_month ?? null) === targetMonth
    )
      return;
    await saveField({
      current_revenue: value,
      current_revenue_month: targetMonth,
    } as any);
  };

  const saveHistoryRow = async () => {
    if (!client || !currentUser?.account_id) return;
    const rev = parseCurrencyInput(rowDraft.revenue);
    if (rev == null) {
      toast.error("Informe o valor do faturamento");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(rowDraft.month)) {
      toast.error("Mês inválido (use AAAA-MM)");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("client_revenue_history").upsert(
      {
        client_id: client.id,
        account_id: client.account_id,
        month: rowDraft.month,
        revenue: rev,
        notes: rowDraft.notes || null,
        created_by: currentUser.id,
      },
      { onConflict: "client_id,month" }
    );
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar histórico");
      return;
    }
    toast.success("Histórico atualizado");
    setEditingId(null);
    setRowDraft({ month: format(new Date(), "yyyy-MM"), revenue: "", notes: "" });
    fetchAll();
  };

  const deleteHistoryRow = async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from("client_revenue_history").delete().eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Removido");
    fetchAll();
  };

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        month: monthLabel(h.month),
        revenue: Number(h.revenue),
      })),
    [history]
  );

  const growth = client ? growthPct(client.initial_revenue, client.current_revenue) : null;

  const mentoringStart = useMemo(() => {
    const raw =
      client?.onboarding_started_at ||
      client?.contract_start_date ||
      client?.created_at ||
      null;
    return raw ? new Date(raw) : null;
  }, [client]);

  const mentoringStartMonth = mentoringStart ? format(mentoringStart, "yyyy-MM") : null;

  const revenueRecord = useMemo(() => {
    if (!history || history.length === 0) return null;
    const eligible = mentoringStartMonth
      ? history.filter((h) => h.month >= mentoringStartMonth)
      : history;
    const pool = eligible.length ? eligible : history;
    return pool.reduce(
      (best, h) => (Number(h.revenue) > Number(best.revenue) ? h : best),
      pool[0]
    );
  }, [history, mentoringStartMonth]);

  const mentoringMonths = useMemo(() => {
    if (!mentoringStart) return null;
    const now = new Date();
    const months =
      (now.getFullYear() - mentoringStart.getFullYear()) * 12 +
      (now.getMonth() - mentoringStart.getMonth());
    return Math.max(0, months);
  }, [mentoringStart]);

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!client) return null;

  // -------------------- COMPACT CARD --------------------
  if (variant === "card") {
    const rykaMeta = {
      active: { label: "Ativo", cls: "text-emerald-600", dot: "bg-emerald-500" },
      pending: { label: "Provisionando", cls: "text-amber-600", dot: "bg-amber-500" },
      error: { label: "Erro no provisionamento", cls: "text-red-600", dot: "bg-red-500" },
      none: { label: "Não utiliza", cls: "text-muted-foreground", dot: "bg-muted-foreground/50" },
    }[rykaStatus];

    return (
      <>
      <Card className="shadow-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Perfil do Negócio</CardTitle>
                <CardDescription className="text-xs">
                  Faturamento, formação e diferencial do cliente
                </CardDescription>
              </div>
            </div>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Revenue row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RevenueBlock
              label="Faturamento inicial"
              icon={<DollarSign className="h-3.5 w-3.5" />}
              value={client.initial_revenue}
              onCommit={commitInitialRevenue}
              accent="muted"
            />
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Faturamento atual
                </span>
                <MonthYearSelect
                  value={client.current_revenue_month || format(new Date(), "yyyy-MM")}
                  onChange={(m) => {
                    if (m !== (client.current_revenue_month || "")) {
                      commitCurrentRevenue(String(client.current_revenue ?? ""), m);
                    }
                  }}
                />

              </div>
              <InlineCurrencyInput
                value={client.current_revenue}
                onCommit={(raw) => commitCurrentRevenue(raw)}
                className="text-lg font-bold text-primary"
              />
            </div>
            <div className="rounded-lg border bg-card p-3 flex flex-col justify-center">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Evolução
              </span>
              {growth == null ? (
                <span className="text-sm text-muted-foreground mt-1">
                  {!client.initial_revenue && !client.current_revenue
                    ? "Preenche automaticamente"
                    : !client.initial_revenue
                    ? "Falta o faturamento inicial"
                    : "Falta o faturamento atual"}
                </span>
              ) : (
                <div className="flex flex-col mt-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={
                        "text-2xl font-bold " +
                        (growth >= 0 ? "text-emerald-600" : "text-red-600")
                      }
                    >
                      {growth >= 0 ? "+" : ""}
                      {growth.toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      desde o início
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    {currency((client.current_revenue ?? 0) - (client.initial_revenue ?? 0))} de crescimento
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Qualitative row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <InlineTextField
              label="Formação"
              icon={<GraduationCap className="h-3.5 w-3.5" />}
              value={client.education}
              draft={drafts.education}
              onDraft={(v) => setDrafts((d) => ({ ...d, education: v }))}
              onCommit={() => commitText("education")}
              placeholder="Ex: Medicina"
            />
            <InlineTextField
              label="Especialidade"
              icon={<Stethoscope className="h-3.5 w-3.5" />}
              value={client.education_specialty}
              draft={drafts.education_specialty}
              onDraft={(v) => setDrafts((d) => ({ ...d, education_specialty: v }))}
              onCommit={() => commitText("education_specialty")}
              placeholder="Ex: Cardiologia"
            />
            <div className="rounded-lg border bg-card p-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1 mb-1">
                <Target className="h-3.5 w-3.5" /> Área de Atuação
              </span>
              <PracticeAreaMultiSelect
                value={client.business_niche}
                onChange={(v) => {
                  saveField({ business_niche: v || null } as any);
                }}
                placeholder="Selecione uma ou mais áreas"
              />
            </div>
            <InlineTextField
              label="Diferencial"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              value={client.differential}
              draft={drafts.differential}
              onDraft={(v) => setDrafts((d) => ({ ...d, differential: v }))}
              onCommit={() => commitText("differential")}
              placeholder="O que te destaca"
            />
            <InlineTextField
              label="Nome do método"
              icon={<BookOpen className="h-3.5 w-3.5" />}
              value={client.method_name}
              draft={drafts.method_name}
              onDraft={(v) => setDrafts((d) => ({ ...d, method_name: v }))}
              onCommit={() => commitText("method_name")}
              placeholder="Nome do método/produto"
            />
          </div>

          {/* Entrada + Ryka + Recorde row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" /> Entrada na mentoria
              </span>
              {mentoringStart ? (
                <div className="mt-1">
                  <div className="text-lg font-bold text-foreground capitalize">
                    {format(mentoringStart, "MMM 'de' yyyy", { locale: ptBR })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {mentoringMonths != null
                      ? `há ${mentoringMonths} ${mentoringMonths === 1 ? "mês" : "meses"}`
                      : ""}
                    {" • "}
                    {format(mentoringStart, "dd/MM/yyyy")}
                    {!client?.onboarding_started_at && !client?.contract_start_date && (
                      <span className="text-amber-600"> (estimado)</span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground mt-1 block">
                  Data indisponível
                </span>
              )}
            </div>

            <div className="rounded-lg border bg-card p-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" /> Clínica Ryka
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${rykaMeta.dot}`} />
                <span className={`text-sm font-semibold ${rykaMeta.cls}`}>
                  {rykaMeta.label}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {rykaStatus === "none"
                  ? "Cliente ainda não provisionado no Clínica Ryka"
                  : "Status do provisionamento mais recente"}
              </p>
            </div>

            <div className="rounded-lg border bg-card p-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-amber-500" /> Recorde de faturamento
              </span>
              {revenueRecord ? (
                <div className="mt-1">
                  <div className="text-lg font-bold text-amber-600">
                    {currency(Number(revenueRecord.revenue))}
                  </div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {monthLabel(revenueRecord.month)} • desde o início da mentoria
                  </div>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground mt-1 block">
                  Sem histórico de faturamento ainda
                </span>
              )}
            </div>
          </div>

          {/* Localização */}
          <LocationCard
            city={client.city}
            state={client.state}
            country={client.country}
            hints={{
              zip: client.zip_code || client.business_zip_code || null,
              city: client.city || client.business_city || null,
              state: client.state || client.business_state || null,
              hasBrDoc: !!(client.cpf || client.cnpj),
            }}
            onSave={async (patch) => {
              await saveField(patch as any);
            }}
          />
        </CardContent>
      </Card>

      <ClientClinicsManager clientId={clientId} accountId={client.account_id} />
      </>
    );
  }


  // -------------------- FULL VIEW --------------------
  return (
    <div className="space-y-4">
      <ClientBusinessProfile clientId={clientId} variant="card" />

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Histórico mensal de faturamento
              </CardTitle>
              <CardDescription>
                Atualiza automaticamente sempre que o faturamento atual muda. Você pode
                adicionar ou editar meses manualmente.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingId("new");
                setRowDraft({
                  month: format(new Date(), "yyyy-MM"),
                  revenue: "",
                  notes: "",
                });
                setHistoryDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar mês
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {chartData.length >= 2 && (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis
                    fontSize={11}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("pt-BR", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v)
                    }
                  />
                  <Tooltip
                    formatter={(v: number) => currency(v)}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum lançamento ainda. Atualize o "Faturamento atual" no card acima ou
              adicione um mês manualmente.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Faturamento</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...history].reverse().map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{monthLabel(h.month)}</TableCell>
                    <TableCell>{currency(Number(h.revenue))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                      {h.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingId(h.id);
                          setRowDraft({
                            month: h.month,
                            revenue: String(h.revenue),
                            notes: h.notes || "",
                          });
                          setHistoryDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteHistoryRow(h.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId === "new" ? "Adicionar mês" : "Editar mês"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Mês</Label>
              <Input
                type="month"
                value={rowDraft.month}
                onChange={(e) => setRowDraft((d) => ({ ...d, month: e.target.value }))}
              />
            </div>
            <div>
              <Label>Faturamento (BRL)</Label>
              <Input
                inputMode="decimal"
                placeholder="Ex: 25000"
                value={rowDraft.revenue}
                onChange={(e) => setRowDraft((d) => ({ ...d, revenue: e.target.value }))}
              />
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={rowDraft.notes}
                onChange={(e) => setRowDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                await saveHistoryRow();
                setHistoryDialogOpen(false);
              }}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------- helpers -------------

function RevenueBlock({
  label,
  icon,
  value,
  onCommit,
  accent = "primary",
}: {
  label: string;
  icon: React.ReactNode;
  value: number | null;
  onCommit: (raw: string) => void;
  accent?: "primary" | "muted";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
        {icon} {label}
      </span>
      <InlineCurrencyInput
        value={value}
        onCommit={onCommit}
        className={
          "text-lg font-bold " + (accent === "primary" ? "text-primary" : "text-foreground")
        }
      />
    </div>
  );
}

function InlineCurrencyInput({
  value,
  onCommit,
  className,
}: {
  value: number | null;
  onCommit: (raw: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={"text-left w-full mt-1 hover:opacity-80 transition-opacity " + (className || "")}
      >
        {value == null ? (
          <span className="text-muted-foreground text-sm font-normal">
            Clique para informar
          </span>
        ) : (
          currency(value)
        )}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value == null ? "" : String(value));
          setEditing(false);
        }
      }}
      className="mt-1 h-8"
      placeholder="0,00"
    />
  );
}

function InlineTextField({
  label,
  icon,
  value,
  draft,
  onDraft,
  onCommit,
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null;
  draft: string | undefined;
  onDraft: (v: string) => void;
  onCommit: () => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const current = draft !== undefined ? draft : value || "";

  return (
    <div className="rounded-lg border bg-card p-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1 mb-1">
        {icon} {label}
      </span>
      {!editing ? (
        <button
          type="button"
          onClick={() => {
            onDraft(value || "");
            setEditing(true);
          }}
          className="text-left w-full text-sm hover:opacity-80 min-h-[24px]"
        >
          {value ? (
            <span>{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder || "Clique para informar"}</span>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={current}
            onChange={(e) => onDraft(e.target.value)}
            onBlur={() => {
              onCommit();
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                onDraft(value || "");
                setEditing(false);
              }
            }}
            placeholder={placeholder}
            className="h-8 text-sm"
          />
        </div>
      )}
    </div>
  );
}

function LocationCard({
  city,
  state,
  country,
  hints,
  onSave,
}: {
  city: string | null;
  state: string | null;
  country: string | null;
  hints?: {
    zip: string | null;
    city: string | null;
    state: string | null;
    hasBrDoc: boolean;
  };
  onSave: (patch: { city: string | null; state: string | null; country: string | null }) => Promise<void>;
}) {
  const [autofilling, setAutofilling] = useState(false);

  const autofill = async () => {
    if (!hints) return;
    setAutofilling(true);
    try {
      const zipDigits = (hints.zip || "").replace(/\D/g, "");
      // 1) Brazilian CEP → ViaCEP (deterministic, free, no key)
      if (zipDigits.length === 8) {
        try {
          const res = await fetch(`https://viacep.com.br/ws/${zipDigits}/json/`);
          const data = await res.json();
          if (data && !data.erro && data.localidade && data.uf) {
            await onSave({
              country: "Brasil",
              state: String(data.uf).toUpperCase(),
              city: data.localidade,
            });
            toast.success(`Preenchido via CEP: ${data.localidade}/${data.uf}`);
            return;
          }
        } catch (err) {
          console.warn("ViaCEP falhou", err);
        }
      }
      // 2) Fallback: usar cidade/estado já cadastrados + inferir país por documento
      if (hints.city || hints.state) {
        const inferredCountry = hints.hasBrDoc || (hints.state && hints.state.length === 2)
          ? "Brasil"
          : null;
        await onSave({
          country: inferredCountry,
          state: hints.state ? String(hints.state).toUpperCase() : null,
          city: hints.city || null,
        });
        toast.success("Preenchido com base no cadastro");
        return;
      }
      toast.error("Sem dados suficientes (CEP/cidade/estado) para inferir");
    } finally {
      setAutofilling(false);
    }
  };

  const canAutofill = !!(hints && (hints.zip || hints.city || hints.state));

  const initial = useMemo<LocationFields>(() => {
    const countryMatch = country
      ? COUNTRIES.find(
          (c) =>
            c.name.toLowerCase() === country.toLowerCase() ||
            c.code.toLowerCase() === country.toLowerCase(),
        )
      : undefined;
    const code = countryMatch?.code || "";
    const isBR = code === "BR";
    let estado_uf = "";
    let estado = state || "";
    if (isBR && state) {
      const s = BRAZIL_STATES.find(
        (st) =>
          st.uf.toLowerCase() === state.toLowerCase() ||
          st.name.toLowerCase() === state.toLowerCase(),
      );
      if (s) {
        estado_uf = s.uf;
        estado = s.name;
      } else if (state.length === 2) {
        estado_uf = state.toUpperCase();
      }
    }
    return {
      pais: countryMatch?.name || country || "",
      pais_codigo: code,
      estado,
      estado_uf,
      cidade: city || "",
    };
  }, [city, state, country]);

  const [value, setValue] = useState<LocationFields>(initial);
  useEffect(() => setValue(initial), [initial]);

  const persist = async (next: LocationFields) => {
    const isBR = (next.pais_codigo || "").toUpperCase() === "BR";
    await onSave({
      country: next.pais || null,
      state: isBR ? next.estado_uf || null : next.estado || null,
      city: next.cidade || null,
    });
  };

  const handleChange = (next: LocationFields) => {
    setValue(next);
    // Persist immediately on country/state selection; city persists on blur below
    if (
      next.pais_codigo !== value.pais_codigo ||
      next.estado_uf !== value.estado_uf ||
      (next.estado !== value.estado && (next.pais_codigo || "").toUpperCase() !== "BR" && next.cidade === value.cidade)
    ) {
      // Only persist when city didn't change (city changes debounce via blur)
      if (next.cidade === value.cidade) {
        void persist(next);
      }
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Localização</div>
          <div className="text-[11px] text-muted-foreground">
            Cidade, estado e país do cliente (cobertura global)
          </div>
        </div>
        {canAutofill && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={autofill}
            disabled={autofilling}
            className="h-7 text-[11px] gap-1"
          >
            {autofilling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Preencher automaticamente
          </Button>
        )}
      </div>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        onBlur={() => {
          // Commit any pending city text on blur
          if (
            value.cidade !== (city || "") ||
            value.pais !== (initial.pais || "") ||
            value.estado !== (initial.estado || "") ||
            value.estado_uf !== (initial.estado_uf || "")
          ) {
            void persist(value);
          }
        }}
      >
        <CountryStateCity value={value} onChange={handleChange} />
      </div>
    </div>
  );
}
