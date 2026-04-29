import { forwardRef } from "react";

export interface Deliverable {
  title: string;
  description?: string;
}

export interface DigitalContractData {
  contract_number?: string | null;
  client_name: string;
  client_cpf_cnpj?: string | null;
  client_address?: string | null;
  client_email?: string | null;
  client_marital_status?: string | null;
  client_nationality?: string | null;
  client_representative?: string | null;
  client_representative_cpf?: string | null;
  object_description?: string | null;
  service_mode?: "hours" | "deliverables" | string;
  monthly_hours?: number | null;
  extra_hour_rate?: number | null;
  total_value?: number | null;
  down_payment_percentage?: number | null;
  down_payment_value?: number | null;
  down_payment_date?: string | null;
  installments?: number | null;
  installment_value?: number | null;
  first_due_date?: string | null;
  due_day?: number | null;
  contract_duration_months?: number | null;
  has_renewal?: boolean | null;
  include_witnesses?: boolean | null;
  deliverables?: Deliverable[];
  late_fee_percentage?: number | null;
  late_interest_percentage?: number | null;
  rescission_penalty_percentage?: number | null;
  jurisdiction?: string | null;
  payment_method?: string | null;
  company_name?: string | null;
  company_cnpj?: string | null;
  company_address?: string | null;
  company_representative?: string | null;
  company_representative_cpf?: string | null;
  company_email?: string | null;
  company_bank_info?: {
    banco?: string;
    agencia?: string;
    conta?: string;
    pix?: string;
  } | null;
}

