import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ZappCallDialog } from "./ZappCallDialog";

interface ZappCallButtonProps {
  conversationId: string;
  contactPhone: string;
  contactName: string;
  clientId?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  sectorId: string;
}

export function ZappCallButton({
  conversationId,
  contactPhone,
  contactName,
  clientId,
  leadId,
  dealId,
  sectorId,
}: ZappCallButtonProps) {
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);

  const handleStartCall = () => {
    setIsCallDialogOpen(true);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={handleStartCall}
          >
            <Phone className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ligar para {contactName}</TooltipContent>
      </Tooltip>

      <ZappCallDialog
        open={isCallDialogOpen}
        onOpenChange={setIsCallDialogOpen}
        conversationId={conversationId}
        contactPhone={contactPhone}
        contactName={contactName}
        clientId={clientId}
        leadId={leadId}
        dealId={dealId}
        sectorId={sectorId}
      />
    </>
  );
}
