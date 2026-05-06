import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, Mail, Phone, Building2, User, MapPin, Calendar, FileText, AlertCircle, Award, Check, Loader2, ChevronsUpDown, Home, Instagram, FileUser, Landmark, QrCode, Clock, Wand2 } from "lucide-react";
import { TIMEZONE_OPTIONS, getLocalTime, formatTimezoneOffset, getTimezoneOffsetHours, resolveClientTimezone, type TimezoneSource } from "@/lib/countryTimezone";
import { getCountryFromPhone } from "@/lib/phoneCountry";
import { CompaniesManager, CompanyData } from "./CompaniesManager";
import { cn } from "@/lib/utils";
import { 
  validateCPF, 
  validateCNPJ, 
  formatCPF, 
  formatCNPJ, 
  formatCEP,
  validateEmail,
  validateBrazilianPhone,
  formatBrazilianPhone,
  formatDateBR,
  parseDateBRToISO,
  parseISOToDateBR,
  validateBirthDate,
  validateInternationalPhone,
  formatInternationalPhone,
  detectCountryFromPhone
} from "@/lib/validators";
import { MLS_LEVELS } from "@/lib/mls-utils";

export interface PixKeyData {
  type: string;
  key: string;
}

export interface BankAccountData {
  bank_name: string;
  bank_code: string;
  account_type: string;
  agency: string;
  account: string;
}

export interface AdditionalPhoneData {
  number: string;
  label?: string;
}

// Helper to normalize phones from legacy format to new format
export const normalizeAdditionalPhones = (phones: any[]): AdditionalPhoneData[] => {
  if (!Array.isArray(phones)) return [];
  return phones.map(p => {
    if (typeof p === "string") return { number: p };
    if (typeof p === "object" && p !== null && p.number) return p as AdditionalPhoneData;
    return null;
  }).filter((p): p is AdditionalPhoneData => p !== null);
};

// Helper to display phone with label
export const formatPhoneWithLabel = (phone: string | AdditionalPhoneData): string => {
  if (typeof phone === "string") return phone;
  return phone.label ? `${phone.label}: ${phone.number}` : phone.number;
};

export interface ClientFormData {
  full_name: string;
  phone_e164: string;
  emails: string[];
  additional_phones: AdditionalPhoneData[];
  cpf: string;
  rg: string;
  cnpj: string;
  birth_date: string;
  company_name: string;
  notes: string;
  instagram: string;
  instagrams: string[];
  bio: string;
  // Residential address
  street: string;
  street_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  // Business address
  business_street: string;
  business_street_number: string;
  business_complement: string;
  business_neighborhood: string;
  business_city: string;
  business_state: string;
  business_zip_code: string;
  // Business info
  business_segment: string;
  business_niche: string;
  // Timezone (IANA). Vazio = detectar automaticamente pelo DDI/telefone.
  timezone: string;
  // Additional companies
  companies: CompanyData[];
  // Contract
  contract_start_date: string;
  contract_end_date: string;
  is_mls: boolean;
  mls_level: string;
  // Responsible user
  responsible_user_id: string;
  // Banking data
  pix_key_type: string;
  pix_key: string;
  additional_pix_keys: PixKeyData[];
  bank_code: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  bank_account_type: string;
  additional_bank_accounts: BankAccountData[];
}

interface ClientInfoFormProps {
  data: ClientFormData;
  onChange: (data: ClientFormData) => void;
  errors?: Record<string, string>;
  showBasicFields?: boolean;
  teamUsers?: { id: string; name: string; email: string }[];
  /** compact: simplifies layout for embedded use (e.g., in dialogs) */
  compact?: boolean;
}

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

// Validation indicator component
function ValidationIndicator({ isValid, isEmpty }: { isValid: boolean; isEmpty: boolean }) {
  if (isEmpty) return null;
  
  return (
    <div className={`absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200 ${isValid ? "text-emerald-500" : "text-destructive"}`}>
      {isValid ? (
        <Check className="h-4 w-4" />
      ) : (
        <X className="h-4 w-4" />
      )}
    </div>
  );
}

// Using shared MLS_LEVELS from mls-utils

