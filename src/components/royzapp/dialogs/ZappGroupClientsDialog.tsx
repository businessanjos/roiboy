import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId: string;
  accountId: string;
}

/** Clientes ligados a um grupo do WhatsApp — usado para contar a conversa no Checkpoints. */
export function ZappGroupClientsDialog({ open, onOpenChange, conversationId, accountId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const key = ["zapp-group-clients", conversationId];

  const { data: links = [] } = useQuery({
    queryKey: key,
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zapp_group_clients")
        .select("id, source, client:clients(id, full_name)")
        .eq("conversation_id", conversationId);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ["zapp-group-client-search", search],
    enabled: open && search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .ilike("full_name", `%${search.trim()}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const add = async (clientId: string) => {
    const { error } = await supabase.from("zapp_group_clients").insert({
      account_id: accountId, conversation_id: conversationId, client_id: clientId, source: "manual",
    } as any);
    if (error && !String(error.message).includes("duplicate")) return toast.error("Não foi possível incluir");
    setSearch("");
    qc.invalidateQueries({ queryKey: key });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("zapp_group_clients").delete().eq("id", id);
    if (error) return toast.error("Não foi possível tirar");
    qc.invalidateQueries({ queryKey: key });
  };

  const linkedIds = new Set(links.map((l) => l.client?.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clientes deste grupo</DialogTitle>
          <DialogDescription>
            As mensagens do grupo contam como interação desses clientes no Checkpoints.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {links.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente ligado.</p>}
          {links.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <span className="text-sm truncate">{l.client?.full_name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{l.source === "manual" ? "Manual" : "Automático"}</Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(l.id)} aria-label="Tirar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Input placeholder="Buscar cliente para incluir..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {results.filter((r: any) => !linkedIds.has(r.id)).map((r: any) => (
            <button key={r.id} onClick={() => add(r.id)} className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted text-left">
              <Plus className="h-4 w-4" /> {r.full_name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
