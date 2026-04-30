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
    return value === undefined || value === null ? "" : String(value).replace(".", ",");
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
      {/* MENTORADO */}
      <fieldset disabled={disabled} className="space-y-3">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-semibold text-foreground">Mentorado</legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyFromBilling}
            disabled={copyingBilling || !dealId || !billingChecked || !isBillingCpf}
            className="h-7 text-xs"
            title={!isBillingCpf && billingChecked ? "Disponível apenas quando o faturamento é CPF" : undefined}
          >
            {copyingBilling ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Copy className="w-3 h-3 mr-1" />
            )}
            Copiar do Faturamento (CPF)
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O mentorado é sempre Pessoa Física. Se o faturamento foi feito no CPF do mentorado, use o botão acima para copiar os dados.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Nome completo</Label>
            <Input
              value={data.client_name ?? ""}
              onChange={(e) => update("client_name", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">CPF</Label>
            <Input
              value={data.client_cpf_cnpj ?? ""}
              onChange={(e) => update("client_cpf_cnpj", e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
          <div>
            <Label className="text-xs">E-mail</Label>
            <Input
              value={data.client_email ?? ""}
              onChange={(e) => update("client_email", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Endereço completo</Label>
            <Input
              value={data.client_address ?? ""}
              onChange={(e) => update("client_address", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Nacionalidade</Label>
            <Input
              value={data.client_nationality ?? ""}
              onChange={(e) => update("client_nationality", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Estado civil</Label>
            <Input
              value={data.client_marital_status ?? ""}
              onChange={(e) => update("client_marital_status", e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* OBJETO + ENTREGAS */}
      <fieldset disabled={disabled} className="space-y-3">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-semibold text-foreground">Objeto e entregas</legend>
        </div>

        <div>
          <Label className="text-xs">Modalidade</Label>
          <Select
            value={data.service_mode ?? "hours"}
            onValueChange={(v) => update("service_mode", v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="not_applicable">Não se aplica</SelectItem>
              <SelectItem value="hours">Horas dedicadas</SelectItem>
              <SelectItem value="deliverables">Por entregas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.service_mode !== "not_applicable" && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Descrição do objeto</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateObject}
                  disabled={aiObjectLoading}
                  className="h-6 text-xs"
                >
                  {aiObjectLoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1" />
                  )}
                  Gerar com IA
                </Button>
              </div>
              <Textarea
                value={data.object_description ?? ""}
                onChange={(e) => update("object_description", e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Entregas</Label>
                <Button type="button" variant="outline" size="sm" onClick={addDeliverable} className="h-7">
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </div>
              {(data.deliverables ?? []).map((d, idx) => (
                <div key={idx} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Título da entrega"
                      value={d.title}
                      onChange={(e) => updateDeliverable(idx, { title: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => generateDeliverable(idx)}
                      disabled={aiDeliverableIdx === idx}
                    >
                      {aiDeliverableIdx === idx ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDeliverable(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Descrição (opcional)"
                    value={d.description ?? ""}
                    onChange={(e) => updateDeliverable(idx, { description: e.target.value })}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </fieldset>

      {/* MODALIDADE / VALORES */}
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="text-sm font-semibold text-foreground">Modalidade e valores</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Duração (meses)</Label>
            <Input
              type="number"
              value={data.contract_duration_months ?? ""}
              onChange={(e) => update("contract_duration_months", Number(e.target.value) || 0)}
            />
          </div>
          {data.service_mode === "hours" && (
            <>
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
                  type="number"
                  step="0.01"
                  value={data.extra_hour_rate ?? ""}
                  onChange={(e) => update("extra_hour_rate", Number(e.target.value) || 0)}
                />
              </div>
            </>
          )}
          {/* 1. Valor total */}
          <div>
            <Label className="text-xs">Valor total (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={data.total_value ?? ""}
              onChange={(e) => {
                const total = Number(e.target.value) || 0;
                const down = Number(data.down_payment_value ?? 0);
                const installments = down > 0 ? 11 : 12;
                const base = down > 0 ? Math.max(total - down, 0) : total;
                onChange({
                  ...data,
                  total_value: total,
                  installments,
                  installment_value: installments > 0 ? base / installments : 0,
                });
              }}
            />
          </div>
          {/* 2. Forma de pagamento */}
          <div>
            <Label className="text-xs">Forma de pagamento</Label>
            <Select
              value={data.payment_method ?? ""}
              onValueChange={(v) => update("payment_method", v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione a forma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="parcelado">Parcelado</SelectItem>
                <SelectItem value="pix_cheques">Pix + Cheques</SelectItem>
                <SelectItem value="pix_cartao_cheques">Pix + Cartão + Cheques</SelectItem>
                <SelectItem value="pix_boleto_parcelado">Pix + Boleto parcelado</SelectItem>
                <SelectItem value="cartao_cheques">Cartão + Cheques</SelectItem>
                <SelectItem value="cartao_boleto_parcelado">Cartão + Boleto parcelado</SelectItem>
                <SelectItem value="cartao_recorrencia">Cartão recorrência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* 3. Entrada */}
          <div>
            <Label className="text-xs">Entrada (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={data.down_payment_value ?? ""}
              onChange={(e) => {
                const down = e.target.value === "" ? null : Number(e.target.value);
                const total = Number(data.total_value ?? 0);
                const downNum = Number(down ?? 0);
                const installments = downNum > 0 ? 11 : 12;
                const base = downNum > 0 ? Math.max(total - downNum, 0) : total;
                onChange({
                  ...data,
                  down_payment_value: down,
                  installments,
                  installment_value: installments > 0 ? base / installments : 0,
                });
              }}
              placeholder="0,00"
            />
          </div>
          {/* 4. Parcelas */}
          <div>
            <Label className="text-xs">Parcelas</Label>
            <Input
              type="number"
              value={data.installments ?? ""}
              onChange={(e) => {
                const installments = Number(e.target.value) || 0;
                const total = Number(data.total_value ?? 0);
                const down = Number(data.down_payment_value ?? 0);
                const base = down > 0 ? Math.max(total - down, 0) : total;
                onChange({
                  ...data,
                  installments,
                  installment_value: installments > 0 ? base / installments : 0,
                });
              }}
            />
          </div>
          {/* 5. Valor da parcela (auto) */}
          <div>
            <Label className="text-xs">Valor da parcela (R$) — automático</Label>
            <Input
              type="number"
              step="0.01"
              value={
                data.installment_value !== undefined && data.installment_value !== null
                  ? Number(data.installment_value).toFixed(2)
                  : ""
              }
              readOnly
              className="bg-muted/50"
            />
          </div>
          {/* 6. Data da entrada */}
          <div>
            <Label className="text-xs">Data da entrada</Label>
            <Input
              type="date"
              value={data.down_payment_date ?? ""}
              onChange={(e) => update("down_payment_date", e.target.value || null)}
            />
          </div>
          {/* 7. Dia dos próximos vencimentos */}
          <div>
            <Label className="text-xs">Dia dos próximos vencimentos</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={data.due_day ?? ""}
              onChange={(e) => update("due_day", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">1º vencimento (após entrada)</Label>
            <Input
              type="date"
              value={data.first_due_date ?? ""}
              onChange={(e) => update("first_due_date", e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* CONDIÇÕES */}
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="text-sm font-semibold text-foreground">Renovação e testemunhas</legend>
        <div className="flex items-center gap-6 pt-2">
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
      </fieldset>

    </div>
  );
};
