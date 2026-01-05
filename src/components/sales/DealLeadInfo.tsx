import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  ChevronDown,
  Instagram,
  FileText,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  emails: string[] | null;
  additional_phones: string[] | null;
  instagram: string | null;
  instagrams: string[] | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  cnpj: string | null;
  company_name: string | null;
  business_segment: string | null;
  business_niche: string | null;
  // Personal address
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  // Business address
  business_zip_code: string | null;
  business_street: string | null;
  business_street_number: string | null;
  business_complement: string | null;
  business_neighborhood: string | null;
  business_city: string | null;
  business_state: string | null;
  // Bank
  bank_name: string | null;
  bank_code: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  // Notes
  notes: string | null;
}

interface DealLeadInfoProps {
  leadId: string;
}

type LeadData = Partial<Lead> & { id: string; full_name: string };

export function DealLeadInfo({ leadId }: DealLeadInfoProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    contact: true,
    company: false,
    personal: false,
    address: false,
    bank: false,
  });

  useEffect(() => {
    fetchLead();
  }, [leadId]);

  const fetchLead = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (error) {
      console.error("Error fetching lead:", error);
    } else {
      setLead(data as unknown as Lead);
    }
    setLoading(false);
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13 && cleaned.startsWith("55")) {
      return `+55 (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return null;
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    return cpf;
  };

  const formatCNPJ = (cnpj: string | null) => {
    if (!cnpj) return null;
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length === 14) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
    }
    return cnpj;
  };

  const hasPersonalAddress = !!(lead?.street || lead?.city || lead?.state);
  const hasBusinessAddress = !!(lead?.business_street || lead?.business_city || lead?.business_state);
  const hasBankData = !!(lead?.bank_name || lead?.pix_key);
  const hasCompanyData = !!(lead?.company_name || lead?.cnpj);
  const hasPersonalData = !!(lead?.cpf || lead?.rg || lead?.birth_date);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  const SectionHeader = ({ 
    section, 
    icon: Icon, 
    title, 
    show = true 
  }: { 
    section: string; 
    icon: any; 
    title: string;
    show?: boolean;
  }) => {
    if (!show) return null;
    return (
      <CollapsibleTrigger
        onClick={() => toggleSection(section)}
        className="flex items-center justify-between w-full py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" />
          {title}
        </span>
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform",
          openSections[section] && "rotate-180"
        )} />
      </CollapsibleTrigger>
    );
  };

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => {
    if (!value) return null;
    return (
      <div className="flex items-start justify-between py-0.5">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[11px] text-right max-w-[60%] break-words">{value}</span>
      </div>
    );
  };

  return (
    <div className="rounded-lg border p-3 space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <User className="h-3.5 w-3.5" />
        Dados do Lead
      </h4>

      {/* Contact Section - Always visible */}
      <Collapsible open={openSections.contact} onOpenChange={() => toggleSection("contact")}>
        <SectionHeader section="contact" icon={Phone} title="Contato" />
        <CollapsibleContent className="pl-4 space-y-0.5 pb-2">
          <InfoRow label="Telefone" value={formatPhone(lead.phone_e164 || "")} />
          {lead.additional_phones && lead.additional_phones.length > 0 && (
            <InfoRow label="Outros" value={lead.additional_phones.map(formatPhone).join(", ")} />
          )}
          <InfoRow label="Email" value={lead.email} />
          {lead.emails && lead.emails.length > 0 && (
            <InfoRow label="Outros" value={lead.emails.join(", ")} />
          )}
          <InfoRow label="Instagram" value={lead.instagram} />
          {lead.instagrams && lead.instagrams.length > 0 && (
            <InfoRow label="Outros" value={lead.instagrams.join(", ")} />
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Company Section */}
      {hasCompanyData && (
        <Collapsible open={openSections.company} onOpenChange={() => toggleSection("company")}>
          <SectionHeader section="company" icon={Building2} title="Empresa" show={hasCompanyData} />
          <CollapsibleContent className="pl-4 space-y-0.5 pb-2">
            <InfoRow label="Razão Social" value={lead.company_name} />
            <InfoRow label="CNPJ" value={formatCNPJ(lead.cnpj)} />
            <InfoRow label="Segmento" value={lead.business_segment} />
            <InfoRow label="Nicho" value={lead.business_niche} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Personal Data Section */}
      {hasPersonalData && (
        <Collapsible open={openSections.personal} onOpenChange={() => toggleSection("personal")}>
          <SectionHeader section="personal" icon={FileText} title="Dados Pessoais" show={hasPersonalData} />
          <CollapsibleContent className="pl-4 space-y-0.5 pb-2">
            <InfoRow label="CPF" value={formatCPF(lead.cpf)} />
            <InfoRow label="RG" value={lead.rg} />
            <InfoRow 
              label="Nascimento" 
              value={lead.birth_date ? format(new Date(lead.birth_date), "dd/MM/yyyy") : null} 
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Address Section */}
      {(hasPersonalAddress || hasBusinessAddress) && (
        <Collapsible open={openSections.address} onOpenChange={() => toggleSection("address")}>
          <SectionHeader section="address" icon={MapPin} title="Endereços" show={hasPersonalAddress || hasBusinessAddress} />
          <CollapsibleContent className="pl-4 space-y-2 pb-2">
            {hasPersonalAddress && (
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Residencial</p>
                <p className="text-[11px]">
                  {[
                    lead.street && `${lead.street}${lead.street_number ? `, ${lead.street_number}` : ""}`,
                    lead.complement,
                    lead.neighborhood,
                    lead.city && lead.state ? `${lead.city} - ${lead.state}` : (lead.city || lead.state),
                    lead.zip_code,
                  ].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
            {hasBusinessAddress && (
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Comercial</p>
                <p className="text-[11px]">
                  {[
                    lead.business_street && `${lead.business_street}${lead.business_street_number ? `, ${lead.business_street_number}` : ""}`,
                    lead.business_complement,
                    lead.business_neighborhood,
                    lead.business_city && lead.business_state ? `${lead.business_city} - ${lead.business_state}` : (lead.business_city || lead.business_state),
                    lead.business_zip_code,
                  ].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Bank Section */}
      {hasBankData && (
        <Collapsible open={openSections.bank} onOpenChange={() => toggleSection("bank")}>
          <SectionHeader section="bank" icon={CreditCard} title="Dados Bancários" show={hasBankData} />
          <CollapsibleContent className="pl-4 space-y-0.5 pb-2">
            <InfoRow label="Banco" value={lead.bank_name} />
            <InfoRow label="Agência" value={lead.bank_agency} />
            <InfoRow label="Conta" value={lead.bank_account} />
            <InfoRow label="Tipo" value={lead.bank_account_type} />
            <InfoRow 
              label={`PIX (${lead.pix_key_type || "chave"})`} 
              value={lead.pix_key} 
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Notes */}
      {lead.notes && (
        <div className="pt-2 border-t">
          <p className="text-[10px] text-muted-foreground mb-0.5">Observações</p>
          <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}
    </div>
  );
}
