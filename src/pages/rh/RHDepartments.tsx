import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building, ArrowLeft, Plus, Search, MoreVertical, Pencil, Trash2, Users, ChevronRight } from "lucide-react";
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
import { useHRDepartments, type HRDepartment } from "@/hooks/useHRDepartments";
import { useHRCollaborators } from "@/hooks/useHRCollaborators";

const COLOR_OPTIONS = [
  { value: "blue", label: "Azul", hsl: "hsl(217 91% 60%)" },
  { value: "emerald", label: "Verde", hsl: "hsl(152 55% 45%)" },
  { value: "amber", label: "Âmbar", hsl: "hsl(39 60% 55%)" },
  { value: "purple", label: "Roxo", hsl: "hsl(271 81% 56%)" },
  { value: "red", label: "Vermelho", hsl: "hsl(0 72% 51%)" },
  { value: "teal", label: "Teal", hsl: "hsl(172 66% 50%)" },
  { value: "pink", label: "Rosa", hsl: "hsl(330 81% 60%)" },
  { value: "indigo", label: "Índigo", hsl: "hsl(239 84% 67%)" },
  { value: "orange", label: "Laranja", hsl: "hsl(25 95% 53%)" },
  { value: "slate", label: "Cinza", hsl: "hsl(215 20% 65%)" },
];

const getColorHsl = (color: string) => {
  if (color.startsWith("hsl") || color.startsWith("#")) return color;
  return COLOR_OPTIONS.find(c => c.value === color)?.hsl || "hsl(215 20% 65%)";
};

export default function RHDepartments() {
  const navigate = useNavigate();
  const { departments, loading, createDepartment, updateDepartment, deleteDepartment } = useHRDepartments();
  const { collaborators } = useHRCollaborators();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<HRDepartment | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: "blue", head_collaborator_id: "", parent_department_id: "" });
  const [saving, setSaving] = useState(false);

  const filtered = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.description?.toLowerCase().includes(search.toLowerCase())
  );

  const openDialog = (dept?: HRDepartment) => {
    if (dept) {
      setEditingDept(dept);
      setForm({
        name: dept.name,
        description: dept.description || "",
        color: dept.color,
        head_collaborator_id: dept.head_collaborator_id || "",
        parent_department_id: dept.parent_department_id || "",
      });
    } else {
      setEditingDept(null);
      setForm({ name: "", description: "", color: "blue", head_collaborator_id: "", parent_department_id: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      head_collaborator_id: form.head_collaborator_id || null,
      parent_department_id: form.parent_department_id || null,
    };

    if (editingDept) {
      await updateDepartment(editingDept.id, payload);
    } else {
      await createDepartment(payload);
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este departamento?")) return;
    await deleteDepartment(id);
  };

  const getCollabCount = (deptId: string) =>
    collaborators.filter(c => (c as any).hr_department_id === deptId).length;

  const getHeadName = (headId: string | null) => {
    if (!headId) return null;
    return collaborators.find(c => c.id === headId)?.full_name || null;
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return null;
    return departments.find(d => d.id === parentId)?.name || null;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="p-2 rounded-xl bg-slate-500/10">
          <Building className="h-6 w-6 text-slate-600" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Departamentos</h1>
          <p className="text-sm text-muted-foreground">Áreas e departamentos da empresa</p>
        </div>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Departamento
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar departamento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {search ? "Nenhum departamento encontrado" : "Nenhum departamento cadastrado"}
          </p>
          {!search && (
            <Button variant="outline" className="mt-4" onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro departamento
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(dept => {
            const headName = getHeadName(dept.head_collaborator_id);
            const parentName = getParentName(dept.parent_department_id);
            const collabCount = getCollabCount(dept.id);

            return (
              <Card key={dept.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getColorHsl(dept.color) }}
                      />
                      <h3 className="font-medium text-foreground">{dept.name}</h3>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDialog(dept)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(dept.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {dept.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{dept.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Users className="h-3 w-3" />
                      {collabCount} colaborador{collabCount !== 1 ? "es" : ""}
                    </Badge>
                    {!dept.is_active && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                    )}
                  </div>

                  {headName && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Responsável:</span> {headName}
                    </p>
                  )}

                  {parentName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ChevronRight className="h-3 w-3" />
                      {parentName}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDept ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Comercial"
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descrição do departamento..."
                rows={3}
              />
            </div>

            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      form.color === c.value ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.hsl }}
                    title={c.label}
                    onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Responsável</Label>
              <Select
                value={form.head_collaborator_id || "none"}
                onValueChange={v => setForm(f => ({ ...f, head_collaborator_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {collaborators.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Departamento pai</Label>
              <Select
                value={form.parent_department_id || "none"}
                onValueChange={v => setForm(f => ({ ...f, parent_department_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Nenhum (raiz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (raiz)</SelectItem>
                  {departments
                    .filter(d => d.id !== editingDept?.id)
                    .map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Salvando..." : editingDept ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
