import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Phone, User, Link2, Package } from "lucide-react";
import { toast } from "sonner";

interface ClientResult {
  id: string;
  full_name: string;
  phone_e164: string | null;
  additional_phones: string[] | null;
  avatar_url: string | null;
  cpf: string | null;
  cnpj: string | null;
  client_products?: { product: { id: string; name: string; color?: string | null } }[];
  type: "client" | "lead";
  status?: string;
}

interface ZappLinkClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  conversationPhone: string;
  contactName: string;
  accountId: string;
  onLinked: () => void;
}

export function ZappLinkClientDialog({
  open,
  onOpenChange,
  conversationId,
  conversationPhone,
  contactName,
  accountId,
  onLinked,
}: ZappLinkClientDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [addPhoneToClient, setAddPhoneToClient] = useState(true);
  const [linking, setLinking] = useState(false);

  // Search clients AND leads
  const searchClients = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const cleanQuery = query.trim();
      const phoneQuery = cleanQuery.replace(/\D/g, "");

      // Search clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select(`
          id, full_name, phone_e164, additional_phones, avatar_url, cpf, cnpj,
          client_products(product:products(id, name, color))
        `)
        .eq("account_id", accountId)
        .eq("status", "active")
        .or(
          `full_name.ilike.%${cleanQuery}%,` +
          `phone_e164.ilike.%${phoneQuery}%,` +
          `cpf.ilike.%${phoneQuery}%,` +
          `cnpj.ilike.%${phoneQuery}%`
        )
        .limit(10);

      if (clientsError) throw clientsError;

      // Search leads (not converted)
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, full_name, phone, email, status")
        .eq("account_id", accountId)
        .neq("status", "converted")
        .or(
          `full_name.ilike.%${cleanQuery}%,` +
          `phone.ilike.%${phoneQuery}%,` +
          `email.ilike.%${cleanQuery}%`
        )
        .limit(10);

      if (leadsError) throw leadsError;

      // Combine results - clients first, then leads
      const clientResults: ClientResult[] = (clientsData || []).map(c => ({
        ...c,
        type: "client" as const,
      }));

      const leadResults: ClientResult[] = (leadsData || []).map(l => ({
        id: l.id,
        full_name: l.full_name,
        phone_e164: l.phone,
        additional_phones: null,
        avatar_url: null,
        cpf: null,
        cnpj: null,
        type: "lead" as const,
        status: l.status,
      }));

      setResults([...clientResults, ...leadResults]);
    } catch (error) {
      console.error("Error searching:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchClients(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchClients]);

  // Auto-search with contact name on open
  useEffect(() => {
    if (open && contactName && contactName !== "Desconhecido") {
      // Try to find first name or first two words
      const nameParts = contactName.split(/[\s\-\/]+/).filter(p => p.length > 2);
      if (nameParts.length > 0) {
        setSearch(nameParts[0]);
      }
    }
    if (!open) {
      setSearch("");
      setResults([]);
      setSelectedClient(null);
      setAddPhoneToClient(true);
    }
  }, [open, contactName]);

  // Link conversation to client
  const handleLink = async () => {
    if (!selectedClient) return;

    setLinking(true);
    try {
      // 1. Update conversation with client_id
      const { error: convError } = await supabase
        .from("zapp_conversations")
        .update({ client_id: selectedClient.id })
        .eq("id", conversationId);

      if (convError) throw convError;

      // 2. If checkbox is checked, add phone to client's additional_phones
      if (addPhoneToClient && conversationPhone) {
        const currentPhones = Array.isArray(selectedClient.additional_phones)
          ? selectedClient.additional_phones
          : [];

        // Check if phone is already in the list or is the main phone
        const cleanConversationPhone = conversationPhone.replace(/\D/g, "");
        const cleanMainPhone = (selectedClient.phone_e164 || "").replace(/\D/g, "");
        const phoneExists =
          cleanConversationPhone === cleanMainPhone ||
          currentPhones.some(p => p.replace(/\D/g, "") === cleanConversationPhone);

        if (!phoneExists) {
          const { error: phoneError } = await supabase
            .from("clients")
            .update({
              additional_phones: [...currentPhones, conversationPhone],
            })
            .eq("id", selectedClient.id);

          if (phoneError) {
            console.error("Error adding phone:", phoneError);
            // Don't fail the whole operation for this
          }
        }
      }

      // 3. Mark any pending suggestions as accepted
      await supabase
        .from("zapp_client_suggestions")
        .update({ status: "accepted" })
        .eq("zapp_conversation_id", conversationId)
        .eq("suggested_client_id", selectedClient.id);

      toast.success(`Conversa vinculada a ${selectedClient.full_name}`);
      onLinked();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error linking client:", error);
      toast.error(error.message || "Erro ao vincular cliente");
    } finally {
      setLinking(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const formatPhone = (phone: string | null) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular a Cliente Existente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">Conversa de:</p>
            <p className="font-medium">{contactName}</p>
            <p className="text-muted-foreground">{formatPhone(conversationPhone)}</p>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Results */}
          <ScrollArea className="h-[240px] border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <User className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm text-center">
                  {search.length >= 2
                    ? "Nenhum cliente encontrado"
                    : "Digite ao menos 2 caracteres para buscar"}
                </p>
              </div>
            ) : (
              <div className="p-1 space-y-1">
                {results.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedClient?.id === client.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={client.avatar_url || undefined} />
                        <AvatarFallback className="bg-muted text-xs">
                          {getInitials(client.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.full_name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{formatPhone(client.phone_e164)}</span>
                        </div>
                        {/* Products */}
                        {client.client_products && client.client_products.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <Package className="h-3 w-3 text-muted-foreground" />
                            {client.client_products.slice(0, 3).map((cp) => (
                              <Badge
                                key={cp.product.id}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4"
                                style={{
                                  backgroundColor: `${cp.product.color || "#10b981"}20`,
                                  color: cp.product.color || "#10b981",
                                }}
                              >
                                {cp.product.name}
                              </Badge>
                            ))}
                            {client.client_products.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{client.client_products.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Add phone checkbox */}
          {selectedClient && conversationPhone && (
            <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
              <Checkbox
                id="addPhone"
                checked={addPhoneToClient}
                onCheckedChange={(checked) => setAddPhoneToClient(checked === true)}
              />
              <Label htmlFor="addPhone" className="text-sm cursor-pointer">
                Adicionar {formatPhone(conversationPhone)} como telefone adicional do cliente
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={linking}>
            Cancelar
          </Button>
          <Button onClick={handleLink} disabled={!selectedClient || linking}>
            {linking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Vinculando...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Vincular
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
