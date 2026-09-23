import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileText, Link2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { LeadSelector, LeadOption } from "./LeadSelector";
import { SellerSelector, useAccountSellers } from "./SellerSelector";
import type { VideoCallSession } from "@/hooks/useVideoCallSessions";

const ACCEPTED = ".txt,.vtt,.srt,.md,.csv,.json,.log";


/** Limpa marcações de legenda (VTT/SRT) deixando só as falas. */
function cleanTranscript(raw: string): string {
  const lines = raw.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === "WEBVTT") continue;
    if (/^\d+$/.test(t)) continue;
    if (/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(t)) continue;
    if (/^NOTE\b/.test(t)) continue;
    if (out[out.length - 1] === t) continue;
    out.push(t);
  }
  return out.join("\n");
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  /** Quando informado, a transcrição é anexada a esta chamada existente. */
  session?: VideoCallSession;
  onCreated?: (id: string, analyzeNow: boolean) => void;
  trigger?: React.ReactNode;
}

export function ImportTranscriptDialog({ session, onCreated, trigger }: Props) {
  const { currentUser } = useCurrentUser();
  const { sellers, loading: loadingSellers } = useAccountSellers();
  const isAttach = !!session;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(session?.participant_name ?? "");
  const [phone, setPhone] = useState(session?.participant_phone ?? "");
  const [lead, setLead] = useState<LeadOption | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(session?.user_id ?? null);
  const [meetingUrl, setMeetingUrl] = useState(session?.meeting_url ?? "");
  const [when, setWhen] = useState(toLocalInput(session?.created_at));
  const [fileName, setFileName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState(session?.transcription ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName(session?.participant_name ?? "");
    setPhone(session?.participant_phone ?? "");
    setLead(null);
    setSellerId(session?.user_id ?? null);
    setMeetingUrl(session?.meeting_url ?? "");
    setWhen(toLocalInput(session?.created_at));
    setFileName(null);
    setTranscript(session?.transcription ?? "");
  };

  const handleLead = (l: LeadOption | null) => {
    setLead(l);
    if (l) {
      if (!name.trim() || l.full_name) setName(l.full_name ?? name);
      if (l.phone) setPhone(l.phone);
      if (!sellerId && l.responsible_user_id) setSellerId(l.responsible_user_id);
    }
  };


  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande", { description: "O limite é de 10 MB." });
      return;
    }
    try {
      const text = await file.text();
      const cleaned = cleanTranscript(text);
      if (!cleaned.trim()) {
        toast.error("Não consegui ler o conteúdo deste arquivo", {
          description: "Envie um arquivo de texto ou cole a transcrição no campo abaixo.",
        });
        return;
      }
      setTranscript(cleaned);
      setFileName(file.name);
      if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ""));
      toast.success("Transcrição carregada", {
        description: `${cleaned.length.toLocaleString("pt-BR")} caracteres`,
      });
    } catch {
      toast.error("Não foi possível ler o arquivo");
    }
  };

  const handleSave = async (analyzeNow: boolean) => {
    if (!transcript.trim()) {
      toast.error("Envie ou cole a transcrição da call");
      return;
    }
    if (!currentUser) {
      toast.error("Sessão não carregada. Recarregue a página.");
      return;
    }
    setSaving(true);

    const common = {
      participant_name: name.trim() || "Call importada",
      participant_phone: phone.trim() || null,
      meeting_url: meetingUrl.trim() || null,
      transcript_file_name: fileName,
      transcription: transcript.trim(),
      ...(lead ? { lead_id: lead.id } : {}),
      ...(sellerId ? { user_id: sellerId } : {}),
    };

    let id = session?.id ?? "";
    let error = null;

    if (isAttach) {
      const res = await supabase
        .from("video_call_sessions")
        .update({ ...common, status: "completed" } as never)
        .eq("id", session!.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("video_call_sessions")
        .insert({
          ...common,
          account_id: currentUser.account_id,
          user_id: sellerId ?? currentUser.id,

          source: "imported",
          status: "completed",
          analysis_status: "pending",
          created_at: when ? new Date(when).toISOString() : undefined,
          started_at: when ? new Date(when).toISOString() : null,
        } as never)
        .select("id")
        .single();
      error = res.error;
      id = (res.data as { id: string } | null)?.id ?? "";
    }

    setSaving(false);

    if (error || !id) {
      toast.error("Erro ao salvar", { description: error?.message });
      return;
    }

    toast.success(isAttach ? "Transcrição anexada" : "Transcrição importada");
    setOpen(false);
    setFileName(null);
    onCreated?.(id, analyzeNow);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Importar transcrição
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isAttach ? "Importar transcrição desta call" : "Importar transcrição da call"}
          </DialogTitle>
          <DialogDescription>
            Envie a transcrição do Zoom ou do Meet, vincule o lead, guarde o link da gravação e
            gere a análise com base no manual de vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <section className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quem participou
            </p>
            <div className="space-y-2">
              <Label>Lead vinculado</Label>
              <LeadSelector value={lead} onChange={handleLead} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" />
                Vendedor responsável
              </Label>
              <SellerSelector
                value={sellerId}
                onChange={setSellerId}
                sellers={sellers}
                loading={loadingSellers}
                className="w-full"
                placeholder="Selecionar quem conduziu a call"
              />
              <p className="text-xs text-muted-foreground">
                Usado para filtrar as calls por vendedor.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="imp-name">Nome do lead / cliente</Label>
                <Input
                  id="imp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imp-phone">Telefone</Label>
                <Input
                  id="imp-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 11 99999-9999"
                />
              </div>
            </div>

            {!isAttach && (
              <div className="space-y-2">
                <Label htmlFor="imp-when">Data e hora da call</Label>
                <Input
                  id="imp-when"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </div>
            )}
          </section>


          <section className="rounded-lg border p-4 space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conteúdo da call
            </p>

            <div className="space-y-2">
              <Label htmlFor="imp-url" className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Link da reunião / gravação (Zoom, Meet)
              </Label>
              <Input
                id="imp-url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://zoom.us/rec/... ou https://meet.google.com/..."
              />
            </div>

            <div className="space-y-2">
              <Label>Arquivo da transcrição</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => {
                    handleFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Escolher arquivo
                </Button>
                <span className="text-xs text-muted-foreground truncate">
                  {fileName ?? "Aceita .txt, .vtt, .srt, .md, .csv — até 10 MB"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imp-text">Transcrição</Label>
              <Textarea
                id="imp-text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={10}
                placeholder="Cole aqui a transcrição da call, se preferir."
                className="font-mono text-xs"
              />
              {transcript && (
                <p className="text-xs text-muted-foreground">
                  {transcript.length.toLocaleString("pt-BR")} caracteres
                </p>
              )}
            </div>
          </section>

        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar sem analisar
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar e gerar análise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
