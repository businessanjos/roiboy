import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gift, ArrowLeft, Plus, Search, MoreVertical, Pencil, Trash2, Star, Briefcase, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useHRCompanyBenefits, BENEFIT_CATEGORY_LABELS, type HRCompanyBenefit,
} from "@/hooks/useHRCompanyBenefits";
import { CONTRACT_TYPE_LABELS } from "@/constants/jobOptions";
import type { JobContractType } from "@/types/job";

const CONTRACT_OPTIONS = Object.entries(CONTRACT_TYPE_LABELS) as [JobContractType, string][];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

interface FormState {
  name: string;
  category: string;
  provider: string;
  description: string;
  monthly_value: string;
  employee_contribution: string;
  contract_types: string[];
  is_highlight: boolean;
  include_in_jobs_by_default: boolean;
  use_in_benchmark: boolean;
  is_active: boolean;
  sort_order: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  category: "outros",
  provider: "",
  description: "",
  monthly_value: "",
  employee_contribution: "",
  contract_types: ["clt"],
  is_highlight: false,
  include_in_jobs_by_default: true,
  use_in_benchmark: true,
  is_active: true,
  sort_order: "0",
};

export default function RHBenefits() {
  const navigate = useNavigate();
  const { benefits, loading, createBenefit, updateBenefit, deleteBenefit } = useHRCompanyBenefits();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HRCompanyBenefit | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return benefits;
    return benefits.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.provider || "").toLowerCase().includes(q) ||
        (BENEFIT_CATEGORY_LABELS[b.category] || b.category).toLowerCase().includes(q),
    );
  }, [benefits, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, HRCompanyBenefit[]>();
    filtered.forEach((b) => {
      const list = map.get(b.category) || [];
      list.push(b);
      map.set(b.category, list);
    });
    return [...map.entries()].sort((a, b) =>
      (BENEFIT_CATEGORY_LABELS[a[0]] || a[0]).localeCompare(BENEFIT_CATEGORY_LABELS[b[0]] || b[0], "pt-BR"),
    );
  }, [filtered]);

  const stats = useMemo(() => {
    const active = benefits.filter((b) => b.is_active);
    const cost = active.reduce((sum, b) => sum + Number(b.monthly_value || 0), 0);
    return {
      total: benefits.length,
      active: active.length,
      inJobs: active.filter((b) => b.include_in_jobs_by_default).length,
      inBenchmark: active.filter((b) => b.use_in_benchmark).length,
      cost,
    };
  }, [benefits]);

  const openDialog = (b?: HRCompanyBenefit) => {
    if (b) {
      setEditing(b);
      setForm({
        name: b.name,
        category: b.category,
        provider: b.provider || "",
        description: b.description || "",
        monthly_value: b.monthly_value != null ? String(b.monthly_value) : "",
        employee_contribution: b.employee_contribution != null ? String(b.employee_contribution) : "",
        contract_types: b.contract_types?.length ? b.contract_types : ["clt"],
        is_highlight: b.is_highlight,
        include_in_jobs_by_default: b.include_in_jobs_by_default,
        use_in_benchmark: b.use_in_benchmark,
        is_active: b.is_active,
        sort_order: String(b.sort_order ?? 0),
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const toggleContract = (value: string) => {
    setForm((f) => ({
      ...f,
      contract_types: f.contract_types.includes(value)
        ? f.contract_types.filter((c) => c !== value)
        : [...f.contract_types, value],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      provider: form.provider.trim() || null,
      description: form.description.trim() || null,
      monthly_value: form.monthly_value ? parseFloat(form.monthly_value) : 0,
      employee_contribution: form.employee_contribution ? parseFloat(form.employee_contribution) : 0,
      contract_types: form.contract_types.length ? form.contract_types : ["clt"],
      is_highlight: form.is_highlight,
      include_in_jobs_by_default: form.include_in_jobs_by_default,
      use_in_benchmark: form.use_in_benchmark,
      is_active: form.is_active,
      sort_order: form.sort_order ? parseInt(form.sort_order, 10) || 0 : 0,
    };
    if (editing) {
      await updateBenefit({ id: editing.id, ...payload });
    } else {
      await createBenefit(payload);
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este benefício do catálogo da empresa?")) return;
    await deleteBenefit(id);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => navigate("/rh")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> RH
          </Button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Gift className="h-6 w-6 text-primary" /> Benefícios da Empresa
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Catálogo oficial de benefícios. Serve como base para as vagas abertas e como referência no
            benchmark de mercado.
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-1" /> Novo benefício
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Benefícios ativos</p>
          <p className="text-2xl font-semibold">{stats.active}<span className="text-sm text-muted-foreground font-normal">/{stats.total}</span></p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> Padrão nas vagas</p>
          <p className="text-2xl font-semibold">{stats.inJobs}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 className="h-3 w-3" /> No benchmark</p>
          <p className="text-2xl font-semibold">{stats.inBenchmark}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Custo mensal / colaborador</p>
          <p className="text-2xl font-semibold">{brl(stats.cost)}</p>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar benefício..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center space-y-3">
          <Gift className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Nenhum benefício cadastrado</p>
          <p className="text-sm text-muted-foreground">
            Cadastre os benefícios oferecidos pela empresa para reutilizar em todas as vagas.
          </p>
          <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-1" /> Cadastrar primeiro benefício</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {BENEFIT_CATEGORY_LABELS[category] || category} · {items.length}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((b) => (
                  <Card key={b.id} className={b.is_active ? "" : "opacity-60"}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            {b.is_highlight && <Star className="h-3.5 w-3.5 text-warning shrink-0" />}
                            <p className="font-medium leading-tight">{b.name}</p>
                          </div>
                          {b.provider && <p className="text-xs text-muted-foreground">{b.provider}</p>}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDialog(b)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateBenefit({ id: b.id, is_active: !b.is_active })}
                            >
                              {b.is_active ? "Desativar" : "Reativar"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(b.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {b.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{b.description}</p>
                      )}

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Number(b.monthly_value || 0) > 0 && (
                          <Badge variant="secondary" className="text-[11px]">{brl(Number(b.monthly_value))}/mês</Badge>
                        )}
                        {Number(b.employee_contribution || 0) > 0 && (
                          <Badge variant="outline" className="text-[11px]">
                            Coparticipação {brl(Number(b.employee_contribution))}
                          </Badge>
                        )}
                        {(b.contract_types || []).map((c) => (
                          <Badge key={c} variant="outline" className="text-[11px]">
                            {CONTRACT_TYPE_LABELS[c as JobContractType] || c}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground pt-1">
                        {b.include_in_jobs_by_default && (
                          <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> padrão nas vagas</span>
                        )}
                        {b.use_in_benchmark && (
                          <span className="inline-flex items-center gap-1"><BarChart3 className="h-3 w-3" /> benchmark</span>
                        )}
                        {!b.is_active && <span>inativo</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar benefício" : "Novo benefício"}</DialogTitle>
            <DialogDescription>
              Benefícios marcados como padrão já vêm pré-selecionados ao criar uma vaga.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Plano de saúde Unimed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BENEFIT_CATEGORY_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fornecedor</Label>
                <Input
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  placeholder="Ex.: Wellhub"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor mensal (R$)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={form.monthly_value}
                  onChange={(e) => setForm({ ...form, monthly_value: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Coparticipação (R$)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={form.employee_contribution}
                  onChange={(e) => setForm({ ...form, employee_contribution: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes, regras de elegibilidade, carência..."
              />
            </div>

            <div className="space-y-2">
              <Label>Elegibilidade por contrato</Label>
              <div className="flex flex-wrap gap-2">
                {CONTRACT_OPTIONS.map(([value, label]) => (
                  <Badge
                    key={value}
                    variant={form.contract_types.includes(value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleContract(value)}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Incluir por padrão nas vagas</Label>
                  <p className="text-xs text-muted-foreground">Pré-seleciona este benefício ao criar uma vaga.</p>
                </div>
                <Switch
                  checked={form.include_in_jobs_by_default}
                  onCheckedChange={(v) => setForm({ ...form, include_in_jobs_by_default: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Usar no benchmark</Label>
                  <p className="text-xs text-muted-foreground">Considerado na comparação com o mercado.</p>
                </div>
                <Switch
                  checked={form.use_in_benchmark}
                  onCheckedChange={(v) => setForm({ ...form, use_in_benchmark: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Destaque</Label>
                  <p className="text-xs text-muted-foreground">Diferencial da empresa, exibido primeiro.</p>
                </div>
                <Switch
                  checked={form.is_highlight}
                  onCheckedChange={(v) => setForm({ ...form, is_highlight: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm">Ativo</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
