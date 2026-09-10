import { useState, type MouseEvent } from "react";
import { Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface WindowEventMap {
    "threecplus:dial-request": CustomEvent<{ phone: string; contactName?: string }>;
    "threecplus:open-drawer": CustomEvent;
  }
}

interface ThreeCPlusCallButtonProps {
  contactPhone: string;
  contactName?: string;
}

export function ThreeCPlusCallButton({ contactPhone, contactName }: ThreeCPlusCallButtonProps) {
  const [calling, setCalling] = useState(false);

  const fallbackToDialer = (description: string) => {
    window.dispatchEvent(
      new CustomEvent("threecplus:dial-request", {
        detail: { phone: contactPhone, contactName },
      })
    );
    toast.info("Abrindo discador 3C Plus", { description });
  };

  const makeCall = async (e: MouseEvent) => {
    e.stopPropagation();
    if (calling) return;

    if (!contactPhone) {
      toast.error("Número de telefone não disponível");
      return;
    }

    setCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-call", {
        body: { phone: contactPhone, contact_name: contactName },
      });

      if (error) {
        fallbackToDialer("Não foi possível discar automaticamente. O número foi enviado para o painel.");
        return;
      }

      if (data?.code === "NO_INTEGRATION") {
        toast.error("3C Plus não configurado", {
          description: "Vá em Configurações > Integrações para conectar sua conta 3C Plus.",
        });
        return;
      }

      if (data?.success) {
        toast.success("Chamada iniciada no 3C Plus", {
          description: `Ligando para ${contactName || contactPhone}...`,
        });
        return;
      }

      if (data?.code === "AGENT_NOT_IDLE") {
        window.dispatchEvent(new CustomEvent("threecplus:open-drawer"));
        toast.error("Entre em uma campanha no Discador 3C (botão no canto da tela) e tente de novo");
        return;
      }

      fallbackToDialer(data?.error || "O número foi enviado para o painel do discador.");
    } catch (err) {
      console.error("[ThreeCPlusCallButton] call error:", err);
      fallbackToDialer("O número foi enviado para o painel do discador.");
    } finally {
      setCalling(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={calling}
            className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
            onClick={makeCall}
          >
            {calling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ligar via 3C Plus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
