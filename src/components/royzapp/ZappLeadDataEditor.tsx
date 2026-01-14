import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  instagrams: string[] | null;
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
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

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
      setIsDirty(false);
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
        setIsDirty(true);
      }
    } catch (e) {
      // Silent fail for CEP lookup
    }
  };

  const handleFieldChange = (field: keyof Lead, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const startEditing = (section: SectionKey) => {
    if (!lead) return;
    
    // If already editing and dirty, show confirmation
    if (editingSection && isDirty && editingSection !== section) {
      setPendingAction(() => () => {
        setFormData(lead);
        setEditingSection(section);
        setIsDirty(false);
      });
      setShowUnsavedAlert(true);
      return;
    }
    
    setFormData(lead);
    setEditingSection(section);
    setIsDirty(false);
  };

  const cancelEditing = () => {
    if (isDirty) {
      setPendingAction(() => () => {
        setEditingSection(null);
        setFormData({});
        setIsDirty(false);
      });
      setShowUnsavedAlert(true);
      return;
    }
    setEditingSection(null);
    setFormData({});
  };

  const saveSection = () => {
    if (!editingSection) return;
    
    const sectionFields: Record<SectionKey, (keyof Lead)[]> = {
      contact: ["full_name", "phone", "email", "emails", "instagram", "instagrams", "additional_phones"],
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

  const handleDiscardChanges = () => {
    setShowUnsavedAlert(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleSaveAndClose = () => {
    setShowUnsavedAlert(false);
    saveSection();
    setPendingAction(null);
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
      <div className="space-y-0.5">
        <Label className="text-[10px] text-zapp-text-muted">{label}</Label>
        {type === "select" && selectOptions ? (
          <Select
            value={(formData[field] as string) || ""}
            onValueChange={(value) => handleFieldChange(field, value)}
          >
            <SelectTrigger className="h-7 text-xs bg-zapp-bg border-zapp-border">
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
              handleFieldChange(field, value);
            }}
            onBlur={onBlur}
            className="h-7 text-xs bg-zapp-bg border-zapp-border text-zapp-text"
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
    <>
      <div className="relative flex flex-col h-full">
        <ScrollArea className="flex-1 max-h-[60vh] pr-2">
          <div className="space-y-1.5">
            {sections.map(({ key, label, icon: Icon }) => (
              <Collapsible 
                key={key} 
                open={openSections.includes(key)} 
                onOpenChange={() => toggleSection(key)}
              >
                <Card className="bg-zapp-panel border-zapp-border">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-zapp-accent" />
                        <span className="text-xs font-medium text-zapp-text">{label}</span>
                      </div>
                      <ChevronDown className={cn(
                        "h-3.5 w-3.5 text-zapp-text-muted transition-transform",
                        openSections.includes(key) && "rotate-180"
                      )} />
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="px-2.5 pb-2.5 border-t border-zapp-border pt-2">
                      {editingSection === key ? (
                        <div className="space-y-2">
                          {key === "contact" && (
                            <>
                              {renderEditField("Nome completo", "full_name")}
                              <div className="grid grid-cols-2 gap-2">
                                {renderEditField("Telefone", "phone")}
                                {renderEditField("Email", "email")}
                              </div>
                              
                              {/* Additional phones */}
                              <div className="space-y-1">
                                <Label className="text-[10px] text-zapp-text-muted">Telefones adicionais</Label>
                                <div className="flex flex-wrap gap-1">
                                  {(formData.additional_phones || []).map((phone, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zapp-accent/10 text-zapp-text text-xs">
                                      {phone}
                                      <button
                                        onClick={() => handleFieldChange("additional_phones", (formData.additional_phones || []).filter((_, i) => i !== idx))}
                                        className="hover:text-red-500"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex gap-1">
                                  <Input
                                    className="h-7 text-xs bg-zapp-bg border-zapp-border text-zapp-text flex-1"
                                    placeholder="+55..."
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                        e.preventDefault();
                                        handleFieldChange("additional_phones", [...(formData.additional_phones || []), e.currentTarget.value.trim()]);
                                        e.currentTarget.value = "";
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              
                              {/* Additional emails */}
                              <div className="space-y-1">
                                <Label className="text-[10px] text-zapp-text-muted">Emails adicionais</Label>
                                <div className="flex flex-wrap gap-1">
                                  {(formData.emails || []).map((email, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zapp-accent/10 text-zapp-text text-xs">
                                      {email}
                                      <button
                                        onClick={() => handleFieldChange("emails", (formData.emails || []).filter((_, i) => i !== idx))}
                                        className="hover:text-red-500"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex gap-1">
                                  <Input
                                    type="email"
                                    className="h-7 text-xs bg-zapp-bg border-zapp-border text-zapp-text flex-1"
                                    placeholder="email@exemplo.com"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                        e.preventDefault();
                                        handleFieldChange("emails", [...(formData.emails || []), e.currentTarget.value.trim()]);
                                        e.currentTarget.value = "";
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              
                              {renderEditField("Instagram", "instagram")}
                              
                              {/* Additional instagrams */}
                              <div className="space-y-1">
                                <Label className="text-[10px] text-zapp-text-muted">Instagrams adicionais</Label>
                                <div className="flex flex-wrap gap-1">
                                  {(formData.instagrams || []).map((ig, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pink-500/15 text-pink-600 dark:text-pink-400 text-xs">
                                      <Instagram className="h-3 w-3" />
                                      @{ig.replace(/^@/, '')}
                                      <button
                                        onClick={() => handleFieldChange("instagrams", (formData.instagrams || []).filter((_, i) => i !== idx))}
                                        className="hover:text-red-500"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex gap-1">
                                  <Input
                                    className="h-7 text-xs bg-zapp-bg border-zapp-border text-zapp-text flex-1"
                                    placeholder="@usuario"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                                        e.preventDefault();
                                        const handle = e.currentTarget.value.replace(/^@/, '').trim();
                                        if (handle) {
                                          handleFieldChange("instagrams", [...(formData.instagrams || []), handle]);
                                          e.currentTarget.value = "";
                                        }
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                          
                          {key === "personal" && (
                            <div className="grid grid-cols-2 gap-2">
                              {renderEditField("CPF", "cpf", { type: "cpf" })}
                              {renderEditField("Nascimento", "birth_date", { type: "date" })}
                              <div className="col-span-2">
                                {renderEditField("RG", "rg")}
                              </div>
                            </div>
                          )}
                          
                          {key === "company" && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                {renderEditField("Empresa", "company_name")}
                                {renderEditField("CNPJ", "cnpj", { type: "cnpj" })}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {renderEditField("Segmento", "business_segment")}
                                {renderEditField("Nicho", "business_niche")}
                              </div>
                            </>
                          )}
                          
                          {key === "address" && (
                            <>
                              {renderEditField("CEP", "zip_code", { 
                                type: "cep",
                                onBlur: () => formData.zip_code && lookupCEP(formData.zip_code, "")
                              })}
                              <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-3">{renderEditField("Rua", "street")}</div>
                                {renderEditField("Nº", "street_number")}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {renderEditField("Complemento", "complement")}
                                {renderEditField("Bairro", "neighborhood")}
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-3">{renderEditField("Cidade", "city")}</div>
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
                              <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-3">{renderEditField("Rua", "business_street")}</div>
                                {renderEditField("Nº", "business_street_number")}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {renderEditField("Complemento", "business_complement")}
                                {renderEditField("Bairro", "business_neighborhood")}
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-3">{renderEditField("Cidade", "business_city")}</div>
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
                              <div className="grid grid-cols-2 gap-2">
                                {renderEditField("Agência", "bank_agency")}
                                {renderEditField("Conta", "bank_account")}
                              </div>
                              {renderEditField("Chave PIX", "pix_key")}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {key === "contact" && (
                            <>
                              {renderField("Nome", lead.full_name)}
                              <div className="grid grid-cols-2 gap-x-2">
                                {renderField("Telefone", lead.phone)}
                                {renderField("Email", lead.email)}
                              </div>
                              {lead.additional_phones && lead.additional_phones.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {lead.additional_phones.map((phone, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zapp-accent/10 text-zapp-text text-[10px]">
                                      <Phone className="h-2.5 w-2.5" />
                                      {phone}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {lead.emails && lead.emails.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {lead.emails.map((email, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zapp-accent/10 text-zapp-text text-[10px]">
                                      <Mail className="h-2.5 w-2.5" />
                                      {email}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {lead.instagram && renderField("Instagram", lead.instagram)}
                              {lead.instagrams && lead.instagrams.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {lead.instagrams.map((ig, idx) => (
                                    <a
                                      key={idx}
                                      href={`https://instagram.com/${ig.replace(/^@/, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-600 dark:text-pink-400 text-[10px] hover:bg-pink-500/25"
                                    >
                                      <Instagram className="h-2.5 w-2.5" />
                                      @{ig.replace(/^@/, '')}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                          
                          {key === "personal" && (
                            <div className="grid grid-cols-2 gap-x-2">
                              {renderField("CPF", lead.cpf)}
                              {renderField("Nascimento", lead.birth_date ? parseISOToDateBR(lead.birth_date) : null)}
                              {renderField("RG", lead.rg)}
                            </div>
                          )}
                          
                          {key === "company" && (
                            <>
                              <div className="grid grid-cols-2 gap-x-2">
                                {renderField("Empresa", lead.company_name)}
                                {renderField("CNPJ", lead.cnpj)}
                              </div>
                              <div className="grid grid-cols-2 gap-x-2">
                                {renderField("Segmento", lead.business_segment)}
                                {lead.business_niche && renderField("Nicho", lead.business_niche)}
                              </div>
                            </>
                          )}
                          
                          {key === "address" && (
                            <>
                              {renderField("CEP", lead.zip_code)}
                              {lead.street && renderField("Endereço", `${lead.street}${lead.street_number ? `, ${lead.street_number}` : ""}${lead.complement ? ` - ${lead.complement}` : ""}`)}
                              <div className="grid grid-cols-2 gap-x-2">
                                {lead.neighborhood && renderField("Bairro", lead.neighborhood)}
                                {lead.city && renderField("Cidade", `${lead.city}/${lead.state || ""}`)}
                              </div>
                            </>
                          )}
                          
                          {key === "business_address" && (
                            <>
                              {renderField("CEP", lead.business_zip_code)}
                              {lead.business_street && renderField("Endereço", `${lead.business_street}${lead.business_street_number ? `, ${lead.business_street_number}` : ""}${lead.business_complement ? ` - ${lead.business_complement}` : ""}`)}
                              <div className="grid grid-cols-2 gap-x-2">
                                {lead.business_neighborhood && renderField("Bairro", lead.business_neighborhood)}
                                {lead.business_city && renderField("Cidade", `${lead.business_city}/${lead.business_state || ""}`)}
                              </div>
                            </>
                          )}
                          
                          {key === "bank" && (
                            <>
                              {renderField("Banco", lead.bank_name)}
                              <div className="grid grid-cols-2 gap-x-2">
                                {lead.bank_agency && renderField("Agência", lead.bank_agency)}
                                {lead.bank_account && renderField("Conta", lead.bank_account)}
                              </div>
                              {lead.pix_key && renderField("PIX", lead.pix_key)}
                            </>
                          )}
                          
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(key)}
                            className="h-5 text-[10px] mt-1.5 text-zapp-accent hover:text-zapp-accent/80 px-2"
                          >
                            <Pencil className="h-2.5 w-2.5 mr-1" />
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
        </ScrollArea>
        
        {/* Floating save button */}
        {editingSection && (
          <div className="sticky bottom-0 bg-zapp-panel border-t border-zapp-border p-2 mt-2 -mx-1 rounded-b-lg">
            <div className="flex gap-2 justify-end">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={cancelEditing}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Cancelar
              </Button>
              <Button 
                size="sm" 
                onClick={saveSection}
                disabled={updateLead.isPending}
                className="h-7 text-xs bg-zapp-accent hover:bg-zapp-accent/90"
              >
                {updateLead.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Save className="h-3 w-3 mr-1" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Unsaved changes confirmation dialog */}
      <AlertDialog open={showUnsavedAlert} onOpenChange={setShowUnsavedAlert}>
        <AlertDialogContent className="bg-zapp-panel border-zapp-border max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zapp-text text-sm">
              Alterações não salvas
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zapp-text-muted text-xs">
              Você tem alterações não salvas. Deseja salvar antes de sair?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel 
              onClick={handleDiscardChanges}
              className="h-7 text-xs"
            >
              Sair sem salvar
            </AlertDialogCancel>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setShowUnsavedAlert(false);
                setPendingAction(null);
              }}
              className="h-7 text-xs"
            >
              Cancelar
            </Button>
            <AlertDialogAction 
              onClick={handleSaveAndClose}
              className="h-7 text-xs bg-zapp-accent hover:bg-zapp-accent/90"
            >
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
