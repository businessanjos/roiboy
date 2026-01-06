import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  User, Phone, Mail, Instagram, Building2, MapPin, Landmark,
  ChevronDown, Loader2, Save, X, Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  formatCPF, formatCNPJ, formatCEP, formatDateBR, parseDateBRToISO, parseISOToDateBR,
  validateCPF, validateCNPJ
} from "@/lib/validators";
import { brazilianBanks } from "@/data/brazilian-banks";

interface ZappLeadDataEditorProps {
  leadId: string;
  onLeadUpdated?: () => void;
}

interface Lead {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  emails: string[] | null;
  instagram: string | null;
  additional_phones: string[] | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  company_name: string | null;
  cnpj: string | null;
  business_segment: string | null;
  business_niche: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  business_zip_code: string | null;
  business_street: string | null;
  business_street_number: string | null;
  business_complement: string | null;
  business_neighborhood: string | null;
  business_city: string | null;
  business_state: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
}

type SectionKey = "contact" | "personal" | "company" | "address" | "business_address" | "bank";

export function ZappLeadDataEditor({ leadId, onLeadUpdated }: ZappLeadDataEditorProps) {
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [openSections, setOpenSections] = useState<SectionKey[]>(["contact"]);

  // Fetch lead data
  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead-detail-zapp", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!leadId,
  });

  // Update lead mutation
  const updateLead = useMutation({
    mutationFn: async (updates: Partial<Lead>) => {
      const { error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-detail-zapp", leadId] });
      toast.success("Dados atualizados!");
      setEditingSection(null);
      onLeadUpdated?.();
    },
    onError: () => {
      toast.error("Erro ao atualizar");
    },
  });

  // CEP lookup
  const lookupCEP = async (cep: string, prefix: "business_" | "" = "") => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          [`${prefix}street`]: data.logradouro || prev[`${prefix}street` as keyof Lead],
          [`${prefix}neighborhood`]: data.bairro || prev[`${prefix}neighborhood` as keyof Lead],
          [`${prefix}city`]: data.localidade || prev[`${prefix}city` as keyof Lead],
          [`${prefix}state`]: data.uf || prev[`${prefix}state` as keyof Lead],
        }));
      }
    } catch (e) {
      // Silent fail for CEP lookup
    }
  };

  const startEditing = (section: SectionKey) => {
    if (!lead) return;
    setFormData(lead);
    setEditingSection(section);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setFormData({});
  };

  const saveSection = () => {
    if (!editingSection) return;
    
    const sectionFields: Record<SectionKey, (keyof Lead)[]> = {
      contact: ["full_name", "phone", "email", "emails", "instagram", "additional_phones"],
      personal: ["cpf", "rg", "birth_date"],
      company: ["company_name", "cnpj", "business_segment", "business_niche"],
      address: ["zip_code", "street", "street_number", "complement", "neighborhood", "city", "state"],
      business_address: ["business_zip_code", "business_street", "business_street_number", "business_complement", "business_neighborhood", "business_city", "business_state"],
      bank: ["bank_name", "bank_agency", "bank_account", "pix_key"],
    };

    const fieldsToUpdate = sectionFields[editingSection];
    const updates: Partial<Lead> = {};
    
    fieldsToUpdate.forEach(field => {
      updates[field] = formData[field] as any;
    });

    // Convert birth_date from DD/MM/YYYY to ISO format
    if (updates.birth_date && typeof updates.birth_date === "string") {
      const isoDate = parseDateBRToISO(updates.birth_date);
      updates.birth_date = isoDate;
    }

    updateLead.mutate(updates);
  };

  const toggleSection = (section: SectionKey) => {
    setOpenSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section) 
        : [...prev, section]
    );
  };

  const renderField = (label: string, value: string | null | undefined, className?: string) => (
    <div className={cn("text-xs", className)}>
      <span className="text-zapp-text-muted">{label}:</span>
      <span className="ml-1 text-zapp-text">{value || "-"}</span>
    </div>
  );

  const renderEditField = (
    label: string, 
    field: keyof Lead, 
    options?: { 
      type?: "text" | "select" | "cep" | "cpf" | "cnpj" | "date";
      selectOptions?: { value: string; label: string }[];
      onBlur?: () => void;
    }
  ) => {
    const { type = "text", selectOptions, onBlur } = options || {};
    
    return (
      <div className="space-y-1">
        <Label className="text-xs text-zapp-text-muted">{label}</Label>
        {type === "select" && selectOptions ? (
          <Select
            value={(formData[field] as string) || ""}
            onValueChange={(value) => setFormData(prev => ({ ...prev, [field]: value }))}
          >
            <SelectTrigger className="h-8 text-xs bg-zapp-bg border-zapp-border">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={(formData[field] as string) || ""}
            onChange={(e) => {
              let value = e.target.value;
              if (type === "cpf") value = formatCPF(value);
              if (type === "cnpj") value = formatCNPJ(value);
              if (type === "cep") value = formatCEP(value);
              if (type === "date") value = formatDateBR(value);
              setFormData(prev => ({ ...prev, [field]: value }));
            }}
            onBlur={onBlur}
            className="h-8 text-xs bg-zapp-bg border-zapp-border text-zapp-text"
            placeholder={label}
          />
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-zapp-accent" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center text-zapp-text-muted py-8 text-sm">
        Lead não encontrado
      </div>
    );
  }

  const sections: { key: SectionKey; label: string; icon: React.ElementType }[] = [
    { key: "contact", label: "Contato", icon: Phone },
    { key: "personal", label: "Dados Pessoais", icon: User },
    { key: "company", label: "Empresa", icon: Building2 },
    { key: "address", label: "Endereço Residencial", icon: MapPin },
    { key: "business_address", label: "Endereço Comercial", icon: Building2 },
    { key: "bank", label: "Dados Bancários", icon: Landmark },
  ];

  return (
    <div className="space-y-2">
      {sections.map(({ key, label, icon: Icon }) => (
        <Collapsible 
          key={key} 
          open={openSections.includes(key)} 
          onOpenChange={() => toggleSection(key)}
        >
          <Card className="bg-zapp-panel border-zapp-border">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-zapp-accent" />
                  <span className="text-sm font-medium text-zapp-text">{label}</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-zapp-text-muted transition-transform",
                  openSections.includes(key) && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-3 pb-3 border-t border-zapp-border pt-2">
                {editingSection === key ? (
                  <div className="space-y-3">
                    {key === "contact" && (
                      <>
                        {renderEditField("Nome completo", "full_name")}
                        {renderEditField("Telefone", "phone")}
                        {renderEditField("Email", "email")}
                        {renderEditField("Instagram", "instagram")}
                      </>
                    )}
                    
                    {key === "personal" && (
                      <>
                        {renderEditField("CPF", "cpf", { type: "cpf" })}
                        {renderEditField("RG", "rg")}
                        {renderEditField("Data de Nascimento", "birth_date", { 
                          type: "date",
                        })}
                      </>
                    )}
                    
                    {key === "company" && (
                      <>
                        {renderEditField("Nome da Empresa", "company_name")}
                        {renderEditField("CNPJ", "cnpj", { type: "cnpj" })}
                        {renderEditField("Segmento", "business_segment")}
                        {renderEditField("Nicho", "business_niche")}
                      </>
                    )}
                    
                    {key === "address" && (
                      <>
                        {renderEditField("CEP", "zip_code", { 
                          type: "cep",
                          onBlur: () => formData.zip_code && lookupCEP(formData.zip_code, "")
                        })}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">{renderEditField("Rua", "street")}</div>
                          {renderEditField("Nº", "street_number")}
                        </div>
                        {renderEditField("Complemento", "complement")}
                        {renderEditField("Bairro", "neighborhood")}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">{renderEditField("Cidade", "city")}</div>
                          {renderEditField("UF", "state")}
                        </div>
                      </>
                    )}
                    
                    {key === "business_address" && (
                      <>
                        {renderEditField("CEP", "business_zip_code", { 
                          type: "cep",
                          onBlur: () => formData.business_zip_code && lookupCEP(formData.business_zip_code, "business_")
                        })}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">{renderEditField("Rua", "business_street")}</div>
                          {renderEditField("Nº", "business_street_number")}
                        </div>
                        {renderEditField("Complemento", "business_complement")}
                        {renderEditField("Bairro", "business_neighborhood")}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2">{renderEditField("Cidade", "business_city")}</div>
                          {renderEditField("UF", "business_state")}
                        </div>
                      </>
                    )}
                    
                    {key === "bank" && (
                      <>
                        {renderEditField("Banco", "bank_name", {
                          type: "select",
                          selectOptions: brazilianBanks.map(b => ({ value: b.name, label: b.name }))
                        })}
                        {renderEditField("Agência", "bank_agency")}
                        {renderEditField("Conta", "bank_account")}
                        {renderEditField("Chave PIX", "pix_key")}
                      </>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={cancelEditing}
                        className="flex-1 h-7"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={saveSection}
                        disabled={updateLead.isPending}
                        className="flex-1 h-7"
                      >
                        {updateLead.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-3 w-3 mr-1" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {key === "contact" && (
                      <>
                        {renderField("Nome", lead.full_name)}
                        {renderField("Telefone", lead.phone)}
                        {renderField("Email", lead.email)}
                        {lead.instagram && renderField("Instagram", lead.instagram)}
                      </>
                    )}
                    
                    {key === "personal" && (
                      <>
                        {renderField("CPF", lead.cpf)}
                        {renderField("RG", lead.rg)}
                        {renderField("Nascimento", lead.birth_date ? parseISOToDateBR(lead.birth_date) : null)}
                      </>
                    )}
                    
                    {key === "company" && (
                      <>
                        {renderField("Empresa", lead.company_name)}
                        {renderField("CNPJ", lead.cnpj)}
                        {renderField("Segmento", lead.business_segment)}
                        {lead.business_niche && renderField("Nicho", lead.business_niche)}
                      </>
                    )}
                    
                    {key === "address" && (
                      <>
                        {renderField("CEP", lead.zip_code)}
                        {lead.street && renderField("Endereço", `${lead.street}${lead.street_number ? `, ${lead.street_number}` : ""}${lead.complement ? ` - ${lead.complement}` : ""}`)}
                        {lead.neighborhood && renderField("Bairro", lead.neighborhood)}
                        {lead.city && renderField("Cidade", `${lead.city}/${lead.state || ""}`)}
                      </>
                    )}
                    
                    {key === "business_address" && (
                      <>
                        {renderField("CEP", lead.business_zip_code)}
                        {lead.business_street && renderField("Endereço", `${lead.business_street}${lead.business_street_number ? `, ${lead.business_street_number}` : ""}${lead.business_complement ? ` - ${lead.business_complement}` : ""}`)}
                        {lead.business_neighborhood && renderField("Bairro", lead.business_neighborhood)}
                        {lead.business_city && renderField("Cidade", `${lead.business_city}/${lead.business_state || ""}`)}
                      </>
                    )}
                    
                    {key === "bank" && (
                      <>
                        {renderField("Banco", lead.bank_name)}
                        {lead.bank_agency && renderField("Agência", lead.bank_agency)}
                        {lead.bank_account && renderField("Conta", lead.bank_account)}
                        {lead.pix_key && renderField("PIX", lead.pix_key)}
                      </>
                    )}
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing(key)}
                      className="h-6 text-xs mt-2 text-zapp-accent hover:text-zapp-accent/80"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
