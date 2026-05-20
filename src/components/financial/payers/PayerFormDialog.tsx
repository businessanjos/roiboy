import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Payer {
  id?: string;
  document_type: "cpf" | "cnpj";
  document: string;
  legal_name: string;
  trade_name?: string | null;
  email_billing?: string | null;
  phone_billing?: string | null;
  address_zip?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  ie?: string | null;
  im?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payer?: Payer | null;
  defaultClientId?: string;
  onSaved?: (payerId: string) => void;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export function PayerFormDialog({ open, onOpenChange, payer, defaultClientId, onSaved }: Props) {
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Payer>({
    document_type: "cpf",
    document: "",
    legal_name: "",
  });

  useEffect(() => {
    if (payer) setForm(payer);
    else setForm({ document_type: "cpf", document: "", legal_name: "" });
  }, [payer, open]);

  const handleSave = async () => {
    if (!accountId) return;
    const doc = onlyDigits(form.document);
    if (form.document_type === "cpf" && doc.length !== 11) {
      toast({ title: "CPF inválido", description: "CPF deve ter 11 dígitos.", variant: "destructive" });
      return;
    }
    if (form.document_type === "cnpj" && doc.length !== 14) {
      toast({ title: "CNPJ inválido", description: "CNPJ deve ter 14 dígitos.", variant: "destructive" });
      return;
    }
    if (!form.legal_name.trim()) {
      toast({ title: "Razão social obrigatória", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, document: doc, account_id: accountId };
      let payerId = payer?.id;
      if (payer?.id) {
        const { error } = await supabase.from("payers").update(payload).eq("id", payer.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("payers").insert(payload).select("id").single();
        if (error) throw error;
        payerId = data.id;
      }

      // Vincular ao cliente se contexto fornecido
      if (defaultClientId && payerId) {
        await supabase.from("client_payers").upsert(
          {
            account_id: accountId,
            client_id: defaultClientId,
            payer_id: payerId,
            relationship: "self",
            is_default: true,
          },
          { onConflict: "client_id,payer_id" }
        );
      }

      toast({ title: payer?.id ? "Pagador atualizado" : "Pagador criado" });
      onSaved?.(payerId!);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{payer?.id ? "Editar Pagador" : "Novo Pagador"}</DialogTitle>
          <DialogDescription>
            Quem paga pela contratação. Separado de quem usa (cliente). Usado para emissão de NF e cobrança.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={form.document_type} onValueChange={(v: "cpf" | "cnpj") => setForm({ ...form, document_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{form.document_type === "cpf" ? "CPF" : "CNPJ"} *</Label>
            <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Razão Social / Nome completo *</Label>
            <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
          </div>
          {form.document_type === "cnpj" && (
            <div className="md:col-span-2">
              <Label>Nome Fantasia</Label>
              <Input value={form.trade_name || ""} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
            </div>
          )}
          <div>
            <Label>E-mail (cobrança)</Label>
            <Input type="email" value={form.email_billing || ""} onChange={(e) => setForm({ ...form, email_billing: e.target.value })} />
          </div>
          <div>
            <Label>Telefone (cobrança)</Label>
            <Input value={form.phone_billing || ""} onChange={(e) => setForm({ ...form, phone_billing: e.target.value })} />
          </div>
          <div>
            <Label>CEP</Label>
            <Input value={form.address_zip || ""} onChange={(e) => setForm({ ...form, address_zip: e.target.value })} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.address_city || ""} onChange={(e) => setForm({ ...form, address_city: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.address_street || ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} placeholder="Rua, número, complemento" />
          </div>
          <div>
            <Label>UF</Label>
            <Input value={form.address_state || ""} maxLength={2} onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={form.address_neighborhood || ""} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
