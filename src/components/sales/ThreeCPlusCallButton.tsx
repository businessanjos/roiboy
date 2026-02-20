import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Campaign {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

interface ThreeCPlusCallButtonProps {
  contactPhone: string;
  contactName?: string;
}

export function ThreeCPlusCallButton({ contactPhone, contactName }: ThreeCPlusCallButtonProps) {
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);

  const fetchCampaignsAndCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);

    try {
      // Step 1: Fetch campaigns
      const { data: campData, error: campError } = await supabase.functions.invoke("threecplus-campaigns");

      if (campError) {
        toast.error("Erro ao buscar campanhas", { description: "Não foi possível conectar ao serviço." });
        setLoading(false);
        return;
      }

      if (campData?.code === "NO_INTEGRATION") {
        toast.error("3C Plus não configurado", {
          description: "Vá em Configurações > Integrações para conectar sua conta 3C Plus.",
        });
        setLoading(false);
        return;
      }

      if (!campData?.success || !campData?.campaigns) {
        toast.error("Erro ao buscar campanhas", { description: campData?.error || "Erro desconhecido" });
        setLoading(false);
        return;
      }

      const campaignList: Campaign[] = campData.campaigns;

      if (campaignList.length === 0) {
        toast.error("Nenhuma campanha disponível", {
          description: "Não há campanhas ativas na sua conta 3C Plus.",
        });
        setLoading(false);
        return;
      }

      // If only one campaign, call directly
      if (campaignList.length === 1) {
        await makeCall(campaignList[0].id);
        return;
      }

      // Multiple campaigns: show selector
      setCampaigns(campaignList);
      setShowCampaignDialog(true);
      setLoading(false);
    } catch (err) {
      console.error("[ThreeCPlusCallButton] Error:", err);
      toast.error("Erro ao iniciar chamada");
      setLoading(false);
    }
  };

  const makeCall = async (campaignId: number | string) => {
    setLoading(true);
    setShowCampaignDialog(false);

    try {
      const { data, error } = await supabase.functions.invoke("threecplus-call", {
        body: { phone: contactPhone, campaign_id: campaignId },
      });

      if (error) {
        toast.error("Erro ao iniciar chamada", {
          description: "Não foi possível conectar ao serviço de chamadas.",
        });
        return;
      }

      if (data?.success) {
        toast.success("Chamada iniciada no 3C Plus", {
          description: contactName ? `Ligando para ${contactName}...` : "Ligando...",
        });
        return;
      }

      if (data?.code === "CAMPAIGN_LOGIN_FAILED") {
        toast.error("Falha ao entrar na campanha", {
          description: "Verifique se a campanha está ativa no 3C Plus.",
        });
        return;
      }

      if (data?.code === "API_CALL_FAILED") {
        toast.error("Não foi possível iniciar a chamada", {
          description: "Verifique se você está logado e em uma campanha ativa no 3C Plus.",
        });
        return;
      }

      toast.error("Erro", { description: data?.error || "Erro desconhecido" });
    } catch (err) {
      console.error("[ThreeCPlusCallButton] Call error:", err);
      toast.error("Erro ao iniciar chamada");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
              onClick={fetchCampaignsAndCall}
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

      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar Campanha</DialogTitle>
            <DialogDescription>
              Escolha a campanha para realizar a ligação
              {contactName ? ` para ${contactName}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {campaigns.map((campaign) => (
              <Button
                key={String(campaign.id)}
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => makeCall(campaign.id)}
                disabled={loading}
              >
                <Phone className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{campaign.name || `Campanha ${campaign.id}`}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
