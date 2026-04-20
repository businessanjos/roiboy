import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X, Calendar as CalendarIcon } from "lucide-react";
import { useMarketingIdeas, type MarketingIdea, type IdeaStatus, type IdeaFormat, type IdeaPlatform, type IdeaPriority, type AssigneeRole } from "@/hooks/useMarketingIdeas";
import { useTeamUsers } from "@/hooks/useTeamUsers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: MarketingIdea | null;
  defaultStatus?: IdeaStatus;
}

const STATUS_OPTS: { value: IdeaStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "approved", label: "Aprovado" },
  { value: "in_production", label: "Em produção" },
  { value: "scheduled", label: "Agendado" },
  { value: "posted", label: "Postado" },
  { value: "archived", label: "Arquivado" },
];
const FORMAT_OPTS: { value: IdeaFormat; label: string }[] = [
  { value: "reel", label: "Reel" },
  { value: "post", label: "Post" },
  { value: "story", label: "Story" },
  { value: "carousel", label: "Carrossel" },
  { value: "youtube_short", label: "YouTube Short" },
  { value: "youtube_long", label: "YouTube longo" },
  { value: "tiktok", label: "TikTok" },
  { value: "live", label: "Live" },
  { value: "other", label: "Outro" },
];
const PLATFORM_OPTS: { value: IdeaPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "multi", label: "Multiplataforma" },
  { value: "other", label: "Outro" },
];
const PRIORITY_OPTS: { value: IdeaPriority; label: string }[] = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];
const ROLE_OPTS: { value: AssigneeRole; label: string }[] = [
  { value: "designer", label: "Designer" },
  { value: "social_media", label: "Social Media" },
  { value: "videomaker", label: "Videomaker" },
  { value: "copywriter", label: "Copywriter" },
  { value: "strategist", label: "Estrategista" },
];

