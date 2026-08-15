import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Pencil, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CompanyRow {
  id: string;
  legal_name: string;
  trade_name: string | null;
  document: string;
  email: string | null;
  phone: string | null;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  ie: string | null;
  im: string | null;
  tax_regime: string | null;
  is_default: boolean;
  is_active: boolean;
}

const TAX_REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
];

const emptyForm = {
  legal_name: "",
  trade_name: "",
  document: "",
  email: "",
  phone: "",
  address_zip: "",
  address_street: "",
  address_number: "",
  address_neighborhood: "",
  address_city: "",
  address_state: "",
  ie: "",
  im: "",
  tax_regime: "simples_nacional",
  is_default: false,
  is_active: true,
};

export function CompaniesManager() {
  const { currentUser } = useCurrentUser();
  const { refresh } = useCompany();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const accountId = currentUser?.account_id;

  const fetchRows = async () => {
    if (!accountId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("account_id", accountId)
      .order("is_default", { ascending: false })
      .order("legal_name");
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar empresas");
      return;
    }
    setRows((data || []) as CompanyRow[]);
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setOpen(true);
  };

  const openEdit = (row: CompanyRow) => {
    setEditingId(row.id);
    setForm({
      legal_name: row.legal_name || "",
      trade_name: row.trade_name || "",
      document: row.document || "",
      email: row.email || "",
      phone: row.phone || "",
      address_zip: row.address_zip || "",
      address_street: row.address_street || "",
      address_number: row.address_number || "",
      address_neighborhood: row.address_neighborhood || "",
      address_city: row.address_city || "",
      address_state: row.address_state || "",
      ie: row.ie || "",
      im: row.im || "",
      tax_regime: row.tax_regime || "simples_nacional",
      is_default: row.is_default,
      is_active: row.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!accountId) return;
    if (!form.legal_name.trim()) {
      toast.error("Razão social é obrigatória");
      return;
    }
    const doc = form.document.replace(/\D/g, "");
    if (doc.length !== 14) {
      toast.error("Informe um CNPJ válido (14 dígitos)");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        account_id: accountId,
        legal_name: form.legal_name.trim(),
        trade_name: form.trade_name.trim() || null,
        document: doc,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address_zip: form.address_zip.trim() || null,
        address_street: form.address_street.trim() || null,
        address_number: form.address_number.trim() || null,
        address_neighborhood: form.address_neighborhood.trim() || null,
        address_city: form.address_city.trim() || null,
        address_state: form.address_state.trim() || null,
        ie: form.ie.trim() || null,
        im: form.im.trim() || null,
        tax_regime: form.tax_regime,
        is_default: form.is_default,
        is_active: form.is_active,
      };

      let savedId = editingId;
      if (editingId) {
        const { error } = await supabase.from("companies").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("companies").insert(payload).select("id").single();
        if (error) throw error;
        savedId = data?.id ?? null;
      }

      // Só uma empresa padrão por conta
      if (form.is_default && savedId) {
        await supabase
          .from("companies")
          .update({ is_default: false })
          .eq("account_id", accountId)
          .neq("id", savedId);
      }

      toast.success(editingId ? "Empresa atualizada" : "Empresa criada");
      setOpen(false);
      await fetchRows();
      await refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  const formatCnpj = (v: string) => {
    const d = (v || "").replace(/\D/g, "");
    if (d.length !== 14) return v;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Empresas (CNPJ)
          </CardTitle>
          <CardDescription>
            Cada produto é vendido por uma empresa. O financeiro e as notas fiscais seguem o CNPJ da empresa.
          </CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Nova empresa
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">Nenhuma empresa cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{row.trade_name || row.legal_name}</span>
                    {row.is_default && <Badge variant="secondary">Padrão</Badge>}
                    {!row.is_active && <Badge variant="outline">Inativa</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.legal_name} · {formatCnpj(row.document)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar empresa" : "Nova empresa"}</DialogTitle>
            <DialogDescription>
              Dados usados em contratos, faturamento e emissão de notas fiscais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Razão social *</Label>
                <Input
                  value={form.legal_name}
                  onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome fantasia</Label>
                <Input
                  value={form.trade_name}
                  onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <Input
                  value={form.document}
                  onChange={(e) => setForm({ ...form, document: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label>Regime tributário</Label>
                <Select
                  value={form.tax_regime}
                  onValueChange={(v) => setForm({ ...form, tax_regime: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {TAX_REGIMES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Inscrição estadual</Label>
                <Input value={form.ie} onChange={(e) => setForm({ ...form, ie: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Inscrição municipal</Label>
                <Input value={form.im} onChange={(e) => setForm({ ...form, im: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Logradouro</Label>
                <Input
                  value={form.address_street}
                  onChange={(e) => setForm({ ...form, address_street: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  value={form.address_number}
                  onChange={(e) => setForm({ ...form, address_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={form.address_neighborhood}
                  onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={form.address_city}
                  onChange={(e) => setForm({ ...form, address_city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input
                  value={form.address_state}
                  maxLength={2}
                  onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={form.address_zip}
                  onChange={(e) => setForm({ ...form, address_zip: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_default}
                  onCheckedChange={(v) => setForm({ ...form, is_default: v })}
                />
                <Label className="cursor-pointer">Empresa padrão</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label className="cursor-pointer">Ativa</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default CompaniesManager;
