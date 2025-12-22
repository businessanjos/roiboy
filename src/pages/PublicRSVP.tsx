import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar, 
  Clock, 
  Video, 
  Check, 
  X, 
  CheckCircle2,
  XCircle,
  PartyPopper
} from "lucide-react";
import { AddressLink } from "@/components/ui/address-link";

interface RSVPData {
  participant_id: string;
  event_id: string;
  event_title: string;
  event_description: string | null;
  event_scheduled_at: string | null;
  event_ends_at: string | null;
  event_modality: string;
  event_address: string | null;
  event_meeting_url: string | null;
  guest_name: string | null;
  client_name: string | null;
  rsvp_status: string;
  rsvp_responded_at: string | null;
}

export default function PublicRSVP() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RSVPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchRSVPData();
    }
  }, [token]);

  const fetchRSVPData = async () => {
    setLoading(true);
    setError(null);

    const { data: result, error: fetchError } = await supabase
      .rpc("get_participant_by_rsvp_token", { p_token: token });

    if (fetchError || !result || result.length === 0) {
      setError("Convite não encontrado ou link inválido.");
    } else {
      setData(result[0] as RSVPData);
    }
    setLoading(false);
  };

  const handleRSVP = async (status: "confirmed" | "declined") => {
    if (!token) return;

    setSubmitting(true);
    setError(null);

    const { data: result, error: submitError } = await supabase
      .rpc("submit_rsvp_response", { p_token: token, p_status: status });

    if (submitError) {
      setError("Erro ao enviar resposta. Tente novamente.");
    } else if (result && typeof result === 'object' && 'success' in result) {
      const response = result as { success: boolean; message?: string; error?: string };
      if (response.success) {
        setSuccess(response.message || "Resposta registrada!");
        // Update local state
        setData(prev => prev ? { ...prev, rsvp_status: status, rsvp_responded_at: new Date().toISOString() } : null);
      } else {
        setError(response.error || "Erro ao processar resposta.");
      }
    }
    setSubmitting(false);
  };

  const participantName = data?.client_name || data?.guest_name || "Convidado";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const hasResponded = data?.rsvp_status === "confirmed" || data?.rsvp_status === "declined";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-2">
          {success ? (
            <>
              <PartyPopper className="h-16 w-16 text-primary mx-auto mb-4" />
              <CardTitle className="text-2xl">{success}</CardTitle>
            </>
          ) : hasResponded ? (
            <>
              {data?.rsvp_status === "confirmed" ? (
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              ) : (
                <XCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              )}
              <CardTitle className="text-2xl">
                {data?.rsvp_status === "confirmed" 
                  ? "Presença Confirmada!" 
                  : "Você declinou o convite"}
              </CardTitle>
              <CardDescription>
                Respondido em {data?.rsvp_responded_at && format(new Date(data.rsvp_responded_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="text-2xl mb-1">Você está convidado!</CardTitle>
              <CardDescription className="text-base">
                Olá, <span className="font-medium text-foreground">{participantName}</span>!
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Event Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-lg">{data?.event_title}</h3>
            
            {data?.event_description && (
              <p className="text-sm text-muted-foreground">{data.event_description}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              {data?.event_scheduled_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>
                    {format(new Date(data.event_scheduled_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
              
              {data?.event_scheduled_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>
                    {format(new Date(data.event_scheduled_at), "HH:mm", { locale: ptBR })}
                    {data?.event_ends_at && (
                      <> - {format(new Date(data.event_ends_at), "HH:mm", { locale: ptBR })}</>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              {data?.event_modality === "online" ? (
                <>
                  <Video className="h-4 w-4 text-primary" />
                  <Badge variant="outline">Online</Badge>
                </>
              ) : data?.event_address ? (
                <AddressLink 
                  address={data.event_address} 
                  className="text-sm"
                />
              ) : (
                <span className="text-muted-foreground">Presencial</span>
              )}
            </div>
          </div>

          {/* RSVP Buttons */}
          {!hasResponded && !success && (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                Por favor, confirme sua presença:
              </p>
              
              <div className="flex gap-3">
                <Button 
                  className="flex-1 h-12" 
                  onClick={() => handleRSVP("confirmed")}
                  disabled={submitting}
                >
                  <Check className="h-5 w-5 mr-2" />
                  Confirmar Presença
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 h-12"
                  onClick={() => handleRSVP("declined")}
                  disabled={submitting}
                >
                  <X className="h-5 w-5 mr-2" />
                  Não Poderei Ir
                </Button>
              </div>

              {error && (
                <p className="text-center text-sm text-destructive">{error}</p>
              )}
            </div>
          )}

          {/* Meeting URL for confirmed online events */}
          {(hasResponded || success) && data?.rsvp_status === "confirmed" && data?.event_modality === "online" && data?.event_meeting_url && (
            <div className="text-center">
              <Button asChild className="w-full">
                <a href={data.event_meeting_url} target="_blank" rel="noopener noreferrer">
                  <Video className="h-4 w-4 mr-2" />
                  Acessar Reunião
                </a>
              </Button>
            </div>
          )}

          {/* Change response option */}
          {hasResponded && !success && (
            <div className="text-center pt-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setData(prev => prev ? { ...prev, rsvp_status: 'pending', rsvp_responded_at: null } : null)}
              >
                Alterar minha resposta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
