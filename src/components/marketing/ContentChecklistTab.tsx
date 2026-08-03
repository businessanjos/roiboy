import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileCheck2, Plus, Trash2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { notifyChecklistBlockers } from '@/lib/contentChecklistNotifications';

import {
  CHECKLIST_FORMATS,
  CHECKLIST_STAGES,
  DECISIONS,
  OBJETIVO_OPTIONS,
  PILAR_OPTIONS,
  visibleSections,
} from './contentChecklistSchema';

type Answers = Record<string, boolean>;

interface ChecklistRow {
  id: string;
  post_title: string;
  responsible: string | null;
  responsible_user_id: string | null;
  post_date: string | null;
  format: string | null;
  pilar: string | null;
  objetivo: string | null;
  ideia_central: string | null;
  answers: Answers;
  blockers: string[];
  decision: string;
  created_at: string;
}

interface AccountUser {
  id: string;
  name: string;
}

const emptyDraft = {
  post_title: '',
  responsible_user_id: '',
  post_date: new Date().toISOString().slice(0, 10),
  format: '' as string,
  pilar: '',
  objetivo: '',
  ideia_central: '',
  answers: {} as Answers,
  decision: 'pending',
};

export function ContentChecklistTab() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Bloqueios já notificados nesta sessão do rascunho — evita spam de notificação. */
  const [notifiedBlockers, setNotifiedBlockers] = useState<string[]>([]);

  const { data: history = [] } = useQuery({
    queryKey: ['content-checklists', currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async (): Promise<ChecklistRow[]> => {
      const { data, error } = await (supabase as any)
        .from('content_approval_checklists')
        .select('*')
        .eq('account_id', currentUser!.account_id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ChecklistRow[];
    },
  });

  const { data: accountUsers = [] } = useQuery({
    queryKey: ['content-checklist-users', currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async (): Promise<AccountUser[]> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('account_id', currentUser!.account_id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as AccountUser[];
    },
  });

  const responsibleName =
    accountUsers.find((u) => u.id === draft.responsible_user_id)?.name ?? null;

  const setAnswer = (id: string, value: boolean) =>
    setDraft((d) => ({ ...d, answers: { ...d.answers, [id]: value } }));

  const { positiveTotal, positiveChecked, blockers } = useMemo(() => {
    let total = 0;
    let checked = 0;
    const blocks: string[] = [];
    for (const stage of CHECKLIST_STAGES) {
      for (const section of visibleSections(stage, draft.format)) {
        for (const item of section.items) {
          if (item.negative) {
            if (draft.answers[item.id]) blocks.push(item.label);
          } else {
            total += 1;
            if (draft.answers[item.id]) checked += 1;
          }
        }
      }
    }
    return { positiveTotal: total, positiveChecked: checked, blockers: blocks };
  }, [draft.answers, draft.format]);

  const progress = positiveTotal ? Math.round((positiveChecked / positiveTotal) * 100) : 0;
  const canApprove = blockers.length === 0 && progress === 100 && !!draft.post_title.trim();

  const newBlockers = blockers.filter((b) => !notifiedBlockers.includes(b));

  const saveMutation = useMutation({
    mutationFn: async (decision: string) => {
      if (!currentUser?.account_id) throw new Error('Sem conta ativa');
      if (!draft.post_title.trim()) throw new Error('Informe o post/pauta');
      const shouldNotify = newBlockers.length > 0;
      const payload = {
        account_id: currentUser.account_id,
        created_by: currentUser.id,
        post_title: draft.post_title.trim(),
        responsible: responsibleName,
        responsible_user_id: draft.responsible_user_id || null,
        post_date: draft.post_date || null,
        format: draft.format || null,
        pilar: draft.pilar || null,
        objetivo: draft.objetivo || null,
        ideia_central: draft.ideia_central || null,
        answers: draft.answers,
        blockers,
        decision,
        ...(shouldNotify ? { last_blocker_notified_at: new Date().toISOString() } : {}),
      };

      let checklistId = editingId;
      if (editingId) {
        const { error } = await (supabase as any)
          .from('content_approval_checklists')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from('content_approval_checklists')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        checklistId = data?.id ?? null;
      }

      let notified = 0;
      if (shouldNotify) {
        notified = await notifyChecklistBlockers({
          accountId: currentUser.account_id,
          actor: { id: currentUser.id, name: currentUser.name },
          responsibleUserId: draft.responsible_user_id || null,
          checklistId,
          postTitle: draft.post_title.trim(),
          blockers,
          decision,
        });
      }
      return { notified };
    },
    onSuccess: ({ notified }, decision) => {
      queryClient.invalidateQueries({ queryKey: ['content-checklists'] });
      toast.success(
        decision === 'approved' ? 'Checklist aprovado e salvo' : 'Checklist salvo',
      );
      if (notified > 0) {
        toast.warning(
          responsibleName
            ? `${responsibleName} foi notificado sobre a reprovação automática`
            : 'Notificação de reprovação automática enviada',
        );
      }
      setDraft({ ...emptyDraft, answers: {} });
      setNotifiedBlockers([]);
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar checklist'),
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('content_approval_checklists')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-checklists'] });
      toast.success('Checklist removido');
    },
  });

  const loadRow = (row: ChecklistRow) => {
    setEditingId(row.id);
    setNotifiedBlockers(row.blockers ?? []);
    setDraft({
      post_title: row.post_title ?? '',
      responsible_user_id: row.responsible_user_id ?? '',
      post_date: row.post_date ?? '',
      format: row.format ?? '',
      pilar: row.pilar ?? '',
      objetivo: row.objetivo ?? '',
      ideia_central: row.ideia_central ?? '',
      answers: (row.answers ?? {}) as Answers,
      decision: row.decision,
    });
  };


  const decisionBadge = (decision: string) => {
    const map: Record<string, { label: string; className: string }> = {
      approved: { label: 'Aprovado', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
      adjust: { label: 'Ajustar', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
      rejected: { label: 'Reprovado', className: 'bg-destructive/15 text-destructive border-destructive/30' },
      pending: { label: 'Em preenchimento', className: 'bg-muted text-muted-foreground border-border' },
    };
    const cfg = map[decision] ?? map.pending;
    return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {/* Cabeçalho do checklist */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck2 className="h-4 w-4" />
              {editingId ? 'Editando checklist' : 'Novo checklist'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Post / pauta</Label>
                <Input
                  value={draft.post_title}
                  onChange={(e) => setDraft((d) => ({ ...d, post_title: e.target.value }))}
                  placeholder="Ex.: Carrossel — o erro de precificação das clínicas"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select
                  value={draft.responsible_user_id}
                  onValueChange={(v) => setDraft((d) => ({ ...d, responsible_user_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Quem será notificado" /></SelectTrigger>
                  <SelectContent>
                    {accountUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={draft.post_date}
                  onChange={(e) => setDraft((d) => ({ ...d, post_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Formato</Label>
                <Select value={draft.format} onValueChange={(v) => setDraft((d) => ({ ...d, format: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CHECKLIST_FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pilar escolhido</Label>
                <Select value={draft.pilar} onValueChange={(v) => setDraft((d) => ({ ...d, pilar: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PILAR_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Objetivo escolhido</Label>
                <Select value={draft.objetivo} onValueChange={(v) => setDraft((d) => ({ ...d, objetivo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {OBJETIVO_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Ideia central</Label>
              <Textarea
                rows={2}
                value={draft.ideia_central}
                onChange={(e) => setDraft((d) => ({ ...d, ideia_central: e.target.value }))}
                placeholder="Em uma frase, qual é a ideia central do post?"
              />
            </div>
          </CardContent>
        </Card>

        {/* Etapas */}
        {CHECKLIST_STAGES.map((stage) => {
          const sections = visibleSections(stage, draft.format);
          if (!sections.length) return null;
          return (
            <Card key={stage.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{stage.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{stage.subtitle}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {sections.map((section, idx) => (
                  <div key={section.id} className="space-y-2">
                    {idx > 0 && <Separator className="mb-4" />}
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {section.items.map((item) => {
                        const checked = !!draft.answers[item.id];
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              'flex items-start gap-2.5 rounded-md border p-2.5 text-sm transition-colors cursor-pointer',
                              checked && item.negative && 'border-destructive/40 bg-destructive/10',
                              checked && !item.negative && 'border-primary/40 bg-primary/5',
                              !checked && 'border-border hover:bg-muted/50',
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => setAnswer(item.id, v === true)}
                              className="mt-0.5"
                            />
                            <span className={cn(item.negative && 'text-destructive')}>
                              {item.negative ? '✕ ' : ''}
                              {item.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {section.note && (
                      <p className="text-xs italic text-muted-foreground">{section.note}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Painel lateral */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Decisão final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Itens confirmados</span>
                <span className="font-medium">{positiveChecked}/{positiveTotal}</span>
              </div>
              <Progress value={progress} />
            </div>

            {blockers.length > 0 ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-destructive">
                  <XCircle className="h-4 w-4" /> Reprovação automática
                </p>
                <ul className="mt-1.5 list-disc pl-5 text-xs text-destructive">
                  {blockers.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            ) : progress === 100 ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Pronto para enviar à Bruna
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Regra: se houver dúvida, não sobe. Complete todos os itens antes de aprovar.
              </div>
            )}

            <div className="grid gap-2">
              <Button
                disabled={!canApprove || saveMutation.isPending}
                onClick={() => saveMutation.mutate('approved')}
              >
                Aprovado para enviar à Bruna
              </Button>
              <Button
                variant="outline"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate('adjust')}
              >
                Voltar para ajuste
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate('rejected')}
              >
                Reprovado
              </Button>
              <Button
                variant="ghost"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate('pending')}
              >
                Salvar rascunho
              </Button>
              {editingId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditingId(null); setDraft({ ...emptyDraft, answers: {} }); }}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Novo checklist
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2 p-4 pt-0">
                {history.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum checklist registrado ainda.</p>
                )}
                {history.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-2 rounded-md border p-2.5"
                  >
                    <button className="min-w-0 flex-1 text-left" onClick={() => loadRow(row)}>
                      <p className="truncate text-sm font-medium">{row.post_title || 'Sem título'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[row.format, row.responsible, row.post_date].filter(Boolean).join(' · ')}
                      </p>
                      <div className="mt-1">{decisionBadge(row.decision)}</div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(row.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
