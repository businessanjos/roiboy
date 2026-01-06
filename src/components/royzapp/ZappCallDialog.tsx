import { useState, useEffect, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, User } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

interface ZappCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactPhone: string;
  contactName: string;
  clientId?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  sectorId: string;
}

type CallStatus = "initiating" | "ringing" | "answered" | "completed" | "failed" | "missed" | "busy" | "no_answer";

const CALL_OUTCOMES = [
  { value: "connected", label: "Conectou" },
  { value: "no_answer", label: "Não atendeu" },
  { value: "busy", label: "Ocupado" },
  { value: "voicemail", label: "Caixa postal" },
  { value: "wrong_number", label: "Número errado" },
  { value: "callback_requested", label: "Retornar depois" },
  { value: "not_interested", label: "Não tem interesse" },
  { value: "meeting_scheduled", label: "Reunião agendada" },
  { value: "sale_closed", label: "Venda fechada" },
] as const;

export function ZappCallDialog({
  open,
  onOpenChange,
  conversationId,
  contactPhone,
  contactName,
  clientId,
  leadId,
  dealId,
  sectorId,
}: ZappCallDialogProps) {
  const { currentUser } = useCurrentUser();
  const [callId, setCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("initiating");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isEnding, setIsEnding] = useState(false);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (callStatus === "answered") {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  // Start call when dialog opens
  useEffect(() => {
    if (open && !callId) {
      startCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Subscribe to call status updates
  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call-${callId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "zapp_calls",
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as CallStatus;
          setCallStatus(newStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId]);

  const startCall = async () => {
    if (!currentUser?.account_id || !currentUser?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    try {
      setCallStatus("initiating");

      const { data, error } = await supabase
        .from("zapp_calls")
        .insert({
          account_id: currentUser.account_id,
          sector_id: sectorId,
          zapp_conversation_id: conversationId,
          user_id: currentUser.id,
          client_id: clientId,
          lead_id: leadId,
          deal_id: dealId,
          direction: "outbound",
          status: "initiating",
          phone_e164: contactPhone,
          contact_name: contactName,
        })
        .select("id")
        .single();

      if (error) throw error;

      setCallId(data.id);

      // Simulate call progression (in real implementation, this would be handled by Twilio webhooks)
      setTimeout(() => setCallStatus("ringing"), 1000);
      setTimeout(() => setCallStatus("answered"), 3000);

      toast.success("Iniciando chamada...");
    } catch (error) {
      console.error("Error starting call:", error);
      toast.error("Erro ao iniciar chamada");
      setCallStatus("failed");
    }
  };

  const endCall = useCallback(async () => {
    if (!callId) {
      onOpenChange(false);
      return;
    }

    setIsEnding(true);

    try {
      const updateData: Record<string, unknown> = {
        status: "completed",
        ended_at: new Date().toISOString(),
        duration_seconds: elapsedSeconds,
      };

      if (outcome) {
        updateData.outcome = outcome;
      }

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from("zapp_calls")
        .update(updateData)
        .eq("id", callId);

      if (error) throw error;

      toast.success("Chamada finalizada");
    } catch (error) {
      console.error("Error ending call:", error);
      toast.error("Erro ao finalizar chamada");
    } finally {
      setIsEnding(false);
      resetState();
      onOpenChange(false);
    }
  }, [callId, elapsedSeconds, outcome, notes, onOpenChange]);

  const resetState = () => {
    setCallId(null);
    setCallStatus("initiating");
    setElapsedSeconds(0);
    setOutcome("");
    setNotes("");
    setIsMuted(false);
    setIsSpeakerOn(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case "initiating":
        return "Conectando...";
      case "ringing":
        return "Chamando...";
      case "answered":
        return "Em chamada";
      case "completed":
        return "Chamada encerrada";
      case "failed":
        return "Falha na chamada";
      case "missed":
        return "Chamada perdida";
      case "busy":
        return "Ocupado";
      case "no_answer":
        return "Não atendeu";
      default:
        return "";
    }
  };

  const isCallActive = callStatus === "answered" || callStatus === "ringing";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && endCall()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-b from-primary/20 to-background p-8 flex flex-col items-center">
          {/* Contact Avatar */}
          <Avatar className="h-24 w-24 mb-4 ring-4 ring-background shadow-lg">
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
              {contactName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Contact Name */}
          <h2 className="text-xl font-semibold text-foreground mb-1">{contactName}</h2>
          <p className="text-muted-foreground text-sm mb-4">{contactPhone}</p>

          {/* Status & Timer */}
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground">{getStatusText()}</p>
            {callStatus === "answered" && (
              <p className="text-2xl font-mono font-bold text-primary mt-2">
                {formatTime(elapsedSeconds)}
              </p>
            )}
          </div>

          {/* Call Controls */}
          {isCallActive && (
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>

              <Button
                variant={isSpeakerOn ? "secondary" : "outline"}
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              >
                {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </Button>
            </div>
          )}

          {/* End Call Button */}
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full h-14 w-14"
            onClick={endCall}
            disabled={isEnding}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>

        {/* Outcome Section (shown during/after call) */}
        {(callStatus === "answered" || callStatus === "completed") && (
          <div className="p-4 border-t space-y-4">
            <div className="space-y-2">
              <Label>Resultado da chamada</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o resultado" />
                </SelectTrigger>
                <SelectContent>
                  {CALL_OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Anotações</Label>
              <Textarea
                placeholder="Adicione notas sobre a chamada..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
