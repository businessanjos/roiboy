import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

interface ZappNavigationOptions {
  phone?: string | null;
  leadId?: string;
  clientId?: string;
  name?: string;
}

export function useZappNavigation() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);

  const openZappConversation = useCallback(async (options: ZappNavigationOptions) => {
    const { phone, leadId, clientId, name } = options;

    if (!phone && !leadId && !clientId) {
      toast.error("Nenhum telefone disponível para iniciar conversa");
      return;
    }

    if (!currentUser?.account_id) {
      toast.error("Usuário não autenticado");
      return;
    }

    setLoading(true);

    try {
      // Always navigate with the parameters - let RoyZapp handle conversation creation/selection
      // This ensures proper assignment creation and chat opening regardless of existing conversation state
      if (phone) {
        const normalizedPhone = phone.replace(/\D/g, "");
        const encodedName = encodeURIComponent(name || "");
        navigate(`/roy-zapp?sector=vendas&newPhone=${normalizedPhone}&newName=${encodedName}${leadId ? `&leadId=${leadId}` : ""}${clientId ? `&clientId=${clientId}` : ""}`);
        toast.info("Abrindo RoyZapp...");
      } else {
        toast.error("Nenhum telefone cadastrado para este contato");
      }
    } catch (error) {
      console.error("Error navigating to Zapp:", error);
      toast.error("Erro ao abrir conversa");
    } finally {
      setLoading(false);
    }
  }, [navigate, currentUser?.account_id]);

  return { openZappConversation, loading };
}
