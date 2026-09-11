import { useState, type MouseEvent } from "react";
import { Loader2, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { threeCDialPhone } from "@/lib/phoneNormalize";
import { useCallEngines } from "@/hooks/useCallEngines";
import { dialWithRyka, getLastEngine, setLastEngine, type CallEngine } from "@/lib/telephony/callEngines";
import { ThreeCPlusCallButton } from "./ThreeCPlusCallButton";

interface Props {
  contactPhone: string;
  contactName?: string;
  dealId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
}

/**
 * Botão de ligar da negociação. Com os dois motores configurados, vira menu
 * (3C Plus / Call Ryka); com apenas um, liga direto.
 */
export function CallEngineButton({ contactPhone, contactName, dealId, leadId, clientId }: Props) {
  const { engines } = useCallEngines();
  const [dialing, setDialing] = useState(false);

  const hasRyka = engines.includes("ryka_call");
  const has3C = engines.length === 0 || engines.includes("3cplus");

  if (!hasRyka) {
    return <ThreeCPlusCallButton contactPhone={contactPhone} contactName={contactName} />;
  }

  const callRyka = async (event?: MouseEvent) => {
    event?.stopPropagation();
    const dialPhone = threeCDialPhone(contactPhone);
    if (!dialPhone) {
      toast.error(`Número inválido: ${contactPhone || "vazio"}`);
      return;
    }
    setLastEngine("ryka_call");
    setDialing(true);
    const result = await dialWithRyka({
      phone: dialPhone,
      contact_name: contactName,
      deal_id: dealId ?? null,
      lead_id: leadId ?? null,
      client_id: clientId ?? null,
    });
    setDialing(false);
    if (!result.ok) toast.error(result.error || "Não foi possível abrir o Call Ryka.");
  };

  if (!has3C) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled={dialing}
        className="h-6 w-6 text-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/10"
        onClick={callRyka}
        aria-label="Ligar via Call Ryka"
      >
        {dialing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
      </Button>
    );
  }

  const preferred: CallEngine = getLastEngine() || "3cplus";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={dialing}
          className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
          onClick={(event) => event.stopPropagation()}
          aria-label="Ligar"
        >
          {dialing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : preferred === "ryka_call" ? (
            <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Phone className="h-3.5 w-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem asChild>
          <div className="flex cursor-pointer items-center gap-2">
            <Phone className="h-4 w-4" />
            <span className="flex-1">3C Plus</span>
            <ThreeCPlusCallButton contactPhone={contactPhone} contactName={contactName} />
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void callRyka()}>
          <MessageCircle className="mr-2 h-4 w-4 text-emerald-500" />
          Call Ryka (WhatsApp)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
