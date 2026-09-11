import { useState, type MouseEvent } from "react";
import { Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { threeCDialPhone } from "@/lib/phoneNormalize";

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

    const dialPhone = threeCDialPhone(contactPhone);
    if (!dialPhone) {
      toast.error(`Número inválido: ${contactPhone || "vazio"}`);
      return;
    }

    setCalling(true);
    try {
      const cached = window.__threeCPlusRuntime;
      const { data, error } = await supabase.functions.invoke("threecplus-call", {
        body: {
          phone: dialPhone,
          contact_name: contactName,
          runtime_proof: cached && Date.now() - cached.polledAt < 20_000 ? cached.proof : null,
        },
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
        window.dispatchEvent(new CustomEvent("threecplus:optimistic-call", { detail: {
          id: data.call_log_id || `accepted-${crypto.randomUUID()}`, call_id: "", phone: dialPhone,
          contact_name: contactName || null, direction: "outbound", status: "dialing",
          duration_seconds: 0, started_at: new Date().toISOString(), qualification_name: null,
          user_id: null, agent_name: null, lead_id: null, deal_id: null, client_id: null,
          recording_url: null,
        }}));
        toast.success("Discando…", {
          description: `Ligando para ${contactName || contactPhone}...`,
        });
        return;
      }

      if (["AGENT_NOT_IDLE", "AGENT_OFFLINE", "AGENT_ON_BREAK", "MANUAL_NOT_ALLOWED"].includes(data?.code)) {
        window.dispatchEvent(new CustomEvent("threecplus:open-drawer"));
        toast.error(data?.error || "Abra o Discador 3C e verifique seu estado antes de tentar novamente.");
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
            {calling ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Discando…" /> : <Phone className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{calling ? "Discando…" : "Ligar via 3C Plus"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
