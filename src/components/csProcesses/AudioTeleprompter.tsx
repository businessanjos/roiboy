import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Send, Loader2, AudioLines, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { sendProcessAudio } from "@/lib/csAudioSend";
import type { ProcessClient } from "@/lib/csClientLinks";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Teleprompter: a consultora lê o roteiro, grava e envia como nota de voz. */
export function AudioTeleprompter({ open, onOpenChange, script, client, onSent }: {
  open: boolean; onOpenChange: (v: boolean) => void; script: React.ReactNode; client: ProcessClient | null; onSent: () => void;
}) {
  const { currentUser: user } = useCurrentUser();
  const [state, setState] = useState<"idle" | "rec" | "review" | "sending">("idle");
  const [secs, setSecs] = useState(0);
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const t0 = useRef(0);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => { if (state !== "rec") return; const id = setInterval(() => setSecs(Math.round((Date.now() - t0.current) / 1000)), 250); return () => clearInterval(id); }, [state]);
  useEffect(() => { if (!open) { cleanup.current(); rec.current?.state === "recording" && rec.current.stop(); setState("idle"); setSecs(0); setTake(null); } }, [open]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      let mime = "audio/webm";
      for (const m of ["audio/ogg;codecs=opus", "audio/ogg", "audio/webm;codecs=opus"]) if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
      const mr = new MediaRecorder(stream, { mimeType: mime });
      const ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount); let raf = 0;
      const tick = () => { an.getByteFrequencyData(buf); setLevel(buf.reduce((a, b) => a + b, 0) / buf.length / 128); raf = requestAnimationFrame(tick); }; tick();
      cleanup.current = () => { cancelAnimationFrame(raf); ctx.close().catch(() => {}); stream.getTracks().forEach((t) => t.stop()); };
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onstop = () => {
        cleanup.current();
        const duration = Math.max(1, Math.round((Date.now() - t0.current) / 1000));
        const blob = new Blob(chunks.current, { type: mr.mimeType || mime });
        if (blob.size < Math.max(2048, duration * 400)) { toast.error("Não detectamos som do microfone. Verifique e grave novamente."); setState("idle"); return; }
        setTake({ blob, url: URL.createObjectURL(blob), duration }); setState("review");
      };
      rec.current = mr; t0.current = Date.now(); setSecs(0); mr.start(); setState("rec");
    } catch { toast.error("Não foi possível acessar o microfone. Permita o uso do microfone no navegador."); }
  };
  const stop = () => rec.current?.stop();
  const redo = () => { if (take) URL.revokeObjectURL(take.url); setTake(null); setSecs(0); setState("idle"); };
  const send = async () => {
    if (!take || !client || !user) return;
    setState("sending");
    try {
      await sendProcessAudio({ blob: take.blob, duration: take.duration, clientId: client.id, clientPhone: client.phone_e164, user });
      toast.success(`Áudio enviado para ${client.full_name.split(" ")[0]} ✓`); onSent(); onOpenChange(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao enviar o áudio"); setState("review"); }
  };
  const first = client?.full_name.split(" ")[0];

  return (
    <Dialog open={open} onOpenChange={(v) => state !== "sending" && onOpenChange(v)}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2"><Mic className="h-5 w-5 text-primary" />Gravar áudio{first ? ` para ${first}` : ""}</DialogTitle>
          <DialogDescription>Leia o roteiro com sua voz, no seu jeito. Ele chega no WhatsApp como áudio gravado na hora.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-10">
          <div className={`whitespace-pre-wrap text-xl leading-[1.8] md:text-2xl ${state === "rec" ? "text-foreground" : "text-foreground/85"}`}>{script}</div>
        </div>
        <div className="border-t bg-muted/40 px-6 py-4">
          {state === "idle" && (
            <div className="flex flex-col items-center gap-2">
              <Button size="lg" className="h-14 gap-2 rounded-full px-8 text-base" onClick={start}><Mic className="h-5 w-5" />Começar a gravar</Button>
              <span className="text-xs text-muted-foreground">Dica: leia com calma, sorrindo — dá pra ouvir antes de enviar.</span>
            </div>
          )}
          {state === "rec" && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" /></span>
                <span className="font-mono text-lg tabular-nums">{fmt(secs)}</span>
                <div className="flex h-8 items-center gap-0.5" aria-hidden>
                  {Array.from({ length: 18 }).map((_, i) => <span key={i} className="w-1 rounded-full bg-primary transition-all" style={{ height: `${Math.max(12, Math.min(100, level * 100 * (0.5 + Math.abs(Math.sin(i * 1.7 + secs)))))}%` }} />)}
                </div>
              </div>
              <Button size="lg" variant="destructive" className="gap-2 rounded-full" onClick={stop}><Square className="h-4 w-4" />Concluir</Button>
            </div>
          )}
          {(state === "review" || state === "sending") && take && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-2"><AudioLines className="h-5 w-5 text-primary" /><audio src={take.url} controls className="h-10 w-full" /></div>
              <div className="flex gap-2">
                <Button variant="ghost" className="gap-1.5" onClick={redo} disabled={state === "sending"}><RotateCcw className="h-4 w-4" />Regravar</Button>
                {client
                  ? <Button className="gap-1.5" onClick={send} disabled={state === "sending"}>{state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar para {first}</Button>
                  : <span className="self-center text-xs text-muted-foreground">Abra a partir de uma cliente para enviar.</span>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
