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
import { Upload, Loader2, FileText, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

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

interface Props {
  onCreated?: (id: string, analyzeNow: boolean) => void;
  trigger?: React.ReactNode;
}

export function ImportTranscriptDialog({ onCreated, trigger }: Props) {
  const { currentUser } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [when, setWhen] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setMeetingUrl("");
    setWhen("");
    setFileName(null);
    setTranscript("");
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
    const { data, error } = await supabase
      .from("video_call_sessions")
      .insert({
        account_id: currentUser.account_id,
        user_id: currentUser.id,
        source: "imported",
        status: "completed",
        analysis_status: "pending",
        participant_name: name.trim() || "Call importada",
        meeting_url: meetingUrl.trim() || null,
        transcript_file_name: fileName,
        transcription: transcript.trim(),
        created_at: when ? new Date(when).toISOString() : undefined,
        started_at: when ? new Date(when).toISOString() : null,
      } as never)
      .select("id")
      .single();
    setSaving(false);

    if (error || !data) {
      toast.error("Erro ao salvar", { description: error?.message });
      return;
    }

    toast.success("Transcrição importada");
    setOpen(false);
    reset();
    onCreated?.((data as { id: string }).id, analyzeNow);
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
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar transcrição da call
          </DialogTitle>
          <DialogDescription>
            Envie a transcrição do Zoom ou do Meet, guarde o link da gravação e gere a análise
            com base no manual de vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
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
              <Label htmlFor="imp-when">Data e hora da call</Label>
              <Input
                id="imp-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
          </div>

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
