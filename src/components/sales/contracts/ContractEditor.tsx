import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DigitalContractData } from "./ContractDocument";

interface ContractEditorProps {
  data: DigitalContractData;
  onChange: (next: DigitalContractData) => void;
  disabled?: boolean;
  dealId?: string;
}

/**
 * Editor "legacy" do contrato. As seções de Mentorado, Renovação e
 * Testemunhas migraram para o Wizard (etapa "Mentorado", entre Cliente e
 * Pagamento). O que resta aqui é apenas a configuração específica do modo
 * "horas contratadas", que é independente do wizard.
 */
export const ContractEditor = ({ data, onChange, disabled }: ContractEditorProps) => {
  const [currencyDrafts, setCurrencyDrafts] = useState<Record<string, string>>({});

  const parseDecimalInput = (raw: string) => {
    const cleaned = raw.replace(/[^\d,.-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") return null;
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decimalIndex = Math.max(lastComma, lastDot);
    const integerPart =
      decimalIndex >= 0 ? cleaned.slice(0, decimalIndex).replace(/[^\d-]/g, "") : cleaned.replace(/[^\d-]/g, "");
    const decimalPart = decimalIndex >= 0 ? cleaned.slice(decimalIndex + 1).replace(/\D/g, "") : "";
    const normalized = decimalPart ? `${integerPart || "0"}.${decimalPart}` : integerPart;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const displayDecimal = (field: keyof DigitalContractData, value: number | null | undefined) => {
    if (currencyDrafts[field as string] !== undefined) return currencyDrafts[field as string];
    return value === undefined || value === null ? "" : Number(value).toFixed(2).replace(".", ",");
  };

  const updateCurrencyField = (
    field: keyof DigitalContractData,
    raw: string,
    apply: (num: number | null) => void,
  ) => {
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

  const update = <K extends keyof DigitalContractData>(field: K, value: DigitalContractData[K]) => {
    onChange({ ...data, [field]: value });
  };

  if (data.service_mode === "hours") {
    return (
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
              onChange={(e) =>
                updateCurrencyField("extra_hour_rate", e.target.value, (num) => update("extra_hour_rate", num))
              }
              onBlur={() => finishCurrencyEdit("extra_hour_rate")}
            />
          </div>
        </div>
      </fieldset>
    );
  }

  return (
    <p className="text-sm text-muted-foreground italic px-1">
      Os dados do mentorado, renovação e testemunhas agora são preenchidos no Wizard acima.
    </p>
  );
};
