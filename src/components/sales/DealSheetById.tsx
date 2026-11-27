import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DealDetailSheet } from "@/components/sales/DealDetailSheet";
import type { Deal, DealStage } from "@/hooks/useDeals";

/**
 * Abre o mesmo card lateral do Pipeline a partir de qualquer tela, só com o id do negócio.
 * Ver, anotar e editar campos acontece aqui; ganhar, perder, reabrir e mudar de etapa
 * seguem as regras do Pipeline, então essas ações levam para lá.
 */
export function DealSheetById({ dealId, onClose }: { dealId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { data, refetch } = useQuery({
    queryKey: ["deal-sheet-by-id", dealId],
    enabled: Boolean(dealId),
    staleTime: 0,
    queryFn: async () => {
      // Lido como a pessoa logada: quem não pode ver o negócio não recebe nada.
      const { data: deal, error } = await supabase
        .from("deals")
        .select(`
          *,
          client:clients(id, full_name, phone_e164, avatar_url),
          lead:leads(id, full_name, phone, email, avatar_url),
          responsible_user:users!deals_responsible_user_id_fkey(id, name, avatar_url, is_active),
          sdr_user:users!deals_sdr_user_id_fkey(id, name, avatar_url),
          stage:deal_stages(*)
        `)
        .eq("id", dealId as string)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!deal) return { deal: null, stages: [] as DealStage[] };
      let stageQuery = supabase.from("deal_stages").select("*").order("display_order");
      if ((deal as any).pipeline_id) stageQuery = stageQuery.eq("pipeline_id", (deal as any).pipeline_id);
      const { data: stages } = await stageQuery;
      return { deal: deal as unknown as Deal, stages: (stages ?? []) as unknown as DealStage[] };
    },
  });

  const inPipeline = (what: string) => {
    const id = dealId;
    toast.info(`Para ${what}, abra o negócio no Pipeline.`, {
      action: id ? { label: "Abrir no Pipeline", onClick: () => navigate(`/pipeline?deal=${id}`) } : undefined,
    });
  };

  if (dealId && data && !data.deal) {
    // Negócio excluído ou fora do alcance de quem clicou.
    toast.error("Não foi possível abrir este negócio.");
    onClose();
    return null;
  }

  return (
    <DealDetailSheet
      open={Boolean(dealId && data?.deal)}
      onOpenChange={open => { if (!open) onClose(); }}
      deal={dealId ? data?.deal ?? null : null}
      stages={data?.stages ?? []}
      onEdit={() => inPipeline("editar o negócio")}
      onMarkAsWon={async () => inPipeline("marcar como ganho")}
      onMarkAsLost={async () => inPipeline("marcar como perdido")}
      onReopen={async () => inPipeline("reabrir o negócio")}
      onStageChange={async () => { inPipeline("mudar a etapa"); return false; }}
      onDealUpdated={() => void refetch()}
    />
  );
}
