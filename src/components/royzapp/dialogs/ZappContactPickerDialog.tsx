import { memo } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  avatar_url: string | null;
}

interface ZappContactPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredClients: Client[];
  onSelectContact: (client: Client) => void;
  sending: boolean;
}

export const ZappContactPickerDialog = memo(function ZappContactPickerDialog({
  open,
  onOpenChange,
  searchQuery,
  onSearchChange,
  filteredClients,
  onSelectContact,
  sending,
}: ZappContactPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
        <DialogHeader>
          <DialogTitle>Enviar Contato</DialogTitle>
          <DialogDescription className="text-[#8696a0]">
            Busque e selecione um contato para enviar
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
          />
          <ScrollArea className="h-64">
            {searchQuery.trim() === "" ? (
              <p className="text-center text-[#8696a0] py-8">Digite para buscar contatos</p>
            ) : filteredClients.length === 0 ? (
              <p className="text-center text-[#8696a0] py-8">Nenhum contato encontrado</p>
            ) : (
              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => onSelectContact(client)}
                    disabled={sending}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#202c33] transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback className="bg-zapp-accent text-white">
                        {client.full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#e9edef] font-medium truncate">{client.full_name}</p>
                      <p className="text-[#8696a0] text-sm truncate">{client.phone_e164}</p>
                    </div>
                    {sending && <Loader2 className="h-4 w-4 animate-spin text-zapp-accent" />}
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
