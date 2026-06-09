import { useState, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHRServiceProviders, HRServiceProvider } from "@/hooks/useHRServiceProviders";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Switch } from "@/components/ui/switch";
import {
  Search, Plus, Handshake, Building2, Phone, Mail, UserSearch, Crown,
} from "lucide-react";

const RH_ALLOWED_EMAILS = ["m.quintana@me.com", "coachevertonsantos@gmail.com", "rh@anjosbusiness.com.br"];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  inactive: { label: "Inativo", variant: "secondary" },
  terminated: { label: "Encerrado", variant: "destructive" },
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function HRServiceProviders() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { providers, loading, createProvider } = useHRServiceProviders();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    cnpj: "",
    company_name: "",
    service_type: "",
    position: "",
    provider_kind: "on_demand" as "on_demand" | "director",
    is_recruitment_partner: false,
    recruitment_commission_pct: "",
  });

  const filtered = useMemo(() => {
    return providers.filter(p => {
      const matchSearch =
        !search ||
        p.full_name.toLowerCase().includes(search.toLowerCase()) ||
        p.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.cnpj?.includes(search) ||
        p.email?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [providers, search, statusFilter]);

  const handleCreate = async () => {
    if (!form.full_name.trim()) return;
    const result = await createProvider({
      full_name: form.full_name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      cpf: form.cpf || null,
      cnpj: form.cnpj || null,
      company_name: form.company_name || null,
      service_type: form.is_recruitment_partner ? (form.service_type || "Recrutamento & Seleção") : (form.service_type || null),
      position: form.position || null,
      is_recruitment_partner: form.is_recruitment_partner,
      recruitment_commission_pct: form.recruitment_commission_pct ? Number(form.recruitment_commission_pct) : null,
    } as any);
    if (result) {
      setDialogOpen(false);
      setForm({ full_name: "", email: "", phone: "", cpf: "", cnpj: "", company_name: "", service_type: "", position: "", is_recruitment_partner: false, recruitment_commission_pct: "" });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Handshake className="h-6 w-6 text-amber-600" />
            Prestadores de Serviço
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus prestadores de serviço e parceiros PJ
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Prestador
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa, CNPJ ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="terminated">Encerrados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{providers.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold text-emerald-600">
            {providers.filter(p => p.status === "active").length}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Inativos</p>
          <p className="text-2xl font-bold text-muted-foreground">
            {providers.filter(p => p.status === "inactive").length}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Encerrados</p>
          <p className="text-2xl font-bold text-destructive">
            {providers.filter(p => p.status === "terminated").length}
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Handshake className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum prestador encontrado</p>
          <p className="text-sm mt-1">Cadastre seu primeiro prestador de serviço</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(provider => {
            const statusInfo = STATUS_MAP[provider.status || "active"] || STATUS_MAP.active;
            return (
              <div
                key={provider.id}
                onClick={() => navigate(`/rh/service-providers/${provider.id}`)}
                className="flex items-center gap-4 p-4 bg-card border rounded-lg hover:shadow-md transition-all cursor-pointer group"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={provider.avatar_url || ""} />
                  <AvatarFallback className="bg-amber-100 text-amber-700 font-semibold">
                    {getInitials(provider.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground truncate">{provider.full_name}</p>
                    <Badge variant={statusInfo.variant} className="text-[10px]">
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    {provider.company_name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {provider.company_name}
                      </span>
                    )}
                    {provider.service_type && (
                      <span>{provider.service_type}</span>
                    )}
                    {provider.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {provider.email}
                      </span>
                    )}
                    {provider.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {provider.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Prestador de Serviço</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            <div>
              <Label>Nome completo *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nome do prestador" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
              </div>
            </div>
            <div>
              <Label>Razão Social / Empresa</Label>
              <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Nome da empresa PJ" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de Serviço</Label>
                <Input value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))} placeholder="Ex: Consultoria, Design..." />
              </div>
              <div>
                <Label>Função</Label>
                <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Ex: Consultor, Designer..." />
              </div>
            </div>
            <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="flex items-center gap-1.5 text-sm"><UserSearch className="h-4 w-4 text-violet-600" /> Parceiro de Recrutamento & Seleção</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Marque se este prestador é uma consultoria que capta candidatos para suas vagas.</p>
                </div>
                <Switch checked={form.is_recruitment_partner} onCheckedChange={(v) => setForm(f => ({ ...f, is_recruitment_partner: v }))} />
              </div>
              {form.is_recruitment_partner && (
                <div>
                  <Label className="text-xs">Comissão por contratação (%)</Label>
                  <Input type="number" step="0.1" value={form.recruitment_commission_pct} onChange={e => setForm(f => ({ ...f, recruitment_commission_pct: e.target.value }))} placeholder="Ex: 15" />
                </div>
              )}
            </div>
            <Button onClick={handleCreate} disabled={!form.full_name.trim()} className="w-full">
              Cadastrar Prestador
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
