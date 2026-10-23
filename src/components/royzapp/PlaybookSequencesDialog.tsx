import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Send, Trash2, ListOrdered, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { usePlaybook, PlaybookItem } from "@/hooks/usePlaybook";
import { PlaybookItemForm } from "@/components/sales/PlaybookItemForm";
import { PlaybookItemSelect } from "@/components/royzapp/PlaybookItemSelect";
import { PlaybookSequencePreview } from "@/components/royzapp/PlaybookSequencePreview";
import { ZappSequenceHistoryList } from "@/components/royzapp/ZappSequenceHistoryList";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  usePlaybookSequences, PlaybookSequence, SequenceStep, SEQUENCE_MAX_STEPS,
  SEQUENCE_MIN_DELAY, SEQUENCE_MAX_DELAY, clampDelay, startSequenceRun, normalizeSequenceSteps,
} from "@/hooks/usePlaybookSequences";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sectorId?: string | null;
  conversationId?: string | null;
  variables?: Record<string, string>;
  buildText?: (item: PlaybookItem, processedText?: string) => string;
  signText?: (text: string) => string;
}

type Draft = { id?: string; name: string; visibility: "personal" | "sector"; steps: SequenceStep[] };

export function PlaybookSequencesDialog({ open, onOpenChange, sectorId, conversationId, variables = {}, buildText, signText }: Props) {
  const { items, folders, replaceVariables } = usePlaybook({ sectorId });
  const { sequences, isLoading, save, isSaving, remove } = usePlaybookSequences(sectorId);
  const { currentUser } = useCurrentUser();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "history">("list");
  const pendingStepRef = useRef<number | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const filtered = sequences.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const newDraft = () => setDraft({ name: "", visibility: "sector", steps: [{ playbook_item_id: "", delay_seconds: 0 }] });
  const editDraft = (s: PlaybookSequence, copy = false) =>
    setDraft({ id: copy ? undefined : s.id, name: copy ? `${s.name} (cópia)` : s.name, visibility: s.visibility, steps: normalizeSequenceSteps(s.steps.map((st) => ({ ...st }))) });

  const updateStep = (i: number, patch: Partial<SequenceStep>) =>
    setDraft((d) => d && { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const moveStep = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const steps = [...d.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps: normalizeSequenceSteps(steps) };
    });

  const handleSave = async () => {
    if (!draft) return;
    try { await save(draft); setDraft(null); } catch { /* toast já exibido */ }
  };

  const openCreateForm = (stepIndex: number | null) => {
    pendingStepRef.current = stepIndex;
    setFormOpen(true);
  };

  const handleFormClose = (createdItem?: { id: string; name: string } | null) => {
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
        steps: s.steps.flatMap((st) => {
          const item = itemById.get(st.playbook_item_id);
          if (!item) return [];
          const processed = item.text_content ? replaceVariables(item.text_content, variables) : undefined;
          const text = buildText ? buildText(item, processed) : (processed || "");
          const caption = item.media_caption ? replaceVariables(item.media_caption, variables) : "";
          return [{
            name: item.name, content_type: item.content_type, text_content: (signText ? signText(text) : text) || null,
            media_url: item.media_url, media_filename: item.media_filename,
            media_caption: (signText ? signText(caption) : caption) || null,
            delay_seconds: st.delay_seconds,
          }];
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
      <DialogContent className={`grid-cols-1 overflow-y-auto max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none sm:max-h-[92vh] ${draft ? "max-w-6xl" : "max-w-2xl"}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5" /> Sequências do Playbook</DialogTitle>
        </DialogHeader>

        {draft ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
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
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2.5">
                  <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  <PlaybookItemSelect
                    items={items}
                    value={st.playbook_item_id}
                    onChange={(id) => updateStep(i, { playbook_item_id: id })}
                    onCreate={() => openCreateForm(i)}
                    ariaLabel={`Mensagem ${i + 1} da sequência`}
                    className="min-w-0 flex-1 basis-56"
                  />
                  <div className="flex w-[8.5rem] shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground">
                    {i === 0 ? (
                      <span className="inline-flex h-9 w-full items-center justify-center rounded-md border border-dashed text-xs font-medium">Instantâneo</span>
                    ) : (
                      <>
                        <span>aguardar</span>
                        <Input
                          type="number" min={SEQUENCE_MIN_DELAY} max={SEQUENCE_MAX_DELAY} className="h-9 w-16 px-2"
                          aria-label={`Segundos antes da mensagem ${i + 1}`}
                          value={st.delay_seconds}
                          onChange={(e) => updateStep(i, { delay_seconds: Number(e.target.value) })}
                          onBlur={(e) => updateStep(i, { delay_seconds: clampDelay(Number(e.target.value)) })}
                        />
                        <span>s</span>
                      </>
                    )}
                  </div>
                  <div className="flex">
                    <Button variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onClick={() => moveStep(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Descer" disabled={i === draft.steps.length - 1} onClick={() => moveStep(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Remover" className="text-destructive" onClick={() => setDraft({ ...draft, steps: normalizeSequenceSteps(draft.steps.filter((_, j) => j !== i)) })}><Trash2 className="h-4 w-4" /></Button>
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
              <p className="text-xs text-muted-foreground">Até {SEQUENCE_MAX_STEPS} mensagens, A 1ª sai no clique; cada seguinte aguarda de {SEQUENCE_MIN_DELAY} a {SEQUENCE_MAX_DELAY} segundos após o envio da anterior.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar</Button>
            </div>
          </div>
          <aside className="self-start lg:sticky lg:top-0">
            <PlaybookSequencePreview steps={draft.steps} items={items} variables={variables} replaceVariables={replaceVariables} signText={signText} />
          </aside>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant={mode === "list" ? "default" : "outline"} size="sm" onClick={() => setMode("list")}>
                <ListOrdered className="mr-1 h-4 w-4" /> Sequências
              </Button>
              <Button variant={mode === "history" ? "default" : "outline"} size="sm" onClick={() => setMode("history")}>
                <History className="mr-1 h-4 w-4" /> Histórico
              </Button>
            </div>
            {mode === "history" ? (
              <ZappSequenceHistoryList open />
            ) : (
              <>
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
              </>
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
