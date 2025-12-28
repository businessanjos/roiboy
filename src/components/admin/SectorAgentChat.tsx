import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agentId?: string;
}

interface AgentOption {
  id: string;
  name: string;
  displayName: string;
  avatar?: string | null;
  greetingMessage?: string | null;
  color: string;
}

interface SectorAgentChatProps {
  agents: AgentOption[];
  defaultAgentId?: string;
}

export function SectorAgentChat({
  agents,
  defaultAgentId,
}: SectorAgentChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(defaultAgentId || agents[0]?.id);
  const [messagesByAgent, setMessagesByAgent] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
  const messages = messagesByAgent[selectedAgentId] || [];

  // Add greeting message on first open or agent switch
  useEffect(() => {
    if (isOpen && selectedAgent && !messagesByAgent[selectedAgent.id] && selectedAgent.greetingMessage) {
      setMessagesByAgent((prev) => ({
        ...prev,
        [selectedAgent.id]: [
          {
            id: `greeting-${selectedAgent.id}`,
            role: "assistant",
            content: selectedAgent.greetingMessage!,
            timestamp: new Date(),
            agentId: selectedAgent.id,
          },
        ],
      }));
    }
  }, [isOpen, selectedAgent, messagesByAgent]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !selectedAgent) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      agentId: selectedAgent.id,
    };

    setMessagesByAgent((prev) => ({
      ...prev,
      [selectedAgent.id]: [...(prev[selectedAgent.id] || []), userMessage],
    }));
    setInput("");
    setIsLoading(true);

    // Simular resposta do agente (será integrado com edge function depois)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `[${selectedAgent.name}] Esta é uma resposta de demonstração. A integração com a IA será implementada em breve.`,
        timestamp: new Date(),
        agentId: selectedAgent.id,
      };
      setMessagesByAgent((prev) => ({
        ...prev,
        [selectedAgent.id]: [...(prev[selectedAgent.id] || []), assistantMessage],
      }));
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get gradient colors for the bubble
  const getGradientClass = (color: string) => {
    if (color.includes("blue")) return "from-blue-500 to-indigo-600";
    if (color.includes("emerald")) return "from-emerald-500 to-green-600";
    if (color.includes("purple")) return "from-purple-500 to-violet-600";
    return "from-primary to-primary/80";
  };

  const gradientClass = selectedAgent ? getGradientClass(selectedAgent.color) : "from-primary to-primary/80";

  if (agents.length === 0) return null;

  return (
    <>
      {/* Floating Chat Bubble */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed right-6 bottom-6 z-50 p-4 rounded-full shadow-lg",
          "bg-gradient-to-br text-white",
          gradientClass,
          "hover:scale-110 transition-transform"
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: isOpen ? 0 : 1, scale: isOpen ? 0 : 1 }}
      >
        <MessageCircle className="h-6 w-6" />
        <span className="sr-only">Abrir chat com {selectedAgent?.name}</span>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-6 bottom-6 z-50 w-96 h-[500px] bg-background border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header with Agent Selector */}
            <div
              className={cn(
                "p-4 bg-gradient-to-r text-white flex items-center justify-between",
                gradientClass
              )}
            >
              {agents.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-3 hover:bg-white/10 rounded-lg p-1 pr-2 transition-colors">
                      <Avatar className="h-10 w-10 border-2 border-white/30">
                        <AvatarImage src={selectedAgent?.avatar || undefined} />
                        <AvatarFallback className="bg-white/20 text-white">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="font-semibold flex items-center gap-1">
                          {selectedAgent?.name}
                          <ChevronDown className="h-4 w-4 opacity-70" />
                        </p>
                        <p className="text-xs opacity-80">{selectedAgent?.displayName}</p>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {agents.map((agent) => (
                      <DropdownMenuItem
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={cn(
                          "flex items-center gap-3 p-3",
                          selectedAgentId === agent.id && "bg-accent"
                        )}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={agent.avatar || undefined} />
                          <AvatarFallback className={cn("bg-gradient-to-br text-white text-xs", getGradientClass(agent.color))}>
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.displayName}</p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white/30">
                    <AvatarImage src={selectedAgent?.avatar || undefined} />
                    <AvatarFallback className="bg-white/20 text-white">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{selectedAgent?.name}</p>
                    <p className="text-xs opacity-80">{selectedAgent?.displayName}</p>
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={selectedAgent?.avatar || undefined} />
                        <AvatarFallback className={cn("bg-gradient-to-br text-white", gradientClass)}>
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      {message.content}
                    </div>
                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-secondary">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={cn("bg-gradient-to-br text-white", gradientClass)}>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t bg-muted/30">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Pergunte ao ${selectedAgent?.name}...`}
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className={cn("bg-gradient-to-br shrink-0", gradientClass)}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
