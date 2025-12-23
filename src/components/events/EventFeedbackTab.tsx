import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  MessageSquare, 
  Star, 
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Download,
  Link2,
  Copy,
  Check,
  Send,
  Settings2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import FeedbackQuestionsEditor from "./FeedbackQuestionsEditor";

interface Client {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Feedback {
  id: string;
  client_id: string | null;
  nps_score: number | null;
  overall_rating: number | null;
  content_rating: number | null;
  organization_rating: number | null;
  venue_rating: number | null;
  highlights: string | null;
  improvements: string | null;
  additional_comments: string | null;
  would_recommend: boolean | null;
  submitted_at: string;
  clients?: Client;
}

interface EventFeedbackTabProps {
  eventId: string;
  accountId: string | null;
}

export default function EventFeedbackTab({ eventId, accountId }: EventFeedbackTabProps) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => {
    if (eventId) {
      fetchFeedback();
    }
  }, [eventId]);

  const fetchFeedback = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_feedback")
      .select(`
        *,
        clients (id, full_name, avatar_url)
      `)
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching feedback:", error);
    } else {
      setFeedback(data || []);
    }
    setLoading(false);
  };

  const calculateNPS = () => {
    const scores = feedback.filter(f => f.nps_score !== null).map(f => f.nps_score!);
    if (scores.length === 0) return null;

    const promoters = scores.filter(s => s >= 9).length;
    const detractors = scores.filter(s => s <= 6).length;
    const nps = Math.round(((promoters - detractors) / scores.length) * 100);
    return nps;
  };

  const calculateAverageRating = (key: keyof Feedback) => {
    const ratings = feedback.filter(f => f[key] !== null).map(f => f[key] as number);
    if (ratings.length === 0) return 0;
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  };

  const splitName = (fullName: string | undefined) => {
    if (!fullName) return { firstName: "", lastName: "" };
    const parts = fullName.trim().split(" ");
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    return { firstName, lastName };
  };

  const exportCSV = () => {
    const headers = [
      "Nome", "Sobrenome", "NPS", "Avaliação Geral", "Conteúdo", "Organização", 
      "Local", "Recomendaria", "Pontos Fortes", "Melhorias", "Comentários", "Data"
    ];
    const rows = feedback.map(f => {
      const { firstName, lastName } = splitName(f.clients?.full_name);
      return [
        firstName || "Anônimo",
        lastName,
        f.nps_score?.toString() || "",
        f.overall_rating?.toString() || "",
        f.content_rating?.toString() || "",
        f.organization_rating?.toString() || "",
        f.venue_rating?.toString() || "",
        f.would_recommend === true ? "Sim" : f.would_recommend === false ? "Não" : "",
        f.highlights || "",
        f.improvements || "",
        f.additional_comments || "",
        format(new Date(f.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `feedback-evento.csv`;
    link.click();
  };

  const feedbackLink = `${window.location.origin}/feedback/${eventId}`;

  const copyFeedbackLink = async () => {
    await navigator.clipboard.writeText(feedbackLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const nps = calculateNPS();
  const avgOverall = calculateAverageRating('overall_rating');
  const avgContent = calculateAverageRating('content_rating');
  const avgOrganization = calculateAverageRating('organization_rating');
  const avgVenue = calculateAverageRating('venue_rating');

  const getNPSColor = (nps: number | null) => {
    if (nps === null) return "text-muted-foreground";
    if (nps >= 50) return "text-green-600";
    if (nps >= 0) return "text-yellow-600";
    return "text-red-600";
  };

  const getNPSLabel = (nps: number | null) => {
    if (nps === null) return "—";
    if (nps >= 75) return "Excelente";
    if (nps >= 50) return "Muito Bom";
    if (nps >= 0) return "Razoável";
    return "Precisa Melhorar";
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star 
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  // Link section component
  const FeedbackLinkSection = () => (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Link para coleta de feedback</h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Editar Formulário
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Compartilhe este link com os participantes para coletar feedback sobre o evento.
        </p>
        <div className="flex gap-2">
          <Input 
            value={feedbackLink} 
            readOnly 
            className="font-mono text-sm bg-muted"
          />
          <Button onClick={copyFeedbackLink} variant="outline" className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (feedback.length === 0) {
    return (
      <div className="space-y-6">
        <FeedbackLinkSection />
        <EmptyState
          icon={MessageSquare}
          title="Nenhum feedback recebido"
          description="Compartilhe o link acima com os participantes para coletar feedback sobre o evento."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FeedbackLinkSection />
      
      {accountId && (
        <FeedbackQuestionsEditor
          eventId={eventId}
          accountId={accountId}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      )}
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <p className={`text-4xl font-bold ${getNPSColor(nps)}`}>
              {nps !== null ? nps : "—"}
            </p>
            <p className="text-sm text-muted-foreground">NPS</p>
            <p className={`text-xs ${getNPSColor(nps)}`}>{getNPSLabel(nps)}</p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Geral</span>
              <span className="text-sm font-medium">{avgOverall.toFixed(1)}/5</span>
            </div>
            <Progress value={avgOverall * 20} className="h-2" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Conteúdo</span>
              <span className="text-sm font-medium">{avgContent.toFixed(1)}/5</span>
            </div>
            <Progress value={avgContent * 20} className="h-2" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Organização</span>
              <span className="text-sm font-medium">{avgOrganization.toFixed(1)}/5</span>
            </div>
            <Progress value={avgOrganization * 20} className="h-2" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Local</span>
              <span className="text-sm font-medium">{avgVenue.toFixed(1)}/5</span>
            </div>
            <Progress value={avgVenue * 20} className="h-2" />
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          {feedback.length} resposta(s)
        </p>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Feedback List */}
      <div className="space-y-4">
        {feedback.map((f) => (
          <Card key={f.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={f.clients?.avatar_url || undefined} />
                    <AvatarFallback>
                      {f.clients?.full_name?.substring(0, 2).toUpperCase() || "AN"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{f.clients?.full_name || "Anônimo"}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(f.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {f.nps_score !== null && (
                    <Badge variant="outline" className="text-lg font-bold">
                      NPS: {f.nps_score}
                    </Badge>
                  )}
                  {f.would_recommend !== null && (
                    f.would_recommend ? (
                      <ThumbsUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <ThumbsDown className="h-5 w-5 text-red-600" />
                    )
                  )}
                </div>
              </div>

              {/* Ratings */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {f.overall_rating && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Geral</p>
                    {renderStars(f.overall_rating)}
                  </div>
                )}
                {f.content_rating && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Conteúdo</p>
                    {renderStars(f.content_rating)}
                  </div>
                )}
                {f.organization_rating && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Organização</p>
                    {renderStars(f.organization_rating)}
                  </div>
                )}
                {f.venue_rating && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Local</p>
                    {renderStars(f.venue_rating)}
                  </div>
                )}
              </div>

              {/* Comments */}
              {(f.highlights || f.improvements || f.additional_comments) && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  {f.highlights && (
                    <div>
                      <p className="text-xs font-medium text-green-600 mb-1">Pontos Fortes</p>
                      <p className="text-sm">{f.highlights}</p>
                    </div>
                  )}
                  {f.improvements && (
                    <div>
                      <p className="text-xs font-medium text-orange-600 mb-1">Sugestões de Melhoria</p>
                      <p className="text-sm">{f.improvements}</p>
                    </div>
                  )}
                  {f.additional_comments && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Comentários</p>
                      <p className="text-sm">{f.additional_comments}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}