import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Sparkles, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DigitalContractData, Deliverable } from "./ContractDocument";

interface ContractEditorProps {
  data: DigitalContractData;
  onChange: (next: DigitalContractData) => void;
  disabled?: boolean;
  dealId?: string;
}

export const ContractEditor = ({ data, onChange, disabled, dealId }: ContractEditorProps) => {
  const [aiObjectLoading, setAiObjectLoading] = useState(false);
  const [aiDeliverableIdx, setAiDeliverableIdx] = useState<number | null>(null);
  const [copyingBilling, setCopyingBilling] = useState(false);
  const [billingTipo, setBillingTipo] = useState<string | null>(null);
  const [billingChecked, setBillingChecked] = useState(false);
  const [currencyDrafts, setCurrencyDrafts] = useState<Record<string, string>>({});

  const parseDecimalInput = (raw: string) => {
    const cleaned = raw.replace(/[^\d,.-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") return null;
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decimalIndex = Math.max(lastComma, lastDot);
    const integerPart = decimalIndex >= 0 ? cleaned.slice(0, decimalIndex).replace(/[^\d-]/g, "") : cleaned.replace(/[^\d-]/g, "");
    const decimalPart = decimalIndex >= 0 ? cleaned.slice(decimalIndex + 1).replace(/\D/g, "") : "";
    const normalized = decimalPart ? `${integerPart || "0"}.${decimalPart}` : integerPart;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const displayDecimal = (field: keyof DigitalContractData, value: number | null | undefined) => {
    if (currencyDrafts[field as string] !== undefined) return currencyDrafts[field as string];
    return value === undefined || value === null ? "" : Number(value).toFixed(2).replace(".", ",");
  };

  const updateCurrencyField = (field: keyof DigitalContractData, raw: string, apply: (num: number | null) => void) => {
    const cleaned = raw.replace(/[^\d,.-]/g, "");
    setCurrencyDrafts((prev) => ({ ...prev, [field as string]: cleaned }));
    apply(cleaned === "" ? null : parseDecimalInput(cleaned));
  };

  const finishCurrencyEdit = (field: keyof DigitalContractData) => {
    setCurrencyDrafts((prev) => {
      const next = { ...prev };
      delete next[field as string];
      return next;
    });
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
          if (!cancelled) { setBillingTipo(null); setBillingChecked(true); }
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
        if (!cancelled) { setBillingTipo(null); setBillingChecked(true); }
      }
    };
    fetchTipo();
    return () => { cancelled = true; };
  }, [dealId]);

  const isBillingCpf = billingTipo === "cpf";

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
      (cf || []).forEach((f: any) => { idByName[f.name] = f.id; });
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

  const update = <K extends keyof DigitalContractData>(field: K, value: DigitalContractData[K]) => {
    onChange({ ...data, [field]: value });
  };

  const updateBank = (field: string, value: string) => {
    onChange({
      ...data,
      company_bank_info: { ...(data.company_bank_info ?? {}), [field]: value },
    });
  };

  const updateDeliverable = (idx: number, partial: Partial<Deliverable>) => {
    const next = [...(data.deliverables ?? [])];
    next[idx] = { ...next[idx], ...partial };
    update("deliverables", next);
  };

  const addDeliverable = () => {
    update("deliverables", [...(data.deliverables ?? []), { title: "", description: "" }]);
  };

  const removeDeliverable = (idx: number) => {
    const next = [...(data.deliverables ?? [])];
    next.splice(idx, 1);
    update("deliverables", next);
  };

  const generateObject = async () => {
    if (!data.deliverables?.length) {
      toast.error("Adicione pelo menos uma entrega para gerar o objeto.");
      return;
    }
    setAiObjectLoading(true);
    try {
      const list = data.deliverables
        .filter((d) => d.title)
        .map((d) => `- ${d.title}${d.description ? ": " + d.description : ""}`)
        .join("\n");
      const { data: result, error } = await supabase.functions.invoke("generate-contract-clause", {
        body: {
          kind: "object",
          context: `Contratada: ${data.company_name || "[empresa]"}. Contratante: ${
            data.client_name || "[cliente]"
          }. Duração: ${data.contract_duration_months ?? 12} meses. Modalidade: ${
            data.service_mode === "hours" ? "horas dedicadas mensais" : "por entregas"
          }. Entregas:\n${list}`,
        },
      });
      if (error) throw error;
      if (result?.text) {
        update("object_description", result.text);
        toast.success("Objeto gerado!");
      }
    } catch (e: any) {
      toast.error("Erro ao gerar: " + (e?.message ?? "tente novamente"));
    } finally {
      setAiObjectLoading(false);
    }
  };

  const generateDeliverable = async (idx: number) => {
    const item = data.deliverables?.[idx];
    if (!item?.title) {
      toast.error("Informe o título da entrega primeiro.");
      return;
    }
    setAiDeliverableIdx(idx);
    try {
      const { data: result, error } = await supabase.functions.invoke("generate-contract-clause", {
        body: {
          kind: "deliverable",
          context: `Entrega: ${item.title}. Contexto: serviços contratados de ${
            data.company_name || "empresa"
          } para ${data.client_name || "cliente"}.`,
        },
      });
      if (error) throw error;
      if (result?.text) {
        updateDeliverable(idx, { description: result.text });
        toast.success("Descrição gerada!");
      }
    } catch (e: any) {
      toast.error("Erro ao gerar: " + (e?.message ?? "tente novamente"));
    } finally {
      setAiDeliverableIdx(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mentorado e Renovação/testemunhas migraram para o Wizard de contrato (etapa "Mentorado"). */}

      {/* MODALIDADE / VALORES — campos de valor, forma de pagamento, parcelas e datas
          foram removidos pois já são preenchidos no Wizard de contrato.
          Mantemos apenas os campos específicos do modo "horas" quando aplicável. */}
      {data.service_mode === "hours" && (
        <fieldset disabled={disabled} className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">Horas contratadas</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Horas mensais</Label>
              <Input
                type="number"
                value={data.monthly_hours ?? ""}
                onChange={(e) => update("monthly_hours", Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Hora extra (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={displayDecimal("extra_hour_rate", data.extra_hour_rate)}
                onChange={(e) => updateCurrencyField("extra_hour_rate", e.target.value, (num) => update("extra_hour_rate", num))}
                onBlur={() => finishCurrencyEdit("extra_hour_rate")}
              />
            </div>
          </div>
        </fieldset>
      )}

      {data.service_mode !== "hours" && (
        <p className="text-sm text-muted-foreground italic px-1">
          Os dados do mentorado, renovação e testemunhas agora são preenchidos no Wizard acima.
        </p>
      )}
    </div>
  );
};
