import { ArrowDownLeft, ArrowUpRight, Sparkles, Users, User, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getChannelLabel } from "@/lib/cs/checkins";

export interface CheckinItem {
  id: string;
  happened_at: string;
  initiated_by: string;
  channel: string;
  kind: string;
  source?: string | null;
  summary?: string | null;
  message_count?: number | null;
}

const zone = "America/Sao_Paulo";
const dayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, weekday: "long", day: "2-digit", month: "long" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });

function dayTitle(at: string) {
  const k = keyFmt.format(new Date(at));
  const today = keyFmt.format(new Date());
  const yest = keyFmt.format(new Date(Date.now() - 864e5));
  if (k === today) return "Hoje";
  if (k === yest) return "Ontem";
  const s = dayFmt.format(new Date(at));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Separa o resumo da IA em blocos "[Individual] ..." / "[Grupo X] ...". */
function parseSections(text: string) {
  const parts = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return parts.map((line) => {
    const m = line.match(/^\[([^\]]+)\]\s*[:\-–]?\s*(.*)$/);
    if (!m) return { label: null as string | null, body: line };
    return { label: m[1], body: m[2] };
  });
}

export function CheckinsTimeline({ items }: { items: CheckinItem[] }) {
  const groups = new Map<string, CheckinItem[]>();
  for (const c of items) {
    const k = keyFmt.format(new Date(c.happened_at));
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }

  return (
    <div className="space-y-5">
      {[...groups].map(([k, list]) => (
        <section key={k}>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-xs font-semibold text-foreground">{dayTitle(list[0].happened_at)}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <ol className="relative ml-3 border-l border-border/70">
            {list.map((c) => {
              const ai = c.source === "ai_whatsapp";
              const fromClient = c.initiated_by === "cliente";
              const Icon = ai ? Sparkles : fromClient ? ArrowDownLeft : ArrowUpRight;
              const sections = parseSections(c.summary || "");
              return (
                <li key={c.id} className="relative pb-5 pl-6 last:pb-0">
                  <span
                    className={cn(
                      "absolute -left-[14px] top-0 flex h-7 w-7 items-center justify-center rounded-full border bg-background",
                      ai ? "border-primary/40 text-primary" : fromClient ? "border-info/40 text-info" : "border-border text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                    <span className="text-sm font-medium">
                      {ai ? "Resumo do dia" : fromClient ? "Cliente procurou" : "Consultor procurou"}
                    </span>
                    {c.kind === "checkpoint" && <Badge variant="outline" className="h-5 text-[10px]">Checkpoint</Badge>}
                    {ai ? (
                      <Badge variant="outline" className="h-5 gap-1 border-primary/30 bg-primary/5 text-[10px] text-primary">
                        <Sparkles className="h-2.5 w-2.5" /> IA · RoyZapp CS
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 gap-1 text-[10px] text-muted-foreground">
                        <PenLine className="h-2.5 w-2.5" /> Manual
                      </Badge>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {ai ? "até " : ""}{timeFmt.format(new Date(c.happened_at))}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {getChannelLabel(c.channel)}
                    {ai && c.message_count ? ` · ${c.message_count} mensagens analisadas` : ""}
                  </p>

                  {sections.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {sections.map((s, i) => {
                        const isGroup = !!s.label && /grupo/i.test(s.label);
                        return (
                          <div key={i} className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5">
                            {s.label && (
                              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {isGroup ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                {s.label.replace(/^grupo\s*/i, isGroup ? "Grupo · " : "")}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{s.body}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
