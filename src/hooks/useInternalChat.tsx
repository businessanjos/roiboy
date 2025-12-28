import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';

interface InternalChat {
  id: string;
  account_id: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  participants?: ChatParticipant[];
  last_message?: InternalMessage | null;
  unread_count?: number;
}

interface ChatParticipant {
  id: string;
  user_id: string;
  last_read_at: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string | null;
  };
}

interface InternalMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  reply_to_id: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
}

export function useInternalChat() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Fetch all chats for current user
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['internal-chats', currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];

      const { data: chatsData, error } = await supabase
        .from('internal_chats')
        .select(`
          *,
          internal_chat_participants!inner (
            id,
            user_id,
            last_read_at,
            users:user_id (
              id,
              name,
              email,
              avatar_url
            )
          )
        `)
        .eq('account_id', currentUser.account_id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Get last message for each chat
      const chatsWithLastMessage = await Promise.all(
        (chatsData || []).map(async (chat: any) => {
          const { data: lastMsg } = await supabase
            .from('internal_messages')
            .select('*, sender:sender_id(id, name, avatar_url)')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Count unread messages
          const myParticipation = chat.internal_chat_participants?.find(
            (p: any) => p.user_id === currentUser.id
          );
          
          let unreadCount = 0;
          if (myParticipation?.last_read_at) {
            const { count } = await supabase
              .from('internal_messages')
              .select('*', { count: 'exact', head: true })
              .eq('chat_id', chat.id)
              .gt('created_at', myParticipation.last_read_at)
              .neq('sender_id', currentUser.id);
            unreadCount = count || 0;
          } else {
            const { count } = await supabase
              .from('internal_messages')
              .select('*', { count: 'exact', head: true })
              .eq('chat_id', chat.id)
              .neq('sender_id', currentUser.id);
            unreadCount = count || 0;
          }

          return {
            ...chat,
            participants: chat.internal_chat_participants?.map((p: any) => ({
              ...p,
              user: p.users
            })),
            last_message: lastMsg,
            unread_count: unreadCount
          };
        })
      );

      return chatsWithLastMessage as InternalChat[];
    },
    enabled: !!currentUser?.account_id,
  });

  // Fetch messages for selected chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['internal-messages', selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return [];

      const { data, error } = await supabase
        .from('internal_messages')
        .select('*, sender:sender_id(id, name, avatar_url)')
        .eq('chat_id', selectedChatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as InternalMessage[];
    },
    enabled: !!selectedChatId,
  });

  // Fetch team members for new chat
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-for-chat', currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];

      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar_url')
        .eq('account_id', currentUser.account_id)
        .neq('id', currentUser.id);

      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.account_id,
  });

  // Create new chat
  const createChat = useMutation({
    mutationFn: async ({ participantIds, groupName }: { participantIds: string[]; groupName?: string }) => {
      if (!currentUser?.account_id || !currentUser?.id) throw new Error('User not found');

      const isGroup = participantIds.length > 1;

      // Check if 1:1 chat already exists
      if (!isGroup) {
        const existingChat = chats.find(chat => 
          !chat.is_group && 
          chat.participants?.some(p => p.user_id === participantIds[0])
        );
        if (existingChat) {
          return existingChat;
        }
      }

      // Create new chat
      const { data: newChat, error: chatError } = await supabase
        .from('internal_chats')
        .insert({
          account_id: currentUser.account_id,
          is_group: isGroup,
          name: isGroup ? (groupName || null) : null,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add participants (including self)
      const allParticipants = [currentUser.id, ...participantIds];
      const { error: participantsError } = await supabase
        .from('internal_chat_participants')
        .insert(
          allParticipants.map(userId => ({
            chat_id: newChat.id,
            user_id: userId
          }))
        );

      if (participantsError) throw participantsError;

      return newChat;
    },
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
      setSelectedChatId(chat.id);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar conversa',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Update chat (rename group)
  const updateChat = useMutation({
    mutationFn: async ({ chatId, name }: { chatId: string; name: string }) => {
      const { data, error } = await supabase
        .from('internal_chats')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', chatId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
      toast({ title: 'Grupo atualizado!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar grupo',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Add participants to group
  const addParticipants = useMutation({
    mutationFn: async ({ chatId, userIds }: { chatId: string; userIds: string[] }) => {
      const { error } = await supabase
        .from('internal_chat_participants')
        .insert(
          userIds.map(userId => ({
            chat_id: chatId,
            user_id: userId
          }))
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
      toast({ title: 'Participantes adicionados!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao adicionar participantes',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Remove participant from group
  const removeParticipant = useMutation({
    mutationFn: async ({ chatId, userId }: { chatId: string; userId: string }) => {
      const { error } = await supabase
        .from('internal_chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
      toast({ title: 'Participante removido!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover participante',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Leave group
  const leaveGroup = useMutation({
    mutationFn: async (chatId: string) => {
      if (!currentUser?.id) throw new Error('User not found');
      
      const { error } = await supabase
        .from('internal_chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', currentUser.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
      setSelectedChatId(null);
      toast({ title: 'Você saiu do grupo' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao sair do grupo',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      if (!selectedChatId || !currentUser?.id) throw new Error('Chat or user not found');

      const { data, error } = await supabase
        .from('internal_messages')
        .insert({
          chat_id: selectedChatId,
          sender_id: currentUser.id,
          content,
          reply_to_id: replyToId
        })
        .select('*, sender:sender_id(id, name, avatar_url)')
        .single();

      if (error) throw error;

      // Update chat's updated_at
      await supabase
        .from('internal_chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedChatId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages', selectedChatId] });
      queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Mark chat as read
  const markAsRead = useCallback(async (chatId: string) => {
    if (!currentUser?.id) return;

    await supabase
      .from('internal_chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', currentUser.id);

    queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
  }, [currentUser?.id, queryClient]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!selectedChatId) return;

    const channel = supabase
      .channel(`internal-messages-${selectedChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
          filter: `chat_id=eq.${selectedChatId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['internal-messages', selectedChatId] });
          queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChatId, queryClient]);

  // Mark as read when selecting chat
  useEffect(() => {
    if (selectedChatId) {
      markAsRead(selectedChatId);
    }
  }, [selectedChatId, markAsRead]);

  const selectedChat = chats.find(c => c.id === selectedChatId);

  return {
    chats,
    chatsLoading,
    messages,
    messagesLoading,
    teamMembers,
    selectedChatId,
    selectedChat,
    setSelectedChatId,
    createChat,
    updateChat,
    addParticipants,
    removeParticipant,
    leaveGroup,
    sendMessage,
    markAsRead,
    currentUserId: currentUser?.id
  };
}
