import { memo } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Contact {
  id: string;
  full_name: string;
  phone_e164: string;
  avatar_url: string | null;
  type?: 'client' | 'lead' | 'conversation';
}

interface ZappNewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  clients: Contact[];
  onSelectClient: (client: Contact) => void;
  creating: boolean;
  isLeadMode?: boolean;
}

export const ZappNewConversationDialog = memo(function ZappNewConversationDialog({
  open,
  onOpenChange,
  searchQuery,
  onSearchChange,
  clients,
  onSelectClient,
  creating,
}: ZappNewConversationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
          <DialogDescription className="text-[#8696a0]">
            Busque um contato para iniciar uma conversa
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
          />
          <ScrollArea className="h-64 -mr-4 pr-4">
            {searchQuery.trim() === "" ? (
              <p className="text-center text-[#8696a0] py-8">Digite para buscar contatos</p>
            ) : clients.length === 0 ? (
              <p className="text-center text-[#8696a0] py-8">Nenhum contato encontrado</p>
            ) : (
              <div className="space-y-2 pr-1">
                {clients.map((client) => (
                  <button
                    key={`${client.type || 'contact'}-${client.id}`}
                    onClick={() => onSelectClient(client)}
                    disabled={creating}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#202c33] transition-colors text-left overflow-hidden"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback className="bg-zapp-accent text-white">
                        {client.full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[#e9edef] font-medium truncate flex-1 min-w-0">{client.full_name}</p>
                        {client.type === 'client' && (
                          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs shrink-0">
                            Cliente
                          </Badge>
                        )}
                        {client.type === 'lead' && (
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs shrink-0">
                            Lead
                          </Badge>
                        )}
                        {client.type === 'conversation' && (
                          <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs shrink-0">
                            Contato
                          </Badge>
                        )}
                      </div>
                      <p className="text-[#8696a0] text-sm truncate">{client.phone_e164}</p>
                    </div>
                    {creating && <Loader2 className="h-4 w-4 animate-spin text-zapp-accent shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
});