export function IdeaDialog({ open, onOpenChange, idea, defaultStatus }: Props) {
  const { createIdea, updateIdea, deleteIdea, setAssignees, upsertChecklistItem, deleteChecklistItem } = useMarketingIdeas();
  const { data: teamUsers = [] } = useTeamUsers();

  const [form, setForm] = useState<Partial<MarketingIdea>>(() => ({
    title: idea?.title || "",
    hook: idea?.hook || "",
    description: idea?.description || "",
    format: idea?.format || "reel",
    platform: idea?.platform || "instagram",
    status: idea?.status || defaultStatus || "draft",
    priority: idea?.priority || "medium",
    planned_date: idea?.planned_date || null,
    scheduled_for: idea?.scheduled_for || null,
    publish_platform: idea?.publish_platform || null,
    caption: idea?.caption || "",
    tags: idea?.tags || [],
  }));
  const [tagInput, setTagInput] = useState("");
  const [newAssignee, setNewAssignee] = useState<{ user_id?: string; role: AssigneeRole }>({ role: "designer" });
  const [newChecklist, setNewChecklist] = useState("");

  const isEdit = !!idea;

  const handleSave = async () => {
    if (isEdit) {
      await updateIdea.mutateAsync({ id: idea.id, ...form });
      onOpenChange(false);
    } else {
      const created = await createIdea.mutateAsync(form);
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (!idea) return;
    if (confirm("Excluir esta ideia?")) {
      await deleteIdea.mutateAsync(idea.id);
      onOpenChange(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    setForm(f => ({ ...f, tags: [...(f.tags || []), t] }));
    setTagInput("");
  };

  const removeTag = (t: string) => setForm(f => ({ ...f, tags: (f.tags || []).filter(x => x !== t) }));

  const addAssignee = async () => {
    if (!idea || !newAssignee.user_id) return;
    const current = (idea.assignees || []).map(a => ({ user_id: a.user_id, role: a.role }));
    await setAssignees.mutateAsync({
      ideaId: idea.id,
      assignees: [...current, { user_id: newAssignee.user_id, role: newAssignee.role }],
    });
    setNewAssignee({ role: "designer" });
  };

  const removeAssignee = async (userId: string, role: AssigneeRole) => {
    if (!idea) return;
    const next = (idea.assignees || [])
      .filter(a => !(a.user_id === userId && a.role === role))
      .map(a => ({ user_id: a.user_id, role: a.role }));
    await setAssignees.mutateAsync({ ideaId: idea.id, assignees: next });
  };

  const addChecklist = async () => {
    if (!idea || !newChecklist.trim()) return;
    await upsertChecklistItem.mutateAsync({
      idea_id: idea.id,
      title: newChecklist.trim(),
      position: (idea.checklist?.length || 0),
    });
    setNewChecklist("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar ideia" : "Nova ideia"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={form.title || ""}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: 3 erros que custam clientes"
            />
          </div>

          <div>
            <Label>Hook (gancho de abertura)</Label>
            <Textarea
              value={form.hook || ""}
              onChange={e => setForm(f => ({ ...f, hook: e.target.value }))}
              placeholder="A primeira frase do vídeo/post que prende atenção"
              rows={2}
            />
          </div>

          <div>
            <Label>Descrição / roteiro</Label>
            <Textarea
              value={form.description || ""}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Roteiro detalhado, pontos a abordar..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Formato</Label>
              <Select value={form.format} onValueChange={(v: IdeaFormat) => setForm(f => ({ ...f, format: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plataforma</Label>
              <Select value={form.platform} onValueChange={(v: IdeaPlatform) => setForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: IdeaStatus) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v: IdeaPriority) => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Data planejada</Label>
              <Input
                type="date"
                value={form.planned_date || ""}
                onChange={e => setForm(f => ({ ...f, planned_date: e.target.value || null }))}
              />
            </div>
            <div>
              <Label>📅 Agendar publicação</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_for ? new Date(form.scheduled_for).toISOString().slice(0, 16) : ""}
                onChange={e => setForm(f => ({
                  ...f,
                  scheduled_for: e.target.value ? new Date(e.target.value).toISOString() : null,
                  status: e.target.value ? "scheduled" : f.status,
                }))}
              />
            </div>
            <div>
              <Label>Plataforma de publicação</Label>
              <Select
                value={form.publish_platform || form.platform || ""}
                onValueChange={(v) => setForm(f => ({ ...f, publish_platform: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Onde publicar" /></SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); }}}
                placeholder="Adicionar tag e Enter"
              />
              <Button type="button" variant="outline" onClick={addTag}>Add</Button>
            </div>
            {(form.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.tags?.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    #{t}
                    <button onClick={() => removeTag(t)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {isEdit && (
            <>
              {/* Assignees */}
              <div className="border-t pt-4">
                <Label className="mb-2 block">Responsáveis</Label>
                <div className="space-y-2 mb-3">
                  {idea.assignees?.map(a => (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                      <Avatar className="h-7 w-7">
                        {a.user?.avatar_url && <AvatarImage src={a.user.avatar_url} />}
                        <AvatarFallback>{a.user?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1">{a.user?.name}</span>
                      <Badge variant="outline">{ROLE_OPTS.find(r => r.value === a.role)?.label}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => removeAssignee(a.user_id, a.role)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select value={newAssignee.user_id} onValueChange={v => setNewAssignee(s => ({ ...s, user_id: v }))}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar pessoa" /></SelectTrigger>
                    <SelectContent>
                      {teamUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newAssignee.role} onValueChange={(v: AssigneeRole) => setNewAssignee(s => ({ ...s, role: v }))}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={addAssignee} size="icon"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              {/* Checklist */}
              <div className="border-t pt-4">
                <Label className="mb-2 block">Checklist de produção</Label>
                <div className="space-y-1 mb-3">
                  {idea.checklist?.sort((a, b) => a.position - b.position).map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group">
                      <Checkbox
                        checked={item.is_completed}
                        onCheckedChange={(checked) => upsertChecklistItem.mutate({
                          id: item.id,
                          idea_id: idea.id,
                          title: item.title,
                          is_completed: !!checked,
                          position: item.position,
                        })}
                      />
                      <span className={`text-sm flex-1 ${item.is_completed ? "line-through text-muted-foreground" : ""}`}>
                        {item.title}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={() => deleteChecklistItem.mutate(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newChecklist}
                    onChange={e => setNewChecklist(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChecklist(); }}}
                    placeholder="Ex: Gravar bruto, editar, revisar..."
                  />
                  <Button onClick={addChecklist} size="icon"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label>Legenda final</Label>
                <Textarea
                  value={form.caption || ""}
                  onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                  placeholder="Cole aqui a legenda final (você pode gerar com IA na aba Copy IA)"
                  rows={4}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>{isEdit ? "Salvar" : "Criar ideia"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
