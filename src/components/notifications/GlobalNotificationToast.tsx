import { AtSign, ArrowUpRight, Bell, Briefcase, CheckSquare, MessageSquare, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  content?: string | null;
  type?: string | null;
  sourceType?: string | null;
  actorName?: string | null;
  actorAvatar?: string | null;
  hasLink: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}

function iconFor(type?: string | null, source?: string | null) {
  if (type === "deal_transferred" || source === "deal") return Briefcase;
  if (type?.startsWith("task") || source?.includes("task")) return CheckSquare;
  if (type?.includes("zapp") || type === "internal_message" || type === "mention") return MessageSquare;
  return Bell;
}

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export function GlobalNotificationToast({ title, content, type, sourceType, actorName, actorAvatar, hasLink, onOpen, onDismiss }: Props) {
  const Icon = iconFor(type, sourceType);
  if (sourceType === "marketing_task_comment" || sourceType === "marketing_task_assignment") {
    const [taskTitle, ...preview] = (content ?? "").split("\n");
    const firstName = actorName?.trim().split(/\s+/)[0];
    const TaskIcon = type === "mention" ? AtSign : type === "task_assigned" ? CheckSquare : MessageSquare;
    return <div className="relative w-full min-w-0 pointer-events-auto py-1 text-foreground">
      <Button type="button" variant="ghost" size="icon" className="absolute -right-1 -top-1 h-7 w-7 text-muted-foreground" aria-label="Fechar aviso" title="Fechar aviso" onClick={onDismiss}><X className="h-3.5 w-3.5" /></Button>
      <div className="flex items-start gap-2.5 pr-5">
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9"><AvatarImage src={actorAvatar ?? undefined} alt={firstName ?? ""} /><AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{firstName?.slice(0, 1).toUpperCase() || <TaskIcon className="h-4 w-4" />}</AvatarFallback></Avatar>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-primary text-primary-foreground"><TaskIcon className="h-2.5 w-2.5" /></span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-relaxed [overflow-wrap:anywhere]">{title}</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{taskTitle}</p>
          {preview.length > 0 && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{preview.join(" ")}</p>}
          <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 gap-1 px-0 text-xs text-primary hover:bg-transparent" onClick={onOpen}>Abrir tarefa<ArrowUpRight className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>;
  }
  return (
    <div className="pointer-events-auto w-[min(360px,calc(100vw-2rem))] rounded-lg border border-border bg-card text-card-foreground shadow-lg overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">{title}</span>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          {actorAvatar ? <AvatarImage src={actorAvatar} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {actorName ? initials(actorName) : <Icon className="h-5 w-5" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          {actorName && <p className="text-sm font-medium truncate">{actorName}</p>}
          {content && <p className="text-sm text-muted-foreground line-clamp-3 mt-0.5">{content}</p>}
          <div className="flex justify-end mt-3">
            <Button size="sm" className="h-8" onClick={onOpen}>{hasLink ? "Abrir" : "Ver notificações"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

let audioCtx: AudioContext | null = null;
export function playNotificationChime() {
  try {
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx || new Ctor();
    const ctx = audioCtx;
    const run = () => {
      const now = ctx.currentTime;
      [{ f: 880, at: 0, d: 0.16 }, { f: 1320, at: 0.18, d: 0.22 }].forEach(({ f, at, d }) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f, now + at);
        g.gain.setValueAtTime(0.0001, now + at);
        g.gain.exponentialRampToValueAtTime(0.2, now + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + at + d);
        o.connect(g); g.connect(ctx.destination);
        o.start(now + at); o.stop(now + at + d + 0.02);
      });
    };
    if (ctx.state === "suspended") ctx.resume().then(run).catch(() => {}); else run();
  } catch { /* som é opcional */ }
}
