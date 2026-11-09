import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import type { ClientField, ProcessClient } from "@/lib/csClientLinks";

const FIELDS: { key: Exclude<ClientField, "responsible_user_id">; label: string; placeholder: string }[] = [
  { key: "instagram", label: "@ do Instagram", placeholder: "clinica.exemplo" },
  { key: "ryka_url", label: "Link da Clínica Ryka", placeholder: "https://ryka.app/..." },
  { key: "platform_login", label: "Login da plataforma", placeholder: "e-mail ou usuário" },
  { key: "phone_e164", label: "Telefone/WhatsApp", placeholder: "+55 11 99999-9999" },
];

/** Dados da cliente usados pelos processos. Salva só os campos alterados na ficha da cliente. */
export function ClientProcessDataDialog({ client, focus, open, onOpenChange }: { client: ProcessClient | null; focus?: ClientField; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const { data: team = [] } = useQuery({
    queryKey: ["cs-process-team", currentUser?.account_id], enabled: open && !!currentUser?.account_id,
    queryFn: async () => (await supabase.from("users").select("id, name").eq("account_id", currentUser!.account_id).order("name")).data ?? [],
  });
  useEffect(() => {
    if (!open || !client) return;
    setForm({ instagram: client.instagram ?? "", ryka_url: client.ryka_url ?? "", platform_login: client.platform_login ?? "", phone_e164: client.phone_e164 ?? "", responsible_user_id: client.responsible_user_id ?? "" });
    setTimeout(() => focus && refs.current[focus]?.focus(), 150);
  }, [open, client, focus]);
  if (!client) return null;
  const save = async () => {
    const patch: Record<string, string | null> = {};
    for (const k of Object.keys(form)) {
      let v = form[k].trim(); if (k === "instagram") v = v.replace(/^@/, "");
      if ((v || null) !== ((client as any)[k] ?? null)) patch[k] = v || null;
    }
    if (!Object.keys(patch).length) { onOpenChange(false); return; }
    setSaving(true);
    const { error } = await supabase.from("clients").update(patch as any).eq("id", client.id);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar os dados da cliente."); return; }
    toast.success("Dados da cliente atualizados");
    qc.invalidateQueries({ queryKey: ["cs-process-client"] });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dados da cliente para os processos</DialogTitle>
          <DialogDescription>Atualize as informações de {client.full_name} usadas nos links e nas mensagens.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>ID no Roy</Label><Input value={client.id} readOnly className="font-mono text-xs" /></div>
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`cpd-${f.key}`}>{f.label}</Label>
              <Input id={`cpd-${f.key}`} ref={(el) => (refs.current[f.key] = el)} value={form[f.key] ?? ""} placeholder={f.placeholder}
                className={focus === f.key ? "ring-2 ring-primary" : ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1">
            <Label>Consultora responsável</Label>
            <Select value={form.responsible_user_id || "none"} onValueChange={(v) => setForm({ ...form, responsible_user_id: v === "none" ? "" : v })}>
              <SelectTrigger className={focus === "responsible_user_id" ? "ring-2 ring-primary" : ""}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {team.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving} onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
