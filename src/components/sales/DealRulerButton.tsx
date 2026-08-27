import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useZappRulers } from "@/hooks/useZappRulers";
import { ZappRulerEnrollDialog } from "@/components/royzapp/ruler/ZappRulerEnrollDialog";

interface DealRulerButtonProps {
  contactName?: string | null;
  contactPhone?: string | null;
  clientId?: string | null;
  leadId?: string | null;
  sectorId?: string | null;
  /** compact = ícone pequeno (card do pipeline) */
  variant?: "icon" | "button";
  className?: string;
}

/** Carrega os modelos apenas quando o diálogo abre (evita fetch por card). */
function RulerEnrollLoader(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  clientId?: string | null;
  leadId?: string | null;
}) {
  const { templates } = useZappRulers(props.sectorId ?? "vendas");
  return (
    <ZappRulerEnrollDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      templates={templates}
      sectorId={props.sectorId ?? "vendas"}
      contactName={props.contactName}
      contactPhone={props.contactPhone}
      clientId={props.clientId}
      leadId={props.leadId}
    />
  );
}

export function DealRulerButton({
  contactName,
  contactPhone,
  clientId,
  leadId,
  sectorId = "vendas",
  variant = "icon",
  className,
}: DealRulerButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  if (!contactPhone) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMounted(true);
    setOpen(true);
  };

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-5 w-5 hover:bg-primary/10", className)}
          onClick={handleClick}
          title="Iniciar régua de relacionamento"
        >
          <CalendarClock className="h-3 w-3 text-primary" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" className={cn("gap-1.5", className)} onClick={handleClick}>
          <CalendarClock className="h-3.5 w-3.5" />
          Régua
        </Button>
      )}

      {mounted && (
        <div onClick={(e) => e.stopPropagation()}>
          <RulerEnrollLoader
            open={open}
            onOpenChange={setOpen}
            sectorId={sectorId}
            contactName={contactName}
            contactPhone={contactPhone}
            clientId={clientId}
            leadId={leadId}
          />
        </div>
      )}
    </>
  );
}
