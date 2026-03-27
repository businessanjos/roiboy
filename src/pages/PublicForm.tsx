import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, CheckCircle2, AlertCircle, Send, User, Phone } from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { motion, AnimatePresence } from "framer-motion";
import {
  FormAppearance,
  DEFAULT_APPEARANCE,
  CARD_WIDTH_OPTIONS,
  BORDER_RADIUS_OPTIONS,
} from "@/components/forms/FormAppearance.types";

interface FormData {
  id: string;
  title: string;
  description: string | null;
  fields: string[];
  require_client_info: boolean;
  appearance?: FormAppearance;
}

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: any;
  is_required: boolean;
}

interface ClientData {
  id: string;
  name: string;
  phone: string;
}

export default function PublicForm() {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("clientId") || searchParams.get("client");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);

  const [responses, setResponses] = useState<Record<string, any>>({});
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchFormData();
  }, [formId, clientId]);

  const fetchFormData = async () => {
    if (!formId) {
      setError("Formulário não encontrado");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("get-public-form", {
        body: { formId, clientId },
      });

      if (error) throw error;

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setFormData(data.form);
      setClientData(data.client);
      
      const orderedFields = data.customFields || [];
      
      const formFieldIds = data.form.fields || [];
      if (orderedFields.length !== formFieldIds.length) {
        console.warn(
          `Form field count mismatch: form defines ${formFieldIds.length} fields, but only ${orderedFields.length} are available.`,
          "Missing field IDs:", formFieldIds.filter((id: string) => !orderedFields.find((f: CustomField) => f.id === id))
        );
      }
      
      setCustomFields(orderedFields);

      if (data.client) {
        setClientName(data.client.name || "");
        setClientPhone(data.client.phone || "");
      }
    } catch (err: any) {
      console.error("Error fetching form:", err);
      setError("Erro ao carregar formulário");
    } finally {
      setLoading(false);
    }
  };

  const isFieldEmpty = (field: CustomField, value: any): boolean => {
    if (value === undefined || value === null) return true;
    
    switch (field.field_type) {
      case "boolean":
        return value !== true && value !== false;
      case "multi_select":
        return !Array.isArray(value) || value.length === 0;
      case "number":
      case "currency":
        return value === "" || isNaN(value);
      case "text":
      case "select":
      case "date":
        return !value || (typeof value === "string" && !value.trim());
      default:
        return !value;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, boolean> = {};
    const missingFields: CustomField[] = [];

    customFields.forEach((field) => {
      if (field.is_required && isFieldEmpty(field, responses[field.id])) {
        errors[field.id] = true;
        missingFields.push(field);
      }
    });

    let clientNameError = false;
    let clientPhoneError = false;

    if (formData?.require_client_info && !clientId) {
      if (!clientName.trim()) clientNameError = true;
      if (!clientPhone.trim()) clientPhoneError = true;
    }

    setFieldErrors({ ...errors, clientName: clientNameError, clientPhone: clientPhoneError });

    if (missingFields.length > 0 || clientNameError || clientPhoneError) {
      const errorMessages: string[] = [];
      if (clientNameError) errorMessages.push("Nome");
      if (clientPhoneError) errorMessages.push("Telefone");
      errorMessages.push(...missingFields.map((f) => f.name));
      toast.error(`Preencha os campos obrigatórios: ${errorMessages.join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-form-response", {
        body: {
          formId,
          clientId: clientData?.id || null,
          clientName: clientName.trim() || null,
          clientPhone: clientPhone.trim() || null,
          responses,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setSubmitted(true);
      toast.success("Resposta enviada com sucesso!");
    } catch (err: any) {
      console.error("Error submitting form:", err);
      toast.error("Erro ao enviar resposta");
    } finally {
      setSubmitting(false);
    }
  };

  const updateResponse = (fieldId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => ({ ...prev, [fieldId]: false }));
    }
  };

  // Get appearance
  const appearance = { ...DEFAULT_APPEARANCE, ...formData?.appearance };

  const inputStyle: React.CSSProperties = {
    backgroundColor: `${appearance.card_background}`,
    color: appearance.text_color,
    borderColor: `${appearance.text_color}18`,
  };

  const inputFocusClass = "transition-all duration-300 focus:ring-2 focus:ring-offset-0";

  const renderField = (field: CustomField) => {
    const value = responses[field.id];
    const hasError = fieldErrors[field.id];

    switch (field.field_type) {
      case "boolean":
        return (
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex items-center gap-3 px-5 py-3 rounded-xl cursor-pointer transition-all duration-300 border",
                value === true
                  ? "shadow-md"
                  : "opacity-60 hover:opacity-100"
              )}
              style={{
                borderColor: value === true ? appearance.primary_color : `${appearance.text_color}15`,
                backgroundColor: value === true ? `${appearance.primary_color}10` : 'transparent',
              }}
              onClick={() => updateResponse(field.id, true)}
            >
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: value === true ? appearance.primary_color : `${appearance.text_color}30`,
                  backgroundColor: value === true ? appearance.primary_color : 'transparent',
                }}
              >
                {value === true && (
                  <CheckCircle2 className="w-3 h-3" style={{ color: appearance.card_background }} />
                )}
              </div>
              <span className="text-sm font-medium" style={{ color: appearance.text_color }}>
                Sim
              </span>
            </div>
            <div
              className={cn(
                "flex items-center gap-3 px-5 py-3 rounded-xl cursor-pointer transition-all duration-300 border",
                value === false
                  ? "shadow-md"
                  : "opacity-60 hover:opacity-100"
              )}
              style={{
                borderColor: value === false ? appearance.primary_color : `${appearance.text_color}15`,
                backgroundColor: value === false ? `${appearance.primary_color}10` : 'transparent',
              }}
              onClick={() => updateResponse(field.id, false)}
            >
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: value === false ? appearance.primary_color : `${appearance.text_color}30`,
                  backgroundColor: value === false ? appearance.primary_color : 'transparent',
                }}
              >
                {value === false && (
                  <CheckCircle2 className="w-3 h-3" style={{ color: appearance.card_background }} />
                )}
              </div>
              <span className="text-sm font-medium" style={{ color: appearance.text_color }}>
                Não
              </span>
            </div>
          </div>
        );

      case "select":
        const selectOptions = field.options || [];
        return (
          <div className="space-y-2">
            {selectOptions.map((opt: any) => (
              <div
                key={opt.value}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-300 border"
                )}
                style={{
                  borderColor: value === opt.value ? appearance.primary_color : `${appearance.text_color}12`,
                  backgroundColor: value === opt.value ? `${appearance.primary_color}08` : 'transparent',
                }}
                onClick={() => updateResponse(field.id, opt.value)}
              >
                <div
                  className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{
                    borderColor: value === opt.value ? appearance.primary_color : `${appearance.text_color}30`,
                  }}
                >
                  {value === opt.value && (
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: appearance.primary_color }}
                    />
                  )}
                </div>
                <span
                  className={cn("text-sm transition-all", value === opt.value ? "font-medium" : "font-normal")}
                  style={{ color: appearance.text_color }}
                >
                  {opt.label}
                </span>
              </div>
            ))}
          </div>
        );

      case "multi_select":
        const multiOptions = field.options || [];
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-2">
            {multiOptions.map((opt: any) => {
              const isSelected = selectedValues.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-300 border"
                  )}
                  style={{
                    borderColor: isSelected ? appearance.primary_color : `${appearance.text_color}12`,
                    backgroundColor: isSelected ? `${appearance.primary_color}08` : 'transparent',
                  }}
                  onClick={() => {
                    if (isSelected) {
                      updateResponse(field.id, selectedValues.filter((v) => v !== opt.value));
                    } else {
                      updateResponse(field.id, [...selectedValues, opt.value]);
                    }
                  }}
                >
                  <div
                    className="w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                    style={{
                      borderColor: isSelected ? appearance.primary_color : `${appearance.text_color}30`,
                      backgroundColor: isSelected ? appearance.primary_color : 'transparent',
                    }}
                  >
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 3.5L3.5 6L9 1" stroke={appearance.card_background} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span
                    className={cn("text-sm transition-all", isSelected ? "font-medium" : "font-normal")}
                    style={{ color: appearance.text_color }}
                  >
                    {opt.label}
                  </span>
                </div>
              );
            })}
          </div>
        );

      case "number":
      case "currency":
        return (
          <div className="relative">
            {field.field_type === "currency" && (
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: `${appearance.text_color}50` }}
              >
                R$
              </span>
            )}
            <input
              type="number"
              value={value || ""}
              onChange={(e) => updateResponse(field.id, e.target.value ? Number(e.target.value) : null)}
              placeholder={field.field_type === "currency" ? "0,00" : "0"}
              step={field.field_type === "currency" ? "0.01" : "1"}
              className={cn(
                "w-full h-12 rounded-xl border bg-transparent px-4 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-offset-0",
                field.field_type === "currency" && "pl-10",
                hasError && "ring-2 ring-red-400"
              )}
              style={{
                ...inputStyle,
                // @ts-ignore
                "--tw-ring-color": appearance.primary_color,
              } as React.CSSProperties}
            />
          </div>
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-full h-12 rounded-xl border flex items-center gap-3 px-4 text-sm outline-none transition-all duration-300 hover:shadow-sm",
                  hasError && "ring-2 ring-red-400"
                )}
                style={{
                  ...inputStyle,
                  borderColor: value ? appearance.primary_color : `${appearance.text_color}18`,
                }}
              >
                <CalendarIcon
                  className="h-4 w-4 shrink-0"
                  style={{ color: value ? appearance.primary_color : `${appearance.text_color}40` }}
                />
                <span style={{ color: value ? appearance.text_color : `${appearance.text_color}45` }}>
                  {value ? format(new Date(value), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecionar data"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) =>
                  updateResponse(field.id, date ? format(date, "yyyy-MM-dd") : null)
                }
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        );

      case "text":
      default:
        return (
          <textarea
            value={value || ""}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            placeholder="Digite sua resposta..."
            rows={3}
            className={cn(
              "w-full rounded-xl border bg-transparent px-4 py-3 text-sm outline-none resize-none transition-all duration-300 focus:ring-2 focus:ring-offset-0",
              hasError && "ring-2 ring-red-400"
            )}
            style={{
              ...inputStyle,
              // @ts-ignore
              "--tw-ring-color": appearance.primary_color,
            } as React.CSSProperties}
          />
        );
    }
  };

  if (loading) {
    return <LoadingScreen message="Carregando formulário..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#fafafa' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl shadow-black/5 p-10 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2 tracking-tight">
            Formulário indisponível
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">{error}</p>
        </motion.div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={(() => {
          if (appearance.background_type === "gradient") {
            return {
              background: `linear-gradient(135deg, ${appearance.gradient_start} 0%, ${appearance.gradient_end} 100%)`,
            };
          }
          return { backgroundColor: appearance.background_color };
        })()}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md rounded-2xl shadow-2xl shadow-black/8 p-12 text-center"
          style={{ backgroundColor: appearance.card_background }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: `${appearance.primary_color}12` }}
          >
            <CheckCircle2 className="h-9 w-9" style={{ color: appearance.primary_color }} />
          </motion.div>
          <h2
            className="text-2xl font-semibold mb-3 tracking-tight"
            style={{ color: appearance.text_color }}
          >
            Resposta enviada
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: `${appearance.text_color}80` }}
          >
            Obrigado por preencher o formulário. Suas respostas foram registradas com sucesso.
          </p>
        </motion.div>
      </div>
    );
  }

  const getBackgroundStyle = (): React.CSSProperties => {
    if (appearance.background_type === "gradient") {
      return {
        background: `linear-gradient(135deg, ${appearance.gradient_start} 0%, ${appearance.gradient_end} 100%)`,
        minHeight: "100vh",
      };
    }
    return {
      backgroundColor: appearance.background_color,
      minHeight: "100vh",
    };
  };

  const cardWidthClass = CARD_WIDTH_OPTIONS[appearance.card_width || "md"].class;
  const borderRadiusClass = BORDER_RADIUS_OPTIONS[appearance.border_radius || "lg"].class;

  const titleAlignmentClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[appearance.title_alignment || "center"];

  const logoAlignmentClass = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  }[appearance.logo_position || "center"];

  const totalFields = customFields.length + (formData?.require_client_info && !clientId ? 2 : 0);
  const filledFields = customFields.filter(f => !isFieldEmpty(f, responses[f.id])).length
    + (formData?.require_client_info && !clientId ? (clientName.trim() ? 1 : 0) + (clientPhone.trim() ? 1 : 0) : 0);
  const progress = totalFields > 0 ? (filledFields / totalFields) * 100 : 0;

  return (
    <div style={getBackgroundStyle()} className="py-6 sm:py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`mx-auto ${cardWidthClass}`}
      >
        {/* Main Card */}
        <div
          className={cn("shadow-2xl shadow-black/8 overflow-hidden", borderRadiusClass)}
          style={{ backgroundColor: appearance.card_background }}
        >
          {/* Progress Bar */}
          <div className="h-1 w-full" style={{ backgroundColor: `${appearance.text_color}08` }}>
            <motion.div
              className="h-full"
              style={{ backgroundColor: appearance.primary_color }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Header */}
          <div className={cn("px-6 sm:px-10 pt-8 sm:pt-10 pb-2", titleAlignmentClass)}>
            {/* Logo */}
            {appearance.logo_url && (
              <div className={`flex ${logoAlignmentClass} mb-6`}>
                <img
                  src={appearance.logo_url}
                  alt="Logo"
                  className="h-12 sm:h-14 object-contain"
                />
              </div>
            )}

            {/* Title */}
            {appearance.show_title !== false && (
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight"
                style={{ color: appearance.text_color }}
              >
                {formData?.title}
              </h1>
            )}

            {/* Description */}
            {formData?.description && (
              <p
                className="mt-3 text-sm sm:text-base leading-relaxed max-w-lg"
                style={{
                  color: `${appearance.text_color}70`,
                  marginLeft: titleAlignmentClass === "text-center" ? "auto" : undefined,
                  marginRight: titleAlignmentClass === "text-center" ? "auto" : undefined,
                }}
              >
                {formData.description}
              </p>
            )}
          </div>

          {/* Client Badge */}
          {clientData && (
            <div className="px-6 sm:px-10 pt-4">
              <div
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm"
                style={{
                  backgroundColor: `${appearance.primary_color}0A`,
                  border: `1px solid ${appearance.primary_color}20`,
                }}
              >
                <User className="w-3.5 h-3.5" style={{ color: appearance.primary_color }} />
                <span style={{ color: appearance.text_color }}>
                  {clientData.name}
                </span>
              </div>
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="px-6 sm:px-10 py-8 sm:py-10 space-y-7">
            {/* Client info fields */}
            {formData?.require_client_info && !clientId && (
              <div
                className="space-y-5 pb-7 mb-2"
                style={{ borderBottom: `1px solid ${appearance.text_color}0A` }}
              >
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium flex items-center gap-1.5"
                    style={{ color: fieldErrors.clientName ? '#ef4444' : appearance.text_color }}
                  >
                    <User className="w-3.5 h-3.5" style={{ opacity: 0.5 }} />
                    Nome
                    <span style={{ color: appearance.primary_color }}>*</span>
                  </label>
                  <input
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      if (fieldErrors.clientName) {
                        setFieldErrors((prev) => ({ ...prev, clientName: false }));
                      }
                    }}
                    placeholder="Seu nome completo"
                    className={cn(
                      "w-full h-12 rounded-xl border bg-transparent px-4 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-offset-0",
                      fieldErrors.clientName && "ring-2 ring-red-400"
                    )}
                    style={{
                      ...inputStyle,
                      // @ts-ignore
                      "--tw-ring-color": appearance.primary_color,
                    } as React.CSSProperties}
                  />
                  {fieldErrors.clientName && (
                    <p className="text-xs text-red-500 mt-1">Nome é obrigatório</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium flex items-center gap-1.5"
                    style={{ color: fieldErrors.clientPhone ? '#ef4444' : appearance.text_color }}
                  >
                    <Phone className="w-3.5 h-3.5" style={{ opacity: 0.5 }} />
                    Telefone
                    <span style={{ color: appearance.primary_color }}>*</span>
                  </label>
                  <input
                    value={clientPhone}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, "");
                      let formatted = "";
                      if (rawValue.length <= 2) {
                        formatted = rawValue.length > 0 ? `(${rawValue}` : "";
                      } else if (rawValue.length <= 7) {
                        formatted = `(${rawValue.slice(0, 2)}) ${rawValue.slice(2)}`;
                      } else if (rawValue.length <= 11) {
                        formatted = `(${rawValue.slice(0, 2)}) ${rawValue.slice(2, 7)}-${rawValue.slice(7)}`;
                      } else {
                        formatted = `(${rawValue.slice(0, 2)}) ${rawValue.slice(2, 7)}-${rawValue.slice(7, 11)}`;
                      }
                      setClientPhone(formatted);
                      if (fieldErrors.clientPhone) {
                        setFieldErrors((prev) => ({ ...prev, clientPhone: false }));
                      }
                    }}
                    placeholder="(11) 99999-9999"
                    className={cn(
                      "w-full h-12 rounded-xl border bg-transparent px-4 text-sm outline-none transition-all duration-300 focus:ring-2 focus:ring-offset-0",
                      fieldErrors.clientPhone && "ring-2 ring-red-400"
                    )}
                    style={{
                      ...inputStyle,
                      // @ts-ignore
                      "--tw-ring-color": appearance.primary_color,
                    } as React.CSSProperties}
                  />
                  {fieldErrors.clientPhone && (
                    <p className="text-xs text-red-500 mt-1">Telefone é obrigatório</p>
                  )}
                </div>
              </div>
            )}

            {/* Custom fields */}
            {customFields.map((field, index) => (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.4 }}
                className="space-y-2.5"
              >
                <label
                  className="text-sm font-medium block"
                  style={{ color: fieldErrors[field.id] ? '#ef4444' : appearance.text_color }}
                >
                  {field.name}
                  {field.is_required && (
                    <span className="ml-1" style={{ color: appearance.primary_color }}>*</span>
                  )}
                </label>
                {renderField(field)}
                <AnimatePresence>
                  {fieldErrors[field.id] && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-red-500"
                    >
                      Este campo é obrigatório
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}

            {/* Submit */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full h-13 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-300",
                  "hover:shadow-lg hover:shadow-black/10 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                )}
                style={{
                  backgroundColor: appearance.primary_color,
                  color: appearance.card_background,
                  height: "52px",
                }}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar Respostas
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          {appearance.show_footer !== false && appearance.footer_text && (
            <div
              className="text-center pb-6 text-xs tracking-wide"
              style={{ color: `${appearance.text_color}35` }}
            >
              {appearance.footer_text}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
