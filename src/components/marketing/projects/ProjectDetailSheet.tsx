import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useMarketingProject,
  useProjectStakeholders,
  useProjectMilestones,
  useProjectDocuments,
  useProjectEvents,
  useProjectTasks,
  PROJECT_STATUS_META,
  MILESTONE_PHASE_META,
  MILESTONE_PHASE_ORDER,
  MILESTONE_PRIORITY_META,
  type MilestonePhase,
  type MilestonePriority,
  type ProjectMilestone,
} from "@/hooks/useMarketingProjects";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTeamUsers } from "@/hooks/useTeamUsers";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Users,
  Target,
  FileText,
  Calendar,
  ClipboardList,
  Plus,
  Trash2,
  Link2,
  Mail,
  Phone,
  ExternalLink,
  DollarSign,
  ArrowLeft,
  Sparkles,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  Flag,
  CalendarRange,
  Pencil,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProjectCopilotPanel } from "./ProjectCopilotPanel";
import { ProjectStakeholdersTab } from "./ProjectStakeholdersTab";

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data: project, isLoading } = useMarketingProject(projectId);

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="container mx-auto py-12 text-center space-y-3">
        <p className="text-muted-foreground">Projeto não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/marketing/projetos")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const status = PROJECT_STATUS_META[project.status];

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/marketing/projetos")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Projetos
      </Button>

      <div
        className="rounded-xl border p-6 space-y-3"
        style={{
          background: `linear-gradient(135deg, ${project.cover_color || "#8b5cf6"}18, transparent 70%)`,
          borderLeft: `4px solid ${project.cover_color || "#8b5cf6"}`,
        }}
      >
        <div className="flex items-start gap-4">
          {project.cover_emoji && <span className="text-5xl leading-none">{project.cover_emoji}</span>}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={status.color}>{status.label}</Badge>
              {project.target_date && (
                <Badge variant="outline">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(parseISO(project.target_date), "dd MMM yyyy", { locale: ptBR })}
                </Badge>
              )}
              {project.budget_planned && (
                <Badge variant="outline">
                  <DollarSign className="h-3 w-3 mr-1" />
                  R$ {project.budget_planned.toLocaleString("pt-BR")}
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-3 max-w-3xl">{project.description}</p>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="copilot" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="copilot" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
            <Sparkles className="h-4 w-4 mr-1.5" />Copilot IA
          </TabsTrigger>
          <TabsTrigger value="stakeholders"><Users className="h-4 w-4 mr-1.5" />Stakeholders</TabsTrigger>
          <TabsTrigger value="milestones"><Target className="h-4 w-4 mr-1.5" />Marcos</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="h-4 w-4 mr-1.5" />Docs</TabsTrigger>
          <TabsTrigger value="events"><Calendar className="h-4 w-4 mr-1.5" />Eventos</TabsTrigger>
          <TabsTrigger value="tasks"><ClipboardList className="h-4 w-4 mr-1.5" />Tarefas</TabsTrigger>
        </TabsList>

        <TabsContent value="copilot"><ProjectCopilotPanel projectId={project.id} /></TabsContent>
        <TabsContent value="stakeholders"><ProjectStakeholdersTab projectId={project.id} /></TabsContent>
        <TabsContent value="milestones"><MilestonesTab projectId={project.id} /></TabsContent>
        <TabsContent value="docs"><DocsTab projectId={project.id} /></TabsContent>
        <TabsContent value="events"><EventsTab projectId={project.id} /></TabsContent>
        <TabsContent value="tasks"><TasksTab projectId={project.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function MarketingProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <ProjectDetailView projectId={id} />;
}

// ===== Stakeholders =====
function StakeholdersTab({ projectId }: { projectId: string }) {
  const { items, add, remove } = useProjectStakeholders(projectId);
  const { data: users = [] } = useTeamUsers();
  const [show, setShow] = useState(false);
  const [type, setType] = useState<"internal" | "external">("internal");
  const [userId, setUserId] = useState<string>("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const reset = () => { setUserId(""); setName(""); setRole(""); setEmail(""); setPhone(""); setShow(false); };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} envolvidos</p>
        <Button size="sm" variant="outline" onClick={() => setShow(s => !s)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {show && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="flex gap-2">
            <Button size="sm" variant={type === "internal" ? "default" : "outline"} onClick={() => setType("internal")}>Interno</Button>
            <Button size="sm" variant={type === "external" ? "default" : "outline"} onClick={() => setType("external")}>Externo</Button>
          </div>
          {type === "internal" ? (
            <div>
              <Label>Pessoa</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Agência X, Editora Y" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
              </div>
            </>
          )}
          <div><Label>Papel *</Label><Input value={role} onChange={e => setRole(e.target.value)} placeholder="Ex.: Sponsor, Designer, Editor, Produtor..." /></div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={reset}>Cancelar</Button>
            <Button
              size="sm"
              disabled={!role.trim() || (type === "internal" ? !userId : !name.trim())}
              onClick={() => {
                add.mutate({
                  type,
                  role,
                  user_id: type === "internal" ? userId : null,
                  name: type === "external" ? name : null,
                  email: type === "external" ? email : null,
                  phone: type === "external" ? phone : null,
                }, { onSuccess: reset });
              }}
            >
              Adicionar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map(s => {
          const displayName = s.type === "internal"
            ? users.find(u => u.id === s.user_id)?.name || "Usuário"
            : s.name;
          return (
            <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg group hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{displayName}</span>
                  <Badge variant="outline" className="text-xs">{s.type === "internal" ? "Interno" : "Externo"}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{s.role}</div>
                {(s.email || s.phone) && (
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                    {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                  </div>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)} className="opacity-0 group-hover:opacity-100">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        })}
        {items.length === 0 && <EmptyState text="Nenhum stakeholder ainda." />}
      </div>
    </div>
  );
}

// ===== Milestones =====
function MilestonesTab({ projectId }: { projectId: string }) {
  const { items, add, update, toggle, remove } = useProjectMilestones(projectId);
  const [editing, setEditing] = useState<ProjectMilestone | null>(null);
  const [creatingPhase, setCreatingPhase] = useState<MilestonePhase | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = MILESTONE_PHASE_ORDER.map(phase => ({
    phase,
    meta: MILESTONE_PHASE_META[phase],
    items: items
      .filter(i => i.phase === phase)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }),
  }));

  const totalDone = items.filter(i => i.completed).length;
  const overallProgress = items.length ? Math.round((totalDone / items.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header: overall progress */}
      <div className="rounded-xl border bg-gradient-to-br from-muted/40 to-background p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Roadmap do projeto</h3>
            <p className="text-xs text-muted-foreground">
              {totalDone}/{items.length} marcos concluídos · {overallProgress}% do roadmap
            </p>
          </div>
          <div className="text-3xl font-bold tabular-nums bg-gradient-to-br from-purple-500 to-pink-500 bg-clip-text text-transparent">
            {overallProgress}%
          </div>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {grouped.map(({ phase, meta, items: phaseItems }, idx) => {
          const done = phaseItems.filter(i => i.completed).length;
          const pct = phaseItems.length ? Math.round((done / phaseItems.length) * 100) : 0;
          const isCollapsed = collapsed[phase] ?? false;
          const isEmpty = phaseItems.length === 0;

          return (
            <div key={phase} className="border rounded-xl overflow-hidden bg-background">
              {/* Phase header */}
              <div
                className={`relative px-4 py-3 bg-gradient-to-r ${meta.color} text-white cursor-pointer`}
                onClick={() => setCollapsed(c => ({ ...c, [phase]: !isCollapsed }))}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-bold text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{meta.label}</h4>
                      <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px] h-5">
                        {done}/{phaseItems.length}
                      </Badge>
                    </div>
                    <p className="text-xs text-white/85 line-clamp-1">{meta.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold tabular-nums">{pct}%</div>
                    <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {!isCollapsed && (
                <div className="p-3 space-y-2">
                  {phaseItems.map(m => (
                    <MilestoneRow
                      key={m.id}
                      milestone={m}
                      onToggle={(v) => toggle.mutate({ id: m.id, completed: v })}
                      onEdit={() => setEditing(m)}
                      onRemove={() => remove.mutate(m.id)}
                      onProgressChange={(p) => update.mutate({ id: m.id, progress: p })}
                    />
                  ))}
                  {isEmpty && (
                    <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                      Nenhum marco nessa fase ainda.
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-foreground"
                    onClick={() => setCreatingPhase(phase)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar marco em {meta.label}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit dialog (inline expanded form) */}
      {(creatingPhase || editing) && (
        <MilestoneFormDialog
          phase={creatingPhase || editing!.phase}
          milestone={editing}
          onCancel={() => { setCreatingPhase(null); setEditing(null); }}
          onSave={(data) => {
            if (editing) {
              update.mutate({ id: editing.id, ...data }, { onSuccess: () => setEditing(null) });
            } else {
              add.mutate({ ...data, phase: creatingPhase! }, { onSuccess: () => setCreatingPhase(null) });
            }
          }}
        />
      )}
    </div>
  );
}

function MilestoneRow({
  milestone, onToggle, onEdit, onRemove, onProgressChange,
}: {
  milestone: ProjectMilestone;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
  onProgressChange: (p: number) => void;
}) {
  const priority = MILESTONE_PRIORITY_META[milestone.priority];
  const isOverdue = !milestone.completed && milestone.due_date && parseISO(milestone.due_date) < new Date();
  const hasDates = milestone.start_date || milestone.due_date;

  return (
    <div className={`group border rounded-lg p-3 transition-colors ${milestone.completed ? "bg-muted/30" : "bg-background hover:bg-muted/20"}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={milestone.completed}
          onCheckedChange={(v) => onToggle(!!v)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-sm leading-tight ${milestone.completed ? "line-through text-muted-foreground" : ""}`}>
                {milestone.title}
              </div>
              {milestone.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{milestone.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>

          {/* Meta line */}
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <Badge variant="outline" className={`${priority.color} h-5 px-1.5`}>
              <Flag className="h-2.5 w-2.5 mr-1" /> {priority.label}
            </Badge>
            {milestone.owner && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <UserIcon className="h-3 w-3" /> {milestone.owner}
              </span>
            )}
            {hasDates && (
              <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                <CalendarRange className="h-3 w-3" />
                {milestone.start_date && format(parseISO(milestone.start_date), "dd MMM", { locale: ptBR })}
                {milestone.start_date && milestone.due_date && " → "}
                {milestone.due_date && format(parseISO(milestone.due_date), "dd MMM yyyy", { locale: ptBR })}
                {isOverdue && " · atrasado"}
              </span>
            )}
            {milestone.completed && milestone.completed_at && (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Concluído {format(parseISO(milestone.completed_at), "dd MMM", { locale: ptBR })}
              </span>
            )}
          </div>

          {/* Progress slider (only if not completed) */}
          {!milestone.completed && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={milestone.progress}
                onChange={(e) => onProgressChange(Number(e.target.value))}
                className="flex-1 h-1 accent-purple-500 cursor-pointer"
              />
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground w-9 text-right">{milestone.progress}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MilestoneFormDialog({
  phase, milestone, onCancel, onSave,
}: {
  phase: MilestonePhase;
  milestone: ProjectMilestone | null;
  onCancel: () => void;
  onSave: (data: Partial<ProjectMilestone>) => void;
}) {
  const [title, setTitle] = useState(milestone?.title || "");
  const [description, setDescription] = useState(milestone?.description || "");
  const [startDate, setStartDate] = useState(milestone?.start_date || "");
  const [dueDate, setDueDate] = useState(milestone?.due_date || "");
  const [owner, setOwner] = useState(milestone?.owner || "");
  const [priority, setPriority] = useState<MilestonePriority>(milestone?.priority || "medium");
  const [currentPhase, setCurrentPhase] = useState<MilestonePhase>(milestone?.phase || phase);

  const meta = MILESTONE_PHASE_META[currentPhase];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className={`px-5 py-3 bg-gradient-to-r ${meta.color} text-white`}>
          <div className="text-xs opacity-90">Fase</div>
          <div className="font-semibold">{meta.label}</div>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <Label className="text-xs">Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Aprovar identidade visual do lançamento" autoFocus />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalhe entregas, critérios de aceite, dependências..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Prazo</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fase</Label>
              <Select value={currentPhase} onValueChange={(v) => setCurrentPhase(v as MilestonePhase)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MILESTONE_PHASE_ORDER.map(p => (
                    <SelectItem key={p} value={p}>{MILESTONE_PHASE_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as MilestonePriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MILESTONE_PRIORITY_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Responsável</Label>
            <Input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Nome do responsável" />
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2 bg-muted/20">
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button
            size="sm"
            disabled={!title.trim()}
            onClick={() => onSave({
              title: title.trim(),
              description: description.trim() || null,
              start_date: startDate || null,
              due_date: dueDate || null,
              owner: owner.trim() || null,
              priority,
              phase: currentPhase,
            })}
          >
            {milestone ? "Salvar" : "Criar marco"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== Docs =====
function DocsTab({ projectId }: { projectId: string }) {
  const { items, add, remove } = useProjectDocuments(projectId);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("link");

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} documentos</p>
        <Button size="sm" variant="outline" onClick={() => setShow(s => !s)}><Plus className="h-4 w-4 mr-1" />Adicionar link</Button>
      </div>
      {show && (
        <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
          <Input placeholder="Título (Brief, Contrato, Drive...)" value={title} onChange={e => setTitle(e.target.value)} />
          <Input placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="link">Link</SelectItem>
              <SelectItem value="drive">Drive / Pasta</SelectItem>
              <SelectItem value="brief">Briefing</SelectItem>
              <SelectItem value="contract">Contrato</SelectItem>
              <SelectItem value="deck">Deck / Apresentação</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setShow(false); setTitle(""); setUrl(""); }}>Cancelar</Button>
            <Button size="sm" disabled={!title.trim() || !url.trim()} onClick={() => {
              add.mutate({ title, url, kind }, { onSuccess: () => { setTitle(""); setUrl(""); setKind("link"); setShow(false); }});
            }}>Adicionar</Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.map(d => (
          <div key={d.id} className="flex items-center gap-3 p-3 border rounded-lg group hover:bg-muted/30">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{d.title}</div>
              <div className="text-xs text-muted-foreground truncate">{d.url}</div>
            </div>
            <Badge variant="outline" className="text-xs">{d.kind}</Badge>
            <Button size="icon" variant="ghost" asChild>
              <a href={d.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove.mutate(d.id)} className="opacity-0 group-hover:opacity-100">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <EmptyState text="Nenhum documento ainda." />}
      </div>
    </div>
  );
}

// ===== Events (linked) =====
function EventsTab({ projectId }: { projectId: string }) {
  const { items, link, unlink } = useProjectEvents(projectId);
  const { currentUser } = useCurrentUser();
  const { data: availableEvents = [] } = useQuery({
    queryKey: ["available-marketing-events", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, scheduled_at, category, color")
        .eq("account_id", currentUser!.account_id)
        .order("scheduled_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
  const [picker, setPicker] = useState("");

  const linkedIds = new Set(items.map((e: any) => e.id));
  const choices = availableEvents.filter(e => !linkedIds.has(e.id));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={picker} onValueChange={(v) => { setPicker(""); link.mutate(v); }}>
          <SelectTrigger><SelectValue placeholder="Vincular evento existente..." /></SelectTrigger>
          <SelectContent>
            {choices.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.title} {e.scheduled_at && `— ${format(parseISO(e.scheduled_at), "dd/MM", { locale: ptBR })}`}
              </SelectItem>
            ))}
            {choices.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhum evento disponível</div>}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        {items.map((e: any) => (
          <div key={e.id} className="flex items-center gap-3 p-3 border rounded-lg group hover:bg-muted/30">
            <div className="h-3 w-3 rounded-full" style={{ background: e.color || "#8b5cf6" }} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{e.title}</div>
              {e.scheduled_at && (
                <div className="text-xs text-muted-foreground">{format(parseISO(e.scheduled_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}</div>
              )}
            </div>
            <Button size="icon" variant="ghost" onClick={() => unlink.mutate(e.id)} className="opacity-0 group-hover:opacity-100">
              <Link2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <EmptyState text="Nenhum evento vinculado a este projeto." />}
      </div>
    </div>
  );
}

// ===== Tasks (linked) =====
function TasksTab({ projectId }: { projectId: string }) {
  const { items, link, unlink } = useProjectTasks(projectId);
  const { currentUser } = useCurrentUser();
  const { data: availableTasks = [] } = useQuery({
    queryKey: ["available-marketing-tasks", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_tasks")
        .select("id, title, status, priority, due_date, is_completed")
        .eq("account_id", currentUser!.account_id)
        .eq("is_completed", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
  const [picker, setPicker] = useState("");

  const linkedIds = new Set(items.map((t: any) => t.id));
  const choices = availableTasks.filter(t => !linkedIds.has(t.id));

  return (
    <div className="space-y-3">
      <Select value={picker} onValueChange={(v) => { setPicker(""); link.mutate(v); }}>
        <SelectTrigger><SelectValue placeholder="Vincular tarefa existente..." /></SelectTrigger>
        <SelectContent>
          {choices.map(t => (
            <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
          ))}
          {choices.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhuma tarefa disponível</div>}
        </SelectContent>
      </Select>
      <div className="space-y-2">
        {items.map((t: any) => (
          <div key={t.id} className="flex items-center gap-3 p-3 border rounded-lg group hover:bg-muted/30">
            <Checkbox checked={t.is_completed} disabled />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.title}</div>
              <div className="flex gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs">{t.priority}</Badge>
                <Badge variant="outline" className="text-xs">{t.status}</Badge>
                {t.due_date && <span className="text-xs text-muted-foreground">{format(parseISO(t.due_date), "dd MMM", { locale: ptBR })}</span>}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => unlink.mutate(t.id)} className="opacity-0 group-hover:opacity-100">
              <Link2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <EmptyState text="Nenhuma tarefa vinculada." />}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg">{text}</div>;
}
