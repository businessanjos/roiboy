import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { dedupeCalls } from "@/components/telephony/CallTimelineEvent";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Phone, RefreshCw, Sparkles, ExternalLink } from "lucide-react";

interface TranscriptRow {
  status: string;
  summary: any;
  transcript: string | null;
  temperature: string | null;
  last_error: string | null;
  recording_url: string | null;
  metadata: Record<string, any> | null;
}

interface CallRow {
  id: string;
  call_id: string;
  phone: string | null;
  contact_name: string | null;
  direction: string | null;
  status: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  qualification_name: string | null;
  user_id: string | null;
  agent_name: string | null;
  lead_id: string | null;
  deal_id: string | null;
  client_id: string | null;
  recording_url: string | null;
  engine?: string | null;
  metadata: Record<string, any> | null;
  threecplus_call_transcripts: TranscriptRow[] | null;
}

const ENGINE_LABELS: Record<string, string> = {
  "3cplus": "3C Plus",
  ryka_call: "Call Ryka",
};

const PERIODS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const TEMP_COLORS: Record<string, string> = {
  quente: "bg-destructive/15 text-destructive",
  morno: "bg-warning/15 text-warning",
  frio: "bg-info/15 text-info",
};

function fmtDuration(seconds: number | null) {
  const s = seconds || 0;
  const m = Math.floor(s / 60);
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

function outcomeOf(call: CallRow) {
  const raw = (call.status || "").toLowerCase();
  if (!call.call_id) return "em andamento";
  if ((call.duration_seconds || 0) > 0) return "atendida";
  if (raw.includes("caixa") || raw.includes("voicemail")) return "caixa postal";
  if (raw.includes("ocupad") || raw.includes("busy")) return "ocupado";
  return "não atendeu";
}

export function ThreeCPlusCallsList() {
  const { currentUser } = useCurrentUser();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [seller, setSeller] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [temperature, setTemperature] = useState("all");
  const [engine, setEngine] = useState("all");
  const [selected, setSelected] = useState<CallRow | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    const since = new Date(Date.now() - Number(period) * 86400000).toISOString();
    const [{ data }, { data: userRows }] = await Promise.all([
      supabase
        .from("threecplus_call_logs")
        .select(
          "id, call_id, phone, contact_name, direction, status, duration_seconds, started_at, qualification_name, user_id, agent_name, lead_id, deal_id, client_id, recording_url, engine, metadata, threecplus_call_transcripts(status, summary, transcript, temperature, last_error, recording_url)",
        )
        .eq("account_id", currentUser.account_id)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(400),
      supabase.from("users").select("id, name").eq("account_id", currentUser.account_id),
    ]);
    setCalls(dedupeCalls((data as unknown as CallRow[]) || []) as CallRow[]);
    setUsers((userRows as { id: string; name: string }[]) || []);
    setLoading(false);
  }, [currentUser?.account_id, period]);

  useEffect(() => {
    load();
  }, [load]);

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name || null;

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      const t = c.threecplus_call_transcripts?.[0];
      if (seller !== "all" && c.user_id !== seller) return false;
      if (outcome === "unlinked" && (c.lead_id || c.deal_id || c.client_id)) return false;
      if (outcome !== "all" && outcome !== "unlinked" && outcomeOf(c) !== outcome) return false;
      if (temperature !== "all" && (t?.temperature || "") !== temperature) return false;
      return true;
    });
  }, [calls, seller, outcome, temperature]);

  const counters = useMemo(() => {
    const answered = calls.filter((c) => (c.duration_seconds || 0) > 0).length;
    const transcribed = calls.filter(
      (c) => c.threecplus_call_transcripts?.[0]?.status === "done",
    ).length;
    const pending = calls.filter((c) =>
      ["pending", "processing", "error"].includes(c.threecplus_call_transcripts?.[0]?.status || ""),
    ).length;
    const unlinked = calls.filter((c) => !c.lead_id && !c.deal_id && !c.client_id).length;
    return { answered, transcribed, pending, unlinked };
  }, [calls]);

  const transcribeNow = async (call: CallRow, force: boolean) => {
    setWorking(call.id);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-transcribe-call", {
        body: { call_log_id: call.id, force },
      });
      if (error) throw error;
      const result = data?.results?.[0];
      if (result && !result.ok) toast.error("Não foi possível transcrever", { description: result.error });
      else toast.success("Transcrição concluída.");
      load();
    } catch (err: any) {
      toast.error("Falha ao transcrever", { description: err?.message });
    } finally {
      setWorking(null);
    }
  };

  const relink = async () => {
    setWorking("relink");
    try {
      const { error } = await supabase.functions.invoke("threecplus-process-calls", { body: {} });
      if (error) throw error;
      toast.success("Ligações reprocessadas e vinculadas.");
      load();
    } catch (err: any) {
      toast.error("Falha ao vincular", { description: err?.message });
    } finally {
      setWorking(null);
    }
  };

  const selectedTranscript = selected?.threecplus_call_transcripts?.[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Ligações</CardTitle>
              <CardDescription>Resultado, resumo por IA e gravação de cada ligação.</CardDescription>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={relink} disabled={working === "relink"}>
            {working === "relink" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Vincular a contatos
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Atendidas", value: counters.answered },
            { label: "Transcritas", value: counters.transcribed },
            { label: "Na fila", value: counters.pending },
            { label: "Sem contato", value: counters.unlinked },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-semibold">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={seller} onValueChange={setSeller}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os resultados</SelectItem>
              <SelectItem value="atendida">Atendida</SelectItem>
              <SelectItem value="não atendeu">Não atendeu</SelectItem>
              <SelectItem value="caixa postal">Caixa postal</SelectItem>
              <SelectItem value="ocupado">Ocupado</SelectItem>
              <SelectItem value="unlinked">Sem contato vinculado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={temperature} onValueChange={setTemperature}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as temperaturas</SelectItem>
              <SelectItem value="quente">Quente</SelectItem>
              <SelectItem value="morno">Morno</SelectItem>
              <SelectItem value="frio">Frio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma ligação no período.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {filtered.map((call) => {
              const t = call.threecplus_call_transcripts?.[0];
              return (
                <div
                  key={call.id}
                  className="flex flex-wrap items-start gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                  onClick={() => setSelected(call)}
                >
                  <div className="min-w-[190px] flex-1">
                    <p className="text-sm font-medium">
                      {call.contact_name || call.phone || "Sem identificação"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {call.started_at
                        ? format(new Date(call.started_at), "dd/MM HH:mm", { locale: ptBR })
                        : "—"}{" "}
                      · {fmtDuration(call.duration_seconds)} · {userName(call.user_id) || call.agent_name || "—"}
                    </p>
                    {t?.summary?.resumo && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.summary.resumo}</p>
                    )}
                    {call.status === "failed" && call.metadata?.threec_error && (
                      <p className="mt-1 text-xs text-destructive">{String(call.metadata.threec_error)}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{outcomeOf(call)}</Badge>
                    {t?.temperature && (
                      <Badge className={TEMP_COLORS[t.temperature] || ""} variant="secondary">
                        {t.temperature}
                      </Badge>
                    )}
                    {!call.lead_id && !call.deal_id && !call.client_id && (
                      <Badge variant="secondary">sem contato</Badge>
                    )}
                    {t?.status && t.status !== "done" && <Badge variant="outline">{t.status}</Badge>}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working === call.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        transcribeNow(call, t?.status === "done");
                      }}
                    >
                      {working === call.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">
                        {t?.status === "done" ? "Reprocessar" : "Transcrever"}
                      </span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.contact_name || selected?.phone || "Ligação"}</DialogTitle>
            <DialogDescription>
              {selected?.started_at
                ? format(new Date(selected.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                : ""}{" "}
              · {fmtDuration(selected?.duration_seconds ?? 0)} · {selected ? outcomeOf(selected) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(selectedTranscript?.recording_url || selected?.recording_url) && (
              <audio
                controls
                preload="none"
                className="w-full"
                src={selectedTranscript?.recording_url || selected?.recording_url || undefined}
              />
            )}
            {selected?.deal_id && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/sales?deal=${selected.deal_id}`, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir negociação
              </Button>
            )}
            {selectedTranscript?.summary && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">Resumo</p>
                <p className="mt-1 text-muted-foreground">{selectedTranscript.summary.resumo}</p>
                {Array.isArray(selectedTranscript.summary.dores) && selectedTranscript.summary.dores.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <strong>Dores:</strong> {selectedTranscript.summary.dores.join("; ")}
                  </p>
                )}
                {Array.isArray(selectedTranscript.summary.objecoes) && selectedTranscript.summary.objecoes.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <strong>Objeções:</strong> {selectedTranscript.summary.objecoes.join("; ")}
                  </p>
                )}
                {Array.isArray(selectedTranscript.summary.proximos_passos) &&
                  selectedTranscript.summary.proximos_passos.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>Próximos passos:</strong> {selectedTranscript.summary.proximos_passos.join("; ")}
                    </p>
                  )}
              </div>
            )}
            {selectedTranscript?.transcript ? (
              <ScrollArea className="h-64 rounded-lg border border-border p-3">
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {selectedTranscript.transcript}
                </p>
              </ScrollArea>
            ) : (
              <p className="text-xs text-muted-foreground">
                {selectedTranscript?.last_error || "Transcrição ainda não disponível."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
