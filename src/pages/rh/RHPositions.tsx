import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, ArrowLeft, Plus, Search, MoreVertical, Pencil, Trash2,
  GraduationCap, Briefcase, TrendingUp, ChevronRight, X, Users, DollarSign, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHRPositions, type HRPosition } from "@/hooks/useHRPositions";
import { useHRDepartments } from "@/hooks/useHRDepartments";

const SENIORITY_OPTIONS = ["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista", "Coordenador", "Gerente", "Diretor", "C-Level"];
const EDUCATION_OPTIONS = ["Ensino Médio", "Técnico", "Superior Incompleto", "Superior Completo", "Pós-graduação", "MBA", "Mestrado", "Doutorado"];

// Hierarquia (do mais sênior para o mais júnior) — usada para ordenar cards dentro do departamento
const SENIORITY_RANK: Record<string, number> = {
  "C-Level": 0,
  "Diretor": 1,
  "Gerente": 2,
  "Coordenador": 3,
  "Especialista": 4,
  "Sênior": 5,
  "Pleno": 6,
  "Júnior": 7,
  "Estagiário": 8,
};

const SENIORITY_COLORS: Record<string, string> = {
  "C-Level": "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800",
  "Diretor": "bg-indigo-500/10 text-indigo-700 border-indigo-200 dark:text-indigo-300 dark:border-indigo-800",
  "Gerente": "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800",
  "Coordenador": "bg-cyan-500/10 text-cyan-700 border-cyan-200 dark:text-cyan-300 dark:border-cyan-800",
  "Especialista": "bg-teal-500/10 text-teal-700 border-teal-200 dark:text-teal-300 dark:border-teal-800",
  "Sênior": "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800",
  "Pleno": "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800",
  "Júnior": "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-800",
  "Estagiário": "bg-slate-500/10 text-slate-700 border-slate-200 dark:text-slate-300 dark:border-slate-800",
};

const EMPTY_FORM = {
  title: "",
  department_id: "",
  seniority: "",
  salary_min: "",
  salary_max: "",
  description: "",
  responsibilities: [] as string[],
  technical_skills: [] as string[],
  behavioral_skills: [] as string[],
  requirements: "",
  education_level: "",
  experience_years: "",
  career_path: "",
  next_position_id: "",
};

