import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, GraduationCap, Sparkles, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DigitalContractData } from "./ContractDocument";

type AddressParts = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  numero: string;
  complemento: string;
};

const EMPTY_PARTS: AddressParts = {
  cep: "",
  logradouro: "",
  bairro: "",
  cidade: "",
  uf: "",
  numero: "",
  complemento: "",
};

const formatCep = (v: string) => {
  const d = (v || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

const composeAddress = (p: AddressParts): string => {
  const street = [p.logradouro, p.numero].filter(Boolean).join(", ");
  const tail = [p.complemento, p.bairro].filter(Boolean).join(" - ");
  const cityUf = [p.cidade, p.uf].filter(Boolean).join("/");
  return [street, tail, cityUf, p.cep ? `CEP ${p.cep}` : ""]
    .filter(Boolean)
    .join(", ");
};

export interface MenteeContractFieldsProps {
  data: DigitalContractData;
  onChange: (next: DigitalContractData) => void;
  disabled?: boolean;
  dealId?: string;
  /** When true, render a compact step header (used inside the wizard). */
  withStepHeader?: boolean;
}

/**
 * Shared "Mentorado" + "Renovação e testemunhas" form.
 * Used both as a wizard step (between Cliente and Pagamento) and from the
 * legacy ContractEditor view as a fallback.
 */
export const MenteeContractFields = ({
  data,
  onChange,
  disabled,
  dealId,
  withStepHeader,
}: MenteeContractFieldsProps) => {
  const [copyingBilling, setCopyingBilling] = useState(false);
  const [billingTipo, setBillingTipo] = useState<string | null>(null);
  const [billingChecked, setBillingChecked] = useState(false);
  const [addr, setAddr] = useState<AddressParts>(EMPTY_PARTS);
  const [cepLoading, setCepLoading] = useState(false);
  const lastCepRef = useRef<string>("");
  const userEditedRef = useRef(false);

  // Initialize from existing client_address only once on mount.
  useEffect(() => {
    if (data.client_address && !addr.logradouro && !addr.numero && !addr.cep) {
      // Best-effort parse: try extract CEP from existing string.
      const cepMatch = (data.client_address || "").match(/(\d{5})-?(\d{3})/);
      if (cepMatch) {
        setAddr((p) => ({ ...p, cep: `${cepMatch[1]}-${cepMatch[2]}` }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compose and persist the address string when parts change (after user edits).
  useEffect(() => {
    if (!userEditedRef.current) return;
    const composed = composeAddress(addr);
    if (composed !== (data.client_address ?? "")) {
      onChange({ ...data, client_address: composed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr]);

  const updateAddr = (patch: Partial<AddressParts>) => {
    userEditedRef.current = true;
    setAddr((prev) => ({ ...prev, ...patch }));
  };

  const lookupCep = async (raw: string) => {
    const digits = (raw || "").replace(/\D/g, "");
    if (digits.length !== 8) return;
    if (lastCepRef.current === digits) return;
    lastCepRef.current = digits;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = await res.json();
      if (json?.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      userEditedRef.current = true;
      setAddr((prev) => ({
        ...prev,
        cep: formatCep(digits),
        logradouro: json.logradouro || "",
        bairro: json.bairro || "",
        cidade: json.localidade || "",
        uf: json.uf || "",
      }));
    } catch {
      toast.error("Falha ao buscar CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchTipo = async () => {
      if (!dealId) {
        setBillingTipo(null);
        setBillingChecked(true);
        return;
      }
      try {
        const { data: cf } = await supabase
          .from("custom_fields")
          .select("id")
          .eq("name", "Tipo de Pessoa (NF)")
          .maybeSingle();
        if (!cf?.id) {
          if (!cancelled) {
            setBillingTipo(null);
            setBillingChecked(true);
          }
          return;
        }
        const { data: val } = await supabase
          .from("deal_field_values")
          .select("value_text")
          .eq("deal_id", dealId)
          .eq("field_id", cf.id)
          .maybeSingle();
        if (!cancelled) {
          setBillingTipo((val?.value_text || "").toLowerCase() || null);
          setBillingChecked(true);
        }
      } catch {
        if (!cancelled) {
          setBillingTipo(null);
          setBillingChecked(true);
        }
      }
    };
    fetchTipo();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const isBillingCpf = billingTipo === "cpf";

  const update = <K extends keyof DigitalContractData>(field: K, value: DigitalContractData[K]) => {
    onChange({ ...data, [field]: value });
  };

  const copyFromBilling = async () => {
    if (!dealId) {
      toast.error("Negócio não identificado.");
      return;
    }
    setCopyingBilling(true);
    try {
      const names = ["Tipo de Pessoa (NF)", "CPF/CNPJ (NF)", "Razão Social / Nome (NF)", "E-mail para envio da NF"];
      const { data: cf } = await supabase
        .from("custom_fields")
        .select("id, name")
        .in("name", names);
      const idByName: Record<string, string> = {};
      (cf || []).forEach((f: any) => {
        idByName[f.name] = f.id;
      });
      const fieldIds = Object.values(idByName);
      if (fieldIds.length === 0) {
        toast.error("Campos de faturamento não encontrados.");
        return;
      }
      const { data: vals } = await supabase
        .from("deal_field_values")
        .select("field_id, value_text")
        .eq("deal_id", dealId)
        .in("field_id", fieldIds);
      const valByName: Record<string, string> = {};
      (vals || []).forEach((v: any) => {
        const name = Object.entries(idByName).find(([, id]) => id === v.field_id)?.[0];
        if (name) valByName[name] = v.value_text || "";
      });
      const tipo = (valByName["Tipo de Pessoa (NF)"] || "").toLowerCase();
      if (tipo && tipo !== "cpf") {
        toast.error("O faturamento é PJ. O Mentorado deve ser sempre Pessoa Física — preencha manualmente.");
        return;
      }
      const cpf = valByName["CPF/CNPJ (NF)"] || "";
      const nome = valByName["Razão Social / Nome (NF)"] || "";
      const email = valByName["E-mail para envio da NF"] || "";
      if (!cpf && !nome && !email) {
        toast.error("Sem dados de faturamento preenchidos para copiar.");
        return;
      }
      onChange({
        ...data,
        client_name: nome || data.client_name,
        client_cpf_cnpj: cpf || data.client_cpf_cnpj,
        client_email: email || data.client_email,
      });
      toast.success("Dados copiados do faturamento.");
    } catch (e: any) {
      toast.error("Erro ao copiar: " + (e?.message ?? "tente novamente"));
    } finally {
      setCopyingBilling(false);
    }
  };

  return (
    <fieldset disabled={disabled} className="space-y-5">
      {withStepHeader && (
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Mentorado</h3>
            <p className="text-xs text-muted-foreground">
              O mentorado é sempre Pessoa Física. Se o faturamento foi feito no CPF do mentorado, copie os dados abaixo.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {!withStepHeader && (
            <legend className="text-sm font-semibold text-foreground">Mentorado</legend>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyFromBilling}
            disabled={disabled || copyingBilling || !dealId || !billingChecked || !isBillingCpf}
            className="h-8 text-xs ml-auto"
            title={!isBillingCpf && billingChecked ? "Disponível apenas quando o faturamento é CPF" : undefined}
          >
            {copyingBilling ? (
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            ) : (
              <Copy className="w-3 h-3 mr-1.5" />
            )}
            Copiar do Faturamento (CPF)
          </Button>
        </div>
        {!withStepHeader && (
          <p className="text-[11px] text-muted-foreground">
            O mentorado é sempre Pessoa Física. Se o faturamento foi feito no CPF do mentorado, use o botão acima para copiar os dados.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Nome completo</Label>
            <Input
              value={data.client_name ?? ""}
              onChange={(e) => update("client_name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CPF</Label>
            <Input
              value={data.client_cpf_cnpj ?? ""}
              onChange={(e) => update("client_cpf_cnpj", e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input
              value={data.client_email ?? ""}
              onChange={(e) => update("client_email", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-3 rounded-md border border-border/60 p-3 bg-muted/20">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">CEP</Label>
              <div className="relative">
                <Input
                  value={addr.cep}
                  inputMode="numeric"
                  placeholder="00000-000"
                  onChange={(e) => {
                    const formatted = formatCep(e.target.value);
                    updateAddr({ cep: formatted });
                    const digits = formatted.replace(/\D/g, "");
                    if (digits.length === 8) lookupCep(digits);
                  }}
                  onBlur={(e) => lookupCep(e.target.value)}
                />
                {cepLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Search className="h-3 w-3" /> Digite o CEP para preencher automaticamente
              </p>
            </div>
            <div className="sm:col-span-4 space-y-1.5">
              <Label className="text-xs">Logradouro</Label>
              <Input
                value={addr.logradouro}
                onChange={(e) => updateAddr({ logradouro: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Número</Label>
              <Input
                value={addr.numero}
                onChange={(e) => updateAddr({ numero: e.target.value })}
                placeholder="123"
              />
            </div>
            <div className="sm:col-span-4 space-y-1.5">
              <Label className="text-xs">Complemento</Label>
              <Input
                value={addr.complemento}
                onChange={(e) => updateAddr({ complemento: e.target.value })}
                placeholder="Apto, bloco, sala..."
              />
            </div>
            <div className="sm:col-span-3 space-y-1.5">
              <Label className="text-xs">Bairro</Label>
              <Input
                value={addr.bairro}
                onChange={(e) => updateAddr({ bairro: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Cidade</Label>
              <Input
                value={addr.cidade}
                onChange={(e) => updateAddr({ cidade: e.target.value })}
              />
            </div>
            <div className="sm:col-span-1 space-y-1.5">
              <Label className="text-xs">UF</Label>
              <Input
                value={addr.uf}
                maxLength={2}
                onChange={(e) => updateAddr({ uf: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="sm:col-span-6 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Endereço completo (gerado)</Label>
              <Input
                value={data.client_address ?? ""}
                readOnly
                className="bg-muted/40 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nacionalidade</Label>
            <Input
              value={data.client_nationality ?? ""}
              onChange={(e) => update("client_nationality", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado civil</Label>
            <Input
              value={data.client_marital_status ?? ""}
              onChange={(e) => update("client_marital_status", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-border">
        <legend className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Renovação e testemunhas
        </legend>
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch
              checked={!!data.has_renewal}
              onCheckedChange={(v) => update("has_renewal", v)}
            />
            Renovação automática
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch
              checked={!!data.include_witnesses}
              onCheckedChange={(v) => update("include_witnesses", v)}
            />
            Incluir testemunhas
          </label>
        </div>
      </div>
    </fieldset>
  );
};
