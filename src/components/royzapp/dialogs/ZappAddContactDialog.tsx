import { memo, useState, useEffect } from "react";
import { UserPlus, TrendingUp, Users, Loader2, Home, Building2, Landmark, User, Briefcase } from "lucide-react";
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
import { brazilianBanks } from "@/data/brazilian-banks";

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
}: ZappAddContactDialogProps) {
  const [activeTab, setActiveTab] = useState<"client" | "lead">("client");
  const [leadSection, setLeadSection] = useState<"basic" | "address" | "bank">("basic");
  
  // Client form
  const [clientForm, setClientForm] = useState({
    full_name: "",
    phone_e164: "",
  });
  
  // Lead form
  const [leadForm, setLeadForm] = useState<LeadFormData>(initialLeadForm);

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

  const saving = savingClient || savingLead;

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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "client" | "lead")}>
            <TabsList className="w-full grid grid-cols-2 bg-zapp-bg-dark">
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
          {showLeadOption && activeTab === "lead" ? (
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