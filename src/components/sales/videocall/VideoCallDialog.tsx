import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useVideoCall } from "@/hooks/useVideoCall";
import {
  Video,
  VideoOff,
  Circle,
  Square,
  Link2,
  Copy,
  Check,
  Loader2,
  PhoneOff,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoCallDialogProps {
  trigger?: React.ReactNode;
  leadId?: string;
  clientId?: string;
  dealId?: string;
  participantName?: string;
  participantPhone?: string;
}

export function VideoCallDialog({
  trigger,
  leadId,
  clientId,
  dealId,
  participantName: initialName,
  participantPhone: initialPhone,
}: VideoCallDialogProps) {
  const [open, setOpen] = useState(false);
  const [participantName, setParticipantName] = useState(initialName || "");
  const [participantPhone, setParticipantPhone] = useState(initialPhone || "");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const {
    isActive,
    isRecording,
    isLoading,
    roomUrl,
    token,
    guestLink,
    createRoom,
    startRecording,
    stopRecording,
    endCall,
    getGuestLink,
  } = useVideoCall();

  const handleCreateRoom = async () => {
    await createRoom({
      participant_name: participantName,
      participant_phone: participantPhone,
      lead_id: leadId,
      client_id: clientId,
      deal_id: dealId,
    });
  };

  const handleGetGuestLink = async () => {
    const link = await getGuestLink(participantName || "Convidado");
    if (link) {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Link copiado!", description: "Envie para o participante" });
      setTimeout(() => setCopied(false), 3000);
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

  const handleEndCall = async () => {
    await endCall();
  };

  const callUrl = roomUrl && token ? `${roomUrl}?t=${token}` : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Video className="h-4 w-4" />
            Videochamada
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Videochamada
              {isActive && (
                <Badge variant={isRecording ? "destructive" : "secondary"} className="ml-2">
                  {isRecording ? "🔴 Gravando" : "Ao vivo"}
                </Badge>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        {!isActive ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full space-y-4">
              <div className="text-center space-y-2 mb-6">
                <Video className="h-16 w-16 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-semibold">Iniciar Videochamada</h3>
                <p className="text-sm text-muted-foreground">
                  Crie uma sala de vídeo, grave a chamada e receba análise automática ao final.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="participant-name">Nome do participante</Label>
                  <Input
                    id="participant-name"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div>
                  <Label htmlFor="participant-phone">Telefone (opcional)</Label>
                  <Input
                    id="participant-phone"
                    value={participantPhone}
                    onChange={(e) => setParticipantPhone(e.target.value)}
                    placeholder="Ex: 11999998888"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateRoom}
                disabled={isLoading}
                className="w-full gap-2"
                size="lg"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Video className="h-4 w-4" />
                )}
                Criar Sala
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Controls bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 flex-shrink-0">
              {!isRecording ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startRecording}
                  className="gap-1.5 text-destructive"
                >
                  <Circle className="h-3 w-3 fill-destructive" />
                  Gravar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopRecording}
                  className="gap-1.5"
                >
                  <Square className="h-3 w-3" />
                  Parar Gravação
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={guestLink ? handleCopyLink : handleGetGuestLink}
                className="gap-1.5"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Link2 className="h-3 w-3" />
                )}
                {guestLink ? "Copiar Link" : "Gerar Link Convidado"}
              </Button>

              <div className="flex-1" />

              <Button
                variant="destructive"
                size="sm"
                onClick={handleEndCall}
                disabled={isLoading}
                className="gap-1.5"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <PhoneOff className="h-3 w-3" />
                )}
                Encerrar
              </Button>
            </div>

            {/* Daily.co iframe */}
            {callUrl && (
              <div className="flex-1 min-h-0">
                <iframe
                  src={callUrl}
                  allow="camera; microphone; fullscreen; speaker; display-capture; compute-pressure"
                  className="w-full h-full border-0"
                  title="Videochamada"
                />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
