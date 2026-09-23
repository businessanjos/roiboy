import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


import {
  Video,
  Clock,
  FileText,
  Brain,
  RefreshCw,
  Loader2,
  User,
  Calendar,
  Search,
  ExternalLink,
  Upload,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useVideoCallSessions, VideoCallSession } from "@/hooks/useVideoCallSessions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VideoCallDialog } from "./VideoCallDialog";
import { VideoCallActions } from "./VideoCallActions";
import { ImportTranscriptDialog } from "./ImportTranscriptDialog";
import { SellerSelector, useAccountSellers, initials } from "./SellerSelector";
import MarkdownRenderer from "@/components/sales/MarkdownRenderer";

function formatDuration(seconds: number): string {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}min ${s}s`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    waiting: { label: "Aguardando", variant: "secondary" },
    recording: { label: "Gravando", variant: "destructive" },
    processing: { label: "Processando", variant: "outline" },
    completed: { label: "Concluído", variant: "default" },
    transcribing: { label: "Transcrevendo", variant: "outline" },
    analyzing: { label: "Analisando", variant: "outline" },
    analysis_failed: { label: "Falha na análise", variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function AnalysisStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pendente", variant: "secondary" },
    transcribing: { label: "Transcrevendo...", variant: "outline" },
    analyzing: { label: "Analisando...", variant: "outline" },
    completed: { label: "Análise pronta", variant: "default" },
    analysis_failed: { label: "Falhou", variant: "destructive" },
    no_transcription: { label: "Sem transcrição", variant: "secondary" },
  };
  const info = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

type FilterKey = "all" | "with_analysis" | "pending" | "no_transcription";
type PeriodKey = "today" | "week" | "month" | "quarter" | "year" | "all";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Essa semana" },
  { key: "month", label: "Esse mês" },
  { key: "quarter", label: "Últimos 3 meses" },
  { key: "year", label: "Esse ano" },
  { key: "all", label: "Tudo" },
];

function periodStart(period: PeriodKey): Date | null {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "today":
      return d;
    case "week": {
      const day = (d.getDay() + 6) % 7; // segunda = 0
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "quarter":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    default:
      return null;
  }
}

/** Botão discreto (só ícone) com explicação ao passar o mouse. */
function IconAction({
  label,
  onClick,
  children,
  className,
  disabled,
}: {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", className)}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Usuários que não fazem parte da equipe de vendas — calls ocultas da aba. */
const HIDDEN_SELLER_IDS = new Set([
  "cefc44c7-d2e2-4937-94ac-069c1c94731b", // George Oliveira
  "1ac1c97c-bff6-4174-b48c-9b524b404ce6", // Vanessa Minelli
]);

export function VideoCallTab() {
  const { sessions: allSessions, isLoading, refetch } = useVideoCallSessions();
  const sessions = useMemo(
    () => allSessions.filter((s) => !s.user_id || !HIDDEN_SELLER_IDS.has(s.user_id)),
    [allSessions]
  );
  const { sellers, loading: loadingSellers } = useAccountSellers();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"analysis" | "transcription">("analysis");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });


  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  const analyze = async (session: VideoCallSession) => {
    if (!session.transcription?.trim()) {
      toast.error("Esta chamada ainda não tem transcrição", {
        description: "Importe a transcrição do Zoom/Meet para gerar a análise.",
      });
      return;
    }
    setAnalyzing((a) => [...a, session.id]);
    try {
      await supabase
        .from("video_call_sessions")
        .update({ analysis_status: "analyzing" })
        .eq("id", session.id);
      refetch();

      const { data, error } = await supabase.functions.invoke("analyze-sales-call", {
        body: { transcript: session.transcription },
      });
      if (error) throw error;
      const analysis = (data as { analysis?: string })?.analysis;
      if (!analysis) throw new Error("A IA não retornou uma análise.");

      await supabase
        .from("video_call_sessions")
        .update({ analysis, analysis_status: "completed" })
        .eq("id", session.id);
      toast.success("Análise pronta");
      refetch();
    } catch (e) {
      await supabase
        .from("video_call_sessions")
        .update({ analysis_status: "analysis_failed" })
        .eq("id", session.id);
      toast.error("Não foi possível gerar a análise", {
        description: e instanceof Error ? e.message : undefined,
      });
      refetch();
    } finally {
      setAnalyzing((a) => a.filter((id) => id !== session.id));
    }
  };

  const handleImported = async (id: string, analyzeNow: boolean) => {
    await refetch();
    if (!analyzeNow) return;
    const { data } = await supabase
      .from("video_call_sessions")
      .select("*")
      .eq("id", id)
      .single();
    if (data) analyze(data as unknown as VideoCallSession);
  };

  /** Base do período + vendedor — os contadores de status usam esta base. */
  const scoped = useMemo(() => {
    const start = periodStart(period);
    return sessions.filter((s) => {
      if (sellerId && s.user_id !== sellerId) return false;
      if (start && new Date(s.created_at) < start) return false;
      return true;
    });
  }, [sessions, period, sellerId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scoped.filter((s) => {
      if (
        term &&
        !(s.participant_name ?? "").toLowerCase().includes(term) &&
        !(s.seller?.name ?? "").toLowerCase().includes(term)
      )
        return false;
      if (filter === "with_analysis") return !!s.analysis;
      if (filter === "pending") return !s.analysis && !!s.transcription;
      if (filter === "no_transcription") return !s.transcription;
      return true;
    });
  }, [scoped, search, filter]);

  const counts = useMemo(
    () => ({
      all: scoped.length,
      with_analysis: scoped.filter((s) => s.analysis).length,
      pending: scoped.filter((s) => !s.analysis && s.transcription).length,
      no_transcription: scoped.filter((s) => !s.transcription).length,
    }),
    [scoped]
  );

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "with_analysis", label: "Com análise" },
    { key: "pending", label: "Aguardando análise" },
    { key: "no_transcription", label: "Sem transcrição" },
  ];

  /** Só quem realmente tem videochamada registrada aparece no filtro de vendedor. */
  const callSellers = useMemo(() => {
    const totals = new Map<string, number>();
    sessions.forEach((s) => {
      if (!s.user_id) return;
      totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + 1);
    });
    return sellers
      .filter((s) => totals.has(s.id))
      .map((s) => ({ ...s, name: `${s.name} (${totals.get(s.id)})` }))
      .sort(
        (a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0)
      );
  }, [sellers, sessions]);

  const activeSeller = sellers.find((s) => s.id === sellerId) ?? null;

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "Tudo";

  const summary = [
    { label: "Calls no filtro", value: counts.all },
    { label: "Com análise", value: counts.with_analysis },
    { label: "Aguardando análise", value: counts.pending },
    { label: "Sem transcrição", value: counts.no_transcription },
  ];

  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((s) => s.id)));

  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("video_call_sessions").delete().in("id", ids);
    setDeleting(false);
    setBulkDeleteOpen(false);
    if (error) {
      toast.error("Não foi possível excluir as chamadas selecionadas");
      return;
    }
    toast.success(`${ids.length} chamada${ids.length > 1 ? "s" : ""} excluída${ids.length > 1 ? "s" : ""}`);
    setSelected(new Set());
    refetch();
  };

  return (

    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Videochamadas</h2>
            <p className="text-sm text-muted-foreground">
              Grave pelo ROY ou importe a transcrição do Zoom/Meet e gere a análise da call
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconAction label="Atualizar lista" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </IconAction>
            <ImportTranscriptDialog
              onCreated={handleImported}
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Importar transcrição
                </Button>
              }
            />
            <VideoCallDialog />
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-3">
            <div className="grid gap-2 md:grid-cols-[minmax(200px,1fr)_180px_190px_210px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por lead ou vendedor"
                  className="pl-8"
                />
              </div>

              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <SellerSelector
                value={sellerId}
                onChange={setSellerId}
                sellers={callSellers}
                loading={loadingSellers}
                allowAll
                allLabel="Todos os vendedores"
                className="w-full"
              />

              <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filters.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label} ({counts[f.key]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Resumo do filtro */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {summary.map((item, i) => (
            <Card key={item.label}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground truncate">
                  {i === 0
                    ? `${activeSeller ? activeSeller.name : "Todos os vendedores"} · ${periodLabel}`
                    : item.label}
                </p>
                <p className="text-2xl font-semibold leading-tight">{item.value}</p>
                {i === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {item.value === 1 ? "videochamada" : "videochamadas"}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sessions list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Video className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">Nenhuma videochamada encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Ajuste o período e o vendedor, importe a transcrição de uma call do Zoom/Meet ou
                inicie uma chamada pelo ROY.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <ImportTranscriptDialog
                  onCreated={handleImported}
                  trigger={
                    <Button variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Importar transcrição
                    </Button>
                  }
                />
                <VideoCallDialog
                  trigger={
                    <Button className="gap-2">
                      <Video className="h-4 w-4" />
                      Iniciar chamada
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todas as calls"
                  className="h-3.5 w-3.5"
                />
                {selected.size > 0
                  ? `${selected.size} selecionada${selected.size > 1 ? "s" : ""}`
                  : "Selecionar"}
              </label>
              {selected.size > 0 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setSelected(new Set())}
                  >
                    Limpar
                  </Button>
                  <IconAction
                    label="Excluir selecionadas"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={deleting}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </IconAction>
                </div>
              )}
            </div>


            {filtered.map((session) => {
              const isAnalyzing =
                analyzing.includes(session.id) || session.analysis_status === "analyzing";
              return (
                <Card
                  key={session.id}
                  className="cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => setSelectedId(session.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                          <Checkbox
                            checked={selected.has(session.id)}
                            onCheckedChange={() => toggleSelected(session.id)}
                            aria-label="Selecionar call"
                          />
                        </div>
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Video className="h-5 w-5 text-primary" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium truncate">
                              {session.participant_name || "Sem participante"}
                            </span>
                            <StatusBadge status={session.status} />
                            {session.source === "imported" && (
                              <Badge variant="outline">Importada</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1.5">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={session.seller?.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[8px]">
                                  {initials(session.seller?.name)}
                                </AvatarFallback>
                              </Avatar>
                              {session.seller?.name ?? "Sem vendedor"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(session.created_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                            {session.duration_seconds > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(session.duration_seconds)}
                              </span>
                            )}
                            {session.transcription && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Transcrição
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!session.analysis && (
                          <AnalysisStatusBadge
                            status={isAnalyzing ? "analyzing" : session.analysis_status}
                          />
                        )}
                        {!session.transcription && (
                          <span onClick={(e) => e.stopPropagation()}>
                            <Tooltip>
                              <ImportTranscriptDialog
                                session={session}
                                onCreated={handleImported}
                                trigger={
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                      aria-label="Importar transcrição"
                                    >
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                }
                              />
                              <TooltipContent>Importar transcrição</TooltipContent>
                            </Tooltip>
                          </span>
                        )}
                        {session.meeting_url && (
                          <IconAction
                            label="Abrir gravação da call"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(session.meeting_url!, "_blank", "noopener");
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </IconAction>
                        )}
                        {session.transcription && (
                          <IconAction
                            label={session.analysis ? "Refazer análise" : "Gerar análise"}
                            disabled={isAnalyzing}
                            className={session.analysis ? undefined : "text-primary"}
                            onClick={(e) => {
                              e.stopPropagation();
                              analyze(session);
                            }}
                          >
                            {isAnalyzing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </IconAction>
                        )}
                        {session.analysis && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewMode("analysis");
                              setSelectedId(session.id);
                            }}
                          >
                            <Brain className="h-3.5 w-3.5" />
                            Ver análise
                          </Button>
                        )}
                        <VideoCallActions session={session} onChanged={refetch} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedId(null)}>
          <DialogContent className="sm:max-w-[760px] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                {selectedSession?.participant_name || "Videochamada"}
              </DialogTitle>
            </DialogHeader>

            {selectedSession && (
              <div className="flex flex-col gap-4 min-h-0">
                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={selectedSession.seller?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[9px]">
                        {initials(selectedSession.seller?.name)}
                      </AvatarFallback>
                    </Avatar>
                    {selectedSession.seller?.name ?? "Sem vendedor"}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(selectedSession.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                  {selectedSession.duration_seconds > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatDuration(selectedSession.duration_seconds)}
                    </span>
                  )}
                  {selectedSession.participant_phone && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <User className="h-4 w-4" />
                      {selectedSession.participant_phone}
                    </span>
                  )}
                  <StatusBadge status={selectedSession.status} />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={viewMode === "analysis" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("analysis")}
                    className="gap-1.5"
                  >
                    <Brain className="h-3.5 w-3.5" />
                    Análise
                  </Button>
                  <Button
                    variant={viewMode === "transcription" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("transcription")}
                    className="gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Transcrição
                  </Button>
                  {selectedSession.meeting_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        window.open(selectedSession.meeting_url!, "_blank", "noopener")
                      }
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir call
                    </Button>
                  )}
                  {!selectedSession.transcription && (
                    <span className="ml-auto">
                      <ImportTranscriptDialog
                        session={selectedSession}
                        onCreated={handleImported}
                        trigger={
                          <Button size="sm" className="gap-1.5">
                            <Upload className="h-3.5 w-3.5" />
                            Importar transcrição
                          </Button>
                        }
                      />
                    </span>
                  )}
                  {selectedSession.transcription && (
                    <Button
                      size="sm"
                      className="gap-1.5 ml-auto"
                      disabled={
                        analyzing.includes(selectedSession.id) ||
                        selectedSession.analysis_status === "analyzing"
                      }
                      onClick={() => analyze(selectedSession)}
                    >
                      {analyzing.includes(selectedSession.id) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {selectedSession.analysis ? "Refazer análise" : "Gerar análise"}
                    </Button>
                  )}
                </div>

                {/* Content */}
                <ScrollArea className="flex-1 min-h-0 max-h-[55vh]">
                  {viewMode === "analysis" ? (
                    selectedSession.analysis ? (
                      <MarkdownRenderer content={selectedSession.analysis} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        {analyzing.includes(selectedSession.id) ||
                        selectedSession.analysis_status === "analyzing" ||
                        selectedSession.analysis_status === "transcribing" ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                            <p className="text-sm text-muted-foreground">
                              Analisando a call com base no manual de vendas...
                            </p>
                          </>
                        ) : (
                          <>
                            <Brain className="h-8 w-8 text-muted-foreground mb-3" />
                            <p className="text-sm text-muted-foreground">
                              {selectedSession.transcription
                                ? "Clique em Gerar análise para avaliar esta call."
                                : "Importe a transcrição desta call para gerar a análise."}
                            </p>
                          </>
                        )}
                      </div>
                    )
                  ) : selectedSession.transcription ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedSession.transcription}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Transcrição não disponível
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir as chamadas selecionadas?</AlertDialogTitle>
              <AlertDialogDescription>
                {selected.size} chamada{selected.size > 1 ? "s serão removidas" : " será removida"}{" "}
                junto com a transcrição e a análise. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleBulkDelete();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>

  );
}