// Phone Field with local state for typing - stores E.164 but displays formatted
function PhoneField({ 
  value, 
  onChange, 
  error,
  label = "Telefone principal *",
  placeholder = "+55 11 99999-9999"
}: { 
  value: string; 
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
}) {
  // Convert E.164 to display format
  const e164ToDisplay = (e164: string): string => {
    if (!e164) return '';
    const digits = e164.replace(/\D/g, '');
    return formatInternationalPhone(digits);
  };
  
  const [displayValue, setDisplayValue] = useState(() => e164ToDisplay(value));
  
  // Sync when external value changes
  useEffect(() => {
    const newDisplay = e164ToDisplay(value);
    const currentDigits = displayValue.replace(/\D/g, '');
    const valueDigits = value.replace(/\D/g, '');
    // Only sync if digits are different (to avoid cursor issues)
    if (currentDigits !== valueDigits) {
      setDisplayValue(newDisplay);
    }
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInternationalPhone(e.target.value);
    setDisplayValue(formatted);
    
    // Store as E.164 (just + and digits)
    const digits = formatted.replace(/\D/g, '');
    const e164Value = digits.length > 0 ? `+${digits}` : '';
    onChange(e164Value);
  };
  
  const validation = validateInternationalPhone(displayValue);
  const isEmpty = !displayValue || displayValue.replace(/\D/g, '').length === 0;
  
  return (
    <div className={`space-y-1.5 ${error ? "animate-shake" : ""}`} data-error={!!error}>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={20}
          className={`h-9 pr-9 ${
            error 
              ? "border-destructive ring-1 ring-destructive/30" 
              : isEmpty
                ? ""
                : validation.isValid
                  ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
                  : validation.error === 'incomplete'
                    ? "border-amber-500/50 ring-1 ring-amber-500/20"
                    : "border-destructive ring-1 ring-destructive/30"
          }`}
        />
        {!isEmpty && validation.error !== 'incomplete' && (
          <ValidationIndicator isValid={validation.isValid} isEmpty={false} />
        )}
      </div>
      {error && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      {!error && validation.error === 'incomplete' && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1">
          Digitando...
        </p>
      )}
      {!error && !isEmpty && validation.error && validation.error !== 'incomplete' && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {validation.error}
        </p>
      )}
      {!error && !isEmpty && validation.country && !validation.error && (
        <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
          {validation.country.flag} {validation.country.name}
        </p>
      )}
    </div>
  );
}

// Birth Date Field with local state for typing
function BirthDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  // Local state for the display value (DD/MM/AAAA format)
  const [displayValue, setDisplayValue] = useState(() => parseISOToDateBR(value));
  
  // Sync display value when external value changes (e.g., form reset)
  useEffect(() => {
    const newDisplay = parseISOToDateBR(value);
    if (newDisplay !== displayValue && value) {
      setDisplayValue(newDisplay);
    } else if (!value && displayValue) {
      // If external value is cleared, clear display
      setDisplayValue('');
    }
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateBR(e.target.value);
    setDisplayValue(formatted);
    
    // Only update the ISO value when we have a complete valid date
    const isoDate = parseDateBRToISO(formatted);
    if (isoDate) {
      onChange(isoDate);
    } else if (formatted === '') {
      onChange('');
    }
    // If incomplete, don't update parent - keep showing what user is typing
  };
  
  const validation = validateBirthDate(displayValue);
  const showValidation = displayValue.length > 0;
  
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">Data de Nascimento</Label>
      <div className="relative">
        <Input
          value={displayValue}
          onChange={handleChange}
          placeholder="DD/MM/AAAA"
          maxLength={10}
          className={`h-9 pr-9 ${
            showValidation && validation.error && validation.error !== 'incomplete'
              ? "border-destructive ring-1 ring-destructive/30" 
              : showValidation && validation.isValid
                ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
                : ""
          }`}
        />
        {showValidation && validation.error !== 'incomplete' && (
          <ValidationIndicator 
            isValid={validation.isValid} 
            isEmpty={false} 
          />
        )}
      </div>
      {showValidation && validation.error === 'incomplete' && (
        <p className="text-[11px] text-amber-600">Digitando...</p>
      )}
      {showValidation && !validation.isValid && validation.error && validation.error !== 'incomplete' && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {validation.error}
        </p>
      )}
      {validation.isValid && validation.age !== null && (
        <p className="text-[11px] text-emerald-600 font-medium">
          {validation.age} {validation.age === 1 ? 'ano' : 'anos'}
        </p>
      )}
    </div>
  );
}

