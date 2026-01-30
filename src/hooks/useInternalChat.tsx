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
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  audio_duration: number | null;
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

  // Fetch all chats for current user - OPTIMIZED to avoid N+1 queries
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['internal-chats', currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id || !currentUser?.id) return [];

      // Fetch chats with participants
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
      if (!chatsData || chatsData.length === 0) return [];

      const chatIds = chatsData.map((c: any) => c.id);

      // OPTIMIZATION: Batch fetch last messages for all chats in ONE query
      // Instead of N queries (one per chat), we do 1 query with RPC-style approach
      const { data: allMessages } = await supabase
        .from('internal_messages')
        .select('id, chat_id, content, message_type, created_at, sender:sender_id(id, name, avatar_url)')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      // Group messages by chat_id and take the first (most recent) for each
      const lastMessageByChat: Record<string, any> = {};
      (allMessages || []).forEach((msg: any) => {
        if (!lastMessageByChat[msg.chat_id]) {
          lastMessageByChat[msg.chat_id] = msg;
        }
      });

      // OPTIMIZATION: Calculate unread counts locally from already fetched messages
      // Instead of N count queries, we process the data we already have
      const unreadCountByChat: Record<string, number> = {};
      chatsData.forEach((chat: any) => {
        const myParticipation = chat.internal_chat_participants?.find(
          (p: any) => p.user_id === currentUser.id
        );
        const lastReadAt = myParticipation?.last_read_at ? new Date(myParticipation.last_read_at) : null;
        
        // Count messages in this chat that are unread (after last_read_at and not from me)
        const chatMessages = (allMessages || []).filter(
          (m: any) => m.chat_id === chat.id && m.sender?.id !== currentUser.id
        );
        
        if (lastReadAt) {
          unreadCountByChat[chat.id] = chatMessages.filter(
            (m: any) => new Date(m.created_at) > lastReadAt
          ).length;
        } else {
          unreadCountByChat[chat.id] = chatMessages.length;
        }
      });

      // Assemble final result
      return chatsData.map((chat: any) => ({
        ...chat,
        participants: chat.internal_chat_participants?.map((p: any) => ({
          ...p,
          user: p.users
        })),
        last_message: lastMessageByChat[chat.id] || null,
        unread_count: unreadCountByChat[chat.id] || 0
      })) as InternalChat[];
    },
    enabled: !!currentUser?.account_id,
    staleTime: 30000, // 30 seconds - reduce refetches
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
    mutationFn: async ({ 
      content, 
      replyToId,
      messageType = 'text',
      file,
      audioDuration
    }: { 
      content?: string; 
      replyToId?: string;
      messageType?: 'text' | 'audio' | 'file' | 'image';
      file?: File;
      audioDuration?: number;
    }) => {
      if (!selectedChatId || !currentUser?.id || !currentUser?.account_id) {
        throw new Error('Chat or user not found');
      }

      let fileUrl = null;
      let fileName = null;
      let fileSize = null;
      let fileType = null;

      // Upload file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${currentUser.account_id}/${selectedChatId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('internal-chat-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('internal-chat-files')
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        fileName = file.name;
        fileSize = file.size;
        fileType = file.type;
      }

      const { data, error } = await supabase
        .from('internal_messages')
        .insert({
          chat_id: selectedChatId,
          sender_id: currentUser.id,
          content: content || null,
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          file_type: fileType,
          audio_duration: audioDuration || null,
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

  // Subscribe to realtime updates for selected chat
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

  // Subscribe to realtime updates for all chats (notifications)
  useEffect(() => {
    if (!currentUser?.id || !currentUser?.account_id) return;

    // Get all chat IDs the user participates in
    const userChatIds = chats.map(c => c.id);
    if (userChatIds.length === 0) return;

    const channel = supabase
      .channel('internal-messages-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages'
        },
        (payload: any) => {
          const newMessage = payload.new;
          
          // Only notify if message is from someone else and in a chat we're part of
          if (
            newMessage.sender_id !== currentUser.id &&
            userChatIds.includes(newMessage.chat_id) &&
            newMessage.chat_id !== selectedChatId
          ) {
            // Find the chat and sender info
            const chat = chats.find(c => c.id === newMessage.chat_id);
            const sender = chat?.participants?.find(p => p.user_id === newMessage.sender_id)?.user;
            
            const chatName = chat?.is_group 
              ? chat.name || 'Grupo' 
              : sender?.name || 'Alguém';

            toast({
              title: `💬 ${chatName}`,
              description: newMessage.content?.substring(0, 50) + (newMessage.content?.length > 50 ? '...' : '') || 'Nova mensagem',
            });

            // Invalidate chats to update unread counts
            queryClient.invalidateQueries({ queryKey: ['internal-chats'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.account_id, chats, selectedChatId, queryClient, toast]);

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
