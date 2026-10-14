import type { LucideIcon } from "lucide-react";
import { Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ClientHistoryEntry {
  id: string;
  at: string;
  title: string;
  detail: string;
  text: string | null;
  icon: LucideIcon;
  action?: ReactNode;
  /** Badge opcional (ex.: "Sem resposta há 12 dias") */
  badge?: string;
}

const zone = "America/Sao_Paulo";
const dateLabel = (at: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "2-digit", month: "long", year: "numeric" }).format(new Date(at));
const timeLabel = (at: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(at));

export function ClientHistoryTimeline({ entries }: { entries: ClientHistoryEntry[] }) {
  const groups = new Map<string, ClientHistoryEntry[]>();
  [...entries].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).forEach((entry) => {
    const day = dateLabel(entry.at);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  });

  return (
    <div className="space-y-6">
      {[...groups].map(([day, items]) => (
        <section key={day} aria-label={day}>
          <div className="mb-4 flex items-center gap-3">
            <h3 className="shrink-0 text-xs font-semibold text-foreground">{day}</h3>
            <div className="h-px flex-1 bg-border" />
          </div>
          <ol className="ml-4 border-l border-border">
            {items.map((entry) => {
              const Icon = entry.icon;
              return (
                <li key={entry.id} className="relative pb-6 pl-7 last:pb-1">
                  <span className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-background text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold">{entry.title}</p>
                      {entry.badge && (
                        <Badge variant="outline" className={cn("h-4 shrink-0 text-[10px] bg-warning/10 text-warning border-warning/30")}>
                          {entry.badge}
                        </Badge>
                      )}
                    </div>
                    <time dateTime={entry.at} className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                      <Clock3 className="h-3 w-3" />{timeLabel(entry.at)}
                    </time>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.detail}</p>
                  {entry.text && <p className="mt-3 whitespace-pre-wrap break-words border-l-2 border-primary/20 pl-3 text-sm leading-relaxed">{entry.text}</p>}
                  {entry.action && <div className="mt-2">{entry.action}</div>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}