export function ClientInfoForm({ data, onChange, errors = {}, showBasicFields = true, teamUsers = [], compact = false }: ClientInfoFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneLabel, setNewPhoneLabel] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);

  // Fetch cities when state changes
  useEffect(() => {
    const fetchCities = async () => {
      if (!data.state) {
        setCities([]);
        return;
      }
      
      setCitiesLoading(true);
      try {
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${data.state}/municipios?orderBy=nome`
        );
        if (response.ok) {
          const citiesData = await response.json();
          setCities(citiesData.map((city: { nome: string }) => city.nome));
        }
      } catch (error) {
        console.error("Erro ao buscar cidades:", error);
      } finally {
        setCitiesLoading(false);
      }
    };
    
    fetchCities();
  }, [data.state]);

  // Real-time validation states
  const validation = useMemo(() => {
    const phoneDigits = data.phone_e164.replace(/\D/g, "");
    const cpfDigits = data.cpf.replace(/\D/g, "");
    const cnpjDigits = data.cnpj.replace(/\D/g, "");
    const cepDigits = data.zip_code.replace(/\D/g, "");
    
    // International phone validation
    const phoneValidation = validateInternationalPhone(data.phone_e164);
    
    return {
      phone: {
        isEmpty: !data.phone_e164 || phoneDigits.length === 0,
        isValid: phoneValidation.isValid,
        isPartial: phoneValidation.error === 'incomplete',
        country: phoneValidation.country,
        error: phoneValidation.error
      },
      cpf: {
        isEmpty: cpfDigits.length === 0,
        isValid: cpfDigits.length === 11 && validateCPF(data.cpf),
        isPartial: cpfDigits.length > 0 && cpfDigits.length < 11
      },
      cnpj: {
        isEmpty: cnpjDigits.length === 0,
        isValid: cnpjDigits.length === 14 && validateCNPJ(data.cnpj),
        isPartial: cnpjDigits.length > 0 && cnpjDigits.length < 14
      },
      cep: {
        isEmpty: cepDigits.length === 0,
        isValid: cepDigits.length === 8,
        isPartial: cepDigits.length > 0 && cepDigits.length < 8
      },
      newEmail: {
        isEmpty: !newEmail.trim(),
        isValid: validateEmail(newEmail.trim())
      }
    };
  }, [data.phone_e164, data.cpf, data.cnpj, data.zip_code, newEmail]);

  const updateField = (field: keyof ClientFormData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const handleAddEmail = () => {
    if (!newEmail.trim()) return;
    if (!validateEmail(newEmail.trim())) {
      setEmailError("E-mail inválido");
      return;
    }
    if (data.emails.includes(newEmail.trim())) {
      setEmailError("E-mail já adicionado");
      return;
    }
    updateField("emails", [...data.emails, newEmail.trim()]);
    setNewEmail("");
    setEmailError("");
  };

  const handleRemoveEmail = (email: string) => {
    updateField("emails", data.emails.filter(e => e !== email));
  };

  const handleAddPhone = () => {
    if (!newPhone.trim()) return;
    const phoneValidation = validateInternationalPhone(newPhone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || "Formato inválido");
      return;
    }
    const e164 = formatPhoneToE164(newPhone);
    // Check if phone already exists (comparing numbers)
    const phoneExists = data.additional_phones.some(p => p.number === e164) || e164 === formatPhoneToE164(data.phone_e164);
    if (phoneExists) {
      setPhoneError("Telefone já adicionado");
      return;
    }
    const newPhoneData: AdditionalPhoneData = {
      number: e164,
      label: newPhoneLabel.trim() || undefined
    };
    updateField("additional_phones", [...data.additional_phones, newPhoneData]);
    setNewPhone("");
    setNewPhoneLabel("");
    setPhoneError("");
  };

  const handleRemovePhone = (phoneToRemove: AdditionalPhoneData) => {
    updateField("additional_phones", data.additional_phones.filter(p => p.number !== phoneToRemove.number));
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatInternationalPhone(value);
    updateField("phone_e164", formatted);
  };
  
  // For additional phones, convert formatted to E.164 on add
  const formatPhoneToE164 = (formatted: string): string => {
    const digits = formatted.replace(/\D/g, "");
    return digits.length > 0 ? `+${digits}` : "";
  };

  const handleCPFChange = (value: string) => {
    updateField("cpf", formatCPF(value));
  };

  const handleCNPJChange = async (value: string) => {
    const formatted = formatCNPJ(value);
    updateField("cnpj", formatted);
    
    // Check if CNPJ is complete (14 digits) and valid
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 14 && validateCNPJ(formatted)) {
      setCnpjLoading(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
        if (response.ok) {
          const cnpjData = await response.json();
          
          // Auto-fill company and BUSINESS address fields (not residential)
          onChange({
            ...data,
            cnpj: formatted,
            company_name: cnpjData.razao_social || cnpjData.nome_fantasia || data.company_name,
            business_street: cnpjData.logradouro || data.business_street,
            business_street_number: cnpjData.numero || data.business_street_number,
            business_complement: cnpjData.complemento || data.business_complement,
            business_neighborhood: cnpjData.bairro || data.business_neighborhood,
            business_city: cnpjData.municipio || data.business_city,
            business_state: cnpjData.uf || data.business_state,
            business_zip_code: cnpjData.cep ? formatCEP(cnpjData.cep) : data.business_zip_code,
          });
        }
      } catch (error) {
        console.error("Erro ao buscar CNPJ:", error);
      } finally {
        setCnpjLoading(false);
      }
    }
  };

  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value);
    updateField("zip_code", formatted);
    
    // Check if CEP is complete (8 digits)
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const cepData = await response.json();
        
        if (!cepData.erro) {
          // Auto-fill address fields
          onChange({
            ...data,
            zip_code: formatted,
            street: cepData.logradouro || data.street,
            neighborhood: cepData.bairro || data.neighborhood,
            city: cepData.localidade || data.city,
            state: cepData.uf || data.state,
          });
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      } finally {
        setCepLoading(false);
      }
    }
  };

  // Helper to get input border class based on validation state
  const getInputClass = (val: { isEmpty: boolean; isValid: boolean; isPartial?: boolean }, hasExternalError?: boolean) => {
    if (hasExternalError) return "border-destructive ring-1 ring-destructive/30";
    if (val.isEmpty) return "";
    if (val.isValid) return "border-emerald-500/50 ring-1 ring-emerald-500/20";
    if (val.isPartial) return "border-amber-500/50 ring-1 ring-amber-500/20";
    return "border-destructive ring-1 ring-destructive/30";
  };

  return (
    <div className="space-y-4">
      {/* Basic Fields - Always visible */}
      {showBasicFields && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            <User className="h-3.5 w-3.5" />
            Dados Básicos
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`space-y-1.5 ${errors.full_name ? "animate-shake" : ""}`} data-error={!!errors.full_name}>
              <Label className="text-sm font-medium">Nome completo *</Label>
              <Input
                value={data.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                placeholder="João Silva"
                className={`h-9 ${errors.full_name ? "border-destructive ring-1 ring-destructive/30" : ""}`}
              />
              {errors.full_name && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.full_name}
                </p>
              )}
            </div>
            <PhoneField
              value={data.phone_e164}
              onChange={(value) => updateField("phone_e164", value)}
              error={errors.phone_e164}
            />
          </div>

          {/* Responsible User Selector */}
          {teamUsers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Responsável</Label>
              <Select
                value={data.responsible_user_id || "none"}
                onValueChange={(value) => updateField("responsible_user_id", value === "none" ? "" : value)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione um responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {teamUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Tabs for Person/Company/Financial */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className={cn(
          "grid w-full grid-cols-3",
          compact ? "h-8 text-xs" : "h-9"
        )}>
          <TabsTrigger value="personal" className={cn("gap-1.5", compact ? "text-xs" : "text-sm")}>
            <User className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            Pessoa Física
          </TabsTrigger>
          <TabsTrigger value="company" className={cn("gap-1.5", compact ? "text-xs" : "text-sm")}>
            <Building2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            Pessoa Jurídica
          </TabsTrigger>
          <TabsTrigger value="financial" className={cn("gap-1.5", compact ? "text-xs" : "text-sm")}>
            <Landmark className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            Financeiro
          </TabsTrigger>
        </TabsList>

        {/* Personal Tab */}
        <TabsContent value="personal" className="mt-4 space-y-5">
          {/* E-mails */}
          <div className={`space-y-3 ${errors.emails ? "animate-shake" : ""}`} data-error={!!errors.emails}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Mail className="h-3.5 w-3.5" />
              E-mails *
            </div>
            {data.emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.emails.map((emailItem, idx) => {
                  // Handle both string and object formats for backwards compatibility
                  const emailValue = typeof emailItem === 'string' 
                    ? emailItem 
                    : (emailItem as { email?: string; label?: string })?.email || '';
                  if (!emailValue) return null;
                  return (
                    <Badge key={emailValue + idx} variant="secondary" className="gap-1 pr-1 text-xs h-6">
                      {emailValue}
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(emailItem)}
                        className="ml-0.5 hover:bg-background/50 rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setEmailError("");
                  }}
                  placeholder="email@exemplo.com"
                  className={`h-9 pr-9 ${emailError || errors.emails ? "border-destructive ring-1 ring-destructive/30" : getInputClass(validation.newEmail)}`}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEmail())}
                />
                <ValidationIndicator isValid={validation.newEmail.isValid} isEmpty={validation.newEmail.isEmpty} />
              </div>
              <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={handleAddEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {(emailError || errors.emails) && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {emailError || errors.emails}
              </p>
            )}
          </div>

          {/* Additional Phones */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Phone className="h-3.5 w-3.5" />
              Telefones Adicionais
            </div>
            {data.additional_phones.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.additional_phones.map((phone, idx) => (
                  <Badge key={phone.number + idx} variant="secondary" className="gap-1 pr-1 text-xs h-6">
                    {phone.label ? (
                      <span><span className="text-muted-foreground">{phone.label}:</span> {phone.number}</span>
                    ) : (
                      phone.number
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhone(phone)}
                      className="ml-0.5 hover:bg-background/50 rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newPhoneLabel}
                onChange={(e) => setNewPhoneLabel(e.target.value)}
                placeholder="Rótulo (ex: Esposa)"
                className="w-32 h-9"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPhone())}
              />
              <Input
                value={newPhone}
                onChange={(e) => {
                  setNewPhone(formatInternationalPhone(e.target.value));
                  setPhoneError("");
                }}
                placeholder="+55 11 99999-9999"
                maxLength={20}
                className={`flex-1 h-9 ${phoneError ? "border-destructive" : ""}`}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPhone())}
              />
              <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={handleAddPhone}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {phoneError && <p className="text-[11px] text-destructive">{phoneError}</p>}
          </div>

          <div className="h-px bg-border/50" />

          {/* Instagram & Bio */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <FileUser className="h-3.5 w-3.5" />
              Perfil Público
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Instagram principal */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5 text-pink-500" />
                  Instagram principal
                </Label>
                <Input
                  value={data.instagram}
                  onChange={(e) => updateField("instagram", e.target.value.replace(/^@/, ''))}
                  placeholder="usuario"
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">Sem o @ (ex: usuario)</p>
              </div>

              {/* Instagrams adicionais - sempre visível */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5 text-pink-500" />
                  Instagrams adicionais
                </Label>
                
                {/* Lista de instagrams adicionais */}
                {data.instagrams.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {data.instagrams.map((ig, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="flex items-center gap-1 pl-2 pr-1 py-1"
                      >
                        <Instagram className="h-3 w-3 text-pink-500" />
                        @{ig}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 ml-1 hover:bg-destructive/20 hover:text-destructive"
                          onClick={() => updateField("instagrams", data.instagrams.filter((_, i) => i !== index))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Campo para adicionar novo Instagram */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Adicionar outro Instagram..."
                    className="h-9"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = (e.target as HTMLInputElement).value.replace(/^@/, '').trim();
                        if (value && !data.instagrams.includes(value)) {
                          updateField("instagrams", [...data.instagrams, value]);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={(e) => {
                      const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                      const value = input?.value.replace(/^@/, '').trim();
                      if (value && !data.instagrams.includes(value)) {
                        updateField("instagrams", [...data.instagrams, value]);
                        input.value = '';
                      }
                    }}
                    title="Adicionar Instagram"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Digite e pressione Enter ou clique no +</p>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium">Bio</Label>
                <Textarea
                  value={data.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  placeholder="Breve descrição para exibir no Members Book..."
                  className="min-h-[80px] resize-none"
                  maxLength={500}
                />
                <p className="text-[11px] text-muted-foreground text-right">{data.bio?.length || 0}/500</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* CPF, RG & Birth Date */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <FileText className="h-3.5 w-3.5" />
              Documentos Pessoais
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">CPF</Label>
                <div className="relative">
                  <Input
                    value={data.cpf}
                    onChange={(e) => handleCPFChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={`h-9 pr-9 ${getInputClass(validation.cpf)}`}
                  />
                  <ValidationIndicator isValid={validation.cpf.isValid} isEmpty={validation.cpf.isEmpty} />
                </div>
                {!validation.cpf.isEmpty && !validation.cpf.isValid && !validation.cpf.isPartial && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    CPF inválido
                  </p>
                )}
                {validation.cpf.isPartial && (
                  <p className="text-[11px] text-amber-600">Digitando...</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">RG</Label>
                <Input
                  value={data.rg}
                  onChange={(e) => updateField("rg", e.target.value)}
                  placeholder="00.000.000-0"
                  className="h-9"
                />
              </div>
              <BirthDateField 
                value={data.birth_date}
                onChange={(value) => updateField("birth_date", value)}
              />
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Residential Address */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Home className="h-3.5 w-3.5" />
              Endereço Residencial
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">CEP</Label>
                <div className="relative">
                  <Input
                    value={data.zip_code}
                    onChange={(e) => handleCEPChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    disabled={cepLoading}
                    className={`h-9 pr-9 ${getInputClass(validation.cep)}`}
                  />
                  {cepLoading ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <ValidationIndicator isValid={validation.cep.isValid} isEmpty={validation.cep.isEmpty} />
                  )}
                </div>
                {cepLoading && (
                  <p className="text-[11px] text-primary">Buscando endereço...</p>
                )}
                {!cepLoading && validation.cep.isPartial && (
                  <p className="text-[11px] text-amber-600">Digitando...</p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium">Rua</Label>
                <Input
                  value={data.street}
                  onChange={(e) => updateField("street", e.target.value)}
                  placeholder="Av. Paulista"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Número</Label>
                <Input
                  value={data.street_number}
                  onChange={(e) => updateField("street_number", e.target.value)}
                  placeholder="1000"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label className="text-sm font-medium">Complemento</Label>
                <Input
                  value={data.complement}
                  onChange={(e) => updateField("complement", e.target.value)}
                  placeholder="Sala 101"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Bairro</Label>
                <Input
                  value={data.neighborhood}
                  onChange={(e) => updateField("neighborhood", e.target.value)}
                  placeholder="Centro"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cidade</Label>
                {data.state && cities.length > 0 ? (
                  <Popover open={cityOpen} onOpenChange={setCityOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={cityOpen}
                        className="h-9 w-full justify-between font-normal"
                        disabled={citiesLoading}
                      >
                        {citiesLoading ? (
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Carregando...
                          </span>
                        ) : data.city ? (
                          data.city
                        ) : (
                          <span className="text-muted-foreground">Selecione...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cidade..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                          <CommandGroup className="max-h-[200px] overflow-auto">
                            {cities.map((city) => (
                              <CommandItem
                                key={city}
                                value={city}
                                onSelect={() => {
                                  updateField("city", city);
                                  setCityOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    data.city === city ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {city}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    value={data.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder={data.state ? "Carregando..." : "Selecione o estado"}
                    className="h-9"
                    disabled={!data.state || citiesLoading}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Estado</Label>
                <Select
                  value={data.state}
                  onValueChange={(value) => {
                    onChange({ ...data, state: value, city: "" });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Notes */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Observações</Label>
            <Textarea
              value={data.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Anotações sobre o cliente..."
              rows={2}
              className="resize-none"
            />
          </div>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company" className="mt-4 space-y-5">
          {/* CNPJ & Company Name */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Building2 className="h-3.5 w-3.5" />
              Dados da Empresa
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">CNPJ</Label>
                <div className="relative">
                  <Input
                    value={data.cnpj}
                    onChange={(e) => handleCNPJChange(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    disabled={cnpjLoading}
                    className={`h-9 pr-9 ${getInputClass(validation.cnpj)}`}
                  />
                  {cnpjLoading ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <ValidationIndicator isValid={validation.cnpj.isValid} isEmpty={validation.cnpj.isEmpty} />
                  )}
                </div>
                {cnpjLoading && (
                  <p className="text-[11px] text-primary">Buscando dados da empresa...</p>
                )}
                {!cnpjLoading && !validation.cnpj.isEmpty && !validation.cnpj.isValid && !validation.cnpj.isPartial && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    CNPJ inválido
                  </p>
                )}
                {!cnpjLoading && validation.cnpj.isPartial && (
                  <p className="text-[11px] text-amber-600">Digitando...</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Razão Social / Empresa</Label>
                <Input
                  value={data.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  placeholder="Empresa Ltda"
                  className="h-9"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 Ao digitar o CNPJ, os dados da empresa e endereço comercial serão preenchidos automaticamente.
            </p>
          </div>

          <div className="h-px bg-border/50" />

          {/* Segment & Niche */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Building2 className="h-3.5 w-3.5" />
              Segmento de Atuação
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Segmento</Label>
                <Input
                  value={data.business_segment}
                  onChange={(e) => updateField("business_segment", e.target.value)}
                  placeholder="Ex: Saúde & Estética"
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">Área principal do negócio</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Nicho</Label>
                <Input
                  value={data.business_niche}
                  onChange={(e) => updateField("business_niche", e.target.value)}
                  placeholder="Ex: Harmonização Facial"
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">Especialidade dentro do segmento</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Timezone */}
          <TimezoneField
            value={data.timezone}
            phone={data.phone_e164}
            state={data.state}
            onChange={(v) => updateField("timezone", v)}
          />

          <div className="h-px bg-border/50" />

          {/* Business Address */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Building2 className="h-3.5 w-3.5" />
              Endereço Comercial
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">CEP</Label>
                <Input
                  value={data.business_zip_code}
                  onChange={(e) => updateField("business_zip_code", formatCEP(e.target.value))}
                  placeholder="00000-000"
                  maxLength={9}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium">Rua</Label>
                <Input
                  value={data.business_street}
                  onChange={(e) => updateField("business_street", e.target.value)}
                  placeholder="Av. Paulista"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Número</Label>
                <Input
                  value={data.business_street_number}
                  onChange={(e) => updateField("business_street_number", e.target.value)}
                  placeholder="1000"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label className="text-sm font-medium">Complemento</Label>
                <Input
                  value={data.business_complement}
                  onChange={(e) => updateField("business_complement", e.target.value)}
                  placeholder="Sala 101"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Bairro</Label>
                <Input
                  value={data.business_neighborhood}
                  onChange={(e) => updateField("business_neighborhood", e.target.value)}
                  placeholder="Centro"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cidade</Label>
                <Input
                  value={data.business_city}
                  onChange={(e) => updateField("business_city", e.target.value)}
                  placeholder="São Paulo"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Estado</Label>
                <Select
                  value={data.business_state}
                  onValueChange={(value) => updateField("business_state", value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Additional Companies */}
          <div className="space-y-3">
            <CompaniesManager
              companies={data.companies || []}
              onChange={(companies) => updateField("companies", companies)}
              label="Empresas Adicionais (Outros CNPJs)"
            />
          </div>

          <div className="h-px bg-border/50" />
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Calendar className="h-3.5 w-3.5" />
              Contrato
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Data de Início</Label>
                <Input
                  type="date"
                  value={data.contract_start_date}
                  onChange={(e) => updateField("contract_start_date", e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Data de Fim</Label>
                <Input
                  type="date"
                  value={data.contract_end_date}
                  onChange={(e) => updateField("contract_end_date", e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* MLS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Award className="h-3.5 w-3.5" />
              MLS
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <Label htmlFor="is_mls" className="text-sm font-medium cursor-pointer">Cliente MLS</Label>
                <Switch
                  id="is_mls"
                  checked={data.is_mls}
                  onCheckedChange={(checked) => {
                    updateField("is_mls", checked);
                    if (!checked) updateField("mls_level", "");
                  }}
                />
              </div>
              {data.is_mls && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Nível MLS</Label>
                  <Select
                    value={data.mls_level}
                    onValueChange={(value) => updateField("mls_level", value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione o nível" />
                    </SelectTrigger>
                    <SelectContent>
                      {MLS_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${level.dotColor}`} />
                            {level.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="mt-4 space-y-5">
          {/* PIX */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <QrCode className="h-3.5 w-3.5" />
              Chave PIX Principal
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tipo de Chave</Label>
                <Select
                  value={data.pix_key_type || "none"}
                  onValueChange={(value) => updateField("pix_key_type", value === "none" ? "" : value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium">Chave PIX</Label>
                <div className="flex gap-2">
                  <Input
                    value={data.pix_key}
                    onChange={(e) => updateField("pix_key", e.target.value)}
                    placeholder={
                      data.pix_key_type === "cpf" ? "000.000.000-00" :
                      data.pix_key_type === "cnpj" ? "00.000.000/0000-00" :
                      data.pix_key_type === "email" ? "email@exemplo.com" :
                      data.pix_key_type === "phone" ? "+55 11 99999-9999" :
                      data.pix_key_type === "random" ? "Chave aleatória" :
                      "Selecione o tipo primeiro"
                    }
                    className="h-9"
                    disabled={!data.pix_key_type}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => {
                      if (data.pix_key_type && data.pix_key.trim()) {
                        updateField("additional_pix_keys", [...data.additional_pix_keys, { type: data.pix_key_type, key: data.pix_key.trim() }]);
                        updateField("pix_key", "");
                        updateField("pix_key_type", "");
                      }
                    }}
                    disabled={!data.pix_key_type || !data.pix_key.trim()}
                    title="Adicionar outra chave PIX"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Additional PIX Keys */}
            {data.additional_pix_keys.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Chaves PIX adicionais</Label>
                <div className="flex flex-wrap gap-2">
                  {data.additional_pix_keys.map((pix, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="flex items-center gap-1 pl-2 pr-1 py-1"
                    >
                      <QrCode className="h-3 w-3 text-primary" />
                      <span className="text-xs text-muted-foreground">{pix.type}:</span>
                      {pix.key}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => updateField("additional_pix_keys", data.additional_pix_keys.filter((_, i) => i !== index))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              💡 Use o botão + para adicionar múltiplas chaves PIX.
            </p>
          </div>

          <div className="h-px bg-border/50" />

          {/* Bank Account */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Landmark className="h-3.5 w-3.5" />
              Conta Bancária Principal
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium">Banco</Label>
                <Input
                  value={data.bank_name}
                  onChange={(e) => updateField("bank_name", e.target.value)}
                  placeholder="Banco do Brasil, Itaú, etc."
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Código</Label>
                <Input
                  value={data.bank_code}
                  onChange={(e) => updateField("bank_code", e.target.value.replace(/\D/g, ""))}
                  placeholder="001"
                  maxLength={4}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tipo de Conta</Label>
                <Select
                  value={data.bank_account_type || "checking"}
                  onValueChange={(value) => updateField("bank_account_type", value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Agência</Label>
                <Input
                  value={data.bank_agency}
                  onChange={(e) => updateField("bank_agency", e.target.value.replace(/\D/g, ""))}
                  placeholder="0001"
                  maxLength={6}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Conta</Label>
                <Input
                  value={data.bank_account}
                  onChange={(e) => updateField("bank_account", e.target.value)}
                  placeholder="12345-6"
                  className="h-9"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => {
                    if (data.bank_name.trim() && data.bank_account.trim()) {
                      updateField("additional_bank_accounts", [...data.additional_bank_accounts, {
                        bank_name: data.bank_name.trim(),
                        bank_code: data.bank_code,
                        account_type: data.bank_account_type,
                        agency: data.bank_agency,
                        account: data.bank_account.trim()
                      }]);
                      updateField("bank_name", "");
                      updateField("bank_code", "");
                      updateField("bank_agency", "");
                      updateField("bank_account", "");
                      updateField("bank_account_type", "checking");
                    }
                  }}
                  disabled={!data.bank_name.trim() || !data.bank_account.trim()}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Conta
                </Button>
              </div>
            </div>

            {/* Additional Bank Accounts */}
            {data.additional_bank_accounts.length > 0 && (
              <div className="space-y-2 mt-3">
                <Label className="text-sm font-medium text-muted-foreground">Contas adicionais</Label>
                <div className="space-y-2">
                  {data.additional_bank_accounts.map((account, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 border"
                    >
                      <div className="flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <span className="font-medium">{account.bank_name}</span>
                          {account.bank_code && <span className="text-muted-foreground"> ({account.bank_code})</span>}
                          <span className="text-muted-foreground"> • Ag: {account.agency || '-'} • Conta: {account.account}</span>
                          <span className="text-muted-foreground"> • {account.account_type === 'checking' ? 'CC' : 'CP'}</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => updateField("additional_bank_accounts", data.additional_bank_accounts.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TimezoneFieldProps {
  value: string;
  phone: string;
  state?: string;
  onChange: (value: string) => void;
}

const SOURCE_LABEL: Record<NonNullable<TimezoneSource>, string> = {
  manual: "Manual",
  ddd: "DDD do telefone",
  state: "UF cadastrada",
  ddi: "País (DDI)",
};

/**
 * Campo de fuso horário do cliente.
 * - Detecta automaticamente em cascata: DDD (BR) > UF cadastrada (BR) > DDI internacional.
 * - Permite override manual quando a detecção falhar.
 * - Vazio = "Detectar automaticamente".
 */
function TimezoneField({ value, phone, state, onChange }: TimezoneFieldProps) {
  const country = getCountryFromPhone(phone);
  // Detecção sem o override (mostra o que o "auto" decidiria via DDD > UF > DDI)
  const auto = useMemo(
    () =>
      resolveClientTimezone({
        manualTimezone: null,
        phone,
        state,
        countryCode: country?.code ?? null,
      }),
    [phone, state, country?.code],
  );
  const autoTz = auto?.timezone ?? null;
  const autoSource = auto?.source ?? null;

  const effectiveTz = value || autoTz;
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!effectiveTz) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [effectiveTz]);

  const localTime = effectiveTz ? getLocalTime(effectiveTz, now) : "";
  const offset = effectiveTz ? getTimezoneOffsetHours(effectiveTz, now) : null;
  const offsetLabel = formatTimezoneOffset(offset);

  const grouped = useMemo(() => {
    const out: Record<string, typeof TIMEZONE_OPTIONS> = {};
    for (const opt of TIMEZONE_OPTIONS) {
      (out[opt.group] ||= []).push(opt);
    }
    return out;
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        <Clock className="h-3.5 w-3.5" />
        Fuso Horário
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Fuso horário do cliente</Label>
          <Select value={value || "__auto__"} onValueChange={(v) => onChange(v === "__auto__" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Detectar automaticamente" />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value="__auto__">
                <span className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  Detectar automaticamente
                  {autoTz && (
                    <span className="text-xs text-muted-foreground">→ {autoTz}</span>
                  )}
                </span>
              </SelectItem>
              {Object.entries(grouped).map(([group, opts]) => (
                <div key={group}>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {group}
                  </div>
                  {opts.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {value
              ? "Override manual ativo. Será usado em vez da detecção automática."
              : autoTz
                ? `Detectado pelo telefone: ${autoTz}. Ajuste manualmente se o cliente estiver em outro fuso (ex.: Manaus, Acre, viagem).`
                : "Sem detecção automática (telefone ausente ou país não mapeado). Selecione manualmente."}
          </p>
        </div>
        {effectiveTz && localTime && (
          <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-center min-w-[110px]">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hora local</div>
            <div className="font-mono text-sm font-semibold tabular-nums">{localTime}</div>
            <div className="text-[10px] text-muted-foreground">{offsetLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export const getEmptyClientFormData = (): ClientFormData => ({
  full_name: "",
  phone_e164: "",
  emails: [],
  additional_phones: [],
  cpf: "",
  rg: "",
  cnpj: "",
  birth_date: "",
  company_name: "",
  notes: "",
  instagram: "",
  instagrams: [],
  bio: "",
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
  business_segment: "",
  business_niche: "",
  timezone: "",
  companies: [],
  contract_start_date: "",
  contract_end_date: "",
  is_mls: false,
  mls_level: "",
  responsible_user_id: "",
  pix_key_type: "",
  pix_key: "",
  additional_pix_keys: [],
  bank_code: "",
  bank_name: "",
  bank_agency: "",
  bank_account: "",
  bank_account_type: "checking",
  additional_bank_accounts: [],
});
