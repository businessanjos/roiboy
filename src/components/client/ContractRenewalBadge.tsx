import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  clientId: string;
  compact?: boolean;
}

/**
 * Mostra badge "Quitado — pronto para renovar" quando o cliente tem
 * pelo menos um client_contract com payment_status='quitado' e contract ativo.
 */
export function ContractRenewalBadge({ clientId, compact = false }: Props) {
  const { data } = useQuery({
    queryKey: ["contract-renewal-badge", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_contracts")
        .select("id, end_date, payment_status, status")
        .eq("client_id", clientId)
        .eq("payment_status", "quitado")
        .in("status", ["active", "ended"])
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60_000,
  });

  if (!data) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 flex items-center gap-1 cursor-default">
            <Crown className="h-3 w-3" />
            {compact ? "" : "Pronto p/ renovar"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-semibold">Contrato quitado</p>
          <p className="text-xs">Todas as parcelas foram pagas. Cliente pronto para renovação.</p>
          {data.end_date && <p className="text-xs">Vencimento atual: {new Date(data.end_date).toLocaleDateString("pt-BR")}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
