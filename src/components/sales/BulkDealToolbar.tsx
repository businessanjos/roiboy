import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, X } from "lucide-react";

interface Props {
  enabled: boolean;
  count: number;
  total: number;
  running: boolean;
  onToggle: () => void;
  onSelectAll: (checked: boolean) => void;
  onEdit: () => void;
}

export function BulkDealToolbar({ enabled, count, total, running, onToggle, onSelectAll, onEdit }: Props) {
  if (!enabled) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 border-y border-border bg-muted/30 px-2 py-2">
      <Button variant="ghost" size="sm" className="h-9 gap-2 text-muted-foreground" onClick={onToggle} disabled={running} aria-pressed={enabled}>
        <X className="h-4 w-4" /> Sair da seleção
      </Button>
      {enabled && <>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm">
          <Checkbox checked={total > 0 && count === total ? true : count > 0 ? "indeterminate" : false} onCheckedChange={checked => onSelectAll(checked === true)} disabled={running || total === 0} />
          Selecionar resultado ({total.toLocaleString("pt-BR")})
        </label>
        <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">{count.toLocaleString("pt-BR")} selecionado{count === 1 ? "" : "s"}</span>
        <Button size="sm" className="h-11 gap-2 sm:ml-auto" disabled={count === 0 || running} onClick={onEdit}>
          <Pencil className="h-4 w-4" /> Alterar em massa
        </Button>
      </>}
    </div>
  );
}