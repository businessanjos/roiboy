import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Mail, Phone, Building2, User, MapPin, Calendar, FileText, AlertCircle } from "lucide-react";
import { 
  validateCPF, 
  validateCNPJ, 
  formatCPF, 
  formatCNPJ, 
  formatCEP,
  validateEmail 
} from "@/lib/validators";

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

export function ClientInfoForm({ data, onChange, errors = {}, showBasicFields = true }: ClientInfoFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

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

  const handleCEPChange = (value: string) => {
    updateField("zip_code", formatCEP(value));
  };

  const cpfValid = !data.cpf || validateCPF(data.cpf);
  const cnpjValid = !data.cnpj || validateCNPJ(data.cnpj);

  return (
    <div className="space-y-6">
      {showBasicFields && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User className="h-4 w-4" />
            Dados Básicos
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`space-y-2 ${errors.full_name ? "animate-shake" : ""}`} data-error={!!errors.full_name}>
              <Label>Nome completo *</Label>
              <Input
                value={data.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                placeholder="João Silva"
                className={errors.full_name ? "border-destructive ring-1 ring-destructive/30" : ""}
              />
              {errors.full_name && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.full_name}
                </p>
              )}
            </div>
            <div className={`space-y-2 ${errors.phone_e164 ? "animate-shake" : ""}`} data-error={!!errors.phone_e164}>
              <Label>Telefone principal (E.164) *</Label>
              <Input
                value={data.phone_e164}
                onChange={(e) => updateField("phone_e164", formatPhoneInput(e.target.value))}
                placeholder="+5511999999999"
                maxLength={16}
                className={errors.phone_e164 ? "border-destructive ring-1 ring-destructive/30" : ""}
              />
              {errors.phone_e164 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.phone_e164}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Additional Emails */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Mail className="h-4 w-4" />
          E-mails
        </div>
        <div className="flex flex-wrap gap-2">
          {data.emails.map((email) => (
            <Badge key={email} variant="secondary" className="gap-1 pr-1">
              {email}
              <button
                type="button"
                onClick={() => handleRemoveEmail(email)}
                className="ml-1 hover:bg-background/50 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setEmailError("");
            }}
            placeholder="email@exemplo.com"
            className={`flex-1 ${emailError ? "border-destructive" : ""}`}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEmail())}
          />
          <Button type="button" variant="outline" size="icon" onClick={handleAddEmail}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {emailError && <p className="text-xs text-destructive">{emailError}</p>}
      </div>

      {/* Additional Phones */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Phone className="h-4 w-4" />
          Telefones Adicionais
        </div>
        <div className="flex flex-wrap gap-2">
          {data.additional_phones.map((phone) => (
            <Badge key={phone} variant="secondary" className="gap-1 pr-1">
              {phone}
              <button
                type="button"
                onClick={() => handleRemovePhone(phone)}
                className="ml-1 hover:bg-background/50 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newPhone}
            onChange={(e) => {
              setNewPhone(formatPhoneInput(e.target.value));
              setPhoneError("");
            }}
            placeholder="+5511999999999"
            maxLength={16}
            className={`flex-1 ${phoneError ? "border-destructive" : ""}`}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPhone())}
          />
          <Button type="button" variant="outline" size="icon" onClick={handleAddPhone}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
      </div>

      <Separator />

      {/* Documents */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="h-4 w-4" />
          Documentos
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input
              value={data.cpf}
              onChange={(e) => handleCPFChange(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
              className={!cpfValid ? "border-destructive" : ""}
            />
            {!cpfValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                CPF inválido
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input
              value={data.cnpj}
              onChange={(e) => handleCNPJChange(e.target.value)}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className={!cnpjValid ? "border-destructive" : ""}
            />
            {!cnpjValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                CNPJ inválido
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Company Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="h-4 w-4" />
          Empresa
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Razão Social / Empresa</Label>
            <Input
              value={data.company_name}
              onChange={(e) => updateField("company_name", e.target.value)}
              placeholder="Empresa Ltda"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Data de Nascimento
            </Label>
            <Input
              type="date"
              value={data.birth_date}
              onChange={(e) => updateField("birth_date", e.target.value)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Address */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Endereço
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input
              value={data.zip_code}
              onChange={(e) => handleCEPChange(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Rua</Label>
            <Input
              value={data.street}
              onChange={(e) => updateField("street", e.target.value)}
              placeholder="Av. Paulista"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label>Número</Label>
            <Input
              value={data.street_number}
              onChange={(e) => updateField("street_number", e.target.value)}
              placeholder="1000"
            />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label>Complemento</Label>
            <Input
              value={data.complement}
              onChange={(e) => updateField("complement", e.target.value)}
              placeholder="Sala 101"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input
              value={data.neighborhood}
              onChange={(e) => updateField("neighborhood", e.target.value)}
              placeholder="Centro"
            />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input
              value={data.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="São Paulo"
            />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <select
              value={data.state}
              onChange={(e) => updateField("state", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione</option>
              {BRAZILIAN_STATES.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Notes */}
      <div className="space-y-4">
        <Label>Observações</Label>
        <Textarea
          value={data.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Anotações sobre o cliente..."
          rows={3}
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
});
