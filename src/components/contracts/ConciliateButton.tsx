import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  AlertCircle,
  FileCheck,
  MapPin,
  User,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConciliationValidation } from "@/hooks/useConciliationValidation";

interface ConciliateButtonProps {
  contractId: string;
  clientId?: string;
  validation: ConciliationValidation | undefined;
  onSuccess: () => void;
}

type FormState = {
  cpf: string;
  cnpj: string;
  street: string;
  street_number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  product_id: string;
};

const EMPTY_FORM: FormState = {
  cpf: "",
  cnpj: "",
  street: "",
  street_number: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  product_id: "",
};

export function ConciliateButton({
  contractId,
  clientId,
  validation,
  onSuccess,
}: ConciliateButtonProps) {
  const [isConciliating, setIsConciliating] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [localValidation, setLocalValidation] =
    useState<ConciliationValidation | undefined>(validation);

  useEffect(() => {
    setLocalValidation(validation);
  }, [validation]);

  const canConciliate = localValidation?.canConciliate ?? false;

  const missing = useMemo(() => {
    const items = new Set(
      (localValidation?.missingItems || []).map((s) => s.toLowerCase())
    );
    return {
      entries: [...items].some((s) => s.includes("lançamento")),
      document: [...items].some((s) => s.includes("cpf") || s.includes("cnpj")),
      address: [...items].some((s) => s.includes("endereço")),
      product: [...items].some((s) => s.includes("produto")),
    };
  }, [localValidation]);

  const loadPrefill = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const [clientRes, contractRes, productsRes] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "cpf, cnpj, street, street_number, neighborhood, city, state, zip_code"
          )
          .eq("id", clientId)
          .single(),
        supabase
          .from("client_contracts")
          .select("product_id")
          .eq("id", contractId)
          .single(),
        supabase.from("products").select("id, name").order("name"),
      ]);
      const c: any = clientRes.data || {};
      setForm({
        cpf: c.cpf || "",
        cnpj: c.cnpj || "",
        street: c.street || "",
        street_number: c.street_number || "",
        neighborhood: c.neighborhood || "",
        city: c.city || "",
        state: c.state || "",
        zip_code: c.zip_code || "",
        product_id: (contractRes.data as any)?.product_id || "",
      });
      setProducts(productsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = async () => {
    setErrorMsg(null);
    setOpen(true);
    await loadPrefill();
  };

  const revalidate = async () => {
    if (!clientId) return;
    const [entriesRes, clientRes, contractRes] = await Promise.all([
      supabase
        .from("financial_entries")
        .select("id")
        .eq("client_id", clientId)
        .eq("entry_type", "receivable")
        .limit(1),
      supabase
        .from("clients")
        .select("cpf, cnpj, city, state, zip_code, street")
        .eq("id", clientId)
        .single(),
      supabase
        .from("client_contracts")
        .select("product_id")
        .eq("id", contractId)
        .single(),
    ]);
    const client: any = clientRes.data || {};
    const hasFinancialEntries = (entriesRes.data?.length || 0) > 0;
    const hasDocument = !!(client.cpf || client.cnpj);
    const hasAddress = !!(
      client.city &&
      client.state &&
      client.zip_code &&
      client.street
    );
    const hasProduct = !!(contractRes.data as any)?.product_id;
    const missingItems: string[] = [];
    if (!hasFinancialEntries) missingItems.push("Lançamentos financeiros");
    if (!hasDocument) missingItems.push("CPF ou CNPJ");
    if (!hasAddress) missingItems.push("Endereço completo");
    if (!hasProduct) missingItems.push("Produto vinculado");
    setLocalValidation({
      canConciliate: missingItems.length === 0,
      missingItems,
      hasFinancialEntries,
      hasDocument,
      hasAddress,
      hasProduct,
      isLoading: false,
    });
  };

  const handleSavePending = async () => {
    if (!clientId) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const clientUpdate: Record<string, any> = {};
      if (missing.document) {
        if (form.cpf) clientUpdate.cpf = form.cpf.trim();
        if (form.cnpj) clientUpdate.cnpj = form.cnpj.trim();
      }
      if (missing.address) {
        clientUpdate.street = form.street.trim();
        clientUpdate.street_number = form.street_number.trim();
        clientUpdate.neighborhood = form.neighborhood.trim();
        clientUpdate.city = form.city.trim();
        clientUpdate.state = form.state.trim().toUpperCase();
        clientUpdate.zip_code = form.zip_code.trim();
      }
      if (Object.keys(clientUpdate).length > 0) {
        const { error } = await supabase
          .from("clients")
          .update(clientUpdate)
          .eq("id", clientId);
        if (error) throw error;
      }
      if (missing.product && form.product_id) {
        const { error } = await supabase
          .from("client_contracts")
          .update({ product_id: form.product_id })
          .eq("id", contractId);
        if (error) throw error;
      }
      toast.success("Dados atualizados");
      await revalidate();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Erro ao salvar dados");
    } finally {
      setSaving(false);
    }
  };

  const handleConciliate = async () => {
    if (!localValidation?.canConciliate) return;
    setIsConciliating(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from("client_contracts")
        .update({
          receivables_generated: true,
          receivables_generated_at: new Date().toISOString(),
        })
        .eq("id", contractId);
      if (error) throw error;
      toast.success("Contrato marcado como conciliado");
      setOpen(false);
      onSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Erro ao atualizar o contrato");
    } finally {
      setIsConciliating(false);
    }
  };

  if (validation?.isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        Verificando...
      </Button>
    );
  }

  const set = (k: keyof FormState) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="hidden xl:flex items-center gap-1.5">
          {[
            {
              ok: localValidation?.hasFinancialEntries,
              icon: FileCheck,
              okLabel: "Lançamentos financeiros gerados",
              pendingLabel: "Lançamentos financeiros pendentes",
            },
            {
              ok: localValidation?.hasDocument,
              icon: User,
              okLabel: "CPF/CNPJ preenchido",
              pendingLabel: "CPF ou CNPJ pendente",
            },
            {
              ok: localValidation?.hasAddress,
              icon: MapPin,
              okLabel: "Endereço completo",
              pendingLabel: "Endereço pendente",
            },
            {
              ok: localValidation?.hasProduct,
              icon: Package,
              okLabel: "Produto vinculado",
              pendingLabel: "Produto pendente",
            },
          ].map((s, i) => (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      s.ok
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-amber-100 text-amber-600"
                    )}
                  >
                    <s.icon className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {s.ok ? s.okLabel : s.pendingLabel}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        <Button
          variant={canConciliate ? "default" : "outline"}
          size="sm"
          disabled={isConciliating}
          onClick={(e) => {
            e.stopPropagation();
            if (canConciliate) {
              handleConciliate();
            } else {
              openDialog();
            }
          }}
          className={cn(!canConciliate && "border-amber-300 text-amber-700")}
        >
          {isConciliating ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : canConciliate ? (
            <Check className="h-4 w-4 mr-1" />
          ) : (
            <AlertCircle className="h-4 w-4 mr-1" />
          )}
          Conciliar
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-xl max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Complete os dados para conciliar
            </DialogTitle>
            <DialogDescription>
              Preencha as pendências abaixo e conclua a conciliação sem sair
              desta tela.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Carregando dados...
            </div>
          ) : (
            <div className="space-y-5">
              {missing.document && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-amber-500" /> CPF ou CNPJ
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">CPF</Label>
                      <Input
                        value={form.cpf}
                        onChange={(e) => set("cpf")(e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CNPJ</Label>
                      <Input
                        value={form.cnpj}
                        onChange={(e) => set("cnpj")(e.target.value)}
                        placeholder="00.000.000/0000-00"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Basta preencher um dos dois.
                  </p>
                </section>
              )}

              {missing.address && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-amber-500" /> Endereço
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    <div className="col-span-4">
                      <Label className="text-xs">Rua</Label>
                      <Input
                        value={form.street}
                        onChange={(e) => set("street")(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Número</Label>
                      <Input
                        value={form.street_number}
                        onChange={(e) => set("street_number")(e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={form.neighborhood}
                        onChange={(e) => set("neighborhood")(e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">CEP</Label>
                      <Input
                        value={form.zip_code}
                        onChange={(e) => set("zip_code")(e.target.value)}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="col-span-4">
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        value={form.city}
                        onChange={(e) => set("city")(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">UF</Label>
                      <Input
                        maxLength={2}
                        value={form.state}
                        onChange={(e) =>
                          set("state")(e.target.value.toUpperCase())
                        }
                      />
                    </div>
                  </div>
                </section>
              )}

              {missing.product && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4 text-amber-500" /> Produto do
                    contrato
                  </div>
                  <Select
                    value={form.product_id}
                    onValueChange={(v) => set("product_id")(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>
              )}

              {missing.entries && (
                <section className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2 font-medium text-amber-800">
                    <FileCheck className="h-4 w-4" /> Lançamentos financeiros
                    pendentes
                  </div>
                  <p className="text-xs text-amber-700">
                    Este contrato ainda não gerou parcelas no financeiro. Abra o
                    contrato e ative "Gerar recebíveis" para criar as parcelas
                    antes de conciliar.
                  </p>
                </section>
              )}

              {canConciliate &&
                !missing.document &&
                !missing.address &&
                !missing.product &&
                !missing.entries && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
                    <Check className="h-4 w-4" /> Tudo pronto! Clique em
                    "Conciliar" para finalizar.
                  </div>
                )}

              {errorMsg && (
                <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3 border border-destructive/20">
                  {errorMsg}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            {(missing.document || missing.address || missing.product) && (
              <Button
                variant="outline"
                onClick={handleSavePending}
                disabled={saving || loading}
              >
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Salvar dados
              </Button>
            )}
            <Button
              onClick={handleConciliate}
              disabled={!canConciliate || isConciliating}
            >
              {isConciliating && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Conciliar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
