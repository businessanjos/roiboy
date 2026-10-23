import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Send, Trash2, ListOrdered, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePlaybook, PlaybookItem } from "@/hooks/usePlaybook";
import { PlaybookItemForm } from "@/components/sales/PlaybookItemForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  usePlaybookSequences, PlaybookSequence, SequenceStep, SEQUENCE_MAX_STEPS,
  SEQUENCE_MIN_DELAY, SEQUENCE_MAX_DELAY, clampDelay, startSequenceRun,
} from "@/hooks/usePlaybookSequences";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sectorId?: string | null;
  conversationId?: string | null;
  variables?: Record<string, string>;
  buildText?: (item: PlaybookItem, processedText?: string) => string;
}

type Draft = { id?: string; name: string; visibility: "personal" | "sector"; steps: SequenceStep[] };

export function PlaybookSequencesDialog({ open, onOpenChange, sectorId, conversationId, variables = {}, buildText }: Props) {
  const { items, folders, replaceVariables } = usePlaybook({ sectorId });
  const { sequences, isLoading, save, isSaving, remove } = usePlaybookSequences(sectorId);
  const { currentUser } = useCurrentUser();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const pendingStepRef = useRef<number | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const filtered = sequences.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const newDraft = () => setDraft({ name: "", visibility: "sector", steps: [{ playbook_item_id: "", delay_seconds: 5 }] });
  const editDraft = (s: PlaybookSequence, copy = false) =>
    setDraft({ id: copy ? undefined : s.id, name: copy ? `${s.name} (cópia)` : s.name, visibility: s.visibility, steps: s.steps.map((st) => ({ ...st })) });

  const updateStep = (i: number, patch: Partial<SequenceStep>) =>
    setDraft((d) => d && { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const moveStep = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const steps = [...d.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });

  const handleSave = async () => {
    if (!draft) return;
    try { await save(draft); setDraft(null); } catch { /* toast já exibido */ }
  };

  const openCreateForm = (stepIndex: number | null) => {
    pendingStepRef.current = stepIndex;
    setFormOpen(true);
  };

  const handleFormClose = (createdItem?: PlaybookItem | null) => {
    setFormOpen(false);
    const created = createdItem || null;
    const index = pendingStepRef.current;
    pendingStepRef.current = null;
    if (!created) return;
    setDraft((d) => {
      if (!d) return d;
      if (index != null) {
        return { ...d, steps: d.steps.map((s, j) => (j === index ? { ...s, playbook_item_id: created.id } : s)) };
      }
      if (d.steps.length >= SEQUENCE_MAX_STEPS) return d;
      return { ...d, steps: [...d.steps, { playbook_item_id: created.id, delay_seconds: 5 }] };
    });
    toast.success(`"${created.name}" adicionada à sequência`);
  };

  const handleStart = async (s: PlaybookSequence) => {
    if (!conversationId || !currentUser?.id || !currentUser.account_id) return;
    const steps = s.steps.map((st) => itemById.get(st.playbook_item_id)).filter(Boolean) as PlaybookItem[];
    if (steps.length === 0) { toast.error("Essa sequência não tem mensagens disponíveis"); return; }
    setStarting(s.id);
    try {
      await startSequenceRun({
        conversationId,
        sequence: { id: s.id, name: s.name },
        steps: s.steps.filter((st) => itemById.has(st.playbook_item_id)).map((st) => {
          const item = itemById.get(st.playbook_item_id)!;
          const processed = item.text_content ? replaceVariables(item.text_content, variables) : undefined;
          const text = buildText ? buildText(item, processed) : (processed || "");
          return {
            name: item.name, content_type: item.content_type, text_content: text || null,
            media_url: item.media_url, media_filename: item.media_filename,
            media_caption: item.media_caption ? replaceVariables(item.media_caption, variables) : null,
            delay_seconds: st.delay_seconds,
          };
        }),
      }, { id: currentUser.id, name: currentUser.name, account_id: currentUser.account_id });
      toast.success(`Sequência "${s.name}" iniciada. Pode ir para outra conversa; se você escrever nesta, ela para.`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar a sequência");
    } finally {
      setStarting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setDraft(null); onOpenChange(v); }}>
      <DialogContent className="grid-cols-1 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5" /> Sequências do Playbook</DialogTitle>
        </DialogHeader>

        {draft ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-1.5">
                <Label htmlFor="seq-name">Nome</Label>
                <Input id="seq-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Follow Preocupado" />
              </div>
              <div className="space-y-1.5">
                <Label>Quem pode usar</Label>
                <Select value={draft.visibility} onValueChange={(v) => setDraft({ ...draft, visibility: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sector">Todo o setor</SelectItem>
                    <SelectItem value="personal">Só eu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mensagens, na ordem de envio</Label>
              {draft.steps.map((st, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                  <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <Select
                    value={st.playbook_item_id || undefined}
                    onValueChange={(v) => {
                      if (v === "__create__") { openCreateForm(i); return; }
                      updateStep(i, { playbook_item_id: v });
                    }}
                  >
                    <SelectTrigger className="min-w-0 flex-1 basis-48"><SelectValue placeholder="Selecione uma mensagem" /></SelectTrigger>
                    <SelectContent>
                      {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                      <div className="my-1 border-t" role="separator" />
                      <SelectItem value="__create__"><span className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nova mensagem…</span></SelectItem>
                    </SelectContent>
                  </Select>
                  {i < draft.steps.length - 1 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>esperar</span>
                      <Input
                        type="number" min={SEQUENCE_MIN_DELAY} max={SEQUENCE_MAX_DELAY} className="h-9 w-20"
                        aria-label={`Segundos após a mensagem ${i + 1}`}
                        value={st.delay_seconds}
                        onChange={(e) => updateStep(i, { delay_seconds: Number(e.target.value) })}
                        onBlur={(e) => updateStep(i, { delay_seconds: clampDelay(Number(e.target.value)) })}
                      />
                      <span>s</span>
                    </div>
                  )}
                  <div className="flex">
                    <Button variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onClick={() => moveStep(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Descer" disabled={i === draft.steps.length - 1} onClick={() => moveStep(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Remover" className="text-destructive" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={draft.steps.length >= SEQUENCE_MAX_STEPS}
                  onClick={() => setDraft({ ...draft, steps: [...draft.steps, { playbook_item_id: "", delay_seconds: 5 }] })}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar mensagem
                </Button>
                <Button variant="outline" size="sm" onClick={() => openCreateForm(null)}>
                  <Plus className="mr-1 h-4 w-4" /> Nova mensagem
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Até {SEQUENCE_MAX_STEPS} mensagens, com espera de {SEQUENCE_MIN_DELAY} a {SEQUENCE_MAX_DELAY} segundos entre elas.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Buscar sequência" aria-label="Buscar sequência" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button onClick={newDraft}><Plus className="mr-1 h-4 w-4" /> Nova</Button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma sequência salva ainda. Crie a primeira com "Nova".</p>
            ) : (
              filtered.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.steps.length} mensagens · {s.visibility === "personal" ? "só eu" : "todo o setor"}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => editDraft(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Duplicar" onClick={() => editDraft(s, true)}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" className="text-destructive"
                    onClick={() => { if (window.confirm(`Excluir a sequência "${s.name}"?`)) remove(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                  {conversationId && (
                    <Button size="sm" onClick={() => handleStart(s)} disabled={!!starting}>
                      {starting === s.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Enviar
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Atalho: criar nova mensagem do Playbook sem sair daqui */}
        <PlaybookItemForm
          open={formOpen}
          onOpenChange={(v) => { if (!v) handleFormClose(null); }}
          editingItem={null}
          folders={folders}
          sectorId={sectorId}
          onClose={(created) => handleFormClose(created)}
        />
      </DialogContent>
    </Dialog>
  );
}
