import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Star,
  MessageSquare,
  ToggleLeft,
  Hash,
  FileText,
  Save,
  RotateCcw,
} from "lucide-react";

interface FeedbackQuestion {
  id: string;
  question_type: string;
  question_text: string;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
}

interface FeedbackQuestionsEditorProps {
  eventId: string;
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUESTION_TYPES = [
  { value: "nps", label: "NPS (0-10)", icon: Hash },
  { value: "stars", label: "Estrelas (1-5)", icon: Star },
  { value: "yes_no", label: "Sim/Não", icon: ToggleLeft },
  { value: "text", label: "Texto curto", icon: MessageSquare },
  { value: "textarea", label: "Texto longo", icon: FileText },
];

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

export default function FeedbackQuestionsEditor({
  eventId,
  accountId,
  open,
  onOpenChange,
}: FeedbackQuestionsEditorProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasEventQuestions, setHasEventQuestions] = useState(false);

  useEffect(() => {
    if (open && eventId && accountId) {
      fetchQuestions();
    }
  }, [open, eventId, accountId]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      // First check if there are event-specific questions
      const { data: eventQuestions, error: eventError } = await supabase
        .from("event_feedback_questions")
        .select("*")
        .eq("event_id", eventId)
        .order("display_order");

      if (eventError) throw eventError;

      if (eventQuestions && eventQuestions.length > 0) {
        setQuestions(eventQuestions);
        setHasEventQuestions(true);
      } else {
        // Check for account defaults
        const { data: defaultQuestions, error: defaultError } = await supabase
          .from("feedback_questions")
          .select("*")
          .eq("account_id", accountId)
          .eq("is_default", true)
          .order("display_order");

        if (defaultError) throw defaultError;

        if (defaultQuestions && defaultQuestions.length > 0) {
          setQuestions(defaultQuestions);
        } else {
          // Use built-in defaults
          setQuestions(
            DEFAULT_QUESTIONS.map((q, i) => ({
              ...q,
              id: `temp-${i}`,
            }))
          );
        }
        setHasEventQuestions(false);
      }
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Erro ao carregar perguntas");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete existing event questions
      await supabase
        .from("event_feedback_questions")
        .delete()
        .eq("event_id", eventId);

      // Insert new questions
      const questionsToInsert = questions.map((q, index) => ({
        account_id: accountId,
        event_id: eventId,
        question_type: q.question_type,
        question_text: q.question_text,
        is_required: q.is_required,
        display_order: index,
        is_active: q.is_active,
      }));

      const { error } = await supabase
        .from("event_feedback_questions")
        .insert(questionsToInsert);

      if (error) throw error;

      setHasEventQuestions(true);
      toast.success("Perguntas salvas com sucesso!");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving questions:", error);
      toast.error("Erro ao salvar perguntas");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    try {
      // Delete event-specific questions
      await supabase
        .from("event_feedback_questions")
        .delete()
        .eq("event_id", eventId);

      setHasEventQuestions(false);
      await fetchQuestions();
      toast.success("Perguntas resetadas para o padrão");
    } catch (error) {
      console.error("Error resetting questions:", error);
      toast.error("Erro ao resetar perguntas");
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: FeedbackQuestion = {
      id: `temp-${Date.now()}`,
      question_type: "text",
      question_text: "",
      is_required: false,
      display_order: questions.length,
      is_active: true,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<FeedbackQuestion>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === questions.length - 1)
    ) {
      return;
    }

    const newQuestions = [...questions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[targetIndex]] = [
      newQuestions[targetIndex],
      newQuestions[index],
    ];
    setQuestions(newQuestions);
  };

  const getTypeIcon = (type: string) => {
    const found = QUESTION_TYPES.find((t) => t.value === type);
    return found ? found.icon : MessageSquare;
  };

  const getTypeLabel = (type: string) => {
    const found = QUESTION_TYPES.find((t) => t.value === type);
    return found ? found.label : type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Formulário de Feedback</DialogTitle>
          <DialogDescription>
            Personalize as perguntas do formulário de feedback deste evento.
            {hasEventQuestions && (
              <Badge variant="secondary" className="ml-2">
                Customizado
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <Card key={question.id} className={!question.is_active ? "opacity-50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 pt-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveQuestion(index, "up")}
                        disabled={index === 0}
                      >
                        <GripVertical className="h-4 w-4 rotate-90" />
                      </Button>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          {(() => {
                            const Icon = getTypeIcon(question.question_type);
                            return <Icon className="h-3 w-3" />;
                          })()}
                          {getTypeLabel(question.question_type)}
                        </Badge>
                        {question.is_required && (
                          <Badge variant="destructive" className="text-xs">
                            Obrigatório
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <Input
                            value={question.question_text}
                            onChange={(e) =>
                              updateQuestion(question.id, {
                                question_text: e.target.value,
                              })
                            }
                            placeholder="Texto da pergunta"
                          />
                        </div>

                        <Select
                          value={question.question_type}
                          onValueChange={(value) =>
                            updateQuestion(question.id, { question_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {QUESTION_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <type.icon className="h-4 w-4" />
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={question.is_required}
                              onCheckedChange={(checked) =>
                                updateQuestion(question.id, { is_required: checked })
                              }
                            />
                            <Label className="text-sm">Obrigatório</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={question.is_active}
                              onCheckedChange={(checked) =>
                                updateQuestion(question.id, { is_active: checked })
                              }
                            />
                            <Label className="text-sm">Ativo</Label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeQuestion(question.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" className="w-full" onClick={addQuestion}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Pergunta
            </Button>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasEventQuestions && (
            <Button
              variant="outline"
              onClick={handleResetToDefault}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Usar Padrão
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
