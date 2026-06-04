import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TrafficAgency } from "@/hooks/useTrafficAgencies";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agency?: TrafficAgency | null;
}

const DEFAULT_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#14b8a6"];

export function AgencyFormDialog({ open, onOpenChange, agency }: Props) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    color: DEFAULT_COLORS[0],
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    notes: "",
    is_active: true,
    name_patterns_text: "",
  });

  useEffect(() => {
    if (agency) {
      setForm({
        name: agency.name ?? "",
        color: agency.color ?? DEFAULT_COLORS[0],
        contact_name: agency.contact_name ?? "",
        contact_email: agency.contact_email ?? "",
        contact_phone: agency.contact_phone ?? "",
        notes: agency.notes ?? "",
        is_active: agency.is_active,
        name_patterns_text: (agency.name_patterns ?? []).join("\n"),
      });
    } else {
      setForm({
        name: "",
        color: DEFAULT_COLORS[0],
        contact_name: "",
        contact_email: "",
        contact_phone: "",
        notes: "",
        is_active: true,
        name_patterns_text: "",
      });
    }
  }, [agency, open]);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const sb: any = supabase;
    const { name_patterns_text, ...rest } = form;
    const name_patterns = name_patterns_text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = { ...rest, name_patterns };
    try {
      if (agency) {
        const { error } = await sb.from("traffic_agencies").update(payload).eq("id", agency.id);
        if (error) throw error;
        await sb.rpc("apply_agency_rules", { p_account_id: agency.account_id });
        toast.success("Agência atualizada — regras reaplicadas");
      } else {
        const { error } = await sb
          .from("traffic_agencies")
          .insert({ ...payload, account_id: currentUser!.account_id });
        if (error) throw error;
        await sb.rpc("apply_agency_rules", { p_account_id: currentUser!.account_id });
        toast.success("Agência criada");
      }
      qc.invalidateQueries({ queryKey: ["traffic-agencies"] });
      qc.invalidateQueries({ queryKey: ["marketing-ad-sets"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{agency ? "Editar agência" : "Nova agência de tráfego"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-12 h-8 p-0.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contato</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
          </div>
          <div>
            <Label>Padrões de nome de campanha (um por linha)</Label>
            <Textarea
              value={form.name_patterns_text}
              onChange={(e) => setForm({ ...form, name_patterns_text: e.target.value })}
              rows={3}
              placeholder={"Ex.:\nSN -\n[AMO]\nAnjos-"}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Toda campanha Meta cujo nome começa com algum desses prefixos (case-insensitive) é atribuída automaticamente a esta agência.
            </p>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativa</Label>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
