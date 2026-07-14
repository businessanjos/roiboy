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
} from "lucide-react";
import { ClientClinicsManager } from "./ClientClinicsManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
        "id, account_id, initial_revenue, current_revenue, current_revenue_month, differential, method_name, education, education_specialty, business_niche"
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
    return (
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
                <Input
                  type="month"
                  defaultValue={client.current_revenue_month || format(new Date(), "yyyy-MM")}
                  onBlur={(e) => {
                    if (e.target.value !== (client.current_revenue_month || "")) {
                      commitCurrentRevenue(
                        String(client.current_revenue ?? ""),
                        e.target.value
                      );
                    }
                  }}
                  className="h-6 w-[130px] text-[11px] px-1"
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
            <InlineTextField
              label="Nicho"
              icon={<Target className="h-3.5 w-3.5" />}
              value={client.business_niche}
              draft={drafts.business_niche}
              onDraft={(v) => setDrafts((d) => ({ ...d, business_niche: v }))}
              onCommit={() => commitText("business_niche")}
              placeholder="Ex: Longevidade"
            />
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
        </CardContent>
      </Card>
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
