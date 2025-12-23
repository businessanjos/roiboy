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

interface FeedbackQuestion {
  id: string;
  question_type: string;
  question_text: string;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
}

const DEFAULT_QUESTIONS: Omit<FeedbackQuestion, "id">[] = [
  { question_type: "nps", question_text: "De 0 a 10, qual a probabilidade de você recomendar nossos eventos?", is_required: true, display_order: 0, is_active: true },
  { question_type: "stars", question_text: "Avaliação Geral", is_required: false, display_order: 1, is_active: true },
  { question_type: "stars", question_text: "Conteúdo", is_required: false, display_order: 2, is_active: true },
  { question_type: "stars", question_text: "Organização", is_required: false, display_order: 3, is_active: true },
  { question_type: "stars", question_text: "Local/Estrutura", is_required: false, display_order: 4, is_active: true },
  { question_type: "yes_no", question_text: "Você participaria novamente de um evento nosso?", is_required: false, display_order: 5, is_active: true },
  { question_type: "textarea", question_text: "O que você mais gostou?", is_required: false, display_order: 6, is_active: true },
  { question_type: "textarea", question_text: "O que podemos melhorar?", is_required: false, display_order: 7, is_active: true },
  { question_type: "textarea", question_text: "Comentários adicionais", is_required: false, display_order: 8, is_active: true },
];

