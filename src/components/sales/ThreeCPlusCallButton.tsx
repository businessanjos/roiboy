import { type MouseEvent } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

declare global {
  interface WindowEventMap {
    "threecplus:dial-request": CustomEvent<{ phone: string; contactName?: string }>;
  }
}

interface ThreeCPlusCallButtonProps {
  contactPhone: string;
  contactName?: string;
}

export function ThreeCPlusCallButton({ contactPhone, contactName }: ThreeCPlusCallButtonProps) {
  const makeCall = (e: MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("threecplus:dial-request", {
        detail: { phone: contactPhone, contactName },
      })
    );

    toast.info("Abrindo discador 3C Plus", {
      description: "O número foi enviado para o painel. Aguarde o agente ficar ocioso para discar.",
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
            onClick={makeCall}
          >
              <Phone className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ligar via 3C Plus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
