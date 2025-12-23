import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar, CheckCircle, Star, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface EventInfo {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  account_id: string;
}

export default function PublicEventFeedback() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Form state
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [overallRating, setOverallRating] = useState<number>(0);
  const [contentRating, setContentRating] = useState<number>(0);
  const [organizationRating, setOrganizationRating] = useState<number>(0);
  const [venueRating, setVenueRating] = useState<number>(0);
  const [wouldRecommend, setWouldRecommend] = useState<string>("");
  const [highlights, setHighlights] = useState("");
  const [improvements, setImprovements] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, scheduled_at, account_id")
        .eq("id", eventId)
        .single();

      if (error) throw error;
      setEvent(data);
    } catch (error) {
      console.error("Error fetching event:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneE164 = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55")) {
      return "+" + digits;
    }
    return "+55" + digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (npsScore === null) {
      toast.error("Por favor, selecione uma nota de 0 a 10 para o NPS");
      return;
    }

    setSubmitting(true);

    try {
      // Try to find client by phone
      let clientId: string | null = null;
      
      if (clientPhone.trim()) {
        const phoneE164 = formatPhoneE164(clientPhone);
        const { data: clientData } = await supabase
          .from("clients")
          .select("id")
          .eq("account_id", event?.account_id)
          .eq("phone_e164", phoneE164)
          .single();
        
        if (clientData) {
          clientId = clientData.id;
        }
      }

      const { error } = await supabase.from("event_feedback").insert({
        event_id: eventId!,
        account_id: event!.account_id,
        client_id: clientId,
        nps_score: npsScore,
        overall_rating: overallRating || null,
        content_rating: contentRating || null,
        organization_rating: organizationRating || null,
        venue_rating: venueRating || null,
        would_recommend: wouldRecommend === "yes" ? true : wouldRecommend === "no" ? false : null,
        highlights: highlights.trim() || null,
        improvements: improvements.trim() || null,
        additional_comments: additionalComments.trim() || null,
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success("Feedback enviado com sucesso!");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Erro ao enviar feedback. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number; 
    onChange: (v: number) => void; 
    label: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`h-8 w-8 ${
                star <= value 
                  ? "text-yellow-500 fill-yellow-500" 
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

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
              O link de feedback é inválido ou o evento não existe.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <CardTitle>Obrigado pelo Feedback!</CardTitle>
            <CardDescription className="text-base">
              Sua opinião é muito importante para nós e nos ajuda a melhorar cada vez mais.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <CardTitle>Avalie sua experiência</CardTitle>
            <CardDescription className="text-base">
              {event.title}
              {event.scheduled_at && (
                <span className="block mt-1 text-sm">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  {format(new Date(event.scheduled_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Phone for identification */}
              <div className="space-y-2">
                <Label htmlFor="phone">Seu telefone (opcional, para identificação)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
                <p className="text-xs text-muted-foreground">
                  Informe para vincular ao seu cadastro
                </p>
              </div>

              {/* NPS Score */}
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  De 0 a 10, qual a probabilidade de você recomendar nossos eventos? *
                </Label>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setNpsScore(score)}
                      className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                        npsScore === score
                          ? score <= 6
                            ? "bg-red-500 text-white"
                            : score <= 8
                            ? "bg-yellow-500 text-white"
                            : "bg-green-500 text-white"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>Nada provável</span>
                  <span>Muito provável</span>
                </div>
              </div>

              {/* Star Ratings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <StarRating
                  value={overallRating}
                  onChange={setOverallRating}
                  label="Avaliação Geral"
                />
                <StarRating
                  value={contentRating}
                  onChange={setContentRating}
                  label="Conteúdo"
                />
                <StarRating
                  value={organizationRating}
                  onChange={setOrganizationRating}
                  label="Organização"
                />
                <StarRating
                  value={venueRating}
                  onChange={setVenueRating}
                  label="Local/Estrutura"
                />
              </div>

              {/* Would recommend */}
              <div className="space-y-3">
                <Label>Você participaria novamente de um evento nosso?</Label>
                <RadioGroup value={wouldRecommend} onValueChange={setWouldRecommend}>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="yes" />
                      <Label htmlFor="yes" className="font-normal cursor-pointer">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="no" />
                      <Label htmlFor="no" className="font-normal cursor-pointer">Não</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Text fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="highlights">O que você mais gostou?</Label>
                  <Textarea
                    id="highlights"
                    value={highlights}
                    onChange={(e) => setHighlights(e.target.value)}
                    placeholder="Conte-nos os pontos altos do evento..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="improvements">O que podemos melhorar?</Label>
                  <Textarea
                    id="improvements"
                    value={improvements}
                    onChange={(e) => setImprovements(e.target.value)}
                    placeholder="Suas sugestões são muito importantes..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comments">Comentários adicionais</Label>
                  <Textarea
                    id="comments"
                    value={additionalComments}
                    onChange={(e) => setAdditionalComments(e.target.value)}
                    placeholder="Algo mais que gostaria de compartilhar?"
                    rows={3}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
