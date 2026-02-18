import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressLink } from "@/components/ui/address-link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, MapPin, Monitor, CheckCircle, Clock, Users, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { RsvpFormField } from "@/components/events/RsvpFieldsEditor";

const DEFAULT_FIELDS: RsvpFormField[] = [
  { key: "name", label: "Nome completo", type: "text", required: true, enabled: true },
  { key: "phone", label: "Telefone (WhatsApp)", type: "tel", required: true, enabled: true },
  { key: "email", label: "E-mail", type: "email", required: true, enabled: true },
  { key: "rg", label: "RG", type: "text", required: true, enabled: true },
];

interface EventInfo {
  event_id: string;
  event_title: string;
  event_description: string | null;
  event_scheduled_at: string | null;
  event_ends_at: string | null;
  event_modality: string;
  event_address: string | null;
  max_capacity: number | null;
  current_confirmed: number;
  has_capacity: boolean;
  rsvp_form_fields: RsvpFormField[] | null;
}

export default function PublicEventRegistration() {
  const { code } = useParams<{ code: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    waitlist_position: number | null;
    message: string;
    is_client: boolean;
  } | null>(null);
  
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (code) fetchEvent();
  }, [code]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase.rpc("get_event_by_registration_code", {
        p_code: code!
      });
      if (error) throw error;
      if (data && data.length > 0) {
        const raw = data[0] as any;
        setEvent({
          ...raw,
          rsvp_form_fields: raw.rsvp_form_fields as RsvpFormField[] | null,
        });
      }
    } catch (error) {
      console.error("Error fetching event:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFields = (): RsvpFormField[] => {
    if (!event?.rsvp_form_fields) return DEFAULT_FIELDS;
    return event.rsvp_form_fields.filter(f => f.enabled);
  };

  const formatPhoneE164 = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55")) return "+" + digits;
    return "+55" + digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields = getFields();

    // Validate required fields
    for (const field of fields) {
      if (field.required && !formValues[field.key]?.trim()) {
        toast.error(`Por favor, informe: ${field.label}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      // Separate standard fields from custom fields
      const name = formValues["name"]?.trim() || "";
      const phone = formatPhoneE164(formValues["phone"] || "");
      const email = formValues["email"]?.trim() || "";
      const rg = formValues["rg"]?.trim() || "";

      // Custom fields = anything not name/phone/email/rg
      const customFields: Record<string, string> = {};
      for (const field of fields) {
        if (!["name", "phone", "email", "rg"].includes(field.key) && formValues[field.key]?.trim()) {
          customFields[field.key] = formValues[field.key].trim();
          // Also store label for readability
          customFields[`_label_${field.key}`] = field.label;
        }
      }

      const { data, error } = await supabase.rpc("register_for_event", {
        p_code: code!,
        p_name: name,
        p_phone: phone,
        p_email: email || null,
        p_rg: rg || null,
        p_custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
      });

      if (error) throw error;

      const response = data as { success: boolean; error?: string; status?: string; waitlist_position?: number; message?: string; is_client?: boolean };

      if (!response.success) {
        toast.error(response.error || "Erro ao realizar inscrição");
        return;
      }

      setResult({
        status: response.status || "confirmed",
        waitlist_position: response.waitlist_position || null,
        message: response.message || "Inscrição realizada!",
        is_client: response.is_client || false,
      });
      setSubmitted(true);
      toast.success(response.message);
    } catch (error) {
      console.error("Error registering:", error);
      toast.error("Erro ao realizar inscrição. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-destructive">Evento não encontrado</CardTitle>
            <CardDescription>
              O link de inscrição é inválido ou o evento não está mais disponível.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              result.status === "confirmed" ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
            }`}>
              {result.status === "confirmed" ? (
                <CheckCircle className="w-8 h-8" />
              ) : (
                <Clock className="w-8 h-8" />
              )}
            </div>
            <CardTitle>
              {result.status === "confirmed" ? "Inscrição Confirmada!" : "Lista de Espera"}
            </CardTitle>
            <CardDescription className="text-base">
              {result.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2">{event.event_title}</h3>
              {event.event_scheduled_at && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(event.event_scheduled_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
              {event.event_modality === "presencial" && event.event_address && (
                <div className="text-sm text-muted-foreground mt-1">
                  <AddressLink 
                    address={event.event_address} 
                    className="text-sm text-muted-foreground hover:text-primary"
                  />
                </div>
              )}
              {event.event_modality === "online" && (
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <Monitor className="w-4 h-4" />
                  Evento online - você receberá o link de acesso
                </p>
              )}
            </div>
            {result.is_client && (
              <p className="text-sm text-center text-muted-foreground">
                Identificamos você como cliente! Seu cadastro foi vinculado automaticamente.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const fields = getFields();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{event.event_title}</CardTitle>
          {event.event_description && (
            <CardDescription className="text-base">
              {event.event_description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Event Details */}
          <div className="space-y-3 text-sm">
            {event.event_scheduled_at && (
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {format(new Date(event.event_scheduled_at), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-muted-foreground">
                    {format(new Date(event.event_scheduled_at), "HH:mm", { locale: ptBR })}
                    {event.event_ends_at && ` - ${format(new Date(event.event_ends_at), "HH:mm", { locale: ptBR })}`}
                  </p>
                </div>
              </div>
            )}
            
            {event.event_modality === "presencial" && event.event_address && (
              <div className="flex items-start gap-3">
                <AddressLink 
                  address={event.event_address} 
                  className="text-sm"
                />
              </div>
            )}
            
            {event.event_modality === "online" && (
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-muted-foreground" />
                <p>Evento online</p>
              </div>
            )}

            {event.max_capacity && (
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-muted-foreground" />
                <p>
                  {event.current_confirmed} / {event.max_capacity} vagas preenchidas
                </p>
              </div>
            )}
          </div>

          {/* Capacity Warning */}
          {!event.has_capacity && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                As vagas estão esgotadas. Você pode se inscrever na lista de espera.
              </p>
            </div>
          )}

          {/* Dynamic Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>
                  {field.label} {field.required && "*"}
                </Label>
                {field.type === "select" && field.options ? (
                  <Select
                    value={formValues[field.key] || ""}
                    onValueChange={(v) => setFormValues(prev => ({ ...prev, [field.key]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Selecione ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={field.key}
                    type={field.type === "number" ? "number" : field.type}
                    value={formValues[field.key] || ""}
                    onChange={(e) => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={
                      field.key === "phone" ? "(11) 99999-9999" :
                      field.key === "email" ? "seu@email.com" :
                      field.key === "rg" ? "00.000.000-0" :
                      field.label
                    }
                    required={field.required}
                  />
                )}
              </div>
            ))}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Inscrevendo..." : event.has_capacity ? "Confirmar Inscrição" : "Entrar na Lista de Espera"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
