import { useState } from "react";
import { useLeads, Lead } from "@/hooks/useLeads";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  MoreHorizontal,
  UserPlus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Users,
  UserCheck,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const LEAD_SOURCES = [
  { value: "website", label: "Website" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "indicacao", label: "Indicação" },
  { value: "evento", label: "Evento" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" },
];

const LEAD_STATUS = [
  { value: "new", label: "Novo", color: "bg-blue-500" },
  { value: "contacted", label: "Contatado", color: "bg-amber-500" },
  { value: "qualified", label: "Qualificado", color: "bg-emerald-500" },
  { value: "unqualified", label: "Não Qualificado", color: "bg-gray-500" },
];

export default function Leads() {
  const {
    leads,
    loading,
    newLeads,
    contactedLeads,
    qualifiedLeads,
    createLead,
    updateLead,
    deleteLead,
    convertToClient,
  } = useLeads();

  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [convertLeadId, setConvertLeadId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    source: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      email: "",
      source: "",
      notes: "",
    });
    setSelectedLead(null);
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      full_name: lead.full_name,
      phone: lead.phone || "",
      email: lead.email || "",
      source: lead.source || "",
      notes: lead.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) return;

    if (selectedLead) {
      await updateLead(selectedLead.id, formData);
    } else {
      await createLead(formData);
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteLeadId) {
      await deleteLead(deleteLeadId);
      setDeleteLeadId(null);
    }
  };

  const handleConvert = async () => {
    if (convertLeadId) {
      await convertToClient(convertLeadId);
      setConvertLeadId(null);
    }
  };

  const handleStatusChange = async (leadId: string, status: string) => {
    await updateLead(leadId, { status });
  };

  const filteredLeads = leads.filter(
    (lead) =>
      lead.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    const s = LEAD_STATUS.find((s) => s.value === status);
    return (
      <Badge variant="secondary" className={`${s?.color || "bg-gray-500"} text-white text-[10px]`}>
        {s?.label || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Leads</h1>
            <p className="text-muted-foreground text-xs">
              Gerencie seus leads antes de se tornarem clientes
            </p>
          </div>
          <Button onClick={openNewDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 overflow-x-auto pb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 min-w-fit">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{leads.length}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 min-w-fit">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm font-medium">{newLeads.length}</span>
            <span className="text-xs text-muted-foreground">Novos</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 min-w-fit">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-medium">{contactedLeads.length}</span>
            <span className="text-xs text-muted-foreground">Contatados</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 min-w-fit">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium">{qualifiedLeads.length}</span>
            <span className="text-xs text-muted-foreground">Qualificados</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Leads List */}
        {filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {searchQuery ? "Nenhum lead encontrado" : "Nenhum lead cadastrado ainda"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredLeads.map((lead) => (
              <Card key={lead.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(lead.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{lead.full_name}</span>
                        {getStatusBadge(lead.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {lead.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </span>
                        )}
                        {lead.source && (
                          <Badge variant="outline" className="text-[10px]">
                            {LEAD_SOURCES.find((s) => s.value === lead.source)?.label || lead.source}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground text-right">
                      {format(new Date(lead.created_at), "dd/MM/yy", { locale: ptBR })}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "contacted")}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Marcar Contatado
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "qualified")}>
                          <UserCheck className="h-4 w-4 mr-2" />
                          Marcar Qualificado
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConvertLeadId(lead.id)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Converter em Cliente
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEditDialog(lead)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteLeadId(lead.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedLead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+55 11 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Origem</Label>
              <Select
                value={formData.source}
                onValueChange={(value) => setFormData({ ...formData, source: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="De onde veio o lead?" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre o lead..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.full_name.trim()}>
              {selectedLead ? "Salvar" : "Criar Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLeadId} onOpenChange={() => setDeleteLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert Confirmation */}
      <AlertDialog open={!!convertLeadId} onOpenChange={() => setConvertLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter em cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O lead será convertido em cliente e você poderá adicionar mais informações depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvert}>
              Converter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
