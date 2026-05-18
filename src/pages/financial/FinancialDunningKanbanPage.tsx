import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, AlertTriangle, Clock, RefreshCw, Headset, TrendingDown, TrendingUp, HandCoins } from "lucide-react";
import {
  FinancialPageHeader,
  FinancialKpiCard,
  FinancialEmptyState,
} from "@/components/financial/_shared";
import { formatBRLCompact } from "@/lib/financial-format";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

type Stage =
  | "a_vencer"
  | "vencida"
  | "negociando"
  | "promessa"
  | "quebrou"
  | "judicial"
  | "recuperada"
  | "perdida";

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "a_vencer", label: "A vencer (7d)", color: "bg-slate-500" },
  { key: "vencida", label: "Vencida", color: "bg-amber-500" },
  { key: "negociando", label: "Negociando", color: "bg-blue-500" },
  { key: "promessa", label: "Promessa", color: "bg-indigo-500" },
  { key: "quebrou", label: "Promessa quebrada", color: "bg-orange-500" },
  { key: "judicial", label: "Judicial", color: "bg-red-600" },
  { key: "recuperada", label: "Recuperada", color: "bg-emerald-500" },
  { key: "perdida", label: "Perdida", color: "bg-zinc-600" },
];

interface DunningCase {
  id: string;
  stage: Stage;
  installment_id: string;
  client_id: string | null;
  assigned_to: string | null;
  sla_due_at: string | null;
  promise_date: string | null;
  promise_amount: number | null;
  last_contact_at: string | null;
  notes: string | null;
  created_at: string;
  installment?: {
    id: string;
    amount: number;
    due_date: string;
    payment_method: string;
    number: number;
  };
  client?: { id: string; full_name: string };
}

interface DunningEvent {
  id: string;
  event_type: string;
  from_stage: string | null;
  to_stage: string | null;
  description: string | null;
  created_at: string;
}

const formatBRL = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function DraggableCard({ kase, onClick }: { kase: DunningCase; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: kase.id });
  const overdueDays = kase.installment
    ? Math.floor(
        (Date.now() - new Date(kase.installment.due_date).getTime()) / 86400000
      )
    : 0;
  const slaOver = kase.sla_due_at && isPast(new Date(kase.sla_due_at));
  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`p-3 space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm leading-tight">
          {kase.client?.full_name || "Cliente desconhecido"}
        </div>
        {slaOver && (
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono font-semibold">
          {formatBRL(Number(kase.installment?.amount ?? 0))}
        </span>
        <Badge variant="outline" className="text-[10px] capitalize">
          {kase.installment?.payment_method || "—"}
        </Badge>
      </div>
      {kase.installment && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {overdueDays > 0
            ? `${overdueDays}d atraso`
            : `vence ${format(new Date(kase.installment.due_date), "dd/MM")}`}
          <span className="opacity-50">· #{kase.installment.number}</span>
        </div>
      )}
      {kase.sla_due_at && (
        <div className={`text-[11px] ${slaOver ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          SLA{" "}
          {formatDistanceToNow(new Date(kase.sla_due_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </div>
      )}
      {kase.stage === "promessa" && kase.promise_date && (
        <div className="text-[11px] text-indigo-600 dark:text-indigo-400">
          Promessa: {format(new Date(kase.promise_date), "dd/MM")} ·{" "}
          {formatBRL(Number(kase.promise_amount ?? 0))}
        </div>
      )}
    </Card>
  );
}

