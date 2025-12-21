import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, MapPin, Calendar, AlertCircle } from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface EventInfo {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  address: string | null;
}

export default function EventCheckin() {
  const { code } = useParams<{ code: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; clientName: string } | null>(null);

  const isPreview = code?.toUpperCase() === 'DEMO' || code?.toUpperCase() === 'PREVIEW';

  useEffect(() => {
    if (code) {
      if (isPreview) {
        // Show mock data for preview
        setEvent({
          id: 'preview-id',
          title: 'Workshop de Liderança',
          description: 'Evento presencial para desenvolvimento de habilidades de liderança e gestão de equipes.',
          scheduled_at: new Date().toISOString(),
          address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP'
        });
        setIsLoading(false);
      } else {
        fetchEvent();
      }
    }
  }, [code]);

  const fetchEvent = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/event-checkin?code=${code}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Evento não encontrado');
      } else {
        setEvent(result.event);
      }
    } catch (err) {
      console.error('Error fetching event:', err);
      setError('Erro ao carregar evento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !code) return;

    setIsSubmitting(true);
    setError(null);

    // Preview mode - simulate success
    if (isPreview) {
      setTimeout(() => {
        setSuccess({
          message: 'Check-in realizado com sucesso!',
          clientName: 'João Silva (Preview)'
        });
        setIsSubmitting(false);
      }, 1000);
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('event-checkin', {
        body: { code, phone }
      });

      if (invokeError) {
        setError(invokeError.message || 'Erro ao fazer check-in');
      } else if (data.error) {
        setError(data.error);
      } else {
        setSuccess({
          message: data.message,
          clientName: data.client_name
        });
      }
    } catch (err) {
      console.error('Error submitting checkin:', err);
      setError('Erro ao fazer check-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  if (isLoading) {
    return <LoadingScreen message="Carregando evento..." />;
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Evento não encontrado</h2>
            <p className="text-muted-foreground text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-center">Check-in realizado!</h2>
            <p className="text-muted-foreground text-center mb-4">
              Bem-vindo(a), <span className="font-medium text-foreground">{success.clientName}</span>
            </p>
            {event && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{event.title}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">{event?.title}</CardTitle>
          {event?.description && (
            <CardDescription className="mt-2">{event.description}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Event info */}
          <div className="space-y-2 text-sm">
            {event?.scheduled_at && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(new Date(event.scheduled_at), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
            {event?.address && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>{event.address}</span>
              </div>
            )}
          </div>

          {/* Check-in form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Seu telefone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="h-12 text-lg"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Digite o telefone cadastrado para confirmar sua presença
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-base"
              disabled={isSubmitting || !phone.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                'Confirmar presença'
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            Powered by ROY
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
