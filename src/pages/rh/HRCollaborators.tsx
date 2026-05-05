import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHRCollaborators, HRCollaborator } from "@/hooks/useHRCollaborators";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search, Plus, UsersRound, ArrowLeft, Eye, Download, Pencil, X,
} from "lucide-react";
import CollaboratorsBulkEditDialog from "./components/CollaboratorsBulkEditDialog";

const RH_ALLOWED_EMAIL = "m.quintana@me.com";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  inactive: { label: "Inativo", variant: "secondary" },
  vacation: { label: "Férias", variant: "outline" },
  leave: { label: "Afastado", variant: "destructive" },
};

const EMPLOYMENT_TYPES: Record<string, string> = {
  clt: "CLT",
  pj: "PJ",
  socio: "Sócio",
  intern: "Estágio",
  temporary: "Temporário",
  freelancer: "Freelancer",
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  team_role_id: string | null;
  role_name?: string | null;
}

export default function HRCollaborators() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { collaborators, loading, createCollaborator, importFromTeam, updateCollaborator, refetch } = useHRCollaborators();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    department: "",
    position: "",
    hire_date: "",
    employment_type: "clt",
    salary: "",
    status: "active",
  });

  const departments = useMemo(() => {
    const depts = new Set(collaborators.map(c => c.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [collaborators]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return collaborators.filter(c => {
      if (q) {
        const hay = [c.full_name, c.email, c.position, c.cpf, c.department, c.unit, c.cbo, c.registration_company, c.payroll_company, c.city, c.neighborhood]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (deptFilter !== "all" && c.department !== deptFilter) return false;
      if (typeFilter !== "all" && c.employment_type !== typeFilter) return false;
      return true;
    });
  }, [collaborators, search, statusFilter, deptFilter, typeFilter]);

  const fetchTeamMembers = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setTeamLoading(true);
    try {
      const { data: teamData } = await supabase
        .from("users")
        .select("id, name, email, avatar_url, team_role_id, account_id")
        .eq("account_id", currentUser.account_id)
        .order("name");

      const linkedUserIds = new Set(collaborators.map(c => c.user_id).filter(Boolean));
      const available = (teamData || []).filter(u => !linkedUserIds.has(u.id));

      let roleMap: Record<string, string> = {};
      const roleIds = [...new Set(available.map(u => u.team_role_id).filter(Boolean))];
      if (roleIds.length > 0) {
        const { data: roles } = await supabase
          .from("team_roles")
          .select("id, name")
          .in("id", roleIds);
        if (roles) roleMap = Object.fromEntries(roles.map(r => [r.id, r.name]));
      }

      setTeamMembers(available.map(u => ({
        ...u,
        role_name: u.team_role_id ? (roleMap[u.team_role_id] || null) : null,
      })));
    } finally {
      setTeamLoading(false);
    }
  }, [currentUser?.account_id, collaborators]);

  const handleOpenImport = () => {
    setSelectedMembers(new Set());
    setImportDialogOpen(true);
    fetchTeamMembers();
  };

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedMembers.size === teamMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(teamMembers.map(m => m.id)));
    }
  };

  const handleImportSelected = async () => {
    setImporting(true);
    for (const memberId of selectedMembers) {
      const member = teamMembers.find(m => m.id === memberId);
      if (!member) continue;
      await importFromTeam(member.id, {
        full_name: member.name || member.email || "Sem nome",
        email: member.email,
        avatar_url: member.avatar_url,
        department: member.role_name?.split(" · ")[0] || null,
        position: member.role_name || null,
        status: "active",
      });
    }
    setImporting(false);
    setImportDialogOpen(false);
    setSelectedMembers(new Set());
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim()) return;
    const result = await createCollaborator({
      full_name: form.full_name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      cpf: form.cpf || null,
      department: form.department || null,
      position: form.position || null,
      hire_date: form.hire_date || null,
      employment_type: form.employment_type,
      salary: form.salary ? parseFloat(form.salary) : null,
      status: form.status,
    } as any);
    if (result) {
      setDialogOpen(false);
      setForm({ full_name: "", email: "", phone: "", cpf: "", department: "", position: "", hire_date: "", employment_type: "clt", salary: "", status: "active" });
    }
  };

  if (currentUser && currentUser.email !== RH_ALLOWED_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rh")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="p-2.5 rounded-xl bg-blue-500/10">
          <UsersRound className="h-6 w-6 text-blue-600" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">
            {collaborators.length} colaborador{collaborators.length !== 1 ? "es" : ""} cadastrado{collaborators.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" onClick={handleOpenImport}>
          <Download className="h-4 w-4 mr-2" />
          Importar da Equipe
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Colaborador
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email, CPF, cargo, unidade..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Vínculo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <UsersRound className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {collaborators.length === 0 ? "Nenhum colaborador cadastrado ainda" : "Nenhum resultado encontrado"}
          </p>
          {collaborators.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Use "Importar da Equipe" para trazer membros ou cadastre manualmente.
            </p>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every(c => selectedRows.has(c.id))}
                    onCheckedChange={(v) => {
                      setSelectedRows(prev => {
                        const next = new Set(prev);
                        if (v) filtered.forEach(c => next.add(c.id));
                        else filtered.forEach(c => next.delete(c.id));
                        return next;
                      });
                    }}
                  />
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">Colaborador</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Departamento</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Cargo</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Unidade</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Vínculo</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden lg:table-cell">Salário base</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden lg:table-cell">Custo mensal</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const st = STATUS_MAP[c.status || "active"] || STATUS_MAP.active;
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={c.avatar_url || undefined} />
                          <AvatarFallback className="bg-blue-500/10 text-blue-600 text-xs font-medium">
                            {getInitials(c.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{c.full_name}</p>
                          <p className="text-xs text-muted-foreground">{c.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{c.department || "—"}</td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{c.position || "—"}</td>
                    <td className="p-3 text-muted-foreground hidden lg:table-cell">{c.unit || "—"}</td>
                    <td className="p-3 hidden lg:table-cell">
                      {c.employment_type ? (
                        <Badge variant="outline" className="text-xs">{EMPLOYMENT_TYPES[c.employment_type] || c.employment_type}</Badge>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-right text-muted-foreground hidden lg:table-cell tabular-nums">
                      {c.base_salary != null ? c.base_salary.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : (c.salary != null ? c.salary.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—")}
                    </td>
                    <td className="p-3 text-right font-medium hidden lg:table-cell tabular-nums">
                      {c.monthly_total_cost != null ? c.monthly_total_cost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/rh/collaborators/${c.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Collaborator Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Colaborador</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <Label>Nome completo *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>Data de admissão</Label>
              <Input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Ex: Comercial" />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Ex: Analista" />
            </div>
            <div>
              <Label>Vínculo</Label>
              <Select value={form.employment_type} onValueChange={v => setForm(f => ({ ...f, employment_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Salário</Label>
              <Input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="0,00" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.full_name.trim()}>Cadastrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import from Team Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar da Equipe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecione os membros da equipe que deseja cadastrar como colaboradores no RH.
          </p>
          {teamLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando membros...</div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Todos os membros da equipe já estão cadastrados no RH.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 py-2 border-b">
                <Checkbox
                  checked={selectedMembers.size === teamMembers.length}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm font-medium text-muted-foreground">
                  Selecionar todos ({teamMembers.length})
                </span>
              </div>
              <div className="max-h-[320px] overflow-y-auto space-y-1">
                {teamMembers.map(m => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedMembers.has(m.id)}
                      onCheckedChange={() => toggleMember(m.id)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback className="bg-blue-500/10 text-blue-600 text-xs">
                        {getInitials(m.name || m.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name || m.email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.role_name || m.email}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleImportSelected}
              disabled={selectedMembers.size === 0 || importing}
            >
              {importing ? "Importando..." : `Importar ${selectedMembers.size > 0 ? `(${selectedMembers.size})` : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
