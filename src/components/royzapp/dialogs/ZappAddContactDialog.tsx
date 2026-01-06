import { memo, useState, useEffect, useCallback } from "react";
import { UserPlus, TrendingUp, Users, Loader2, Home, Building2, Landmark, User, Briefcase, Link2, Search, Phone, Package, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { brazilianBanks } from "@/data/brazilian-banks";
import { toast } from "sonner";

interface LeadFormData {
  full_name: string;
  phone: string;
  email: string;
  source: string;
  notes: string;
  // Dados pessoais
  cpf: string;
  rg: string;
  birth_date: string;
  // Dados empresa
  cnpj: string;
  company_name: string;
  business_segment: string;
  business_niche: string;
  // Endereço residencial
  street: string;
  street_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  // Endereço comercial
  business_street: string;
  business_street_number: string;
  business_complement: string;
  business_neighborhood: string;
  business_city: string;
  business_state: string;
  business_zip_code: string;
  // Dados bancários
  bank_code: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  bank_account_type: string;
  pix_key: string;
  pix_key_type: string;
  instagram: string;
}

const initialLeadForm: LeadFormData = {
  full_name: "",
  phone: "",
  email: "",
  source: "whatsapp",
  notes: "",
  cpf: "",
  rg: "",
  birth_date: "",
  cnpj: "",
  company_name: "",
  business_segment: "",
  business_niche: "",
  street: "",
  street_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  business_street: "",
  business_street_number: "",
  business_complement: "",
  business_neighborhood: "",
  business_city: "",
  business_state: "",
  business_zip_code: "",
  bank_code: "",
  bank_name: "",
  bank_agency: "",
  bank_account: "",
  bank_account_type: "checking",
  pix_key: "",
  pix_key_type: "",
  instagram: "",
};

// Types for linked results
interface LinkResult {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  type: "client" | "lead" | "deal";
  status?: string;
  products?: { id: string; name: string; color?: string }[];
  stage_name?: string;
}

interface ZappAddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  contactName: string;
  showLeadOption: boolean;
  onSaveClient: (data: { full_name: string; phone_e164: string }) => Promise<void>;
  onSaveLead: (data: LeadFormData) => Promise<void>;
  savingClient: boolean;
  savingLead: boolean;
  // Link props
  accountId?: string;
  conversationId?: string;
  onLinked?: () => void;
}

