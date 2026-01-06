import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Sparkles,
  User,
  FileText,
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConversationAssignment, ContactInfo, getContactInfo } from "../types";
import { Link } from "react-router-dom";

const OUTCOME_OPTIONS = [
  { value: "resolved", label: "Resolvido", icon: CheckCircle, color: "text-emerald-500" },
  { value: "follow_up", label: "Aguardando retorno", icon: Clock, color: "text-amber-500" },
  { value: "escalated", label: "Encaminhado/Escalonado", icon: AlertTriangle, color: "text-orange-500" },
  { value: "no_response", label: "Sem resposta do cliente", icon: XCircle, color: "text-muted-foreground" },
  { value: "cancelled", label: "Cancelado/Inválido", icon: XCircle, color: "text-red-500" },
];

interface ZappCloseTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: ConversationAssignment;
  agentName: string;
  sectorId: string;
  departmentName: string;
  onSuccess?: () => void;
}

interface ConversationStats {
  messagesCount: number;
  firstMessageAt: string | null;
  lastClientMessageAt: string | null;
  durationMinutes: number;
}

export function ZappCloseTicketDialog({
  open,
  onOpenChange,
  assignment,
  agentName,
  sectorId,
  departmentName,
  onSuccess,
}: ZappCloseTicketDialogProps) {
  const [outcome, setOutcome] = useState<string>("resolved");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  const contactInfo = getContactInfo(assignment);
  const conversationId = assignment.zapp_conversation_id;
  const clientId = assignment.zapp_conversation?.client_id || null;
  const leadId = assignment.zapp_conversation?.lead_id || null;

  // Fetch conversation stats
  const fetchStats = useCallback(async () => {
    if (!conversationId) return;
    setLoadingStats(true);

    try {
      const { data, error } = await supabase
        .from("zapp_messages")
        .select("id, created_at, direction")
        .eq("zapp_conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const firstMsg = data[0];
        const lastClientMsg = [...data].reverse().find((m: any) => m.direction === "inbound");
        
        const startTime = new Date(assignment.assigned_at || assignment.created_at);
        const endTime = new Date();
        const duration = differenceInMinutes(endTime, startTime);

        setStats({
          messagesCount: data.length,
          firstMessageAt: firstMsg.created_at,
          lastClientMessageAt: lastClientMsg?.created_at || null,
          durationMinutes: Math.max(1, duration),
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoadingStats(false);
    }
  }, [conversationId, assignment.assigned_at, assignment.created_at]);

  // Generate AI summary
  const generateAISummary = async () => {
    if (!conversationId) return;
    setGeneratingAI(true);

    try {
      const { data, error } = await supabase.functions.invoke("summarize-conversation", {
        body: { 
          conversation_id: conversationId,
          assignment_id: assignment.id,
        },
      });

      if (error) throw error;
      if (data?.summary) {
        setAiSummary(data.summary);
        if (!summary) {
          setSummary(data.summary);
        }
      }
    } catch (error: any) {
      console.error("Error generating AI summary:", error);
      toast.error("Erro ao gerar resumo por IA");
    } finally {
      setGeneratingAI(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStats();
      setOutcome("resolved");
      setSummary("");
      setNotes("");
      setAiSummary("");
    }
  }, [open, fetchStats]);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  const handleClose = async () => {
    if (!outcome) {
      toast.error("Selecione o resultado do atendimento");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: userProfile } = await supabase
        .from("users")
        .select("account_id, id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!userProfile) throw new Error("Perfil não encontrado");

      const now = new Date().toISOString();
      const durationMinutes = stats?.durationMinutes || 0;

      // 1. Update assignment with close info
      const { error: updateError } = await supabase
        .from("zapp_conversation_assignments")
        .update({
          status: "closed",
          closed_at: now,
          closed_by: userProfile.id,
          close_outcome: outcome,
          close_summary: summary || null,
          close_ai_summary: aiSummary || null,
          close_notes: notes || null,
          service_duration_minutes: durationMinutes,
          first_message_at: stats?.firstMessageAt || null,
          last_client_message_at: stats?.lastClientMessageAt || null,
        })
        .eq("id", assignment.id);

      if (updateError) throw updateError;

      // 2. Create service history record for client/lead timeline
      const historyData = {
        account_id: userProfile.account_id,
        client_id: clientId,
        lead_id: leadId,
        conversation_assignment_id: assignment.id,
        agent_id: assignment.agent_id,
        agent_name: agentName,
        sector_id: sectorId,
        department_name: departmentName,
        outcome,
        summary: summary || null,
        ai_summary: aiSummary || null,
        notes: notes || null,
        duration_minutes: durationMinutes,
        messages_count: stats?.messagesCount || 0,
        started_at: assignment.assigned_at || assignment.created_at,
        closed_at: now,
      };

      const { error: historyError } = await supabase
        .from("client_service_history")
        .insert(historyData);

      if (historyError) {
        console.error("Error creating service history:", historyError);
        // Don't fail the whole operation if history fails
      }

      toast.success("Atendimento finalizado com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error closing ticket:", error);
      toast.error(error.message || "Erro ao finalizar atendimento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-zapp-panel border-zapp-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zapp-text">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            Finalizar Atendimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Contact Info */}
          <div className="flex items-center gap-3 p-3 bg-zapp-bg-dark rounded-lg">
            <div className="h-10 w-10 rounded-full bg-zapp-accent/20 flex items-center justify-center">
              <User className="h-5 w-5 text-zapp-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-zapp-text font-medium truncate">{contactInfo.name}</p>
              <p className="text-zapp-text-muted text-xs">{contactInfo.phone}</p>
            </div>
            {clientId && (
              <Link 
                to={`/clients/${clientId}`}
                className="text-xs text-zapp-accent hover:underline"
              >
                Ver cadastro
              </Link>
            )}
          </div>

          {/* Stats */}
          {loadingStats ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-zapp-text-muted" />
            </div>
          ) : stats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-zapp-bg-dark rounded-lg">
                <Clock className="h-4 w-4 mx-auto text-zapp-accent mb-1" />
                <p className="text-lg font-bold text-zapp-text">{formatDuration(stats.durationMinutes)}</p>
                <p className="text-xs text-zapp-text-muted">Duração</p>
              </div>
              <div className="text-center p-3 bg-zapp-bg-dark rounded-lg">
                <MessageSquare className="h-4 w-4 mx-auto text-blue-400 mb-1" />
                <p className="text-lg font-bold text-zapp-text">{stats.messagesCount}</p>
                <p className="text-xs text-zapp-text-muted">Mensagens</p>
              </div>
              <div className="text-center p-3 bg-zapp-bg-dark rounded-lg">
                <Calendar className="h-4 w-4 mx-auto text-amber-400 mb-1" />
                <p className="text-sm font-medium text-zapp-text">
                  {format(new Date(assignment.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </p>
                <p className="text-xs text-zapp-text-muted">Início</p>
              </div>
            </div>
          )}

          {/* Outcome */}
          <div className="space-y-2">
            <Label className="text-zapp-text">Resultado do atendimento *</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className="bg-zapp-bg-dark border-zapp-border text-zapp-text">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-zapp-panel border-zapp-border">
                {OUTCOME_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <SelectItem 
                      key={opt.value} 
                      value={opt.value}
                      className="text-zapp-text hover:bg-zapp-hover"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${opt.color}`} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Summary with AI */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-zapp-text">Resumo do atendimento</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-zapp-accent hover:bg-zapp-accent/10"
                onClick={generateAISummary}
                disabled={generatingAI}
              >
                {generatingAI ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                Gerar com IA
              </Button>
            </div>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Descreva brevemente o que foi tratado..."
              className="bg-zapp-bg-dark border-zapp-border text-zapp-text placeholder:text-zapp-text-muted resize-none"
              rows={3}
            />
            {aiSummary && summary !== aiSummary && (
              <div className="p-2 bg-zapp-accent/10 rounded text-xs text-zapp-text-muted">
                <span className="font-medium text-zapp-accent">Sugestão IA: </span>
                {aiSummary}
                <Button 
                  variant="link" 
                  size="sm" 
                  className="h-auto p-0 ml-2 text-xs text-zapp-accent"
                  onClick={() => setSummary(aiSummary)}
                >
                  Usar
                </Button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-zapp-text">Observações internas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas visíveis apenas para a equipe..."
              className="bg-zapp-bg-dark border-zapp-border text-zapp-text placeholder:text-zapp-text-muted resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleClose}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Finalizar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
