import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Block, Step } from "@/lib/csProcesses";

const KIND_LABEL: Record<Block["kind"], string> = { message: "Mensagem", task: "Tarefa", alert: "Aviso", meta: "Detalhe", note: "Informação" };

/** Edição de uma etapa: título e cada mensagem, tarefa ou aviso separadamente. */
export function StepEditDialog({ step, original, open, onOpenChange, onSave, saving }: {
  step: Step | null; original?: Step | null; open: boolean; onOpenChange: (o: boolean) => void; onSave: (s: Step) => void; saving?: boolean;
}) {
  const [draft, setDraft] = useState<Step | null>(null);
  useEffect(() => { if (open && step) setDraft(structuredClone(step)); }, [open, step]);
  if (!draft) return null;
  const setBlock = (i: number, b: Block) => setDraft({ ...draft, blocks: draft.blocks.map((x, j) => (j === i ? b : x)) });
  const move = (i: number, d: number) => { const bl = [...draft.blocks]; const [x] = bl.splice(i, 1); bl.splice(i + d, 0, x); setDraft({ ...draft, blocks: bl }); };
  const add = (kind: "message" | "task" | "alert") => setDraft({ ...draft, blocks: [...draft.blocks, { kind, text: "" } as Block] });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Editar etapa</DialogTitle>
          <DialogDescription>A mudança vale para toda a equipe. Use {"{Nome}"} e outras variáveis entre chaves nas mensagens.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1">
            <Label>Título da etapa</Label>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          {draft.blocks.map((b, i) => (
            <div key={i} className="space-y-1.5 rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">{KIND_LABEL[b.kind]}{b.kind === "meta" ? ` · ${b.label}` : ""}</span>
                <div className="flex gap-0.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === draft.blocks.length - 1} onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDraft({ ...draft, blocks: draft.blocks.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {b.kind === "message"
                ? <Textarea value={b.text} onChange={(e) => setBlock(i, { ...b, text: e.target.value })} className="min-h-[120px]" />
                : <Textarea value={b.text} onChange={(e) => setBlock(i, { ...b, text: e.target.value.replace(/\n/g, " ") })} className="min-h-[44px]" rows={2} />}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => add("message")}><Plus className="h-3.5 w-3.5" />Mensagem</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => add("task")}><Plus className="h-3.5 w-3.5" />Tarefa</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => add("alert")}><Plus className="h-3.5 w-3.5" />Aviso</Button>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" disabled={!original} onClick={() => original && setDraft(structuredClone(original))}>Voltar ao texto original</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={saving} onClick={() => onSave({ ...draft, blocks: draft.blocks.filter((b) => b.text.trim() || b.kind === "meta") })}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
