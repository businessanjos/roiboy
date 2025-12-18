import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Mail, Phone, Building2, User, MapPin, Calendar, FileText, AlertCircle, Award, Check, Loader2 } from "lucide-react";
import { 
  validateCPF, 
  validateCNPJ, 
  formatCPF, 
  formatCNPJ, 
  formatCEP,
  validateEmail 
} from "@/lib/validators";
import { MLS_LEVELS } from "@/lib/mls-utils";

export interface ClientFormData {
  full_name: string;
  phone_e164: string;
  emails: string[];
  additional_phones: string[];
  cpf: string;
  cnpj: string;
  birth_date: string;
  company_name: string;
  notes: string;
  street: string;
  street_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  contract_start_date: string;
  contract_end_date: string;
  is_mls: boolean;
  mls_level: string;
}

interface ClientInfoFormProps {
  data: ClientFormData;
  onChange: (data: ClientFormData) => void;
  errors?: Record<string, string>;
  showBasicFields?: boolean;
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

export function ClientInfoForm({ data, onChange, errors = {}, showBasicFields = true }: ClientInfoFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  // Real-time validation states
  const validation = useMemo(() => {
    const phoneDigits = data.phone_e164.replace(/\D/g, "");
    const cpfDigits = data.cpf.replace(/\D/g, "");
    const cnpjDigits = data.cnpj.replace(/\D/g, "");
    const cepDigits = data.zip_code.replace(/\D/g, "");
    
    return {
      phone: {
        isEmpty: !data.phone_e164 || phoneDigits.length === 0,
        isValid: /^\+[1-9]\d{10,14}$/.test(data.phone_e164),
        isPartial: phoneDigits.length > 0 && phoneDigits.length < 11
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
    const formatted = formatPhoneInput(newPhone);
    if (!/^\+[1-9]\d{1,14}$/.test(formatted)) {
      setPhoneError("Formato inválido. Ex: +5511999999999");
      return;
    }
    if (data.additional_phones.includes(formatted) || formatted === data.phone_e164) {
      setPhoneError("Telefone já adicionado");
      return;
    }
    updateField("additional_phones", [...data.additional_phones, formatted]);
    setNewPhone("");
    setPhoneError("");
  };

  const handleRemovePhone = (phone: string) => {
    updateField("additional_phones", data.additional_phones.filter(p => p !== phone));
  };

  const formatPhoneInput = (value: string): string => {
    let digits = value.replace(/[^\d+]/g, "");
    if (!digits.startsWith("+")) {
      digits = "+" + digits.replace(/\+/g, "");
    }
    return ("+" + digits.slice(1).replace(/\+/g, "")).slice(0, 16);
  };

  const handleCPFChange = (value: string) => {
    updateField("cpf", formatCPF(value));
  };

  const handleCNPJChange = (value: string) => {
    updateField("cnpj", formatCNPJ(value));
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
    <div className="space-y-5">
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
            <div className={`space-y-1.5 ${errors.phone_e164 ? "animate-shake" : ""}`} data-error={!!errors.phone_e164}>
              <Label className="text-sm font-medium">Telefone principal *</Label>
              <div className="relative">
                <Input
                  value={data.phone_e164}
                  onChange={(e) => updateField("phone_e164", formatPhoneInput(e.target.value))}
                  placeholder="+5511999999999"
                  maxLength={16}
                  className={`h-9 pr-9 ${errors.phone_e164 ? "border-destructive ring-1 ring-destructive/30" : getInputClass(validation.phone)}`}
                />
                <ValidationIndicator isValid={validation.phone.isValid} isEmpty={validation.phone.isEmpty} />
              </div>
              {errors.phone_e164 && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.phone_e164}
                </p>
              )}
              {!errors.phone_e164 && validation.phone.isPartial && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  Digitando...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Additional Emails */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          <Mail className="h-3.5 w-3.5" />
          E-mails
        </div>
        {data.emails.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.emails.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1 pr-1 text-xs h-6">
                {email}
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  className="ml-0.5 hover:bg-background/50 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
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
              className={`h-9 pr-9 ${emailError ? "border-destructive" : getInputClass(validation.newEmail)}`}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEmail())}
            />
            <ValidationIndicator isValid={validation.newEmail.isValid} isEmpty={validation.newEmail.isEmpty} />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={handleAddEmail}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {emailError && <p className="text-[11px] text-destructive">{emailError}</p>}
      </div>

      {/* Additional Phones */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          <Phone className="h-3.5 w-3.5" />
          Telefones Adicionais
        </div>
        {data.additional_phones.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.additional_phones.map((phone) => (
              <Badge key={phone} variant="secondary" className="gap-1 pr-1 text-xs h-6">
                {phone}
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
            value={newPhone}
            onChange={(e) => {
              setNewPhone(formatPhoneInput(e.target.value));
              setPhoneError("");
            }}
            placeholder="+5511999999999"
            maxLength={16}
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

      {/* Documents */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          <FileText className="h-3.5 w-3.5" />
          Documentos
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
            <Label className="text-sm font-medium">CNPJ</Label>
            <div className="relative">
              <Input
                value={data.cnpj}
                onChange={(e) => handleCNPJChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className={`h-9 pr-9 ${getInputClass(validation.cnpj)}`}
              />
              <ValidationIndicator isValid={validation.cnpj.isValid} isEmpty={validation.cnpj.isEmpty} />
            </div>
            {!validation.cnpj.isEmpty && !validation.cnpj.isValid && !validation.cnpj.isPartial && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                CNPJ inválido
              </p>
            )}
            {validation.cnpj.isPartial && (
              <p className="text-[11px] text-amber-600">Digitando...</p>
            )}
          </div>
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* Company Info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          <Building2 className="h-3.5 w-3.5" />
          Empresa
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Razão Social / Empresa</Label>
            <Input
              value={data.company_name}
              onChange={(e) => updateField("company_name", e.target.value)}
              placeholder="Empresa Ltda"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Data de Nascimento</Label>
            <Input
              type="date"
              value={data.birth_date}
              onChange={(e) => updateField("birth_date", e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* Contract Dates */}
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

      <div className="h-px bg-border/50" />

      {/* Address */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          <MapPin className="h-3.5 w-3.5" />
          Endereço
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
            <Input
              value={data.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="São Paulo"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Estado</Label>
            <Select
              value={data.state}
              onValueChange={(value) => updateField("state", value)}
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
    </div>
  );
}

export const getEmptyClientFormData = (): ClientFormData => ({
  full_name: "",
  phone_e164: "",
  emails: [],
  additional_phones: [],
  cpf: "",
  cnpj: "",
  birth_date: "",
  company_name: "",
  notes: "",
  street: "",
  street_number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  contract_start_date: "",
  contract_end_date: "",
  is_mls: false,
  mls_level: "",
});