export default function PublicEventFeedback() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Form state
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [clientPhone, setClientPhone] = useState("");

  useEffect(() => {
    if (eventId) {
      fetchEventAndQuestions();
    }
  }, [eventId]);

  const fetchEventAndQuestions = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, title, description, scheduled_at, account_id")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch event-specific questions first
      const { data: eventQuestions, error: eqError } = await supabase
        .from("event_feedback_questions")
        .select("*")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("display_order");

      if (!eqError && eventQuestions && eventQuestions.length > 0) {
        setQuestions(eventQuestions);
      } else {
        // Try account defaults
        const { data: defaultQuestions, error: dqError } = await supabase
          .from("feedback_questions")
          .select("*")
          .eq("account_id", eventData.account_id)
          .eq("is_default", true)
          .eq("is_active", true)
          .order("display_order");

        if (!dqError && defaultQuestions && defaultQuestions.length > 0) {
          setQuestions(defaultQuestions);
        } else {
          // Use built-in defaults
          setQuestions(
            DEFAULT_QUESTIONS.map((q, i) => ({
              ...q,
              id: `default-${i}`,
            }))
          );
        }
      }
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
    
    // Validate required fields
    for (const question of questions) {
      if (question.is_required) {
        const response = responses[question.id];
        if (response === undefined || response === null || response === "") {
          toast.error(`Por favor, responda: ${question.question_text}`);
          return;
        }
      }
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

      // Map responses to legacy fields for backward compatibility
      const legacyData: Record<string, any> = {};
      
      questions.forEach((q) => {
        const response = responses[q.id];
        if (response === undefined || response === null) return;

        // Map to legacy fields based on question text patterns
        const textLower = q.question_text.toLowerCase();
        
        if (q.question_type === "nps") {
          legacyData.nps_score = response;
        } else if (q.question_type === "stars") {
          if (textLower.includes("geral")) {
            legacyData.overall_rating = response;
          } else if (textLower.includes("conteúdo") || textLower.includes("conteudo")) {
            legacyData.content_rating = response;
          } else if (textLower.includes("organização") || textLower.includes("organizacao")) {
            legacyData.organization_rating = response;
          } else if (textLower.includes("local") || textLower.includes("estrutura")) {
            legacyData.venue_rating = response;
          }
        } else if (q.question_type === "yes_no") {
          if (textLower.includes("participaria") || textLower.includes("recomend")) {
            legacyData.would_recommend = response === "yes";
          }
        } else if (q.question_type === "textarea" || q.question_type === "text") {
          if (textLower.includes("gostou") || textLower.includes("pontos fortes")) {
            legacyData.highlights = response;
          } else if (textLower.includes("melhorar")) {
            legacyData.improvements = response;
          } else if (textLower.includes("comentário") || textLower.includes("comentario") || textLower.includes("adicional")) {
            legacyData.additional_comments = response;
          }
        }
      });

      // Insert main feedback
      const { data: feedbackData, error: feedbackError } = await supabase
        .from("event_feedback")
        .insert({
          event_id: eventId!,
          account_id: event!.account_id,
          client_id: clientId,
          ...legacyData,
        })
        .select()
        .single();

      if (feedbackError) throw feedbackError;

      // Insert custom responses
      const customResponses = questions.map((q) => ({
        account_id: event!.account_id,
        event_id: eventId!,
        feedback_id: feedbackData.id,
        question_id: q.id,
        question_text: q.question_text,
        response_value: typeof responses[q.id] === "string" ? responses[q.id] : null,
        response_number: typeof responses[q.id] === "number" ? responses[q.id] : null,
        response_boolean: typeof responses[q.id] === "boolean" ? responses[q.id] : 
          responses[q.id] === "yes" ? true : responses[q.id] === "no" ? false : null,
      })).filter((r) => r.response_value !== null || r.response_number !== null || r.response_boolean !== null);

      if (customResponses.length > 0) {
        await supabase.from("event_feedback_responses").insert(customResponses);
      }

      setSubmitted(true);
      toast.success("Feedback enviado com sucesso!");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Erro ao enviar feedback. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateResponse = (questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  // Render components for each question type
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

  const NPSRating = ({
    value,
    onChange,
    label,
    required,
  }: {
    value: number | null;
    onChange: (v: number) => void;
    label: string;
    required?: boolean;
  }) => (
    <div className="space-y-3">
      <Label className="text-base font-medium">
        {label} {required && "*"}
      </Label>
      <div className="flex flex-wrap gap-2 justify-center">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={`w-10 h-10 rounded-lg font-semibold transition-all ${
              value === score
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
  );

  const YesNoQuestion = ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    label: string;
  }) => (
    <div className="space-y-3">
      <Label>{label}</Label>
      <RadioGroup value={value} onValueChange={onChange}>
        <div className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id={`yes-${label}`} />
            <Label htmlFor={`yes-${label}`} className="font-normal cursor-pointer">Sim</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id={`no-${label}`} />
            <Label htmlFor={`no-${label}`} className="font-normal cursor-pointer">Não</Label>
          </div>
        </div>
      </RadioGroup>
    </div>
  );

  const renderQuestion = (question: FeedbackQuestion) => {
    const value = responses[question.id];

    switch (question.question_type) {
      case "nps":
        return (
          <NPSRating
            key={question.id}
            value={value ?? null}
            onChange={(v) => updateResponse(question.id, v)}
            label={question.question_text}
            required={question.is_required}
          />
        );

      case "stars":
        return (
          <StarRating
            key={question.id}
            value={value ?? 0}
            onChange={(v) => updateResponse(question.id, v)}
            label={question.question_text}
          />
        );

      case "yes_no":
        return (
          <YesNoQuestion
            key={question.id}
            value={value ?? ""}
            onChange={(v) => updateResponse(question.id, v)}
            label={question.question_text}
          />
        );

      case "textarea":
        return (
          <div key={question.id} className="space-y-2">
            <Label htmlFor={question.id}>
              {question.question_text}
              {question.is_required && " *"}
            </Label>
            <Textarea
              id={question.id}
              value={value ?? ""}
              onChange={(e) => updateResponse(question.id, e.target.value)}
              rows={3}
            />
          </div>
        );

      case "text":
      default:
        return (
          <div key={question.id} className="space-y-2">
            <Label htmlFor={question.id}>
              {question.question_text}
              {question.is_required && " *"}
            </Label>
            <Input
              id={question.id}
              value={value ?? ""}
              onChange={(e) => updateResponse(question.id, e.target.value)}
            />
          </div>
        );
    }
  };

  // Group questions by type for better layout
  const starsQuestions = questions.filter((q) => q.question_type === "stars");
  const otherQuestions = questions.filter((q) => q.question_type !== "stars");

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

              {/* Render questions dynamically */}
              {otherQuestions
                .filter((q) => q.question_type === "nps")
                .map(renderQuestion)}

              {/* Star ratings in grid */}
              {starsQuestions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {starsQuestions.map(renderQuestion)}
                </div>
              )}

              {/* Yes/No questions */}
              {otherQuestions
                .filter((q) => q.question_type === "yes_no")
                .map(renderQuestion)}

              {/* Text fields */}
              <div className="space-y-4">
                {otherQuestions
                  .filter((q) => q.question_type === "text" || q.question_type === "textarea")
                  .map(renderQuestion)}
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
