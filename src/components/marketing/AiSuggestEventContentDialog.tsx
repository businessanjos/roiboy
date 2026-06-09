import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  useEventContentDeliverables,
  kindConfig,
  type DeliverableKind,
} from '@/hooks/useEventContentDeliverables';
import type { MarketingEvent } from '@/hooks/useMarketingEvents';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface Suggestion {
  kind: DeliverableKind;
  title: string;
  hook: string | null;
  big_idea: string | null;
  format: string | null;
  channel: string | null;
  persona_target: string | null;
  due_offset_days: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: MarketingEvent;
}

export function AiSuggestEventContentDialog({ open, onOpenChange, event }: Props) {
  const { currentUser } = useCurrentUser();
  const { create } = useEventContentDeliverables(event.id, event.scheduled_at?.slice(0, 10) ?? null);

  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    setSuggestions([]);
    setSelected({});
    try {
      const { data, error } = await supabase.functions.invoke('suggest-event-content', {
        body: {
          accountId: currentUser.account_id,
          event: {
            id: event.id,
            title: event.title,
            event_type: event.event_type,
            scheduled_at: event.scheduled_at,
            ends_at: event.ends_at,
            description: event.description,
            goals: event.goals,
            notes: event.notes,
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const list = ((data as any)?.deliverables || []) as Suggestion[];
      setSuggestions(list);
      const all: Record<number, boolean> = {};
      list.forEach((_, i) => { all[i] = true; });
      setSelected(all);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar sugestões');
    } finally {
      setLoading(false);
    }
  };

  const updateSuggestion = (idx: number, patch: Partial<Suggestion>) => {
    setSuggestions((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const handleConfirm = async () => {
    const chosen = suggestions.filter((_, i) => selected[i]);
    if (chosen.length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      for (let i = 0; i < chosen.length; i++) {
        const s = chosen[i];
        const description = [s.hook && `Hook: ${s.hook}`, s.big_idea && `Big idea: ${s.big_idea}`,
          s.format && `Formato: ${s.format}`, s.channel && `Canal: ${s.channel}`,
          s.persona_target && `Persona: ${s.persona_target}`]
          .filter(Boolean).join('\n');
        await create.mutateAsync({
          kind: s.kind,
          title: s.title,
          description: description || null,
          due_offset_days: s.due_offset_days,
          sort_order: i,
        });
      }
      toast.success(`${chosen.length} entregáveis criados`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Sugestões de IA para "{event.title}"
          </DialogTitle>
        </DialogHeader>

        {suggestions.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground text-center max-w-md">
              A IA vai gerar pautas (antes, durante e depois do evento) baseadas no tom de voz, persona e pilares da marca.
            </p>
            <Button onClick={generate} disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Gerar pautas</>
              )}
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-3">
                {suggestions.map((s, idx) => {
                  const cfg = kindConfig[s.kind];
                  const isOn = !!selected[idx];
                  return (
                    <div key={idx} className={`rounded-lg border p-3 space-y-2 ${isOn ? '' : 'opacity-50'}`}>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={isOn}
                          onCheckedChange={(v) => setSelected((p) => ({ ...p, [idx]: !!v }))}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs">{cfg.icon}</span>
                            <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                            {s.due_offset_days != null && (
                              <Badge variant="secondary" className="text-[10px]">
                                {s.due_offset_days === 0 ? 'D' : `D${s.due_offset_days > 0 ? '+' : ''}${s.due_offset_days}`}
                              </Badge>
                            )}
                            {s.channel && <Badge variant="outline" className="text-[10px]">{s.channel}</Badge>}
                          </div>
                          <Input
                            value={s.title}
                            onChange={(e) => updateSuggestion(idx, { title: e.target.value })}
                            className="h-8 text-sm font-medium"
                          />
                          {(s.hook || s.big_idea) && (
                            <Textarea
                              value={[s.hook && `Hook: ${s.hook}`, s.big_idea && `Big idea: ${s.big_idea}`].filter(Boolean).join('\n')}
                              onChange={(e) => {
                                // keep edits in big_idea for simplicity
                                updateSuggestion(idx, { big_idea: e.target.value, hook: null });
                              }}
                              className="text-xs"
                              rows={2}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="ghost" onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar novamente'}
              </Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando…</> : 'Adicionar selecionados'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
