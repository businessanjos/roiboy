import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const db = supabase as any;

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

  const { data, isLoading } = useQuery({
    queryKey: ["seller-transfer-whatsapp", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const [cfg, phones, users, groups] = await Promise.all([
        db.from("sales_transfer_whatsapp_settings").select("*").eq("account_id", accountId).maybeSingle(),
        db.from("sales_user_whatsapp_phones").select("user_id, phone_e164"),
        db.from("users").select("id, name").eq("account_id", accountId).eq("is_active", true).order("name"),
        db.from("zapp_conversations").select("group_jid, contact_name").eq("sector_id", "vendas").eq("is_group", true)
          .not("group_jid", "is", null).order("last_message_at", { ascending: false }).limit(200),
      ]);
      const seen = new Set<string>();
      const groupList = ((groups.data || []) as any[]).filter((g) => !seen.has(g.group_jid) && seen.add(g.group_jid));
      return {
        cfg: cfg.data,
        phones: (phones.data || []) as { user_id: string; phone_e164: string }[],
        users: (users.data || []) as { id: string; name: string }[],
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

  const names = new Map((data?.users || []).map((u) => [u.id, u.name]));
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
          <div className="space-y-5">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="stw-private" className="text-sm font-medium">No WhatsApp de cada vendedor</Label>
                <Switch id="stw-private" checked={priv} onCheckedChange={(v) => { setPriv(v); saveCfg({ notify_private: v }); }} />
              </div>
              {priv && (
                <div className="space-y-2">
                  {(data?.phones || []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum número cadastrado ainda.</p>}
                  {(data?.phones || []).map((p) => (
                    <div key={p.user_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="min-w-0 truncate"><strong>{names.get(p.user_id) || "Vendedor"}</strong> · {p.phone_e164}</span>
                      <Button size="icon" variant="ghost" onClick={() => removePhone(p.user_id)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
                    <option value="">Escolha o vendedor</option>
                    {(data?.users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input className="flex-1" placeholder="WhatsApp com DDD, ex: 11 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <Button disabled={!userId || phone.replace(/\D/g, "").length < 10} onClick={addPhone}>
                      <Plus className="mr-1 h-4 w-4" /> Adicionar
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="stw-group" className="text-sm font-medium">Em um grupo do time</Label>
                <Switch id="stw-group" checked={group} onCheckedChange={(v) => { setGroup(v); saveCfg({ notify_group: v }); }} />
              </div>
              {group && (
                <div className="space-y-1">
                  <select
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={groupJid}
                    onChange={(e) => { setGroupJid(e.target.value); saveCfg({ group_jid: e.target.value }); }}
                  >
                    <option value="">Escolha o grupo</option>
                    {(data?.groups || []).map((g) => <option key={g.group_jid} value={g.group_jid}>{g.contact_name || "Grupo sem nome"}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">O número do Comercial precisa estar dentro do grupo.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