export default function RHPositions() {
  const navigate = useNavigate();
  const { positions, loading, createPosition, updatePosition, deletePosition } = useHRPositions();
  const { departments } = useHRDepartments();

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailPosition, setDetailPosition] = useState<HRPosition | null>(null);
  const [editingPos, setEditingPos] = useState<HRPosition | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState({ technical: "", behavioral: "", responsibility: "" });

  const filtered = positions.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchDept = filterDept === "all" || p.department_id === filterDept;
    return matchSearch && matchDept;
  });

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name || "Sem departamento";
  const getDeptColor = (id: string | null) => departments.find(d => d.id === id)?.color || "#94a3b8";

  // Agrupar por departamento e ordenar internamente por hierarquia de senioridade
  const grouped = (() => {
    const groups = new Map<string, { id: string | null; name: string; color: string; items: HRPosition[] }>();
    filtered.forEach(p => {
      const key = p.department_id || "__none__";
      if (!groups.has(key)) {
        groups.set(key, {
          id: p.department_id,
          name: getDeptName(p.department_id),
          color: getDeptColor(p.department_id),
          items: [],
        });
      }
      groups.get(key)!.items.push(p);
    });
    // Ordenar cargos dentro de cada grupo por senioridade (mais sênior primeiro), depois por título
    groups.forEach(g => {
      g.items.sort((a, b) => {
        const ra = SENIORITY_RANK[a.seniority || ""] ?? 99;
        const rb = SENIORITY_RANK[b.seniority || ""] ?? 99;
        if (ra !== rb) return ra - rb;
        return a.title.localeCompare(b.title);
      });
    });
    // Ordenar grupos por nome de departamento (com "Sem departamento" no final)
    return Array.from(groups.values()).sort((a, b) => {
      if (!a.id && b.id) return 1;
      if (a.id && !b.id) return -1;
      return a.name.localeCompare(b.name);
    });
  })();

  const openDialog = (pos?: HRPosition) => {
    if (pos) {
      setEditingPos(pos);
      setForm({
        title: pos.title,
        department_id: pos.department_id || "",
        seniority: pos.seniority || "",
        salary_min: pos.salary_min?.toString() || "",
        salary_max: pos.salary_max?.toString() || "",
        description: pos.description || "",
        responsibilities: pos.responsibilities || [],
        technical_skills: pos.technical_skills || [],
        behavioral_skills: pos.behavioral_skills || [],
        requirements: pos.requirements || "",
        education_level: pos.education_level || "",
        experience_years: pos.experience_years?.toString() || "",
        career_path: pos.career_path || "",
        next_position_id: pos.next_position_id || "",
      });
    } else {
      setEditingPos(null);
      setForm({ ...EMPTY_FORM, responsibilities: [], technical_skills: [], behavioral_skills: [] });
    }
    setNewSkillInput({ technical: "", behavioral: "", responsibility: "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      department_id: form.department_id || null,
      seniority: form.seniority || null,
      salary_min: form.salary_min ? parseFloat(form.salary_min) : null,
      salary_max: form.salary_max ? parseFloat(form.salary_max) : null,
      description: form.description.trim() || null,
      responsibilities: form.responsibilities,
      technical_skills: form.technical_skills,
      behavioral_skills: form.behavioral_skills,
      requirements: form.requirements.trim() || null,
      education_level: form.education_level || null,
      experience_years: form.experience_years ? parseInt(form.experience_years) : null,
      career_path: form.career_path.trim() || null,
      next_position_id: form.next_position_id || null,
    };

    if (editingPos) {
      await updatePosition({ id: editingPos.id, ...payload });
    } else {
      await createPosition(payload);
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cargo?")) return;
    await deletePosition(id);
    if (detailPosition?.id === id) setDetailPosition(null);
  };

  const addToList = (field: "responsibilities" | "technical_skills" | "behavioral_skills", inputKey: string) => {
    const value = newSkillInput[inputKey as keyof typeof newSkillInput].trim();
    if (!value) return;
    setForm(f => ({ ...f, [field]: [...f[field], value] }));
    setNewSkillInput(prev => ({ ...prev, [inputKey]: "" }));
  };

  const removeFromList = (field: "responsibilities" | "technical_skills" | "behavioral_skills", idx: number) => {
    setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  };

  const formatSalary = (v: number | null) => v ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="p-2 rounded-xl bg-cyan-500/10">
          <FileText className="h-6 w-6 text-cyan-600" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Cargos</h1>
          <p className="text-sm text-muted-foreground">
            {positions.length} {positions.length === 1 ? "cargo cadastrado" : "cargos cadastrados"} • organizados por departamento e hierarquia
          </p>
        </div>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cargo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cargo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {departments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grouped grid by department */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">{search || filterDept !== "all" ? "Nenhum cargo encontrado" : "Nenhum cargo cadastrado"}</p>
          {!search && filterDept === "all" && (
            <Button variant="outline" className="mt-4" onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" /> Criar primeiro cargo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <section key={group.id || "__none__"}>
              {/* Department header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${group.color}1a`, color: group.color }}
                >
                  <Building2 className="h-4 w-4" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-foreground">{group.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {group.items.length} {group.items.length === 1 ? "cargo" : "cargos"}
                  </p>
                </div>
                <div
                  className="h-px flex-1 max-w-[40%]"
                  style={{ background: `linear-gradient(to right, ${group.color}40, transparent)` }}
                />
              </div>

              {/* Cards grid */}
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map(pos => (
                  <Card
                    key={pos.id}
                    className="group cursor-pointer hover:shadow-md hover:border-primary/30 transition-all relative overflow-hidden"
                    onClick={() => setDetailPosition(pos)}
                  >
                    {/* Top accent bar by department color */}
                    <div className="h-1" style={{ backgroundColor: group.color }} />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{pos.title}</h3>
                          {pos.seniority && (
                            <Badge
                              variant="outline"
                              className={`mt-1.5 text-[10px] font-medium ${SENIORITY_COLORS[pos.seniority] || ""}`}
                            >
                              {pos.seniority}
                            </Badge>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); openDialog(pos); }}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); handleDelete(pos.id); }}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {pos.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {pos.description}
                        </p>
                      )}

                      <div className="space-y-1.5 pt-1 border-t">
                        {(pos.salary_min || pos.salary_max) && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <DollarSign className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {formatSalary(pos.salary_min)}{pos.salary_min && pos.salary_max ? " – " : ""}{formatSalary(pos.salary_max)}
                            </span>
                          </div>
                        )}
                        {pos.education_level && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <GraduationCap className="h-3 w-3 shrink-0" />
                            <span className="truncate">{pos.education_level}</span>
                          </div>
                        )}
                        {pos.experience_years != null && pos.experience_years > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Briefcase className="h-3 w-3 shrink-0" />
                            <span>{pos.experience_years} ano(s) de experiência</span>
                          </div>
                        )}
                        {(pos.technical_skills.length > 0 || pos.behavioral_skills.length > 0) && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3 shrink-0" />
                            <span>{pos.technical_skills.length + pos.behavioral_skills.length} competências</span>
                          </div>
                        )}
                      </div>

                      {!pos.is_active && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailPosition} onOpenChange={(open) => !open && setDetailPosition(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {detailPosition && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <DialogTitle className="text-xl">{detailPosition.title}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      {getDeptName(detailPosition.department_id)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openDialog(detailPosition)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {detailPosition.seniority && (
                    <Badge variant="outline" className={SENIORITY_COLORS[detailPosition.seniority] || ""}>
                      {detailPosition.seniority}
                    </Badge>
                  )}
                  {detailPosition.education_level && (
                    <Badge variant="outline" className="gap-1"><GraduationCap className="h-3 w-3" />{detailPosition.education_level}</Badge>
                  )}
                  {detailPosition.experience_years != null && detailPosition.experience_years > 0 && (
                    <Badge variant="outline" className="gap-1"><Briefcase className="h-3 w-3" />{detailPosition.experience_years} ano(s) exp.</Badge>
                  )}
                </div>

                {(detailPosition.salary_min || detailPosition.salary_max) && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-0.5">Faixa Salarial</p>
                    <p className="text-sm font-medium">
                      {formatSalary(detailPosition.salary_min)}{detailPosition.salary_min && detailPosition.salary_max ? " – " : ""}{formatSalary(detailPosition.salary_max)}
                    </p>
                  </div>
                )}

                <Tabs defaultValue="description" className="w-full">
                  <TabsList className="w-full grid grid-cols-4">
                    <TabsTrigger value="description" className="text-xs">Descrição</TabsTrigger>
                    <TabsTrigger value="skills" className="text-xs">Competências</TabsTrigger>
                    <TabsTrigger value="requirements" className="text-xs">Requisitos</TabsTrigger>
                    <TabsTrigger value="career" className="text-xs">Carreira</TabsTrigger>
                  </TabsList>

                  <TabsContent value="description" className="mt-3 space-y-3">
                    {detailPosition.description ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailPosition.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic">Sem descrição</p>
                    )}
                    {detailPosition.responsibilities.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1.5">Responsabilidades</p>
                        <ul className="space-y-1">
                          {detailPosition.responsibilities.map((r, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="skills" className="mt-3 space-y-4">
                    {detailPosition.technical_skills.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1.5">Competências Técnicas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detailPosition.technical_skills.map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {detailPosition.behavioral_skills.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1.5">Competências Comportamentais</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detailPosition.behavioral_skills.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {detailPosition.technical_skills.length === 0 && detailPosition.behavioral_skills.length === 0 && (
                      <p className="text-sm text-muted-foreground/60 italic">Nenhuma competência cadastrada</p>
                    )}
                  </TabsContent>

                  <TabsContent value="requirements" className="mt-3">
                    {detailPosition.requirements ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailPosition.requirements}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic">Sem requisitos adicionais</p>
                    )}
                  </TabsContent>

                  <TabsContent value="career" className="mt-3 space-y-3">
                    {detailPosition.career_path ? (
                      <div>
                        <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />Plano de Carreira</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailPosition.career_path}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic">Sem plano de carreira definido</p>
                    )}
                    {detailPosition.next_position_id && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-0.5">Próximo Cargo</p>
                        <p className="text-sm font-medium">{positions.find(p => p.id === detailPosition.next_position_id)?.title || "—"}</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog - Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPos ? "Editar Cargo" : "Novo Cargo"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="general" className="text-xs">Geral</TabsTrigger>
              <TabsTrigger value="skills" className="text-xs">Competências</TabsTrigger>
              <TabsTrigger value="requirements" className="text-xs">Requisitos</TabsTrigger>
              <TabsTrigger value="career" className="text-xs">Carreira</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-3">
              <div>
                <Label>Título do Cargo *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Analista Financeiro" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Departamento</Label>
                  <Select value={form.department_id || "none"} onValueChange={v => setForm(f => ({ ...f, department_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {departments.map(d => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Senioridade</Label>
                  <Select value={form.seniority || "none"} onValueChange={v => setForm(f => ({ ...f, seniority: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {SENIORITY_OPTIONS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Salário Mínimo (R$)</Label>
                  <Input type="number" value={form.salary_min} onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))} placeholder="0,00" />
                </div>
                <div>
                  <Label>Salário Máximo (R$)</Label>
                  <Input type="number" value={form.salary_max} onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))} placeholder="0,00" />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Descreva as atribuições gerais do cargo..." />
              </div>
              {/* Responsibilities */}
              <div>
                <Label>Responsabilidades</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newSkillInput.responsibility}
                    onChange={e => setNewSkillInput(p => ({ ...p, responsibility: e.target.value }))}
                    placeholder="Adicionar responsabilidade..."
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addToList("responsibilities", "responsibility"); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => addToList("responsibilities", "responsibility")}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.responsibilities.map((r, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 text-xs">
                      {r}
                      <button onClick={() => removeFromList("responsibilities", i)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="skills" className="space-y-4 mt-3">
              <div>
                <Label>Competências Técnicas</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newSkillInput.technical}
                    onChange={e => setNewSkillInput(p => ({ ...p, technical: e.target.value }))}
                    placeholder="Ex: Excel avançado, SQL..."
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addToList("technical_skills", "technical"); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => addToList("technical_skills", "technical")}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.technical_skills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 text-xs">
                      {s}
                      <button onClick={() => removeFromList("technical_skills", i)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Competências Comportamentais</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={newSkillInput.behavioral}
                    onChange={e => setNewSkillInput(p => ({ ...p, behavioral: e.target.value }))}
                    placeholder="Ex: Liderança, Comunicação..."
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addToList("behavioral_skills", "behavioral"); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => addToList("behavioral_skills", "behavioral")}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.behavioral_skills.map((s, i) => (
                    <Badge key={i} variant="outline" className="gap-1 text-xs">
                      {s}
                      <button onClick={() => removeFromList("behavioral_skills", i)}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Escolaridade Mínima</Label>
                  <Select value={form.education_level || "none"} onValueChange={v => setForm(f => ({ ...f, education_level: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {EDUCATION_OPTIONS.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Experiência mínima (anos)</Label>
                  <Input type="number" value={form.experience_years} onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div>
                <Label>Requisitos Adicionais</Label>
                <Textarea value={form.requirements} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} rows={5} placeholder="Certificações, idiomas, disponibilidade para viagem..." />
              </div>
            </TabsContent>

            <TabsContent value="career" className="space-y-4 mt-3">
              <div>
                <Label>Plano de Carreira</Label>
                <Textarea value={form.career_path} onChange={e => setForm(f => ({ ...f, career_path: e.target.value }))} rows={5} placeholder="Descreva as possibilidades de crescimento neste cargo..." />
              </div>
              <div>
                <Label>Próximo Cargo na Carreira</Label>
                <Select value={form.next_position_id || "none"} onValueChange={v => setForm(f => ({ ...f, next_position_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {positions.filter(p => p.id !== editingPos?.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? "Salvando..." : editingPos ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
