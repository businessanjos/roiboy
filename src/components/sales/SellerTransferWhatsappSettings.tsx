import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const db = supabase as any;

function formatPhoneE164(e164: string) {
  const n = e164.replace(/\D/g, "");
  if (n.startsWith("55") && n.length >= 12) {
    const ddd = n.slice(2, 4);
    const rest = n.slice(4);
    return `+55 (${ddd}) ${rest.length > 8 ? rest.slice(0, 5) : rest.slice(0, 4)}${rest.length > 8 ? " " : ""}${rest.slice(rest.length > 8 ? 5 : 4)}`;
  }
  return e164;
}

function toE164(raw: string) {
  let n = raw.replace(/\D/g, "");
  if (n.length < 10 || n.length > 13) return null;
  if (n.length <= 11) n = "55" + n;
  return "+" + n;
}

/** Gestor escolhe como o vendedor é avisado no WhatsApp quando recebe um lead/negócio. */
export function SellerTransferWhatsappSettings() {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser() as any;
  const accountId = currentUser?.account_id as string | undefined;
  const [open, setOpen] = useState(false);
  const [priv, setPriv] = useState(false);
  const [group, setGroup] = useState(false);
  const [groupJid, setGroupJid] = useState("");
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["seller-transfer-whatsapp", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const [cfg, phones, users, groups] = await Promise.all([
        db.from("sales_transfer_whatsapp_settings").select("*").eq("account_id", accountId).maybeSingle(),
        db.from("sales_user_whatsapp_phones").select("user_id, phone_e164"),
        db.from("users").select("id, name, user_team_roles(team_roles(name, area))").eq("account_id", accountId).eq("is_active", true).order("name"),
        db.from("zapp_conversations").select("group_jid, contact_name").eq("sector_id", "vendas").eq("is_group", true)
          .not("group_jid", "is", null).order("last_message_at", { ascending: false }).limit(200),
      ]);
      const seen = new Set<string>();
      const groupList = ((groups.data || []) as any[]).filter((g) => !seen.has(g.group_jid) && seen.add(g.group_jid));
      return {
        cfg: cfg.data,
        phones: (phones.data || []) as { user_id: string; phone_e164: string }[],
        users: ((users.data || []) as any[]).filter((u) =>
          (u.user_team_roles || []).some((r: any) => {
            const t = r.team_roles; const n = String(t?.name || "").toLowerCase();
            return t?.area === "Comercial" || n.startsWith("comercial") || n.includes("sdr") || n.includes("closer");
          })).map((u) => ({ id: u.id as string, name: u.name as string })),
        groups: groupList as { group_jid: string; contact_name: string | null }[],
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    setPriv(!!data.cfg?.notify_private);
    setGroup(!!data.cfg?.notify_group);
    setGroupJid(data.cfg?.group_jid || "");
  }, [data]);

  const phoneOf = new Map((data?.phones || []).map((p) => [p.user_id, p.phone_e164]));
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const sellers = (data?.users || []).filter((u) => norm(u.name).includes(norm(search)));
  const groups = (data?.groups || []).filter((g) => norm(g.contact_name || "").includes(norm(groupSearch)));
  const refresh = () => qc.invalidateQueries({ queryKey: ["seller-transfer-whatsapp", accountId] });

  const saveCfg = async (next: { notify_private?: boolean; notify_group?: boolean; group_jid?: string }) => {
    const merged = { notify_private: priv, notify_group: group, group_jid: groupJid, ...next };
    if (merged.notify_group && !merged.group_jid) {
      setGroup(merged.notify_group);
      return; // espera escolher o grupo
    }
    const g = data?.groups.find((x) => x.group_jid === merged.group_jid);
    const { error } = await db.from("sales_transfer_whatsapp_settings").upsert({
      account_id: accountId,
      notify_private: merged.notify_private,
      notify_group: merged.notify_group,
      group_jid: merged.group_jid || null,
      group_name: g?.contact_name || null,
      updated_at: new Date().toISOString(),
    });
    if (error) return toast.error("Não foi possível salvar. Tente novamente.");
    toast.success("Preferência salva");
    refresh();
  };

  const addPhone = async () => {
    const e164 = toE164(phone);
    if (!e164) return toast.error("Número inválido. Use DDD + número.");
    const { error } = await db.from("sales_user_whatsapp_phones").upsert({ user_id: userId, account_id: accountId, phone_e164: e164, updated_at: new Date().toISOString() });
    if (error) return toast.error("Não foi possível salvar o número.");
    setPhone(""); setUserId("");
    refresh();
  };
  const removePhone = async (uid: string) => {
    const { error } = await db.from("sales_user_whatsapp_phones").delete().eq("user_id", uid);
    if (error) return toast.error("Não foi possível remover.");
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          <BellRing className="h-3.5 w-3.5" />
          Aviso ao vendedor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Aviso ao vendedor no WhatsApp</DialogTitle>
          <DialogDescription>Quando um lead ou negócio é transferido, o vendedor recebe um aviso. Ative uma ou as duas opções.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <Tabs defaultValue="sellers" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sellers">Vendedores</TabsTrigger>
              <TabsTrigger value="group">Grupo do time</TabsTrigger>
            </TabsList>

            <TabsContent value="sellers" className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <Label htmlFor="stw-private" className="text-sm font-medium">Avisar no WhatsApp de cada vendedor</Label>
                <Switch id="stw-private" checked={priv} onCheckedChange={(v) => { setPriv(v); saveCfg({ notify_private: v }); }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {(data?.users || []).filter((u: any) => phoneOf.has(u.id)).length} de {(data?.users || []).length} vendedores com número ativo para envio
              </p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar vendedor" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {sellers.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nenhum vendedor encontrado.</p>}
                {sellers.map((u) => {
                  const saved = phoneOf.get(u.id);
                  const editing = userId === u.id;
                  return (
                    <div key={u.id} className="rounded-md border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.name}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            {saved ? (
                              <>
                                <Badge className="h-5 gap-1 rounded-full px-1.5 text-[10px] font-medium">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Ativo p/ envio
                                </Badge>
                                <span className="truncate text-xs text-muted-foreground">{formatPhoneE164(saved)}</span>
                              </>
                            ) : (
                              <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px] font-medium text-muted-foreground">Sem número</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setUserId(editing ? "" : u.id); setPhone(saved || ""); }}>
                            {saved ? "Editar" : <><Plus className="mr-1 h-3.5 w-3.5" />Número</>}
                          </Button>
                          {saved && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removePhone(u.id)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </div>
                      {editing && (
                        <div className="mt-2 flex gap-2">
                          <Input autoFocus className="h-9 flex-1" placeholder="DDD + número" value={phone} onChange={(e) => setPhone(e.target.value)} />
                          <Button size="sm" className="h-9" disabled={phone.replace(/\D/g, "").length < 10} onClick={addPhone}>Salvar</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="group" className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <Label htmlFor="stw-group" className="text-sm font-medium">Avisar em um grupo do time</Label>
                <Switch id="stw-group" checked={group} onCheckedChange={(v) => { setGroup(v); saveCfg({ notify_group: v }); }} />
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar grupo" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} />
              </div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {groups.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nenhum grupo encontrado.</p>}
                {groups.map((g) => {
                  const active = g.group_jid === groupJid;
                  return (
                    <button
                      key={g.group_jid}
                      type="button"
                      onClick={() => { setGroupJid(g.group_jid); saveCfg({ group_jid: g.group_jid }); }}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${active ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
                    >
                      <span className="truncate">{g.contact_name || "Grupo sem nome"}</span>
                      {active && <span className="shrink-0 text-xs font-medium text-primary">Selecionado</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">O número do Comercial precisa estar dentro do grupo.</p>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
