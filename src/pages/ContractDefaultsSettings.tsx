import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

interface DefaultsForm {
  company_name?: string;
  company_cnpj?: string;
  company_address?: string;
  company_representative?: string;
  company_representative_cpf?: string;
  company_email?: string;
  default_jurisdiction?: string;
  bank_banco?: string;
  bank_agencia?: string;
  bank_conta?: string;
  bank_pix?: string;
}

export default function ContractDefaultsSettings() {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DefaultsForm>({});
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!currentUser?.account_id) return;
      const { data } = await supabase
        .from("contract_company_defaults")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        const bank: any = (data as any).company_bank_info ?? {};
        setForm({
          company_name: data.company_name ?? "",
          company_cnpj: data.company_cnpj ?? "",
          company_address: data.company_address ?? "",
          company_representative: data.company_representative ?? "",
          company_representative_cpf: data.company_representative_cpf ?? "",
          company_email: data.company_email ?? "",
          default_jurisdiction: data.default_jurisdiction ?? "",
          bank_banco: bank.banco ?? "",
          bank_agencia: bank.agencia ?? "",
          bank_conta: bank.conta ?? "",
          bank_pix: bank.pix ?? "",
        });
      }
      setLoading(false);
    }
    load();
  }, [currentUser?.account_id]);

  const set = (k: keyof DefaultsForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);
    try {
      const payload = {
        account_id: currentUser.account_id,
        company_name: form.company_name || null,
        company_cnpj: form.company_cnpj || null,
        company_address: form.company_address || null,
        company_representative: form.company_representative || null,
        company_representative_cpf: form.company_representative_cpf || null,
        company_email: form.company_email || null,
        default_jurisdiction: form.default_jurisdiction || null,
        company_bank_info: {
          banco: form.bank_banco || "",
          agencia: form.bank_agencia || "",
          conta: form.bank_conta || "",
          pix: form.bank_pix || "",
        },
      };
      if (existingId) {
        const { error } = await supabase
          .from("contract_company_defaults")
          .update(payload)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("contract_company_defaults")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setExistingId(data.id);
      }
      toast.success("Padrões salvos");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">Contratos Digitais — Padrões da CONTRATADA</h1>
        <p className="text-xs text-muted-foreground">
          Estes dados serão usados como padrão ao gerar novos contratos a partir de Deals.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Razão social</Label>
            <Input value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">CNPJ</Label>
            <Input value={form.company_cnpj ?? ""} onChange={(e) => set("company_cnpj", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Endereço</Label>
            <Input value={form.company_address ?? ""} onChange={(e) => set("company_address", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Representante</Label>
            <Input value={form.company_representative ?? ""} onChange={(e) => set("company_representative", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">CPF do representante</Label>
            <Input value={form.company_representative_cpf ?? ""} onChange={(e) => set("company_representative_cpf", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">E-mail</Label>
            <Input value={form.company_email ?? ""} onChange={(e) => set("company_email", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Foro padrão (cidade/UF)</Label>
            <Input value={form.default_jurisdiction ?? ""} onChange={(e) => set("default_jurisdiction", e.target.value)} />
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs font-semibold mb-2">Dados bancários para pagamento</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Banco</Label>
              <Input value={form.bank_banco ?? ""} onChange={(e) => set("bank_banco", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Agência</Label>
              <Input value={form.bank_agencia ?? ""} onChange={(e) => set("bank_agencia", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Conta</Label>
              <Input value={form.bank_conta ?? ""} onChange={(e) => set("bank_conta", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">PIX</Label>
              <Input value={form.bank_pix ?? ""} onChange={(e) => set("bank_pix", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Salvar padrões
          </Button>
        </div>
      </Card>
    </div>
  );
}
