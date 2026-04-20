import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "sonner";

export interface CopilotConversation {
  id: string;
  title: string;
  last_message_at: string;
  is_pinned: boolean;
  created_at: string;
}

export interface CopilotMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls: any;
  tool_call_id: string | null;
  tool_name: string | null;
  tool_result: any;
  created_at: string;
}

export function useMarketingCopilot(conversationId?: string | null) {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ["copilot-conversations", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("marketing_copilot_conversations")
        .select("*")
        .eq("account_id", accountId)
        .order("is_pinned", { ascending: false })
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as CopilotConversation[];
    },
    enabled: !!accountId,
  });

  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["copilot-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("marketing_copilot_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at");
      if (error) throw error;
      return data as CopilotMessage[];
    },
    enabled: !!conversationId,
  });

  const createConversation = useMutation({
    mutationFn: async (title?: string) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase
        .from("marketing_copilot_conversations")
        .insert({ account_id: accountId, user_id: currentUser?.auth_user_id, title: title || "Nova conversa" })
        .select().single();
      if (error) throw error;
      return data as CopilotConversation;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["copilot-conversations", accountId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const sendMessage = useMutation({
    mutationFn: async ({ conversationId: convId, message }: { conversationId: string; message: string }) => {
      if (!accountId) throw new Error("Sem conta");
      const { data, error } = await supabase.functions.invoke("marketing-copilot-chat", {
        body: { conversationId: convId, message, accountId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["copilot-messages", variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["copilot-conversations", accountId] });
      // Invalida outras queries que podem ter sido afetadas pelas tool calls
      queryClient.invalidateQueries({ queryKey: ["marketing-ideas", accountId] });
      queryClient.invalidateQueries({ queryKey: ["marketing-hooks", accountId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renameConversation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("marketing_copilot_conversations").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["copilot-conversations", accountId] }),
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_copilot_conversations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copilot-conversations", accountId] });
      toast.success("Conversa removida");
    },
  });

  return {
    conversations, loadingConvs,
    messages, loadingMsgs,
    createConversation, sendMessage, renameConversation, deleteConversation,
  };
}
