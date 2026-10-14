import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Search, Shield, Users2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupJid: string;
  sectorId?: string | null;
  integrationId?: string | null;
}

interface Participant { id: string; phone: string; name: string; isAdmin: boolean; clientName?: string; }

const AVATAR_STYLES = [
  "bg-primary/10 text-primary",
  "bg-secondary text-secondary-foreground",
  "bg-accent text-accent-foreground",
  "bg-muted text-muted-foreground",
];

function formatPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return `+55 (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}`;
  return d ? `+${d}` : "";
}

function initials(p: Participant) {
  const base = p.clientName || p.name || p.phone;
  if (!base) return "?";
  const parts = base.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function avatarStyle(p: Participant) {
  const key = (p.clientName || p.name || p.phone || "?").trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_STYLES[h % AVATAR_STYLES.length];
}

/** Lista os contatos (participantes) de um grupo do WhatsApp — somente leitura. */
export function ZappGroupParticipantsDialog({ open, onOpenChange, groupJid, sectorId, integrationId }: Props) {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["zapp-group-participants", groupJid],
    enabled: open && !!groupJid,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      // Fontes de nome além do WhatsApp: cache do webhook + nomes já vistos nas mensagens do ROY.
      const cachedByName = new Map<string, string>();
      const cachedRes = await supabase
        .from("whatsapp_group_participants")
        .select("phone, name, is_admin")
        .eq("group_jid", groupJid);
      (cachedRes.data || []).forEach((c: any) => {
        const d = String(c.phone || "").replace(/\D/g, "");
        const n = String(c.name || "").trim();
        if (d && n) cachedByName.set(d.slice(-8), n);
      });

      const msgNames = new Map<string, string>();
      const convRes = await supabase.from("zapp_conversations").select("id").eq("group_jid", groupJid);
      const convIds = (convRes.data || []).map((c: any) => c.id);
      if (convIds.length) {
        const { data: msgs } = await supabase
          .from("zapp_messages")
          .select("sender_phone, sender_name")
          .in("conversation_id", convIds)
          .not("sender_name", "is", null)
          .limit(5000);
        (msgs || []).forEach((m: any) => {
          const d = String(m.sender_phone || "").replace(/\D/g, "");
          const n = String(m.sender_name || "").trim();
          if (d && n && !msgNames.has(d.slice(-8))) msgNames.set(d.slice(-8), n);
        });
      }

      let liveError: unknown = null;
      let raw: any[] = [];
      try {
        const { data, error } = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "group_participants", group_id: groupJid, sector_id: sectorId, integration_id: integrationId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        raw = data?.data?.participants || [];
      } catch (e) {
        liveError = e;
      }

      let list: Participant[];
      if (raw.length) {
        list = raw.map((p) => {
          const field = String(p.PhoneNumber || p.phoneNumber || p.phone || p.JID || p.jid || p.id || "");
          const phone = field.includes("@lid") ? "" : field.split("@")[0].split(":")[0].replace(/\D/g, "");
          const suffix = phone.slice(-8);
          return {
            id: String(p.JID || p.jid || p.LID || p.lid || p.id || phone),
            phone,
            name:
              p.DisplayName || p.displayName || p.name || p.notify || p.pushName ||
              cachedByName.get(suffix) || msgNames.get(suffix) || "",
            isAdmin: !!(p.IsAdmin || p.isAdmin || p.IsSuperAdmin || p.isSuperAdmin || p.admin === "admin" || p.admin === "superadmin"),
          };
        });
      } else {
        if (liveError && !(cachedRes.data || []).length) throw liveError;
        list = (cachedRes.data || []).map((c: any) => ({
          id: String(c.phone),
          phone: String(c.phone || "").replace(/\D/g, ""),
          name: String(c.name || ""),
          isAdmin: !!c.is_admin,
        }));
      }

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

      return list.sort(
        (a, b) =>
          Number(b.isAdmin) - Number(a.isAdmin) ||
          Number(!!b.clientName) - Number(!!a.clientName) ||
          (a.clientName || a.name || a.phone).localeCompare(b.clientName || b.name || b.phone)
      );
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data || [];
    const qd = q.replace(/\D/g, "");
    return (data || []).filter((p) =>
      (p.name || "").toLowerCase().includes(q) || (p.clientName || "").toLowerCase().includes(q) || (qd && p.phone.includes(qd)));
  }, [data, search]);

  const clientCount = (data || []).filter((p) => p.clientName).length;
  const adminCount = (data || []).filter((p) => p.isAdmin).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl p-0">
        <div className="flex items-center gap-3 border-b bg-muted/40 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base leading-tight">Contatos do grupo</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs leading-tight">
              {data
                ? `${data.length} participantes${clientCount ? ` · ${clientCount} ${clientCount === 1 ? "cliente" : "clientes"}` : ""} · lidos direto do WhatsApp`
                : "Lendo participantes no WhatsApp..."}
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-3 px-5 pt-4">
          {data && data.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[11px]">{data.length} participantes</Badge>
              {adminCount > 0 && (
                <Badge variant="outline" className="gap-1 text-[11px]"><Shield className="h-3 w-3" /> {adminCount} admin{adminCount > 1 ? "s" : ""}</Badge>
              )}
              {clientCount > 0 && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px]">{clientCount} cliente{clientCount > 1 ? "s" : ""}</Badge>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl pl-9"
            />
          </div>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-3 pb-4 pt-3">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <p className="py-6 text-center text-sm text-destructive px-3">
              Não foi possível ler o grupo. Confira se o WhatsApp deste setor está conectado e faz parte do grupo.
            </p>
          )}
          {!isLoading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Users2 className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{search ? "Nenhum contato encontrado para essa busca." : "Nenhum contato encontrado."}</p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <ul className="space-y-1">
              {filtered.map((p, i) => {
                const prev = filtered[i - 1];
                const showAdminDivider = p.isAdmin && (!prev || !prev.isAdmin);
                const showClientsDivider = !p.isAdmin && p.clientName && (!prev || !(!prev.isAdmin && prev.clientName));
                return (
                  <li key={p.id}>
                    {(showAdminDivider || showClientsDivider) && (
                      <p className="px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                        {showAdminDivider ? "Administradores do grupo" : "Clientes"}
                      </p>
                    )}
                    <div className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/50">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          avatarStyle(p)
                        )}
                        aria-hidden
                      >
                        {initials(p)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {p.clientName || p.name || formatPhone(p.phone) || "Contato oculto"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.phone
                            ? formatPhone(p.phone)
                            : "Número oculto pelo WhatsApp"}
                          {p.clientName && p.name ? ` · ${p.name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {p.clientName && (
                          <Badge className="hidden bg-primary/10 text-primary border-primary/20 text-[10px] sm:inline-flex">Cliente</Badge>
                        )}
                        {p.isAdmin && <Badge variant="outline" className="gap-1 text-[10px]"><Shield className="h-2.5 w-2.5" /> Admin</Badge>}
                        {p.phone && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label="Copiar número"
                            onClick={() => { navigator.clipboard.writeText(`+${p.phone}`); toast.success("Número copiado"); }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
