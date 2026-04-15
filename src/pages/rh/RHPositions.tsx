import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, ArrowLeft, Plus, Search, MoreVertical, Pencil, Trash2,
  GraduationCap, Briefcase, TrendingUp, ChevronRight, X,
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

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name || "—";

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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
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
          <p className="text-sm text-muted-foreground">Cargos, competências e requisitos</p>
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
          <SelectTrigger className="w-48"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {departments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid + Detail */}
      <div className="flex gap-6">
        {/* List */}
        <div className={`flex-1 ${detailPosition ? "max-w-md" : ""}`}>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">{search || filterDept !== "all" ? "Nenhum cargo encontrado" : "Nenhum cargo cadastrado"}</p>
              {!search && filterDept === "all" && (
                <Button variant="outline" className="mt-4" onClick={() => openDialog()}>
                  <Plus className="h-4 w-4 mr-2" /> Criar primeiro cargo
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(pos => (
                <Card
                  key={pos.id}
                  className={`group cursor-pointer hover:shadow-md transition-all ${detailPosition?.id === pos.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setDetailPosition(pos)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground text-sm">{pos.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{getDeptName(pos.department_id)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
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
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {pos.seniority && <Badge variant="secondary" className="text-[10px]">{pos.seniority}</Badge>}
                      {pos.education_level && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <GraduationCap className="h-3 w-3" />{pos.education_level}
                        </Badge>
                      )}
                      {!pos.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>}
                    </div>
                    {(pos.salary_min || pos.salary_max) && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {formatSalary(pos.salary_min)}{pos.salary_min && pos.salary_max ? " – " : ""}{formatSalary(pos.salary_max)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {detailPosition && (
          <div className="flex-1 min-w-0">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{detailPosition.title}</h2>
                    <p className="text-sm text-muted-foreground">{getDeptName(detailPosition.department_id)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(detailPosition)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailPosition(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {detailPosition.seniority && <Badge variant="secondary">{detailPosition.seniority}</Badge>}
                  {detailPosition.education_level && (
                    <Badge variant="outline" className="gap-1"><GraduationCap className="h-3 w-3" />{detailPosition.education_level}</Badge>
                  )}
                  {detailPosition.experience_years && (
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
              </CardContent>
            </Card>
          </div>
        )}
      </div>

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
