import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { useVideoCallSessions, VideoCallSession } from "@/hooks/useVideoCallSessions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VideoCallDialog } from "./VideoCallDialog";
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

export function VideoCallTab() {
  const { sessions, isLoading, refetch } = useVideoCallSessions();
  const [selectedSession, setSelectedSession] = useState<VideoCallSession | null>(null);
  const [viewMode, setViewMode] = useState<"analysis" | "transcription">("analysis");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Videochamadas</h2>
          <p className="text-sm text-muted-foreground">
            Realize videochamadas com gravação, transcrição e análise automática
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
          <VideoCallDialog />
        </div>
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">Nenhuma videochamada ainda</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Inicie uma videochamada para gravar, transcrever e analisar automaticamente.
            </p>
            <VideoCallDialog
              trigger={
                <Button className="gap-2">
                  <Video className="h-4 w-4" />
                  Iniciar primeira chamada
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSelectedSession(session)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Video className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {session.participant_name || "Sem participante"}
                        </span>
                        <StatusBadge status={session.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AnalysisStatusBadge status={session.analysis_status} />
                    {session.analysis && (
                      <Button variant="ghost" size="sm" className="gap-1.5">
                        <Brain className="h-3.5 w-3.5" />
                        Ver Análise
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedSession}
        onOpenChange={(open) => !open && setSelectedSession(null)}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              {selectedSession?.participant_name || "Videochamada"}
            </DialogTitle>
          </DialogHeader>

          {selectedSession && (
            <div className="flex flex-col gap-4 min-h-0">
              {/* Meta info */}
              <div className="flex items-center gap-4 text-sm">
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

              {/* Toggle tabs */}
              <div className="flex gap-2">
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
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
                {viewMode === "analysis" ? (
                  selectedSession.analysis ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{selectedSession.analysis}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      {selectedSession.analysis_status === "analyzing" ||
                      selectedSession.analysis_status === "transcribing" ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">
                            {selectedSession.analysis_status === "transcribing"
                              ? "Transcrevendo áudio..."
                              : "Analisando chamada..."}
                          </p>
                        </>
                      ) : (
                        <>
                          <Brain className="h-8 w-8 text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">
                            Análise não disponível
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