const formatCurrency = (value?: number | null) => {
  if (value === undefined || value === null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

const formatDate = (date?: string | null) => {
  if (!date) return "___/___/______";
  return new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const Section = ({ title, children, breakBefore }: { title: string; children: React.ReactNode; breakBefore?: boolean }) => (
  <section
    {...(breakBefore ? { "data-pdf-page": "break" } : {})}
    className="mb-8"
  >
    <h2 className="text-base font-semibold uppercase tracking-wide text-foreground border-b border-border pb-2 mb-4">
      {title}
    </h2>
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
  </section>
);

interface ContractDocumentProps {
  data: DigitalContractData;
}

/**
 * Documento de contrato — versão limpa e formal adaptada ao design system do Roy.
 * Usa tokens HSL semânticos para suportar tema light/dark.
 */
export const ContractDocument = forwardRef<HTMLDivElement, ContractDocumentProps>(
  ({ data }, ref) => {
    const totalValue =
      data.total_value ??
      ((data.installment_value ?? 0) * (data.installments ?? 0));

    return (
      <div
        ref={ref}
        className="bg-card text-foreground p-10 max-w-[210mm] mx-auto shadow-sm border border-border rounded-md"
        style={{ minHeight: "297mm" }}
      >
        {/* Header */}
        <header className="text-center mb-10 pb-6 border-b-2 border-primary">
          <h1 className="text-2xl font-bold tracking-tight">
            CONTRATO DE PRESTAÇÃO DE SERVIÇOS
          </h1>
          {data.contract_number && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              Nº {data.contract_number}
            </p>
          )}
        </header>

        {/* Partes */}
        <Section title="Partes">
          <p>
            <strong>CONTRATADA:</strong> {data.company_name || "[empresa]"},
            {data.company_cnpj ? ` CNPJ ${data.company_cnpj},` : ""}
            {data.company_address ? ` com sede em ${data.company_address},` : ""}
            {" "}neste ato representada por{" "}
            <strong>{data.company_representative || "[representante]"}</strong>
            {data.company_representative_cpf
              ? `, CPF ${data.company_representative_cpf}`
              : ""}
            .
          </p>
          <p>
            <strong>CONTRATANTE:</strong> <strong>{data.client_name}</strong>
            {data.client_nationality ? `, ${data.client_nationality}` : ""}
            {data.client_marital_status ? `, ${data.client_marital_status}` : ""}
            {data.client_cpf_cnpj ? `, ${data.client_cpf_cnpj}` : ""}
            {data.client_address ? `, residente/com sede em ${data.client_address}` : ""}
            {data.client_representative
              ? `, neste ato representado por ${data.client_representative}${
                  data.client_representative_cpf
                    ? ` (CPF ${data.client_representative_cpf})`
                    : ""
                }`
              : ""}
            .
          </p>
        </Section>

        {/* Objeto */}
        {data.service_mode !== "not_applicable" && (
          <Section title="Cláusula 1ª — Do Objeto">
            <p className="whitespace-pre-line">
              {data.object_description ||
                "A CONTRATADA se obriga a prestar à CONTRATANTE os serviços descritos abaixo, conforme escopo, prazos e condições aqui estabelecidos."}
            </p>
          </Section>
        )}

        {/* Entregas */}
        {data.deliverables && data.deliverables.length > 0 && (
          <Section title="Cláusula 2ª — Das Entregas">
            <ul className="space-y-2 list-disc pl-5">
              {data.deliverables.map((d, i) => (
                <li key={i}>
                  <span className="font-semibold">{d.title}</span>
                  {d.description ? <span className="text-foreground/80"> — {d.description}</span> : null}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Modalidade */}
        {data.service_mode !== "not_applicable" && (
          <Section title="Cláusula 3ª — Da Modalidade de Execução">
            {data.service_mode === "hours" ? (
              <p>
                Os serviços serão prestados em regime de{" "}
                <strong>{data.monthly_hours ?? 0} horas mensais dedicadas</strong>.
                Horas excedentes serão cobradas a{" "}
                <strong>{formatCurrency(data.extra_hour_rate)}/hora</strong>,
                mediante aprovação prévia da CONTRATANTE.
              </p>
            ) : (
              <p>
                Os serviços serão prestados conforme o escopo de entregas
                descrito na Cláusula 2ª, sem vinculação a carga horária mensal.
              </p>
            )}
          </Section>
        )}

        {/* Valores e Pagamento */}
        <Section title="Cláusula 4ª — Do Valor e Forma de Pagamento" breakBefore>
          <p>
            O valor total do contrato é de{" "}
            <strong>{formatCurrency(totalValue)}</strong>, a ser pago em{" "}
            <strong>{data.installments ?? 1}x</strong> de{" "}
            <strong>{formatCurrency(data.installment_value)}</strong>.
          </p>
          {((data.down_payment_value ?? 0) > 0 || (data.down_payment_percentage ?? 0) > 0) && (
            <p>
              Sinal/entrada:{" "}
              <strong>
                {data.down_payment_value && data.down_payment_value > 0
                  ? formatCurrency(data.down_payment_value)
                  : `${data.down_payment_percentage}% do valor total`}
              </strong>
              {data.down_payment_date
                ? `, com pagamento em ${formatDate(data.down_payment_date)}.`
                : " no ato da assinatura."}
            </p>
          )}
          <p>
            Demais parcelas com vencimento todo dia <strong>{data.due_day ?? 10}</strong>.
            {data.first_due_date
              ? ` Primeiro vencimento em ${formatDate(data.first_due_date)}.`
              : ""}
          </p>
          {data.company_bank_info && (
            <div className="mt-3 p-3 rounded border border-border bg-muted/30 text-xs">
              <p className="font-semibold mb-1">Dados para pagamento</p>
              {data.company_bank_info.banco && <p>Banco: {data.company_bank_info.banco}</p>}
              {data.company_bank_info.agencia && <p>Agência: {data.company_bank_info.agencia}</p>}
              {data.company_bank_info.conta && <p>Conta: {data.company_bank_info.conta}</p>}
              {data.company_bank_info.pix && <p>PIX: {data.company_bank_info.pix}</p>}
            </div>
          )}
        </Section>

        {/* Multas */}
        <Section title="Cláusula 5ª — Da Mora e Inadimplência">
          <p>
            Em caso de atraso no pagamento, será aplicada multa de{" "}
            <strong>{data.late_fee_percentage ?? 2}%</strong> e juros de{" "}
            <strong>{data.late_interest_percentage ?? 1}% ao mês</strong> sobre
            o valor em aberto.
          </p>
        </Section>

        {/* Vigência */}
        <Section title="Cláusula 6ª — Da Vigência">
          <p>
            O presente contrato terá vigência de{" "}
            <strong>{data.contract_duration_months ?? 12} meses</strong>{" "}
            contados a partir da data de assinatura,
            {data.has_renewal
              ? " renovando-se automaticamente por iguais períodos salvo manifestação em contrário com 30 dias de antecedência."
              : " encerrando-se automaticamente ao final deste prazo."}
          </p>
        </Section>

        {/* Rescisão */}
        <Section title="Cláusula 7ª — Da Rescisão">
          <p>
            A rescisão antecipada por qualquer das partes implicará multa
            equivalente a{" "}
            <strong>{data.rescission_penalty_percentage ?? 10}%</strong> sobre
            o saldo remanescente do contrato.
          </p>
        </Section>

        {/* Foro */}
        <Section title="Cláusula 8ª — Do Foro">
          <p>
            As partes elegem o foro da comarca de{" "}
            <strong>{data.jurisdiction || "[Cidade]"}</strong> para dirimir
            quaisquer controvérsias decorrentes deste contrato.
          </p>
        </Section>

        {/* Assinaturas */}
        <section data-pdf-page="break" className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-center mb-10">
            E por estarem assim justas e contratadas, as partes assinam o
            presente contrato.
          </p>
          <div className="grid grid-cols-2 gap-12 text-sm">
            <div className="text-center">
              <div className="border-t border-foreground pt-2 mt-16">
                <p className="font-semibold">{data.company_representative || "CONTRATADA"}</p>
                <p className="text-xs text-muted-foreground">{data.company_name}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-foreground pt-2 mt-16">
                <p className="font-semibold">{data.client_representative || data.client_name}</p>
                <p className="text-xs text-muted-foreground">CONTRATANTE</p>
              </div>
            </div>
          </div>

          {data.include_witnesses && (
            <div className="grid grid-cols-2 gap-12 text-sm mt-16">
              <div className="text-center">
                <div className="border-t border-border pt-2 mt-16">
                  <p className="text-xs">Testemunha 1 — Nome / CPF</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-border pt-2 mt-16">
                  <p className="text-xs">Testemunha 2 — Nome / CPF</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  },
);

ContractDocument.displayName = "ContractDocument";