function DroppableColumn({
  stage,
  cases,
  onCardClick,
}: {
  stage: (typeof STAGES)[number];
  cases: DunningCase[];
  onCardClick: (kase: DunningCase) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  const total = cases.reduce(
    (sum, c) => sum + Number(c.installment?.amount ?? 0),
    0
  );
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
          <h3 className="font-semibold text-sm">{stage.label}</h3>
          <Badge variant="secondary" className="text-[10px]">
            {cases.length}
          </Badge>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {formatBRL(total)}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 p-2 rounded-lg bg-muted/40 min-h-[200px] transition-colors ${
          isOver ? "bg-primary/10 ring-1 ring-primary" : ""
        }`}
      >
        {cases.map((kase) => (
          <DraggableCard key={kase.id} kase={kase} onClick={() => onCardClick(kase)} />
        ))}
      </div>
    </div>
  );
}

export default function FinancialDunningKanbanPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<DunningCase | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["dunning-cases", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("dunning_cases")
        .select(
          `id, stage, installment_id, client_id, assigned_to, sla_due_at,
           promise_date, promise_amount, last_contact_at, notes, created_at,
           installment:installments!installment_id(id, amount, due_date, payment_method, number),
           client:clients!client_id(id, full_name)`
        )
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DunningCase[];
    },
    enabled: !!accountId,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["dunning-events", selected?.id],
    queryFn: async () => {
      if (!selected) return [];
      const { data, error } = await supabase
        .from("dunning_case_events")
        .select("id, event_type, from_stage, to_stage, description, created_at")
        .eq("case_id", selected.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DunningEvent[];
    },
    enabled: !!selected,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase
        .from("dunning_cases")
        .update({ stage })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dunning-cases"] });
      qc.invalidateQueries({ queryKey: ["dunning-events"] });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao mover", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<DunningCase> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("dunning_cases").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dunning-cases"] });
      toast({ title: "Caso atualizado" });
    },
  });

  const noteMutation = useMutation({
    mutationFn: async ({ caseId, description }: { caseId: string; description: string }) => {
      if (!accountId) return;
      const { error } = await supabase.from("dunning_case_events").insert({
        case_id: caseId,
        account_id: accountId,
        event_type: "note",
        description,
      });
      if (error) throw error;
      await supabase
        .from("dunning_cases")
        .update({ last_contact_at: new Date().toISOString() })
        .eq("id", caseId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dunning-events"] });
      qc.invalidateQueries({ queryKey: ["dunning-cases"] });
      toast({ title: "Nota registrada" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!accountId) return 0;
      const { data, error } = await supabase.rpc("generate_dunning_cases", {
        p_account_id: accountId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["dunning-cases"] });
      toast({ title: `${count ?? 0} caso(s) gerado(s)` });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const byStage = useMemo(() => {
    const map: Record<Stage, DunningCase[]> = {
      a_vencer: [], vencida: [], negociando: [], promessa: [],
      quebrou: [], judicial: [], recuperada: [], perdida: [],
    };
    for (const c of cases) (map[c.stage] ||= []).push(c);
    return map;
  }, [cases]);

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const id = String(e.active.id);
    const newStage = String(e.over.id) as Stage;
    const kase = cases.find((c) => c.id === id);
    if (!kase || kase.stage === newStage) return;
    moveMutation.mutate({ id, stage: newStage });
  };

  const totals = useMemo(() => {
    const sum = (keys: Stage[]) =>
      cases
        .filter((c) => keys.includes(c.stage))
        .reduce((s, c) => s + Number(c.installment?.amount ?? 0), 0);
    return {
      overdue: sum(["vencida", "quebrou", "judicial"]),
      negotiating: sum(["negociando", "promessa"]),
      recovered: sum(["recuperada"]),
      lost: sum(["perdida"]),
    };
  }, [cases]);

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <FinancialPageHeader
        icon={Headset}
        title="CRM de Cobrança"
        description="Atendimento humano às parcelas vencidas, com SLA por etapa e histórico de contato."
        actions={
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            size="sm"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {generateMutation.isPending ? "Gerando..." : "Gerar casos de vencidas"}
          </Button>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <FinancialKpiCard
          icon={AlertTriangle}
          label="Em cobrança (vencidas)"
          value={formatBRLCompact(totals.overdue)}
          tone="danger"
          hint="Vencida, promessa quebrada e judicial"
        />
        <FinancialKpiCard
          icon={HandCoins}
          label="Em negociação"
          value={formatBRLCompact(totals.negotiating)}
          tone="warning"
          hint="Negociando e com promessa de pagamento"
        />
        <FinancialKpiCard
          icon={TrendingUp}
          label="Recuperado"
          value={formatBRLCompact(totals.recovered)}
          tone="success"
        />
        <FinancialKpiCard
          icon={TrendingDown}
          label="Perdido"
          value={formatBRLCompact(totals.lost)}
          tone="muted"
        />
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto">
          {STAGES.map((s) => (
            <Skeleton key={s.key} className="w-72 h-96 shrink-0" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <FinancialEmptyState
          icon={Headset}
          title="Nenhum caso de cobrança no momento"
          description="Quando houver parcelas vencidas, clique em 'Gerar casos de vencidas' para criar o pipeline automaticamente."
          action={
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar casos agora
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto flex-1 pb-4">
            {STAGES.map((stage) => (
              <DroppableColumn
                key={stage.key}
                stage={stage}
                cases={byStage[stage.key] || []}
                onCardClick={setSelected}
              />
            ))}
          </div>
        </DndContext>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.client?.full_name || "Caso"}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor</Label>
                    <p className="font-mono font-semibold">
                      {formatBRL(Number(selected.installment?.amount ?? 0))}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Vencimento</Label>
                    <p>
                      {selected.installment &&
                        format(new Date(selected.installment.due_date), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Método</Label>
                    <p className="capitalize">{selected.installment?.payment_method}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Parcela</Label>
                    <p>#{selected.installment?.number}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Etapa</Label>
                  <Select
                    value={selected.stage}
                    onValueChange={(v) =>
                      moveMutation.mutate({ id: selected.id, stage: v as Stage })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(selected.stage === "promessa" || selected.stage === "negociando") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Data da promessa</Label>
                      <Input
                        type="date"
                        defaultValue={selected.promise_date || ""}
                        onBlur={(e) =>
                          updateMutation.mutate({
                            id: selected.id,
                            promise_date: (e.target.value || null) as any,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={selected.promise_amount ?? ""}
                        onBlur={(e) =>
                          updateMutation.mutate({
                            id: selected.id,
                            promise_amount: (e.target.value
                              ? Number(e.target.value)
                              : null) as any,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>SLA</Label>
                  <Input
                    type="datetime-local"
                    defaultValue={
                      selected.sla_due_at
                        ? format(new Date(selected.sla_due_at), "yyyy-MM-dd'T'HH:mm")
                        : ""
                    }
                    onBlur={(e) =>
                      updateMutation.mutate({
                        id: selected.id,
                        sla_due_at: (e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null) as any,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nova interação</Label>
                  <Textarea
                    placeholder="Ex: Cliente prometeu pagar via PIX até sexta..."
                    rows={3}
                    id="dunning-new-note"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const el = document.getElementById(
                        "dunning-new-note"
                      ) as HTMLTextAreaElement;
                      const v = el?.value.trim();
                      if (!v) return;
                      noteMutation.mutate({ caseId: selected.id, description: v });
                      el.value = "";
                    }}
                  >
                    Registrar contato
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3" />
                    Histórico
                  </Label>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="text-xs border-l-2 border-muted pl-3 py-1"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {ev.event_type.replace("_", " ")}
                          </Badge>
                          <span className="text-muted-foreground">
                            {format(new Date(ev.created_at), "dd/MM HH:mm")}
                          </span>
                        </div>
                        {ev.event_type === "stage_change" && (
                          <p className="mt-1">
                            <span className="text-muted-foreground">
                              {STAGES.find((s) => s.key === ev.from_stage)?.label || "—"}
                            </span>
                            {" → "}
                            <span className="font-medium">
                              {STAGES.find((s) => s.key === ev.to_stage)?.label}
                            </span>
                          </p>
                        )}
                        {ev.description && ev.event_type !== "stage_change" && (
                          <p className="mt-1">{ev.description}</p>
                        )}
                      </div>
                    ))}
                    {events.length === 0 && (
                      <p className="text-xs text-muted-foreground">Sem movimentações.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
