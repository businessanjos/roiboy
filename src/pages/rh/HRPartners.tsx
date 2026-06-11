import { useState, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHRPartners, HRPartner } from "@/hooks/useHRPartners";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search, Plus, Crown, Building2, Phone, Mail, Percent,
} from "lucide-react";

const RH_ALLOWED_EMAILS = ["m.quintana@me.com", "coachevertonsantos@gmail.com", "rh@anjosbusiness.com.br", "diessica@consultoria-luma.com", "jaqueline@consultoria-luma.com"];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  inactive: { label: "Inativo", variant: "secondary" },
  exited: { label: "Saído", variant: "destructive" },
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function HRPartners() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { partners, loading, createPartner } = useHRPartners();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    position: "",
    department: "",
    ownership_percentage: "",
  });

  const filtered = useMemo(() => {
    return partners.filter(p => {
      const s = search.toLowerCase();
      if (s && !(
        p.full_name.toLowerCase().includes(s) ||
        (p.email || "").toLowerCase().includes(s) ||
        (p.cpf || "").includes(s) ||
        (p.department || "").toLowerCase().includes(s)
      )) return false;
      return true;
    });
  }, [partners, search]);

  if (currentUser && !RH_ALLOWED_EMAILS.includes((currentUser.email || "").toLowerCase())) {
    return <Navigate to="/" replace />;
  }


  const handleCreate = async () => {
    if (!form.full_name.trim()) return;
    const result = await createPartner({
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      cpf: form.cpf || null,
      position: form.position || null,
      department: form.department || null,
      ownership_percentage: form.ownership_percentage ? Number(form.ownership_percentage) : null,
    });
    if (result) {
      setDialogOpen(false);
      setForm({ full_name: "", email: "", phone: "", cpf: "", position: "", department: "", ownership_percentage: "" });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            Quadro Societário
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os sócios e o quadro societário da empresa
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Sócio
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou departamento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? "Nenhum sócio encontrado." : "Nenhum sócio cadastrado ainda."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(partner => {
            const statusInfo = STATUS_MAP[partner.status || "active"] || STATUS_MAP.active;
            return (
              <div
                key={partner.id}
                onClick={() => navigate(`/rh/partners/${partner.id}`)}
                className="flex items-center gap-4 p-4 bg-card border rounded-lg hover:shadow-md transition-all cursor-pointer group"
              >
                <Avatar className="h-12 w-12 border-2 border-primary/20">
                  <AvatarImage src={partner.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getInitials(partner.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">{partner.full_name}</span>
                    <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {partner.position && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {partner.position}
                      </span>
                    )}
                    {partner.ownership_percentage != null && (
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        {partner.ownership_percentage}% participação
                      </span>
                    )}
                    {partner.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {partner.email}
                      </span>
                    )}
                    {partner.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {partner.phone}
                      </span>
                    )}
                    {partner.pro_labore != null && (
                      <span className="font-medium text-primary">
                        Pró-labore: R$ {partner.pro_labore.toLocaleString("pt-BR")}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Sócio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo *</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
              </div>
              <div>
                <Label>Participação (%)</Label>
                <Input type="number" value={form.ownership_percentage} onChange={e => setForm(f => ({ ...f, ownership_percentage: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cargo</Label>
                <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
              </div>
              <div>
                <Label>Departamento</Label>
                <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.full_name.trim()}>
              Cadastrar Sócio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
