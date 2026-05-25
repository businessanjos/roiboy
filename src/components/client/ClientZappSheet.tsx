import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  Save, 
  User, 
  Phone, 
  Mail, 
  Building2, 
  MapPin, 
  Calendar, 
  FileText, 
  Instagram,
  DollarSign,
  Plus,
  ExternalLink,
  TrendingUp,
  Trophy,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { 
  formatCPF, 
  formatCNPJ, 
  formatCEP,
  formatBrazilianPhone,
  formatInternationalPhone,
  formatDateBR,
  parseDateBRToISO,
  parseISOToDateBR,
} from "@/lib/validators";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ClientZappSheetProps {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientUpdated?: () => void;
}

interface ClientData {
  id: string;
  full_name: string;
  phone_e164: string;
  emails: unknown; // Can be array of strings, array of objects, or object
  cpf: string | null;
  cnpj: string | null;
  birth_date: string | null;
  company_name: string | null;
  notes: string | null;
  instagram: string | null;
  bio: string | null;
  avatar_url: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

interface DealStage {
  id: string;
  name: string;
  color: string;
  probability: number;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  status: 'open' | 'won' | 'lost';
  stage_id: string | null;
  expected_close_date: string | null;
  created_at: string;
  stage?: DealStage | null;
}

// Helper function to extract first email from various data formats
const extractFirstEmail = (emails: unknown): string => {
  if (!emails) return "";
  
  // If it's an array
  if (Array.isArray(emails)) {
    const first = emails[0];
    if (!first) return "";
    // If the item is a string, return it directly
    if (typeof first === "string") return first;
    // If it's an object with email property
    if (typeof first === "object" && first !== null) {
      if ("email" in first && typeof (first as any).email === "string") return (first as any).email;
      // If it's an object with numeric property (e.g., {0: "email"})
      if ("0" in first && typeof (first as any)["0"] === "string") return (first as any)["0"];
    }
  }
  
  // If it's an object (not array)
  if (typeof emails === "object" && emails !== null) {
    if ("email" in emails && typeof (emails as any).email === "string") return (emails as any).email;
    if ("0" in emails && typeof (emails as any)["0"] === "string") return (emails as any)["0"];
  }
  
  // If it's a direct string
  if (typeof emails === "string") return emails;
  
  return "";
};

export function ClientZappSheet({ 
  clientId, 
  open, 
  onOpenChange,
  onClientUpdated 
}: ClientZappSheetProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"client" | "deals">("client");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone_e164: "",
    email: "",
    cpf: "",
    cnpj: "",
    birth_date: "",
    company_name: "",
    notes: "",
    instagram: "",
    bio: "",
    street: "",
    street_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
  });

  // Deals state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  
  // New deal form
  const [showNewDealForm, setShowNewDealForm] = useState(false);
  const [newDealForm, setNewDealForm] = useState({
    title: "",
    value: "",
    stage_id: "",
  });
  const [creatingDeal, setCreatingDeal] = useState(false);

  // Dirty state for unsaved changes
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
  const initialFormDataRef = useRef<typeof formData | null>(null);

  useEffect(() => {
    if (clientId && open) {
      fetchClient();
      fetchDeals();
      fetchStages();
      setIsDirty(false);
    }
  }, [clientId, open]);

  const fetchClient = async () => {
    if (!clientId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (error) throw error;

      const clientData: ClientData = {
        id: data.id,
        full_name: data.full_name,
        phone_e164: data.phone_e164,
        emails: data.emails, // Keep raw data, will be processed by extractFirstEmail
        cpf: data.cpf,
        cnpj: data.cnpj,
        birth_date: data.birth_date,
        company_name: data.company_name,
        notes: data.notes,
        instagram: data.instagram,
        bio: data.bio,
        avatar_url: data.avatar_url,
        street: data.street,
        street_number: data.street_number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
      };

      setClient(clientData);
      const initialData = {
        full_name: clientData.full_name || "",
        phone_e164: formatInternationalPhone(clientData.phone_e164 || "") || clientData.phone_e164 || "",
        email: extractFirstEmail(clientData.emails),
        cpf: formatCPF(clientData.cpf || "") || "",
        cnpj: formatCNPJ(clientData.cnpj || "") || "",
        birth_date: clientData.birth_date ? parseISOToDateBR(clientData.birth_date) : "",
        company_name: clientData.company_name || "",
        notes: clientData.notes || "",
        instagram: clientData.instagram || "",
        bio: clientData.bio || "",
        street: clientData.street || "",
        street_number: clientData.street_number || "",
        complement: clientData.complement || "",
        neighborhood: clientData.neighborhood || "",
        city: clientData.city || "",
        state: clientData.state || "",
        zip_code: formatCEP(clientData.zip_code || "") || "",
      };
      setFormData(initialData);
      initialFormDataRef.current = initialData;
      setIsDirty(false);
    } catch (error) {
      console.error("Error fetching client:", error);
      toast.error("Erro ao carregar dados do cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setShowUnsavedAlert(true);
    } else {
      onOpenChange(newOpen);
    }
  };

  const handleDiscardChanges = () => {
    setShowUnsavedAlert(false);
    setIsDirty(false);
    onOpenChange(false);
  };

  const handleSaveAndClose = async () => {
    await handleSave();
    setShowUnsavedAlert(false);
    setIsDirty(false);
    onOpenChange(false);
  };

  const fetchDeals = async () => {
    if (!clientId) return;
    
    setLoadingDeals(true);
    try {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          id,
          title,
          value,
          status,
          stage_id,
          expected_close_date,
          created_at,
          stage:deal_stages(id, name, color, probability)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDeals((data || []).map(d => ({
        ...d,
        status: d.status as 'open' | 'won' | 'lost',
        stage: d.stage as DealStage | null,
      })));
    } catch (error) {
      console.error("Error fetching deals:", error);
    } finally {
      setLoadingDeals(false);
    }
  };

  const fetchStages = async () => {
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();
      
      if (!userData?.account_id) return;

      const { data, error } = await supabase
        .from("deal_stages")
        .select("id, name, color, probability")
        .eq("account_id", userData.account_id)
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      setStages(data || []);
      
      // Set default stage for new deal
      if (data && data.length > 0 && !newDealForm.stage_id) {
        setNewDealForm(prev => ({ ...prev, stage_id: data[0].id }));
      }
    } catch (error) {
      console.error("Error fetching stages:", error);
    }
  };

  const handleSave = async () => {
    if (!clientId) return;

    setSaving(true);
    try {
      const updateData: any = {
        full_name: formData.full_name.trim(),
        company_name: formData.company_name.trim() || null,
        notes: formData.notes.trim() || null,
        instagram: formData.instagram.trim() || null,
        bio: formData.bio.trim() || null,
        cpf: formData.cpf.replace(/\D/g, "") || null,
        cnpj: formData.cnpj.replace(/\D/g, "") || null,
        birth_date: formData.birth_date ? parseDateBRToISO(formData.birth_date) : null,
        street: formData.street.trim() || null,
        street_number: formData.street_number.trim() || null,
        complement: formData.complement.trim() || null,
        neighborhood: formData.neighborhood.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        zip_code: formData.zip_code.replace(/\D/g, "") || null,
      };

      // Handle email array
      if (formData.email.trim()) {
        updateData.emails = [formData.email.trim()];
      }

      const { error } = await supabase
        .from("clients")
        .update(updateData)
        .eq("id", clientId);

      if (error) throw error;

      toast.success("Cliente atualizado com sucesso!");
      setIsDirty(false);
      initialFormDataRef.current = formData;
      onClientUpdated?.();
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error("Erro ao atualizar cliente");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!clientId || !newDealForm.title.trim()) {
      toast.error("Título do negócio é obrigatório");
      return;
    }

    setCreatingDeal(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id, id")
        .single();
      
      if (!userData?.account_id) throw new Error("Conta não encontrada");

      const selectedStage = stages.find(s => s.id === newDealForm.stage_id);

      if (!newDealForm.stage_id) {
        throw new Error("Selecione uma etapa para criar o negócio");
      }

      const { data: stageData, error: stageError } = await supabase
        .from("deal_stages")
        .select("pipeline_id")
        .eq("id", newDealForm.stage_id)
        .single();

      if (stageError) throw stageError;

      const { error } = await supabase.from("deals").insert({
        account_id: userData.account_id,
        client_id: clientId,
        title: newDealForm.title.trim(),
        value: parseFloat(newDealForm.value.replace(/\D/g, "") || "0") / 100,
        stage_id: newDealForm.stage_id,
        pipeline_id: stageData.pipeline_id,
        probability: selectedStage?.probability || 0,
        responsible_user_id: userData.id,
        status: "open",
        tags: [],
      });

      if (error) throw error;

      toast.success("Negócio criado com sucesso!");
      setShowNewDealForm(false);
      setNewDealForm({ title: "", value: "", stage_id: stages[0]?.id || "" });
      fetchDeals();
    } catch (error: any) {
      console.error("Error creating deal:", error);
      toast.error(error.message || "Erro ao criar negócio");
    } finally {
      setCreatingDeal(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCurrencyInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const number = parseInt(digits) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(number);
  };

  const openDeals = deals.filter(d => d.status === "open");
  const closedDeals = deals.filter(d => d.status !== "open");
  const totalValue = openDeals.reduce((sum, d) => sum + d.value, 0);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-[380px] sm:w-[460px] bg-zapp-bg border-zapp-border p-0 flex flex-col">
        <SheetHeader className="px-5 py-3 bg-zapp-panel relative">
          <div className="flex items-center gap-3">
            {client && (
              <Avatar className="h-10 w-10">
                <AvatarImage src={client.avatar_url || undefined} />
                <AvatarFallback className="bg-zapp-accent text-white">
                  {getInitials(client.full_name)}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0 pr-10">
              <SheetTitle className="text-zapp-text truncate">
                {client?.full_name || "Carregando..."}
              </SheetTitle>
              <p className="text-xs text-zapp-text-muted truncate">
                {client?.phone_e164}
              </p>
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-zapp-accent" />
          </div>
        ) : client ? (
          <>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "client" | "deals")} className="flex flex-col">
              <div className="px-4 py-1.5 bg-zapp-panel border-b border-zapp-border flex items-center justify-center">
                <TabsList className="w-full grid grid-cols-2 bg-zapp-bg-dark">
                  <TabsTrigger value="client" className="text-zapp-text data-[state=active]:bg-zapp-accent data-[state=active]:text-white">
                    <User className="h-4 w-4 mr-1.5" />
                    Cliente
                  </TabsTrigger>
                  <TabsTrigger value="deals" className="text-zapp-text data-[state=active]:bg-zapp-accent data-[state=active]:text-white">
                    <DollarSign className="h-4 w-4 mr-1.5" />
                    Negócios
                    {openDeals.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] bg-zapp-accent/20 text-zapp-accent">
                        {openDeals.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="client" className="m-0">
                <div className="p-2 space-y-2">
                    {/* Basic Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-zapp-text font-medium text-xs">
                        <User className="h-3 w-3" />
                        <span>Informações Básicas</span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="space-y-0.5">
                          <Label className="text-zapp-text-muted text-xs">Nome completo</Label>
                          <Input
                            value={formData.full_name}
                            onChange={(e) => handleFieldChange("full_name", e.target.value)}
                            className="bg-zapp-panel border-zapp-border text-zapp-text h-8 text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="space-y-0.5">
                            <Label className="text-zapp-text-muted text-xs">Telefone</Label>
                            <Input
                              value={formData.phone_e164}
                              disabled
                              className="bg-zapp-panel border-zapp-border text-zapp-text-muted h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-zapp-text-muted text-xs">E-mail</Label>
                            <Input
                              value={formData.email}
                              onChange={(e) => handleFieldChange("email", e.target.value)}
                              className="bg-zapp-panel border-zapp-border text-zapp-text h-8 text-sm"
                              type="email"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="space-y-0.5">
                            <Label className="text-zapp-text-muted text-xs">CPF</Label>
                            <Input
                              value={formData.cpf}
                              onChange={(e) => handleFieldChange("cpf", formatCPF(e.target.value))}
                              className="bg-zapp-panel border-zapp-border text-zapp-text h-8 text-sm"
                              maxLength={14}
                            />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-zapp-text-muted text-xs">Nascimento</Label>
                            <Input
                              value={formData.birth_date}
                              onChange={(e) => handleFieldChange("birth_date", formatDateBR(e.target.value))}
                              className="bg-zapp-panel border-zapp-border text-zapp-text h-8 text-sm"
                              placeholder="DD/MM/AAAA"
                              maxLength={10}
                            />
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <Label className="text-zapp-text-muted text-xs">Instagram</Label>
                          <Input
                            value={formData.instagram}
                            onChange={(e) => handleFieldChange("instagram", e.target.value)}
                            className="bg-zapp-panel border-zapp-border text-zapp-text h-8 text-sm"
                            placeholder="@usuario"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-zapp-border" />

                    {/* Company Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-zapp-text font-medium text-xs">
                        <Building2 className="h-3 w-3" />
                        <span>Empresa</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="space-y-0.5">
                          <Label className="text-zapp-text-muted text-xs">Nome da Empresa</Label>
                          <Input
                            value={formData.company_name}
                            onChange={(e) => handleFieldChange("company_name", e.target.value)}
                            className="bg-zapp-panel border-zapp-border text-zapp-text h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-zapp-text-muted text-xs">CNPJ</Label>
                          <Input
                            value={formData.cnpj}
                            onChange={(e) => handleFieldChange("cnpj", formatCNPJ(e.target.value))}
                            className="bg-zapp-panel border-zapp-border text-zapp-text h-8 text-sm"
                            maxLength={18}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-zapp-border" />

                    {/* Notes */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-zapp-text font-medium text-xs">
                        <FileText className="h-3 w-3" />
                        <span>Observações</span>
                      </div>
                      
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => handleFieldChange("notes", e.target.value)}
                        className="bg-zapp-panel border-zapp-border text-zapp-text resize-none text-sm"
                        rows={2}
                        placeholder="Notas sobre o cliente..."
                      />
                    </div>

                    {/* Footer - Save button */}
                    <div className="pt-4 border-t border-zapp-border mt-4">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => handleOpenChange(false)}
                          className="border-zapp-border text-zapp-text hover:bg-zapp-hover h-8 text-sm"
                        >
                          Fechar
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={saving || !formData.full_name.trim()}
                          className={cn(
                            "h-8 text-white text-sm",
                            isDirty 
                              ? "bg-amber-600 hover:bg-amber-700" 
                              : "bg-zapp-accent hover:bg-zapp-accent-hover"
                          )}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              {isDirty && <AlertCircle className="h-3.5 w-3.5 mr-1" />}
                              <Save className="h-3.5 w-3.5 mr-1" />
                              {isDirty ? "Salvar Alterações" : "Salvar"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
              </TabsContent>

              <TabsContent value="deals" className="flex-1 m-0 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {/* Summary Card */}
                    <div className="rounded-lg border border-zapp-border bg-zapp-panel p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-zapp-text-muted uppercase tracking-wide">Negócios Abertos</p>
                          <p className="text-2xl font-bold text-zapp-accent">{openDeals.length}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zapp-text-muted uppercase tracking-wide">Valor Total</p>
                          <p className="text-lg font-semibold text-emerald-500">{formatCurrency(totalValue)}</p>
                        </div>
                      </div>
                    </div>

                    {/* New Deal Form */}
                    {showNewDealForm ? (
                      <div className="rounded-lg border border-zapp-accent/50 bg-zapp-panel p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-zapp-text">Novo Negócio</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-zapp-text-muted hover:text-zapp-text"
                            onClick={() => setShowNewDealForm(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <Input
                            placeholder="Título do negócio"
                            value={newDealForm.title}
                            onChange={(e) => setNewDealForm({ ...newDealForm, title: e.target.value })}
                            className="bg-zapp-bg border-zapp-border text-zapp-text h-9"
                          />
                          
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Valor"
                              value={newDealForm.value}
                              onChange={(e) => setNewDealForm({ ...newDealForm, value: formatCurrencyInput(e.target.value) })}
                              className="bg-zapp-bg border-zapp-border text-zapp-text h-9"
                            />
                            
                            <Select
                              value={newDealForm.stage_id}
                              onValueChange={(v) => setNewDealForm({ ...newDealForm, stage_id: v })}
                            >
                              <SelectTrigger className="bg-zapp-bg border-zapp-border text-zapp-text h-9">
                                <SelectValue placeholder="Etapa" />
                              </SelectTrigger>
                              <SelectContent className="bg-zapp-panel border-zapp-border">
                                {stages.map((stage) => (
                                  <SelectItem 
                                    key={stage.id} 
                                    value={stage.id}
                                    className="text-zapp-text hover:bg-zapp-hover"
                                  >
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
                        
                        <Button
                          onClick={handleCreateDeal}
                          disabled={creatingDeal || !newDealForm.title.trim()}
                          className="w-full bg-zapp-accent hover:bg-zapp-accent-hover text-white h-9"
                        >
                          {creatingDeal ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Criar Negócio"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-dashed border-zapp-border text-zapp-text hover:bg-zapp-hover h-10"
                        onClick={() => setShowNewDealForm(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Negócio
                      </Button>
                    )}

                    {/* Open Deals */}
                    {openDeals.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-zapp-text-muted uppercase tracking-wide px-1">
                          Em andamento
                        </h4>
                        {openDeals.map((deal) => (
                          <div 
                            key={deal.id}
                            className="rounded-lg border border-zapp-border bg-zapp-panel p-3 hover:bg-zapp-hover transition-colors cursor-pointer"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(`/pipeline?deal=${deal.id}`);
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-zapp-text truncate">
                                    {deal.title}
                                  </p>
                                  <ExternalLink className="h-3 w-3 text-zapp-text-muted flex-shrink-0" />
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {deal.stage && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] h-4 px-1.5"
                                      style={{ 
                                        borderColor: deal.stage.color,
                                        color: deal.stage.color,
                                        backgroundColor: `${deal.stage.color}15`,
                                      }}
                                    >
                                      {deal.stage.name}
                                    </Badge>
                                  )}
                                  <span className="text-[10px] text-zapp-text-muted">
                                    {formatDistanceToNow(new Date(deal.created_at), { addSuffix: true, locale: ptBR })}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-semibold text-emerald-500">
                                  {formatCurrency(deal.value)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Closed Deals */}
                    {closedDeals.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-zapp-text-muted uppercase tracking-wide px-1">
                          Finalizados
                        </h4>
                        {closedDeals.map((deal) => (
                          <div 
                            key={deal.id}
                            className="rounded-lg border border-zapp-border bg-zapp-panel/50 p-3 hover:bg-zapp-hover transition-colors cursor-pointer"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(`/pipeline?deal=${deal.id}`);
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-zapp-text-muted truncate">
                                    {deal.title}
                                  </p>
                                  {deal.status === "won" ? (
                                    <Trophy className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-[10px] text-zapp-text-muted mt-0.5">
                                  {format(new Date(deal.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              </div>
                              <p className={cn(
                                "text-sm font-semibold flex-shrink-0",
                                deal.status === "won" ? "text-emerald-500" : "text-zapp-text-muted"
                              )}>
                                {formatCurrency(deal.value)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty state */}
                    {deals.length === 0 && !loadingDeals && (
                      <div className="text-center py-8">
                        <DollarSign className="h-10 w-10 mx-auto text-zapp-text-muted/30 mb-3" />
                        <p className="text-sm text-zapp-text-muted">
                          Nenhum negócio encontrado
                        </p>
                        <p className="text-xs text-zapp-text-muted/70 mt-1">
                          Crie um negócio para acompanhar a venda
                        </p>
                      </div>
                    )}

                    {loadingDeals && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1">
            <p className="text-zapp-text-muted">Cliente não encontrado</p>
          </div>
        )}
      </SheetContent>

      {/* Alert Dialog for unsaved changes */}
      <AlertDialog open={showUnsavedAlert} onOpenChange={setShowUnsavedAlert}>
        <AlertDialogContent className="bg-zapp-panel border-zapp-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zapp-text">Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription className="text-zapp-text-muted">
              Você tem alterações não salvas. Deseja salvar antes de sair?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              onClick={() => setShowUnsavedAlert(false)}
              className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleDiscardChanges}
              className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
            >
              Sair sem salvar
            </Button>
            <AlertDialogAction
              onClick={handleSaveAndClose}
              className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
