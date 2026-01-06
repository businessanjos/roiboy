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
      // First, try to find existing conversation
      let conversationQuery = supabase
        .from("zapp_conversations")
        .select("id, sector_id")
        .eq("account_id", currentUser.account_id)
        .eq("sector_id", "vendas");

      if (leadId) {
        conversationQuery = conversationQuery.eq("lead_id", leadId);
      } else if (clientId) {
        conversationQuery = conversationQuery.eq("client_id", clientId);
      } else if (phone) {
        // Normalize phone for search
        const normalizedPhone = phone.replace(/\D/g, "");
        conversationQuery = conversationQuery.ilike("phone_e164", `%${normalizedPhone}%`);
      }

      const { data: existingConversations } = await conversationQuery.limit(1);

      if (existingConversations && existingConversations.length > 0) {
        // Navigate to existing conversation
        navigate(`/roy-zapp?sector=vendas&conversation=${existingConversations[0].id}`);
        toast.success("Abrindo conversa existente...");
      } else if (phone) {
        // Navigate to RoyZapp with phone to start new conversation
        const normalizedPhone = phone.replace(/\D/g, "");
        const encodedName = encodeURIComponent(name || "");
        navigate(`/roy-zapp?sector=vendas&newPhone=${normalizedPhone}&newName=${encodedName}${leadId ? `&leadId=${leadId}` : ""}${clientId ? `&clientId=${clientId}` : ""}`);
        toast.info("Abrindo RoyZapp para iniciar conversa...");
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
