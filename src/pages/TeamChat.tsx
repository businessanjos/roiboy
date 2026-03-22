import { useState, useRef, useEffect } from 'react';
import { useInternalChat } from '@/hooks/useInternalChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Users,
  MoreVertical,
  Pencil,
  UserPlus,
  LogOut,
  Bot,
  Sparkles,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { TeamChatMessageInput, TeamChatMessage } from '@/components/team-chat';
import { ZappAIAgentChat, AIAgent } from '@/components/royzapp';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function TeamChat() {
  const { currentUser } = useCurrentUser();
  const {
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
    currentUserId
  } = useInternalChat();

  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newChatDialogOpen, setNewChatDialogOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [editGroupDialogOpen, setEditGroupDialogOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [addMembersDialogOpen, setAddMembersDialogOpen] = useState(false);
  const [newMemberIds, setNewMemberIds] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // AI Agents state
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [selectedAIAgent, setSelectedAIAgent] = useState<AIAgent | null>(null);

  // Fetch AI agents
  useEffect(() => {
    const fetchAIAgents = async () => {
      const { data } = await supabase
        .from('ai_sector_agents')
        .select('*')
        .eq('is_enabled', true)
        .order('name');
      
      if (data) {
        setAiAgents(data.map(agent => ({
          id: agent.id,
          sector_id: agent.sector_id,
          name: agent.name,
          display_name: agent.display_name,
          avatar_url: agent.avatar_url,
          greeting_message: agent.greeting_message,
          is_enabled: agent.is_enabled,
        })));
      }
    };
    
    fetchAIAgents();
  }, []);

  const handleSelectAIAgent = (agent: AIAgent) => {
    setSelectedAIAgent(agent);
    setSelectedChatId(null); // Deselect any regular chat
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setSelectedAIAgent(null); // Deselect AI agent
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (data: {
    content?: string;
    messageType: 'text' | 'audio' | 'file' | 'image';
    file?: File;
    audioDuration?: number;
  }) => {
    await sendMessage.mutateAsync({
      content: data.content,
      messageType: data.messageType,
      file: data.file,
      audioDuration: data.audioDuration
    });
  };


  const handleCreateChat = async () => {
    if (selectedMembers.length === 0) return;
    
    const isGroup = selectedMembers.length > 1;
    await createChat.mutateAsync({ 
      participantIds: selectedMembers, 
      groupName: isGroup && groupName.trim() ? groupName.trim() : undefined 
    });
    setNewChatDialogOpen(false);
    setSelectedMembers([]);
    setGroupName('');
  };

  const handleEditGroup = async () => {
    if (!selectedChat?.id || !editGroupName.trim()) return;
    
    await updateChat.mutateAsync({ chatId: selectedChat.id, name: editGroupName.trim() });
    setEditGroupDialogOpen(false);
    setEditGroupName('');
  };

  const handleAddMembers = async () => {
    if (!selectedChat?.id || newMemberIds.length === 0) return;
    
    await addParticipants.mutateAsync({ chatId: selectedChat.id, userIds: newMemberIds });
    setAddMembersDialogOpen(false);
    setNewMemberIds([]);
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!selectedChat?.id) return;
    await removeParticipant.mutateAsync({ chatId: selectedChat.id, userId });
  };

  const handleLeaveGroup = async () => {
    if (!selectedChat?.id) return;
    await leaveGroup.mutateAsync(selectedChat.id);
  };

  const openEditGroupDialog = () => {
    setEditGroupName(selectedChat?.name || '');
    setEditGroupDialogOpen(true);
  };

  const openAddMembersDialog = () => {
    setNewMemberIds([]);
    setAddMembersDialogOpen(true);
  };

  // Get members not already in the group
  const availableMembers = teamMembers.filter(
    member => !selectedChat?.participants?.some(p => p.user_id === member.id)
  );

  const getChatName = (chat: typeof chats[0]) => {
    if (chat.name) return chat.name;
    if (chat.is_group) return 'Grupo';
    
    const otherParticipant = chat.participants?.find(p => p.user_id !== currentUserId);
    return otherParticipant?.user?.name || 'Chat';
  };

  const getChatAvatar = (chat: typeof chats[0]) => {
    if (chat.is_group) return null;
    const otherParticipant = chat.participants?.find(p => p.user_id !== currentUserId);
    return otherParticipant?.user?.avatar_url;
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Ontem';
    return format(date, 'dd/MM', { locale: ptBR });
  };

  const filteredChats = chats.filter(chat => {
    const name = getChatName(chat).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar - Chat List */}
      <div className="w-80 border-r flex flex-col bg-card">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">ROY Chat</h1>
            <Dialog open={newChatDialogOpen} onOpenChange={setNewChatDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost">
                  <Plus className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Conversa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Selecione os membros para iniciar uma conversa:
                  </p>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {teamMembers.map(member => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedMembers.includes(member.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMembers([...selectedMembers, member.id]);
                              } else {
                                setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                              }
                            }}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback>
                              {member.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{member.name}</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  {/* Group name field - only show when multiple members selected */}
                  {selectedMembers.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="group-name">Nome do Grupo (opcional)</Label>
                      <Input
                        id="group-name"
                        placeholder="Ex: Equipe de Vendas"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleCreateChat} 
                    disabled={selectedMembers.length === 0 || createChat.isPending}
                    className="w-full"
                  >
                    {createChat.isPending ? 'Criando...' : selectedMembers.length > 1 ? 'Criar Grupo' : 'Iniciar Conversa'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* AI Agents Section */}
          {aiAgents.length > 0 && (
            <div className="border-b">
              <div className="px-4 py-2 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Assistentes IA
                </p>
              </div>
              <div className="divide-y">
                {aiAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => handleSelectAIAgent(agent)}
                    className={cn(
                      "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                      selectedAIAgent?.id === agent.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={agent.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                            <Bot className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-card rounded-full">
                          <Sparkles className="h-3 w-3 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{agent.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            IA
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {agent.display_name}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Regular Chats */}
          {chatsLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando conversas...
            </div>
          ) : filteredChats.length === 0 && aiAgents.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhuma conversa ainda</p>
              <p className="text-xs">Clique em + para iniciar</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredChats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={cn(
                    "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                    selectedChatId === chat.id && !selectedAIAgent && "bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {chat.is_group ? (
                        <AvatarFallback className="bg-primary/10">
                          <Users className="h-5 w-5 text-primary" />
                        </AvatarFallback>
                      ) : (
                        <>
                          <AvatarImage src={getChatAvatar(chat) || undefined} />
                          <AvatarFallback>
                            {getChatName(chat).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{getChatName(chat)}</span>
                        {chat.last_message && (
                          <span className="text-xs text-muted-foreground">
                            {formatMessageTime(chat.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                          {chat.last_message?.content || 'Sem mensagens'}
                        </p>
                        {chat.unread_count && chat.unread_count > 0 && (
                          <Badge variant="default" className="ml-2 h-5 min-w-5 justify-center">
                            {chat.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedAIAgent ? (
          <ZappAIAgentChat
            agent={selectedAIAgent}
            currentUserName={currentUser?.name || ''}
            currentUserAvatar={currentUser?.avatar_url || null}
            onBack={() => setSelectedAIAgent(null)}
          />
        ) : selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b flex items-center justify-between px-4 bg-card">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {selectedChat.is_group ? (
                    <AvatarFallback className="bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </AvatarFallback>
                  ) : (
                    <>
                      <AvatarImage src={getChatAvatar(selectedChat) || undefined} />
                      <AvatarFallback>
                        {getChatName(selectedChat).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className="flex items-center">
                  <h2 className="font-semibold">{getChatName(selectedChat)}</h2>
                  {selectedChat.is_group && (
                    <span className="text-xs text-muted-foreground ml-2">
                      · {selectedChat.participants?.length} participantes
                    </span>
                  )}
                </div>
              </div>
              
              {/* Group Options Menu */}
              {selectedChat.is_group && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={openEditGroupDialog}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Renomear grupo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openAddMembersDialog}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Adicionar membros
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleLeaveGroup}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair do grupo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Edit Group Dialog */}
            <Dialog open={editGroupDialogOpen} onOpenChange={setEditGroupDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Renomear Grupo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-group-name">Nome do Grupo</Label>
                    <Input
                      id="edit-group-name"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      placeholder="Nome do grupo"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditGroupDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleEditGroup}
                    disabled={!editGroupName.trim() || updateChat.isPending}
                  >
                    {updateChat.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Members Dialog */}
            <Dialog open={addMembersDialogOpen} onOpenChange={setAddMembersDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Membros</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {availableMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Todos os membros já estão no grupo
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Selecione os membros para adicionar:
                      </p>
                      <ScrollArea className="h-48">
                        <div className="space-y-2">
                          {availableMembers.map(member => (
                            <label
                              key={member.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                            >
                              <Checkbox
                                checked={newMemberIds.includes(member.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setNewMemberIds([...newMemberIds, member.id]);
                                  } else {
                                    setNewMemberIds(newMemberIds.filter(id => id !== member.id));
                                  }
                                }}
                              />
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.avatar_url || undefined} />
                                <AvatarFallback>
                                  {member.name?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{member.name}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddMembersDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleAddMembers}
                    disabled={newMemberIds.length === 0 || addParticipants.isPending}
                  >
                    {addParticipants.isPending ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Group Participants List (shown in header on click) */}

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Seja o primeiro a enviar!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    const isOwn = message.sender_id === currentUserId;
                    const showAvatar = index === 0 || 
                      messages[index - 1].sender_id !== message.sender_id;

                    return (
                      <TeamChatMessage
                        key={message.id}
                        message={{
                          ...message,
                          message_type: (message as any).message_type || 'text',
                          file_url: (message as any).file_url || null,
                          file_name: (message as any).file_name || null,
                          file_size: (message as any).file_size || null,
                          file_type: (message as any).file_type || null,
                          audio_duration: (message as any).audio_duration || null,
                        }}
                        isOwn={isOwn}
                        showAvatar={showAvatar}
                        currentUserId={currentUserId}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <TeamChatMessageInput
              onSendMessage={handleSendMessage}
              disabled={sendMessage.isPending}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                Selecione uma conversa
              </h3>
              <p className="text-sm text-muted-foreground">
                ou inicie uma nova clicando em +
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
