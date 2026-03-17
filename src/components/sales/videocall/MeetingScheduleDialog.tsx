import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVideoCall } from "@/hooks/useVideoCall";
import { Video, Copy, Check, Loader2, Calendar, Link2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MeetingScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId?: string;
  leadId?: string;
  clientId?: string;
  participantName?: string;
  participantPhone?: string;
  stageName?: string;
}

export function MeetingScheduleDialog({
  open,
  onOpenChange,
  dealId,
  leadId,
  clientId,
  participantName: initialName,
  participantPhone: initialPhone,
  stageName,
}: MeetingScheduleDialogProps) {
  const [participantName, setParticipantName] = useState(initialName || "");
  const [participantPhone, setParticipantPhone] = useState(initialPhone || "");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [copied, setCopied] = useState(false);
  const [roomCreated, setRoomCreated] = useState(false);
  const { toast } = useToast();

  const {
    isLoading,
    roomUrl,
    guestLink,
    createRoom,
    getGuestLink,
  } = useVideoCall();

  const handleCreateRoom = async () => {
    const result = await createRoom({
      participant_name: participantName,
      participant_phone: participantPhone,
      lead_id: leadId,
      client_id: clientId,
      deal_id: dealId,
    });

    if (result) {
      setRoomCreated(true);
      // Auto-generate guest link
      const link = await getGuestLink(participantName || "Convidado");
      if (link) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        toast({ title: "Link copiado!", description: "Envie para o cliente via WhatsApp" });
        setTimeout(() => setCopied(false), 3000);
      }
    }
  };

  const handleCopyLink = async () => {
    if (guestLink) {
      await navigator.clipboard.writeText(guestLink);
      setCopied(true);
      toast({ title: "Link copiado!" });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    setRoomCreated(false);
    setCopied(false);
    onOpenChange(false);
  };

  const whatsappMessage = guestLink
    ? encodeURIComponent(
        `Olá ${participantName}! 🎯\n\nSua reunião está confirmada${scheduledDate ? ` para ${format(new Date(`${scheduledDate}T${scheduledTime || "10:00"}`), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}` : ""}.\n\nAcesse pelo link abaixo:\n${guestLink}\n\nTe espero lá! 🚀`
      )
    : "";

  const whatsappLink = participantPhone
    ? `https://wa.me/${participantPhone.replace(/\D/g, "")}?text=${whatsappMessage}`
    : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            {roomCreated ? "Sala Criada!" : "Agendar Reunião"}
          </DialogTitle>
          {stageName && (
            <p className="text-sm text-muted-foreground">
              Lead movido para: <span className="font-medium">{stageName}</span>
            </p>
          )}
        </DialogHeader>

        {!roomCreated ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do participante</Label>
              <Input
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Nome do cliente/lead"
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone (WhatsApp)</Label>
              <Input
                value={participantPhone}
                onChange={(e) => setParticipantPhone(e.target.value)}
                placeholder="5511999998888"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleCreateRoom} disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Video className="h-4 w-4" />
                )}
                Criar Sala e Gerar Link
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                <span className="font-medium">Sala criada com sucesso!</span>
              </div>

              {guestLink && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Link do convidado:</Label>
                  <div className="flex gap-2">
                    <Input
                      value={guestLink}
                      readOnly
                      className="text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                      className="shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2 sm:gap-2">
              {whatsappLink && (
                <Button
                  variant="default"
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  onClick={() => window.open(whatsappLink, "_blank")}
                >
                  <Send className="h-4 w-4" />
                  Enviar via WhatsApp
                </Button>
              )}
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
