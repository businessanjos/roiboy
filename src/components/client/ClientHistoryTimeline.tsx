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
                <li key={entry.id} className="relative pb-5 pl-6 last:pb-1">
                  <span className="absolute -left-3.5 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex items-baseline justify-between gap-3 pt-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{entry.title}</p>
                      {entry.badge && (
                        <Badge variant="outline" className={cn("h-4 shrink-0 text-[10px] bg-warning/10 text-warning border-warning/30")}>
                          {entry.badge}
                        </Badge>
                      )}
                    </div>
                    <time dateTime={entry.at} className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                      <Clock3 className="h-3 w-3" />{timeLabel(entry.at)}
                    </time>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <p className="min-w-0 truncate text-xs text-muted-foreground">{entry.detail}</p>
                    {entry.action}
                  </div>
                  {entry.text && <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed">{entry.text}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}