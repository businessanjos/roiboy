import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ThreeCPlusCallButtonProps {
  contactPhone: string;
  contactName?: string;
}

export function ThreeCPlusCallButton({ contactPhone, contactName }: ThreeCPlusCallButtonProps) {
  const [loading, setLoading] = useState(false);

  const makeCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("threecplus-call", {
        body: { phone: contactPhone },
      });

      if (error) {
        toast.error("Erro ao iniciar chamada", {
          description: "Não foi possível conectar ao serviço de chamadas.",
        });
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
          description: contactName ? `Ligando para ${contactName}...` : "Ligando...",
        });
        return;
      }

      toast.error("Erro", { description: data?.error || "Erro desconhecido" });
    } catch (err) {
      console.error("[ThreeCPlusCallButton] Error:", err);
      toast.error("Erro ao iniciar chamada");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
            onClick={makeCall}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Phone className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ligar via 3C Plus</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
