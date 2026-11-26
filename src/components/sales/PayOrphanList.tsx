import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { orphanDay, orphanKey, orphanMoney, type PayOrphan } from "@/hooks/usePayOrphans";

interface Props {
  orphans: PayOrphan[] | undefined;
  loading: boolean;
  error: string | null;
  partial?: boolean;
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Sale the seller pointed at: highlighted and listed first, never the only option. */
  suggestedKey?: string | null;
  className?: string;
}

/** Ownerless paid sales: one fixed-height row per sale, only the list scrolls. */
export function PayOrphanList({ orphans, loading, error, partial, selected, onSelect, suggestedKey, className }: Props) {
  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> Buscando vendas sem dono…
      </p>
    );
  }
  if (error) return <p role="alert" className="border-l-2 border-destructive py-1 pl-3 text-sm">{error}</p>;
  const list = [...(orphans ?? [])].sort((a, b) => Number(orphanKey(b) === suggestedKey) - Number(orphanKey(a) === suggestedKey));
  if (!list.length) return <p className="py-6 text-sm text-muted-foreground">Nenhuma venda paga sem dono no momento.</p>;
  return (
    <div className={cn("space-y-2", className)}>
      <ul role="radiogroup" aria-label="Vendas sem dono" className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {list.map((o) => {
          const key = orphanKey(o);
          const active = selected === key;
          return (
            <li key={key}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(active ? null : key)}
                className={cn(
                  "grid min-h-14 w-full grid-cols-[1fr_auto] items-center gap-x-3 px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-primary/10" : "hover:bg-muted/60",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{o.payerName}</span>
                    {key === suggestedKey && <Badge variant="outline" className="shrink-0 text-[10px]">Sugestão do vendedor</Badge>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {orphanDay(o.date)} · {o.label || (o.source === "stripe_legacy" ? "Legado Stripe" : "RykaPay")}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{orphanMoney(o.amountCents)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        {list.length} {list.length === 1 ? "venda sem dono" : "vendas sem dono"}
        {partial ? " · o RykaPay devolveu só as 200 cobranças mais recentes" : ""}
      </p>
    </div>
  );
}
