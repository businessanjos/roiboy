import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Users2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupJid: string;
  sectorId?: string | null;
  integrationId?: string | null;
}

interface Participant { id: string; phone: string; name: string; isAdmin: boolean; clientName?: string }

function formatPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+55 (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
  return d ? `+${d}` : "";
}

/** Lista os contatos (participantes) de um grupo do WhatsApp — somente leitura. */
export function ZappGroupParticipantsDialog({ open, onOpenChange, groupJid, sectorId, integrationId }: Props) {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["zapp-group-participants", groupJid],
    enabled: open && !!groupJid,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "group_participants", group_id: groupJid, sector_id: sectorId, integration_id: integrationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const raw: any[] = data?.data?.participants || [];
      const list: Participant[] = raw.map((p) => {
        const field = String(p.PhoneNumber || p.phoneNumber || p.phone || p.JID || p.jid || p.id || "");
        const phone = field.includes("@lid") ? "" : field.split("@")[0].split(":")[0].replace(/\D/g, "");
        return {
          id: String(p.JID || p.jid || p.LID || p.lid || p.id || phone),
          phone,
          name: p.DisplayName || p.displayName || p.name || p.notify || p.pushName || "",
          isAdmin: !!(p.IsAdmin || p.isAdmin || p.IsSuperAdmin || p.isSuperAdmin || p.admin === "admin" || p.admin === "superadmin"),
        };
      });
      const suffixes = list.map((p) => p.phone.slice(-8)).filter((s) => s.length === 8);
      if (suffixes.length) {
        const { data: clients } = await supabase
          .from("clients")
          .select("full_name, phone_e164")
          .or(suffixes.map((s) => `phone_e164.ilike.%${s}`).join(","))
          .limit(500);
        const map = new Map<string, string>();
        (clients || []).forEach((c: any) => {
          const d = String(c.phone_e164 || "").replace(/\D/g, "");
          if (d) map.set(d.slice(-8), c.full_name);
        });
        list.forEach((p) => { p.clientName = map.get(p.phone.slice(-8)); });
      }
      return list.sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || (a.clientName || a.name || a.phone).localeCompare(b.clientName || b.name || b.phone));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data || [];
    const qd = q.replace(/\D/g, "");
    return (data || []).filter((p) =>
      (p.name || "").toLowerCase().includes(q) || (p.clientName || "").toLowerCase().includes(q) || (qd && p.phone.includes(qd)));
  }, [data, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users2 className="h-5 w-5" /> Contatos do grupo</DialogTitle>
          <DialogDescription>
            {data ? `${data.length} participantes, lidos direto do WhatsApp.` : "Lendo participantes no WhatsApp..."}
          </DialogDescription>
        </DialogHeader>
        <Input placeholder="Buscar por nome ou número..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-[55vh] overflow-y-auto space-y-1">
          {isLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {error && <p className="text-sm text-destructive py-4">Não foi possível ler o grupo. Confira se o WhatsApp deste setor está conectado e faz parte do grupo.</p>}
          {!isLoading && !error && filtered.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhum contato encontrado.</p>}
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.clientName || p.name || formatPhone(p.phone) || "Contato oculto"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.phone ? formatPhone(p.phone) : "Número oculto pelo WhatsApp"}{p.clientName && p.name ? ` · ${p.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.clientName && <Badge variant="secondary" className="text-[10px]">Cliente</Badge>}
                {p.isAdmin && <Badge variant="outline" className="text-[10px]">Admin</Badge>}
                {p.phone && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Copiar número"
                    onClick={() => { navigator.clipboard.writeText(`+${p.phone}`); toast.success("Número copiado"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
