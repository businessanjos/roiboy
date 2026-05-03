import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ContractDocument, type DigitalContractData, type Deliverable } from "@/components/sales/contracts/ContractDocument";
import { TemplatedContractPreview } from "@/components/sales/contracts/TemplatedContractSection";
import { type TemplateVariableDef } from "@/lib/contractTemplates";

const rowToData = (row: any): DigitalContractData => ({
  contract_number: row.contract_number,
  client_name: row.client_name ?? "",
  client_cpf_cnpj: row.client_cpf_cnpj,
  client_address: row.client_address,
  client_email: row.client_email,
  client_marital_status: row.client_marital_status,
  client_nationality: row.client_nationality,
  client_representative: row.client_representative,
  client_representative_cpf: row.client_representative_cpf,
  object_description: row.object_description,
  service_mode: row.service_mode ?? "deliverables",
  monthly_hours: row.monthly_hours,
  extra_hour_rate: row.extra_hour_rate,
  total_value: row.total_value,
  down_payment_percentage: row.down_payment_percentage,
  installments: row.installments,
  installment_value: row.installment_value,
  first_due_date: row.first_due_date,
  due_day: row.due_day,
  contract_duration_months: row.contract_duration_months,
  has_renewal: row.has_renewal,
  include_witnesses: row.include_witnesses,
  deliverables: (row.deliverables as Deliverable[]) ?? [],
  late_fee_percentage: row.late_fee_percentage,
  late_interest_percentage: row.late_interest_percentage,
  rescission_penalty_percentage: row.rescission_penalty_percentage,
  jurisdiction: row.jurisdiction,
  payment_method: row.payment_method,
  company_name: row.company_name,
  company_cnpj: row.company_cnpj,
  company_address: row.company_address,
  company_representative: row.company_representative,
  company_representative_cpf: row.company_representative_cpf,
  company_email: row.company_email,
  company_bank_info: row.company_bank_info,
});

export default function PublicDigitalContract() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DigitalContractData | null>(null);
  const [templateHtml, setTemplateHtml] = useState<string | null>(null);
  const [templateVariables, setTemplateVariables] = useState<TemplateVariableDef[]>([]);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-digital-contract?token=${token}`;
        const res = await fetch(url);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error ?? "Contrato não encontrado");
        }
        const json = await res.json();
        setData(rowToData(json.contract));
        setTemplateHtml(json.contract?.template_html ?? null);
        setTemplateVariables((json.contract?.template_variables as TemplateVariableDef[]) ?? []);
        setPlaceholderValues((json.contract?.placeholder_values as Record<string, unknown>) ?? {});
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        {error ?? "Contrato não disponível."}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background py-8">
      {templateHtml ? (
        <div className="mx-auto max-w-[210mm] px-4">
          <TemplatedContractPreview
            templateHtml={templateHtml}
            templateVariables={templateVariables}
            placeholderValues={placeholderValues}
          />
        </div>
      ) : (
        <ContractDocument data={data} />
      )}
    </div>
  );
}