const LEAD_SOURCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "indicacao", label: "Indicação" },
  { value: "site", label: "Site" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

export const ZappAddContactDialog = memo(function ZappAddContactDialog({
  open,
  onOpenChange,
  phone,
  contactName,
  showLeadOption,
  onSaveClient,
  onSaveLead,
  savingClient,
  savingLead,
  accountId,
  conversationId,
  onLinked,
}: ZappAddContactDialogProps) {
  const [activeTab, setActiveTab] = useState<"client" | "lead" | "link">("client");
  const [leadSection, setLeadSection] = useState<"basic" | "address" | "bank">("basic");
  
  // Client form
  const [clientForm, setClientForm] = useState({
    full_name: "",
    phone_e164: "",
  });
  
  // Lead form
  const [leadForm, setLeadForm] = useState<LeadFormData>(initialLeadForm);

  // Link search state
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<LinkResult[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkResult | null>(null);
  const [addPhoneToLink, setAddPhoneToLink] = useState(true);
  const [linking, setLinking] = useState(false);

  // Search for clients, leads and deals
  const searchForLink = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2 || !accountId) {
      setLinkResults([]);
      return;
    }

    setLinkLoading(true);
    try {
      const cleanQuery = query.trim();
      const phoneQuery = cleanQuery.replace(/\D/g, "");

      // Search clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select(`
          id, full_name, phone_e164, avatar_url,
          client_products(product:products(id, name, color))
        `)
        .eq("account_id", accountId)
        .eq("status", "active")
        .or(`full_name.ilike.%${cleanQuery}%,phone_e164.ilike.%${phoneQuery}%`)
        .limit(5);

      // Search leads
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, full_name, phone, status")
        .eq("account_id", accountId)
        .neq("status", "converted")
        .or(`full_name.ilike.%${cleanQuery}%,phone.ilike.%${phoneQuery}%`)
        .limit(5);

      // Search deals
      const { data: dealsData } = await supabase
        .from("deals")
        .select(`
          id, title, value, 
          lead:leads!deals_lead_id_fkey(id, full_name, phone),
          stage:deal_stages!deals_stage_id_fkey(name)
        `)
        .eq("account_id", accountId)
        .neq("status", "lost")
        .neq("status", "won")
        .ilike("title", `%${cleanQuery}%`)
        .limit(5);

      // Combine results
      const results: LinkResult[] = [];
      
      (clientsData || []).forEach(c => {
        results.push({
          id: c.id,
          full_name: c.full_name,
          phone: c.phone_e164,
          avatar_url: c.avatar_url,
          type: "client",
          products: c.client_products?.map((cp: any) => cp.product).filter(Boolean) || [],
        });
      });

      (leadsData || []).forEach(l => {
        results.push({
          id: l.id,
          full_name: l.full_name,
          phone: l.phone,
          avatar_url: null,
          type: "lead",
          status: l.status,
        });
      });

      (dealsData || []).forEach(d => {
        const lead = d.lead as any;
        results.push({
          id: d.id,
          full_name: d.title,
          phone: lead?.phone || null,
          avatar_url: null,
          type: "deal",
          stage_name: (d.stage as any)?.name,
        });
      });

      setLinkResults(results);
    } catch (error) {
      console.error("Error searching for link:", error);
      setLinkResults([]);
    } finally {
      setLinkLoading(false);
    }
  }, [accountId]);

  // Debounced search
  useEffect(() => {
    if (activeTab === "link") {
      const timer = setTimeout(() => {
        searchForLink(linkSearch);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [linkSearch, activeTab, searchForLink]);

  // Handle linking
  const handleLink = async () => {
    if (!selectedLink || !conversationId || !accountId) return;

    setLinking(true);
    try {
      const updateData: Record<string, any> = {};
      
      if (selectedLink.type === "client") {
        updateData.client_id = selectedLink.id;
        updateData.lead_id = null;
      } else if (selectedLink.type === "lead") {
        updateData.lead_id = selectedLink.id;
        updateData.client_id = null;
      } else if (selectedLink.type === "deal") {
        // For deals, we need to get the lead_id from the deal
        const { data: dealData } = await supabase
          .from("deals")
          .select("lead_id")
          .eq("id", selectedLink.id)
          .single();
        
        if (dealData?.lead_id) {
          updateData.lead_id = dealData.lead_id;
          updateData.client_id = null;
        }
      }

      // Update conversation
      const { error: updateError } = await supabase
        .from("zapp_conversations")
        .update(updateData)
        .eq("id", conversationId);

      if (updateError) throw updateError;

      // Optionally add phone to client/lead
      if (addPhoneToLink && phone) {
        if (selectedLink.type === "client") {
          const { data: clientData } = await supabase
            .from("clients")
            .select("additional_phones")
            .eq("id", selectedLink.id)
            .single();
          
          const existingPhones = Array.isArray(clientData?.additional_phones) 
            ? clientData.additional_phones as string[] 
            : [];
          
          if (!existingPhones.includes(phone)) {
            await supabase
              .from("clients")
              .update({ additional_phones: [...existingPhones, phone] })
              .eq("id", selectedLink.id);
          }
        } else if (selectedLink.type === "lead") {
          await supabase
            .from("leads")
            .update({ phone })
            .eq("id", selectedLink.id)
            .is("phone", null);
        }
      }

      toast.success("Conversa vinculada com sucesso!");
      onLinked?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error linking:", error);
      toast.error("Erro ao vincular: " + error.message);
    } finally {
      setLinking(false);
    }
  };

  // Update forms when props change and dialog is open
  useEffect(() => {
    if (open) {
      setClientForm({ full_name: contactName || "", phone_e164: phone || "" });
      setLeadForm(prev => ({
        ...initialLeadForm,
        full_name: contactName || "",
        phone: phone || "",
      }));
      setActiveTab("client");
      setLeadSection("basic");
      // Reset link state
      setLinkSearch(contactName && contactName !== "Desconhecido" ? contactName.split(/[\s\-\/]+/)[0] || "" : "");
      setLinkResults([]);
      setSelectedLink(null);
      setAddPhoneToLink(true);
    }
  }, [open, phone, contactName]);

  // Fetch address by CEP
  const fetchAddressByCep = async (cep: string, isBusinessAddress: boolean) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return;

      if (isBusinessAddress) {
        setLeadForm(prev => ({
          ...prev,
          business_street: data.logradouro || "",
          business_neighborhood: data.bairro || "",
          business_city: data.localidade || "",
          business_state: data.uf || "",
        }));
      } else {
        setLeadForm(prev => ({
          ...prev,
          street: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
        }));
      }
    } catch (error) {
      console.error("Error fetching CEP:", error);
    }
  };

  // Fetch company data by CNPJ
  const fetchCompanyByCnpj = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      const data = await response.json();
      if (data.message) return;

      setLeadForm(prev => ({
        ...prev,
        company_name: data.nome_fantasia || data.razao_social || "",
        business_street: data.logradouro || "",
        business_street_number: data.numero || "",
        business_complement: data.complemento || "",
        business_neighborhood: data.bairro || "",
        business_city: data.municipio || "",
        business_state: data.uf || "",
        business_zip_code: data.cep?.replace(/\D/g, "") || "",
      }));
    } catch (error) {
      console.error("Error fetching CNPJ:", error);
    }
  };

  // Handle dialog open/close
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const handleSaveClient = async () => {
    await onSaveClient(clientForm);
  };

  const handleSaveLead = async () => {
    await onSaveLead(leadForm);
  };

  const saving = savingClient || savingLead || linking;
  const canLink = !!accountId && !!conversationId;

  const handleBankSelect = (bankCode: string) => {
    const bank = brazilianBanks.find(b => b.code === bankCode);
    setLeadForm(prev => ({
      ...prev,
      bank_code: bankCode,
      bank_name: bank?.name || "",
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-zapp-panel border-zapp-border text-zapp-text sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-zapp-accent" />
            Cadastrar Contato
          </DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Cadastre este contato no sistema
          </DialogDescription>
        </DialogHeader>

        {showLeadOption ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "client" | "lead" | "link")}>
            <TabsList className={`w-full grid bg-zapp-bg-dark ${canLink ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger 
                value="client" 
                className="text-zapp-text data-[state=active]:bg-zapp-accent data-[state=active]:text-white"
              >
                <Users className="h-4 w-4 mr-1.5" />
                Cliente
              </TabsTrigger>
              <TabsTrigger 
                value="lead" 
                className="text-zapp-text data-[state=active]:bg-blue-500 data-[state=active]:text-white"
              >
                <TrendingUp className="h-4 w-4 mr-1.5" />
                Lead
              </TabsTrigger>
              {canLink && (
                <TabsTrigger 
                  value="link" 
                  className="text-zapp-text data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                >
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Vincular
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="client" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-name" className="text-zapp-text-muted">Nome completo</Label>
                <Input
                  id="client-name"
                  value={clientForm.full_name}
                  onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                  placeholder="Nome do cliente"
                  className="bg-zapp-bg border-zapp-border text-zapp-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone" className="text-zapp-text-muted">Telefone</Label>
                <Input
                  id="client-phone"
                  value={clientForm.phone_e164}
                  className="bg-zapp-bg border-zapp-border text-zapp-text-muted"
                  readOnly
                />
                <p className="text-xs text-zapp-text-muted">
                  Preenchido automaticamente com o número da conversa
                </p>
              </div>
            </TabsContent>

            <TabsContent value="lead" className="mt-4">
              <Tabs value={leadSection} onValueChange={(v) => setLeadSection(v as "basic" | "address" | "bank")}>
                <TabsList className="w-full grid grid-cols-3 bg-zapp-bg-dark mb-4">
                  <TabsTrigger value="basic" className="text-zapp-text text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                    <User className="h-3 w-3 mr-1" />
                    Básico
                  </TabsTrigger>
                  <TabsTrigger value="address" className="text-zapp-text text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                    <Home className="h-3 w-3 mr-1" />
                    Endereço
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="text-zapp-text text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                    <Landmark className="h-3 w-3 mr-1" />
                    Bancário
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[350px] pr-4">
                  <TabsContent value="basic" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2 col-span-2">
                        <Label className="text-zapp-text-muted">Nome completo *</Label>
                        <Input
                          value={leadForm.full_name}
                          onChange={(e) => setLeadForm({ ...leadForm, full_name: e.target.value })}
                          placeholder="Nome do lead"
                          className="bg-zapp-bg border-zapp-border text-zapp-text"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zapp-text-muted">Telefone</Label>
                        <Input
                          value={leadForm.phone}
                          className="bg-zapp-bg border-zapp-border text-zapp-text-muted"
                          readOnly
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zapp-text-muted">Origem</Label>
                        <Select
                          value={leadForm.source}
                          onValueChange={(v) => setLeadForm({ ...leadForm, source: v })}
                        >
                          <SelectTrigger className="bg-zapp-bg border-zapp-border text-zapp-text">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zapp-panel border-zapp-border">
                            {LEAD_SOURCES.map((source) => (
                              <SelectItem 
                                key={source.value} 
                                value={source.value}
                                className="text-zapp-text hover:bg-zapp-hover"
                              >
                                {source.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zapp-text-muted">E-mail</Label>
                        <Input
                          type="email"
                          value={leadForm.email}
                          onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                          placeholder="email@exemplo.com"
                          className="bg-zapp-bg border-zapp-border text-zapp-text"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zapp-text-muted">Instagram</Label>
                        <Input
                          value={leadForm.instagram}
                          onChange={(e) => setLeadForm({ ...leadForm, instagram: e.target.value })}
                          placeholder="@usuario"
                          className="bg-zapp-bg border-zapp-border text-zapp-text"
                        />
                      </div>
                    </div>

                    {/* Dados Pessoais */}
                    <div className="border-t border-zapp-border pt-4 mt-4">
                      <h4 className="text-sm font-medium text-zapp-text mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" /> Pessoa Física
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">CPF</Label>
                          <Input
                            value={leadForm.cpf}
                            onChange={(e) => setLeadForm({ ...leadForm, cpf: e.target.value })}
                            placeholder="000.000.000-00"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">RG</Label>
                          <Input
                            value={leadForm.rg}
                            onChange={(e) => setLeadForm({ ...leadForm, rg: e.target.value })}
                            placeholder="00.000.000-0"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Nascimento</Label>
                          <Input
                            type="date"
                            value={leadForm.birth_date}
                            onChange={(e) => setLeadForm({ ...leadForm, birth_date: e.target.value })}
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dados Empresa */}
                    <div className="border-t border-zapp-border pt-4 mt-4">
                      <h4 className="text-sm font-medium text-zapp-text mb-3 flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Pessoa Jurídica
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">CNPJ</Label>
                          <Input
                            value={leadForm.cnpj}
                            onChange={(e) => setLeadForm({ ...leadForm, cnpj: e.target.value })}
                            onBlur={() => fetchCompanyByCnpj(leadForm.cnpj)}
                            placeholder="00.000.000/0000-00"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Nome Fantasia</Label>
                          <Input
                            value={leadForm.company_name}
                            onChange={(e) => setLeadForm({ ...leadForm, company_name: e.target.value })}
                            placeholder="Nome da empresa"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Segmento</Label>
                          <Input
                            value={leadForm.business_segment}
                            onChange={(e) => setLeadForm({ ...leadForm, business_segment: e.target.value })}
                            placeholder="Ex: Tecnologia"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Nicho</Label>
                          <Input
                            value={leadForm.business_niche}
                            onChange={(e) => setLeadForm({ ...leadForm, business_niche: e.target.value })}
                            placeholder="Ex: SaaS"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zapp-text-muted">Observações</Label>
                      <Textarea
                        value={leadForm.notes}
                        onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                        placeholder="Anotações sobre o lead..."
                        className="bg-zapp-bg border-zapp-border text-zapp-text resize-none"
                        rows={2}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="address" className="space-y-4 mt-0">
                    {/* Endereço Residencial */}
                    <div>
                      <h4 className="text-sm font-medium text-zapp-text mb-3 flex items-center gap-2">
                        <Home className="h-4 w-4" /> Endereço Residencial
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">CEP</Label>
                          <Input
                            value={leadForm.zip_code}
                            onChange={(e) => setLeadForm({ ...leadForm, zip_code: e.target.value })}
                            onBlur={() => fetchAddressByCep(leadForm.zip_code, false)}
                            placeholder="00000-000"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-zapp-text-muted">Rua</Label>
                          <Input
                            value={leadForm.street}
                            onChange={(e) => setLeadForm({ ...leadForm, street: e.target.value })}
                            placeholder="Nome da rua"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Número</Label>
                          <Input
                            value={leadForm.street_number}
                            onChange={(e) => setLeadForm({ ...leadForm, street_number: e.target.value })}
                            placeholder="123"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-zapp-text-muted">Complemento</Label>
                          <Input
                            value={leadForm.complement}
                            onChange={(e) => setLeadForm({ ...leadForm, complement: e.target.value })}
                            placeholder="Apto, Sala..."
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Bairro</Label>
                          <Input
                            value={leadForm.neighborhood}
                            onChange={(e) => setLeadForm({ ...leadForm, neighborhood: e.target.value })}
                            placeholder="Bairro"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Cidade</Label>
                          <Input
                            value={leadForm.city}
                            onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                            placeholder="Cidade"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Estado</Label>
                          <Select
                            value={leadForm.state}
                            onValueChange={(v) => setLeadForm({ ...leadForm, state: v })}
                          >
                            <SelectTrigger className="bg-zapp-bg border-zapp-border text-zapp-text">
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent className="bg-zapp-panel border-zapp-border max-h-48">
                              {BRAZILIAN_STATES.map((uf) => (
                                <SelectItem key={uf} value={uf} className="text-zapp-text hover:bg-zapp-hover">
                                  {uf}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Endereço Comercial */}
                    <div className="border-t border-zapp-border pt-4">
                      <h4 className="text-sm font-medium text-zapp-text mb-3 flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Endereço Comercial
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">CEP</Label>
                          <Input
                            value={leadForm.business_zip_code}
                            onChange={(e) => setLeadForm({ ...leadForm, business_zip_code: e.target.value })}
                            onBlur={() => fetchAddressByCep(leadForm.business_zip_code, true)}
                            placeholder="00000-000"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-zapp-text-muted">Rua</Label>
                          <Input
                            value={leadForm.business_street}
                            onChange={(e) => setLeadForm({ ...leadForm, business_street: e.target.value })}
                            placeholder="Nome da rua"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Número</Label>
                          <Input
                            value={leadForm.business_street_number}
                            onChange={(e) => setLeadForm({ ...leadForm, business_street_number: e.target.value })}
                            placeholder="123"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-zapp-text-muted">Complemento</Label>
                          <Input
                            value={leadForm.business_complement}
                            onChange={(e) => setLeadForm({ ...leadForm, business_complement: e.target.value })}
                            placeholder="Sala, Andar..."
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Bairro</Label>
                          <Input
                            value={leadForm.business_neighborhood}
                            onChange={(e) => setLeadForm({ ...leadForm, business_neighborhood: e.target.value })}
                            placeholder="Bairro"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Cidade</Label>
                          <Input
                            value={leadForm.business_city}
                            onChange={(e) => setLeadForm({ ...leadForm, business_city: e.target.value })}
                            placeholder="Cidade"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Estado</Label>
                          <Select
                            value={leadForm.business_state}
                            onValueChange={(v) => setLeadForm({ ...leadForm, business_state: v })}
                          >
                            <SelectTrigger className="bg-zapp-bg border-zapp-border text-zapp-text">
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent className="bg-zapp-panel border-zapp-border max-h-48">
                              {BRAZILIAN_STATES.map((uf) => (
                                <SelectItem key={uf} value={uf} className="text-zapp-text hover:bg-zapp-hover">
                                  {uf}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="bank" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2 col-span-2">
                        <Label className="text-zapp-text-muted">Banco</Label>
                        <Select
                          value={leadForm.bank_code}
                          onValueChange={handleBankSelect}
                        >
                          <SelectTrigger className="bg-zapp-bg border-zapp-border text-zapp-text">
                            <SelectValue placeholder="Selecione o banco" />
                          </SelectTrigger>
                          <SelectContent className="bg-zapp-panel border-zapp-border max-h-48">
                            {brazilianBanks.map((bank) => (
                              <SelectItem 
                                key={bank.code} 
                                value={bank.code}
                                className="text-zapp-text hover:bg-zapp-hover"
                              >
                                {bank.code} - {bank.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zapp-text-muted">Agência</Label>
                        <Input
                          value={leadForm.bank_agency}
                          onChange={(e) => setLeadForm({ ...leadForm, bank_agency: e.target.value })}
                          placeholder="0000"
                          className="bg-zapp-bg border-zapp-border text-zapp-text"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zapp-text-muted">Conta</Label>
                        <Input
                          value={leadForm.bank_account}
                          onChange={(e) => setLeadForm({ ...leadForm, bank_account: e.target.value })}
                          placeholder="00000-0"
                          className="bg-zapp-bg border-zapp-border text-zapp-text"
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label className="text-zapp-text-muted">Tipo de Conta</Label>
                        <Select
                          value={leadForm.bank_account_type}
                          onValueChange={(v) => setLeadForm({ ...leadForm, bank_account_type: v })}
                        >
                          <SelectTrigger className="bg-zapp-bg border-zapp-border text-zapp-text">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zapp-panel border-zapp-border">
                            <SelectItem value="checking" className="text-zapp-text hover:bg-zapp-hover">
                              Conta Corrente
                            </SelectItem>
                            <SelectItem value="savings" className="text-zapp-text hover:bg-zapp-hover">
                              Conta Poupança
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="border-t border-zapp-border pt-4">
                      <h4 className="text-sm font-medium text-zapp-text mb-3">Chave PIX</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Tipo</Label>
                          <Select
                            value={leadForm.pix_key_type}
                            onValueChange={(v) => setLeadForm({ ...leadForm, pix_key_type: v })}
                          >
                            <SelectTrigger className="bg-zapp-bg border-zapp-border text-zapp-text">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent className="bg-zapp-panel border-zapp-border">
                              {PIX_KEY_TYPES.map((type) => (
                                <SelectItem 
                                  key={type.value} 
                                  value={type.value}
                                  className="text-zapp-text hover:bg-zapp-hover"
                                >
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zapp-text-muted">Chave</Label>
                          <Input
                            value={leadForm.pix_key}
                            onChange={(e) => setLeadForm({ ...leadForm, pix_key: e.target.value })}
                            placeholder="Chave PIX"
                            className="bg-zapp-bg border-zapp-border text-zapp-text"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </TabsContent>

            {/* Link Tab Content */}
            {canLink && (
              <TabsContent value="link" className="mt-4">
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
                    <Input
                      placeholder="Buscar cliente, lead ou negócio..."
                      value={linkSearch}
                      onChange={(e) => setLinkSearch(e.target.value)}
                      className="pl-9 bg-zapp-bg border-zapp-border text-zapp-text"
                    />
                  </div>

                  {/* Results */}
                  <ScrollArea className="h-[300px]">
                    {linkLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-zapp-text-muted" />
                      </div>
                    ) : linkResults.length === 0 ? (
                      <div className="text-center py-8 text-zapp-text-muted text-sm">
                        {linkSearch.length >= 2 
                          ? "Nenhum resultado encontrado" 
                          : "Digite pelo menos 2 caracteres para buscar"}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {linkResults.map((result) => (
                          <div
                            key={`${result.type}-${result.id}`}
                            onClick={() => setSelectedLink(result)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                              selectedLink?.id === result.id && selectedLink?.type === result.type
                                ? "border-purple-500 bg-purple-500/10"
                                : "border-zapp-border bg-zapp-bg hover:bg-zapp-hover"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={result.avatar_url || undefined} />
                                <AvatarFallback className="bg-zapp-panel text-zapp-text text-xs">
                                  {result.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-zapp-text truncate">
                                    {result.full_name}
                                  </span>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-[10px] px-1.5 py-0 ${
                                      result.type === "client" 
                                        ? "border-zapp-accent text-zapp-accent" 
                                        : result.type === "lead"
                                        ? "border-blue-500 text-blue-500"
                                        : "border-amber-500 text-amber-500"
                                    }`}
                                  >
                                    {result.type === "client" ? "Cliente" : result.type === "lead" ? "Lead" : "Negócio"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zapp-text-muted">
                                  {result.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {result.phone}
                                    </span>
                                  )}
                                  {result.type === "deal" && result.stage_name && (
                                    <span className="flex items-center gap-1">
                                      <Handshake className="h-3 w-3" />
                                      {result.stage_name}
                                    </span>
                                  )}
                                  {result.type === "client" && result.products && result.products.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Package className="h-3 w-3" />
                                      {result.products.map(p => p.name).join(", ")}
                                    </span>
                                  )}
                                  {result.type === "lead" && result.status && (
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                      {result.status}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Add phone option */}
                  {selectedLink && phone && (
                    <div className="flex items-center gap-2 p-3 bg-zapp-bg rounded-lg border border-zapp-border">
                      <Checkbox
                        id="add-phone"
                        checked={addPhoneToLink}
                        onCheckedChange={(checked) => setAddPhoneToLink(!!checked)}
                      />
                      <Label htmlFor="add-phone" className="text-sm text-zapp-text-muted cursor-pointer">
                        Adicionar telefone {phone} ao {selectedLink.type === "client" ? "cliente" : "lead"}
                      </Label>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="client-name-simple" className="text-zapp-text-muted">Nome completo</Label>
              <Input
                id="client-name-simple"
                value={clientForm.full_name}
                onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                placeholder="Nome do cliente"
                className="bg-zapp-bg border-zapp-border text-zapp-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-phone-simple" className="text-zapp-text-muted">Telefone</Label>
              <Input
                id="client-phone-simple"
                value={clientForm.phone_e164}
                className="bg-zapp-bg border-zapp-border text-zapp-text-muted"
                readOnly
              />
              <p className="text-xs text-zapp-text-muted">
                Preenchido automaticamente com o número da conversa
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)} 
            className="border-zapp-border text-zapp-text-muted hover:bg-zapp-hover"
            disabled={saving}
          >
            Cancelar
          </Button>
          {activeTab === "link" ? (
            <Button
              onClick={handleLink}
              disabled={saving || !selectedLink}
              className="bg-purple-500 hover:bg-purple-600 text-white"
            >
              {linking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Vinculando...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Vincular
                </>
              )}
            </Button>
          ) : showLeadOption && activeTab === "lead" ? (
            <Button
              onClick={handleSaveLead}
              disabled={saving || !leadForm.full_name.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {savingLead ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-1.5" />
                  Cadastrar Lead
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSaveClient}
              disabled={saving || !clientForm.full_name.trim()}
              className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
            >
              {savingClient ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-1.5" />
                  Cadastrar Cliente
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});