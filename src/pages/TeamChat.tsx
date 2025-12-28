import { useState, useRef, useEffect } from 'react';
import { useInternalChat } from '@/hooks/useInternalChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MessageSquare, 
  Send, 
  Plus, 
  Search, 
  Users,
  Check,
  CheckCheck
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function TeamChat() {
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
    sendMessage,
    currentUserId
  } = useInternalChat();

  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newChatDialogOpen, setNewChatDialogOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    await sendMessage.mutateAsync({ content: messageInput.trim() });
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateChat = async () => {
    if (selectedMembers.length === 0) return;
    
    await createChat.mutateAsync(selectedMembers);
    setNewChatDialogOpen(false);
    setSelectedMembers([]);
  };

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
            <h1 className="text-xl font-semibold">Chat do Time</h1>
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
                  <ScrollArea className="h-64">
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
                          <div>
                            <p className="font-medium text-sm">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button 
                    onClick={handleCreateChat} 
                    disabled={selectedMembers.length === 0 || createChat.isPending}
                    className="w-full"
                  >
                    {createChat.isPending ? 'Criando...' : 'Iniciar Conversa'}
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
          {chatsLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando conversas...
            </div>
          ) : filteredChats.length === 0 ? (
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
                  onClick={() => setSelectedChatId(chat.id)}
                  className={cn(
                    "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                    selectedChatId === chat.id && "bg-muted"
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
        {selectedChat ? (
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
                <div>
                  <h2 className="font-semibold">{getChatName(selectedChat)}</h2>
                  {selectedChat.is_group && (
                    <p className="text-xs text-muted-foreground">
                      {selectedChat.participants?.length} participantes
                    </p>
                  )}
                </div>
              </div>
            </div>

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
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-2",
                          isOwn && "flex-row-reverse"
                        )}
                      >
                        {showAvatar && !isOwn && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={message.sender?.avatar_url || undefined} />
                            <AvatarFallback>
                              {message.sender?.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {!showAvatar && !isOwn && <div className="w-8" />}
                        
                        <div className={cn("max-w-[70%]", isOwn && "items-end")}>
                          {showAvatar && !isOwn && (
                            <p className="text-xs text-muted-foreground mb-1 ml-1">
                              {message.sender?.name}
                            </p>
                          )}
                          <Card className={cn(
                            "p-3 shadow-sm",
                            isOwn 
                              ? "bg-primary text-primary-foreground rounded-br-sm" 
                              : "bg-muted rounded-bl-sm"
                          )}>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <div className={cn(
                              "flex items-center gap-1 mt-1",
                              isOwn ? "justify-end" : "justify-start"
                            )}>
                              <span className={cn(
                                "text-[10px]",
                                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {format(new Date(message.created_at), 'HH:mm')}
                              </span>
                              {isOwn && (
                                <CheckCheck className={cn(
                                  "h-3 w-3",
                                  "text-primary-foreground/70"
                                )} />
                              )}
                            </div>
                          </Card>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-card">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={sendMessage.isPending}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessage.isPending}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
