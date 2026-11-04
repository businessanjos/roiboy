import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  accountId: string;
  currentName: string;
  phone: string | null;
  isNotClient: boolean;
}

/** Edita o nome do contato da conversa e marca "Não é cliente" (número interno). */
export function ZappEditContactDialog({ open, onOpenChange, conversationId, accountId, currentName, phone, isNotClient }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(currentName);
  const [notClient, setNotClient] = useState(isNotClient);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(currentName); setNotClient(isNotClient); }
  }, [open, currentName, isNotClient]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Informe o nome do contato"); return; }
    setSaving(true);
    try {
      const update: Record<string, unknown> = { contact_name: trimmed };
      if (notClient && !isNotClient) update.client_id = null;
      const { error } = await supabase.from("zapp_conversations").update(update).eq("id", conversationId);
      if (error) throw error;

      if (phone && notClient !== isNotClient) {
        if (notClient) {
          const { error: e } = await supabase.from("zapp_internal_contacts")
            .insert({ account_id: accountId, phone_e164: phone, label: trimmed });
          if (e) throw e;
        } else {
          const { error: e } = await supabase.from("zapp_internal_contacts")
            .delete().eq("account_id", accountId).eq("phone_e164", phone);
          if (e) throw e;
        }
        qc.invalidateQueries({ queryKey: ["zapp-internal-contact-cores"] });
      }
      qc.invalidateQueries({ queryKey: ["zapp-conversations"] });
      toast.success(notClient ? "Contato salvo como não cliente" : "Contato atualizado");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Não foi possível salvar", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
          <DialogDescription>{phone || "Sem telefone"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="zapp-contact-name">Nome do contato</Label>
            <Input id="zapp-contact-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Não é cliente</p>
              <p className="text-xs text-muted-foreground">
                Não conta em clientes, gráficos e produtividade.
              </p>
            </div>
            <Switch checked={notClient} onCheckedChange={setNotClient} disabled={!phone} aria-label="Não é cliente" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
