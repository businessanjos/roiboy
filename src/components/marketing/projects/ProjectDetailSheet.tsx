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
        <TabsContent value="stakeholders"><StakeholdersTab projectId={project.id} /></TabsContent>
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
  const { items, add, toggle, remove } = useProjectMilestones(projectId);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.filter(i => i.completed).length}/{items.length} concluídos</p>
        <Button size="sm" variant="outline" onClick={() => setShow(s => !s)}><Plus className="h-4 w-4 mr-1" />Novo marco</Button>
      </div>
      {show && (
        <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
          <Input placeholder="Ex.: Capa do livro aprovada" value={title} onChange={e => setTitle(e.target.value)} />
          <Input type="date" value={due} onChange={e => setDue(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setShow(false); setTitle(""); setDue(""); }}>Cancelar</Button>
            <Button size="sm" disabled={!title.trim()} onClick={() => {
              add.mutate({ title, due_date: due || null }, { onSuccess: () => { setTitle(""); setDue(""); setShow(false); }});
            }}>Adicionar</Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.map(m => (
          <div key={m.id} className="flex items-center gap-3 p-3 border rounded-lg group hover:bg-muted/30">
            <Checkbox checked={m.completed} onCheckedChange={(v) => toggle.mutate({ id: m.id, completed: !!v })} />
            <div className="flex-1">
              <div className={`font-medium ${m.completed ? "line-through text-muted-foreground" : ""}`}>{m.title}</div>
              {m.due_date && (
                <div className="text-xs text-muted-foreground">{format(parseISO(m.due_date), "dd MMM yyyy", { locale: ptBR })}</div>
              )}
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove.mutate(m.id)} className="opacity-0 group-hover:opacity-100">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {items.length === 0 && <EmptyState text="Nenhum marco criado. Comece com kickoff, entregas-chave e go-live." />}
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
