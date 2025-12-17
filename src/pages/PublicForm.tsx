import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";

interface FormData {
  id: string;
  title: string;
  description: string | null;
  fields: string[];
  require_client_info: boolean;
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
  const clientId = searchParams.get("client");

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
      setCustomFields(
        (data.customFields || []).filter((f: CustomField) =>
          data.form.fields.includes(f.id)
        )
      );

      // Pre-fill client info if available
      if (data.client) {
        setClientName(data.client.name);
        setClientPhone(data.client.phone);
      }
    } catch (err: any) {
      console.error("Error fetching form:", err);
      setError("Erro ao carregar formulário");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const missingFields = customFields.filter(
      (field) => field.is_required && !responses[field.id]
    );

    if (missingFields.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${missingFields.map((f) => f.name).join(", ")}`);
      return;
    }

    // Validate client info if required
    if (formData?.require_client_info && !clientId) {
      if (!clientName.trim()) {
        toast.error("Nome é obrigatório");
        return;
      }
      if (!clientPhone.trim()) {
        toast.error("Telefone é obrigatório");
        return;
      }
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
  };

  const renderField = (field: CustomField) => {
    const value = responses[field.id];

    switch (field.field_type) {
      case "boolean":
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={value === true}
              onCheckedChange={(checked) => updateResponse(field.id, checked)}
            />
            <span className="text-sm text-muted-foreground">
              {value === true ? "Sim" : value === false ? "Não" : "Não informado"}
            </span>
          </div>
        );

      case "select":
        const selectOptions = field.options || [];
        return (
          <RadioGroup
            value={value || ""}
            onValueChange={(v) => updateResponse(field.id, v)}
          >
            {selectOptions.map((opt: any) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`${field.id}-${opt.value}`} />
                <Label
                  htmlFor={`${field.id}-${opt.value}`}
                  className="font-normal cursor-pointer"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "multi_select":
        const multiOptions = field.options || [];
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-2">
            {multiOptions.map((opt: any) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${opt.value}`}
                  checked={selectedValues.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateResponse(field.id, [...selectedValues, opt.value]);
                    } else {
                      updateResponse(
                        field.id,
                        selectedValues.filter((v) => v !== opt.value)
                      );
                    }
                  }}
                />
                <Label
                  htmlFor={`${field.id}-${opt.value}`}
                  className="font-normal cursor-pointer"
                >
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        );

      case "number":
      case "currency":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => updateResponse(field.id, e.target.value ? Number(e.target.value) : null)}
            placeholder={field.field_type === "currency" ? "0.00" : "0"}
            step={field.field_type === "currency" ? "0.01" : "1"}
          />
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value), "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value) : undefined}
                onSelect={(date) =>
                  updateResponse(field.id, date ? format(date, "yyyy-MM-dd") : null)
                }
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        );

      case "text":
      default:
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            placeholder="Digite sua resposta..."
            rows={3}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Formulário indisponível
            </h2>
            <p className="text-muted-foreground text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Resposta enviada!
            </h2>
            <p className="text-muted-foreground text-center">
              Obrigado por preencher o formulário.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/80">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{formData?.title}</h1>
          {formData?.description && (
            <p className="text-muted-foreground mt-2">{formData.description}</p>
          )}
        </div>

        {/* Client Info */}
        {clientData && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">
                Respondendo como:{" "}
                <span className="font-medium text-foreground">{clientData.name}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Client info fields if required and no clientId */}
              {formData?.require_client_info && !clientId && (
                <div className="space-y-4 pb-4 border-b">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">
                      Nome <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="clientName"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">
                      Telefone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="clientPhone"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              )}

              {/* Custom fields */}
              {customFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label>
                    {field.name}
                    {field.is_required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  {renderField(field)}
                </div>
              ))}

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar Respostas
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Powered by ROIBOY
        </p>
      </div>
    </div>
  );
}
