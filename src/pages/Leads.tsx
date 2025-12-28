import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLeads, Lead } from "@/hooks/useLeads";
import { useDeals } from "@/hooks/useDeals";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  X,
  Clock,
  TrendingUp,
  Settings2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadTimeline } from "@/components/leads/LeadTimeline";
import { toast } from "sonner";
import { LeadCustomFieldsManager, LeadFieldValueEditor, type LeadCustomField, FieldValueBadge, type FieldOption } from "@/components/custom-fields";
import { CustomField } from "@/components/custom-fields";

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
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
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
  const { createDeal, stages } = useDeals();

  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [convertLeadId, setConvertLeadId] = useState<string | null>(null);
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false);
  
  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, any>>>({});
  
  // Flow state for new lead creation
  const [dialogStep, setDialogStep] = useState<'phone' | 'lead-form' | 'deal-form'>('phone');
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [existingClient, setExistingClient] = useState<{ id: string; full_name: string; phone_e164: string } | null>(null);
  const [creatingDeal, setCreatingDeal] = useState(false);
  
  // Deal form state
  const [dealFormData, setDealFormData] = useState({
    title: "",
    value: "",
    stage_id: "",
    notes: "",
  });

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    source: "",
    notes: "",
  });

  // Fetch custom fields
  const fetchCustomFields = useCallback(async () => {
    const { data } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("is_active", true)
      .eq("show_in_leads", true)
      .order("display_order");
    
    if (data) {
      setCustomFields(data.map(f => ({
        id: f.id,
        name: f.name,
        field_type: f.field_type as CustomField["field_type"],
        options: (f.options as unknown as FieldOption[]) || [],
        is_required: f.is_required,
        display_order: f.display_order,
        is_active: f.is_active,
        show_in_clients: f.show_in_clients,
      })));
    }
  }, []);

  // Fetch field values for leads
  const fetchFieldValues = useCallback(async () => {
    if (leads.length === 0) return;
    
    const leadIds = leads.map(l => l.id);
    const { data } = await supabase
      .from("lead_field_values")
      .select("*")
      .in("lead_id", leadIds);
    
    if (data) {
      const valuesMap: Record<string, Record<string, any>> = {};
      data.forEach(fv => {
        if (!valuesMap[fv.lead_id]) valuesMap[fv.lead_id] = {};
        const value = fv.value_boolean ?? fv.value_number ?? fv.value_text ?? fv.value_date ?? fv.value_json;
        valuesMap[fv.lead_id][fv.field_id] = value;
      });
      setFieldValues(valuesMap);
    }
  }, [leads]);

  useEffect(() => {
    fetchCustomFields();
  }, [fetchCustomFields]);

  useEffect(() => {
    if (leads.length > 0) {
      fetchFieldValues();
    }
  }, [leads, fetchFieldValues]);

  const handleFieldValueChange = (leadId: string, fieldId: string, newValue: any) => {
    setFieldValues(prev => ({
      ...prev,
      [leadId]: {
        ...(prev[leadId] || {}),
        [fieldId]: newValue
      }
    }));
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      phone: "",
      email: "",
      source: "",
      notes: "",
    });
    setDealFormData({
      title: "",
      value: "",
      stage_id: "",
      notes: "",
    });
    setSelectedLead(null);
    setExistingClient(null);
    setDialogStep('phone');
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
    setDialogStep('lead-form');
    setIsDialogOpen(true);
  };

  const handlePhoneCheck = async () => {
    if (!formData.phone || formData.phone.replace(/\D/g, '').length < 8) {
      toast.error("Informe um telefone válido");
      return;
    }
    
    setCheckingPhone(true);
    try {
      const normalizedPhone = formData.phone.replace(/\D/g, '');
      
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164")
        .or(`phone_e164.ilike.%${normalizedPhone}%`)
        .limit(1);
      
      if (data && data.length > 0) {
        // Client exists - go to deal form
        setExistingClient(data[0]);
        const firstStage = stages.sort((a, b) => a.display_order - b.display_order)[0];
        setDealFormData({
          title: `Novo negócio - ${data[0].full_name}`,
          value: "",
          stage_id: firstStage?.id || "",
          notes: "",
        });
        setDialogStep('deal-form');
      } else {
        // No client - go to lead form
        setExistingClient(null);
        setDialogStep('lead-form');
      }
    } catch (error) {
      console.error("Error checking phone:", error);
      toast.error("Erro ao verificar telefone");
    } finally {
      setCheckingPhone(false);
    }
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) return;

    // If editing, just update
    if (selectedLead) {
      await updateLead(selectedLead.id, formData);
      setIsDialogOpen(false);
      resetForm();
      return;
    }

    // Create new lead
    await createLead(formData);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleCreateDeal = async () => {
    if (!existingClient) return;
    
    setCreatingDeal(true);
    try {
      const deal = await createDeal({
        title: dealFormData.title || `Novo negócio - ${existingClient.full_name}`,
        client_id: existingClient.id,
        stage_id: dealFormData.stage_id || undefined,
        value: dealFormData.value ? parseFloat(dealFormData.value) : undefined,
        notes: dealFormData.notes || undefined,
      });

      if (deal) {
        toast.success("Negócio criado com sucesso!");
        setIsDialogOpen(false);
        resetForm();
        navigate("/pipeline");
      }
    } catch (error) {
      console.error("Error creating deal:", error);
      toast.error("Erro ao criar negócio");
    } finally {
      setCreatingDeal(false);
    }
  };

  const handleCreateLeadAnyway = () => {
    setExistingClient(null);
    setDialogStep('lead-form');
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setFieldsDialogOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Campos
            </Button>
            <Button onClick={openNewDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </div>
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
              <Card 
                key={lead.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setDetailLead(lead)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(lead.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{lead.full_name}</span>
                        {getStatusBadge(lead.status)}
                        {/* Custom field badges */}
                        {customFields.slice(0, 2).map(field => {
                          const value = fieldValues[lead.id]?.[field.id];
                          if (value === undefined || value === null) return null;
                          return (
                            <div key={field.id} onClick={(e) => e.stopPropagation()}>
                              <LeadFieldValueEditor
                                field={field}
                                leadId={lead.id}
                                accountId={currentUser?.account_id || ""}
                                currentValue={value}
                                onValueChange={(fId, nv) => handleFieldValueChange(lead.id, fId, nv)}
                              />
                            </div>
                          );
                        })}
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

      {/* Create/Edit Dialog with Step Flow */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { 
        setIsDialogOpen(open); 
        if (!open) resetForm(); 
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedLead ? "Editar Lead" : 
                dialogStep === 'phone' ? "Verificar Telefone" :
                dialogStep === 'deal-form' ? "Criar Negócio" : "Novo Lead"}
            </DialogTitle>
            {dialogStep === 'phone' && !selectedLead && (
              <DialogDescription>
                Informe o telefone para verificar se já é um cliente
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Step 1: Phone Check */}
          {dialogStep === 'phone' && !selectedLead && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+55 11 99999-9999"
                  autoFocus
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handlePhoneCheck} 
                  disabled={checkingPhone || !formData.phone.trim()}
                >
                  {checkingPhone ? "Verificando..." : "Continuar"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2a: Lead Form (if no existing client) */}
          {(dialogStep === 'lead-form' || selectedLead) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nome completo"
                  autoFocus
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
                    disabled={!selectedLead}
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

              <DialogFooter>
                {!selectedLead && (
                  <Button variant="ghost" onClick={() => setDialogStep('phone')}>
                    Voltar
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={!formData.full_name.trim()}>
                  {selectedLead ? "Salvar" : "Criar Lead"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2b: Deal Form (if existing client found) */}
          {dialogStep === 'deal-form' && existingClient && !selectedLead && (
            <div className="space-y-4">
              {/* Client Info */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary">
                      {existingClient.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{existingClient.full_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {existingClient.phone_e164}
                    </p>
                  </div>
                  <Badge className="ml-auto bg-emerald-500 text-white">
                    <UserCheck className="h-3 w-3 mr-1" />
                    Cliente
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deal_title">Título do Negócio</Label>
                <Input
                  id="deal_title"
                  value={dealFormData.title}
                  onChange={(e) => setDealFormData({ ...dealFormData, title: e.target.value })}
                  placeholder="Ex: Consultoria inicial"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deal_value">Valor (R$)</Label>
                  <Input
                    id="deal_value"
                    type="number"
                    value={dealFormData.value}
                    onChange={(e) => setDealFormData({ ...dealFormData, value: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deal_stage">Etapa</Label>
                  <Select
                    value={dealFormData.stage_id}
                    onValueChange={(value) => setDealFormData({ ...dealFormData, stage_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.sort((a, b) => a.display_order - b.display_order).map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deal_notes">Observações</Label>
                <Textarea
                  id="deal_notes"
                  value={dealFormData.notes}
                  onChange={(e) => setDealFormData({ ...dealFormData, notes: e.target.value })}
                  placeholder="Anotações sobre o negócio..."
                  rows={2}
                />
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="ghost" onClick={handleCreateLeadAnyway} className="sm:mr-auto">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar lead mesmo assim
                </Button>
                <Button variant="outline" onClick={() => setDialogStep('phone')}>
                  Voltar
                </Button>
                <Button onClick={handleCreateDeal} disabled={creatingDeal}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {creatingDeal ? "Criando..." : "Criar Negócio"}
                </Button>
              </DialogFooter>
            </div>
          )}
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

      {/* Lead Detail Sheet with Timeline */}
      <Sheet open={!!detailLead} onOpenChange={(open) => !open && setDetailLead(null)}>
        <SheetContent className="sm:max-w-md overflow-hidden flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {detailLead ? getInitials(detailLead.full_name) : ""}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="block">{detailLead?.full_name}</span>
                  {detailLead && getStatusBadge(detailLead.status)}
                </div>
              </SheetTitle>
            </div>
          </SheetHeader>

          {detailLead && (
            <div className="flex-1 overflow-hidden flex flex-col mt-4">
              {/* Lead Info */}
              <div className="flex-shrink-0 space-y-2 pb-4 border-b">
                {detailLead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{detailLead.phone}</span>
                  </div>
                )}
                {detailLead.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{detailLead.email}</span>
                  </div>
                )}
                {detailLead.source && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs">
                      {LEAD_SOURCES.find((s) => s.value === detailLead.source)?.label || detailLead.source}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Criado em {format(new Date(detailLead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
                {detailLead.notes && (
                  <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                    {detailLead.notes}
                  </p>
                )}
              </div>

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <div className="flex-shrink-0 py-4 border-t">
                  <h3 className="text-sm font-semibold mb-3">Campos Personalizados</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {customFields.map(field => (
                      <div key={field.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground shrink-0">{field.name}:</span>
                        <LeadFieldValueEditor
                          field={field}
                          leadId={detailLead.id}
                          accountId={currentUser?.account_id || ""}
                          currentValue={fieldValues[detailLead.id]?.[field.id]}
                          onValueChange={(fId, nv) => handleFieldValueChange(detailLead.id, fId, nv)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="flex-1 overflow-hidden pt-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Jornada de Compra
                </h3>
                <ScrollArea className="h-[calc(100vh-500px)]">
                  <LeadTimeline leadId={detailLead.id} />
                </ScrollArea>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 pt-4 border-t flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    openEditDialog(detailLead);
                    setDetailLead(null);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setConvertLeadId(detailLead.id);
                    setDetailLead(null);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Converter em Cliente
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Custom Fields Manager Dialog */}
      <Dialog open={fieldsDialogOpen} onOpenChange={setFieldsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campos Personalizados de Leads</DialogTitle>
          </DialogHeader>
          <LeadCustomFieldsManager 
            open={true} 
            onOpenChange={() => {}} 
            onFieldsChange={fetchCustomFields}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
