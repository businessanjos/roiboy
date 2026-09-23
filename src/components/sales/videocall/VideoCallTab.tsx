import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { useVideoCallSessions, VideoCallSession } from "@/hooks/useVideoCallSessions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VideoCallDialog } from "./VideoCallDialog";
import { VideoCallActions } from "./VideoCallActions";
import { ImportTranscriptDialog } from "./ImportTranscriptDialog";
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

export function VideoCallTab() {
  const { sessions, isLoading, refetch } = useVideoCallSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"analysis" | "transcription">("analysis");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [analyzing, setAnalyzing] = useState<string[]>([]);

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (term && !(s.participant_name ?? "").toLowerCase().includes(term)) return false;
      if (filter === "with_analysis") return !!s.analysis;
      if (filter === "pending") return !s.analysis && !!s.transcription;
      if (filter === "no_transcription") return !s.transcription;
      return true;
    });
  }, [sessions, search, filter]);

  const counts = useMemo(
    () => ({
      all: sessions.length,
      with_analysis: sessions.filter((s) => s.analysis).length,
      pending: sessions.filter((s) => !s.analysis && s.transcription).length,
      no_transcription: sessions.filter((s) => !s.transcription).length,
    }),
    [sessions]
  );

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "with_analysis", label: "Com análise" },
    { key: "pending", label: "Aguardando análise" },
    { key: "no_transcription", label: "Sem transcrição" },
  ];

  return (
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
          <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
          <ImportTranscriptDialog onCreated={handleImported} />
          <VideoCallDialog />
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="ml-1.5 text-xs opacity-70">{counts[f.key]}</span>
            </Button>
          ))}
        </div>
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
              Importe a transcrição de uma call do Zoom/Meet ou inicie uma chamada pelo ROY.
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
          {filtered.map((session) => {
            const isAnalyzing =
              analyzing.includes(session.id) || session.analysis_status === "analyzing";
            return (
              <Card
                key={session.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedId(session.id)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
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
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <AnalysisStatusBadge
                        status={isAnalyzing ? "analyzing" : session.analysis_status}
                      />
                      {session.meeting_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(session.meeting_url!, "_blank", "noopener");
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir call
                        </Button>
                      )}
                      {session.transcription && (
                        <Button
                          variant={session.analysis ? "ghost" : "default"}
                          size="sm"
                          className="gap-1.5"
                          disabled={isAnalyzing}
                          onClick={(e) => {
                            e.stopPropagation();
                            analyze(session);
                          }}
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {session.analysis ? "Refazer análise" : "Gerar análise"}
                        </Button>
                      )}
                      {session.analysis && (
                        <Button
                          variant="ghost"
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
    </div>
  );
}
