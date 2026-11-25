import { useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Flag, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MarketingTask } from "@/hooks/useMarketingTasks";
import type { MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";
import type { TaskBulkAction } from "@/lib/marketing/taskChanges";
import { TaskGroupSelection, type TaskSelectionProps } from "./TaskSelection";

interface Props extends TaskSelectionProps {
  tasks: MarketingTask[];
  columns: MarketingTaskColumn[];
  onApply: (action: TaskBulkAction) => Promise<void>;
  onCancel: () => void;
  progress?: { completed: number; total: number };
}

export function TaskBulkToolbar({ tasks, columns, onApply, onCancel, progress, ...selection }: Props) {
  const [confirmation, setConfirmation] = useState<{ action: TaskBulkAction; label: string } | null>(null);
  const count = tasks.filter((task) => selection.selectedTaskIds?.has(task.id)).length;
  const disabled = selection.selectionDisabled || count === 0;
  return <>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-y border-primary/20 bg-primary/5 px-3 py-2" aria-label="Ações das tarefas selecionadas">
      <TaskGroupSelection tasks={tasks} label="Selecionar todas as tarefas filtradas" {...selection} />
      <span className="mr-auto text-sm font-medium tabular-nums" role="status">{selection.selectionDisabled && progress?.total ? `${progress.completed} de ${progress.total}` : `${count} selecionada${count === 1 ? "" : "s"}`}</span>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={disabled} className="gap-2"><ArrowRight className="h-4 w-4" />Mover</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">{columns.map((column) => <DropdownMenuItem key={column.id} onSelect={() => setConfirmation({ action: { kind: "move", column }, label: `Mover para ${column.title}` })}>{column.title}</DropdownMenuItem>)}</DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" size="sm" disabled={disabled} className="gap-2" onClick={() => setConfirmation({ action: { kind: "complete" }, label: "Concluir tarefas" })}><CheckCircle2 className="h-4 w-4" />Concluir</Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={disabled} className="gap-2"><Flag className="h-4 w-4" />Mais ações</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="gap-2" onSelect={() => setConfirmation({ action: { kind: "reopen" }, label: "Reabrir tarefas" })}><Circle className="h-4 w-4" />Reabrir</DropdownMenuItem>
          {([ ["low", "Baixa"], ["medium", "Média"], ["high", "Alta"] ] as const).map(([priority, label]) => <DropdownMenuItem key={priority} className="gap-2" onSelect={() => setConfirmation({ action: { kind: "priority", priority }, label: `Prioridade ${label.toLocaleLowerCase("pt-BR")}` })}><Flag className="h-4 w-4" />Prioridade {label.toLocaleLowerCase("pt-BR")}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Cancelar seleção" disabled={selection.selectionDisabled} onClick={onCancel}><X className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Cancelar seleção</TooltipContent></Tooltip>
    </div>
    <AlertDialog open={!!confirmation} onOpenChange={(open) => { if (!open && !selection.selectionDisabled) setConfirmation(null); }}>
      <AlertDialogContent className="max-w-[min(28rem,calc(100vw-2rem))]">
        <AlertDialogHeader><AlertDialogTitle>{confirmation?.label}</AlertDialogTitle><AlertDialogDescription>{count} tarefa{count === 1 ? " será alterada" : "s serão alteradas"}. Você poderá desfazer esta alteração.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" disabled={selection.selectionDisabled} onClick={() => setConfirmation(null)}>Cancelar</Button>
          <Button disabled={disabled} className="gap-2" onClick={async () => { if (!confirmation) return; await onApply(confirmation.action); setConfirmation(null); }}>{selection.selectionDisabled && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}