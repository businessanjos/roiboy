import { forwardRef } from "react";
import logoRykas from "@/assets/logo-rykas-mentoring.png";
import {
  Building2,
  User,
  FileText,
  ListChecks,
  Settings2,
  Wallet,
  AlertTriangle,
  CalendarClock,
  XCircle,
  Scale,
  PenLine,
  CheckCircle2,
} from "lucide-react";

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

const Section = ({
  title,
  icon: Icon,
  children,
  breakBefore,
  number,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  breakBefore?: boolean;
  number?: string;
}) => (
  <section
    {...(breakBefore ? { "data-pdf-page": "break" } : {})}
    className="mb-7"
  >
    <div className="flex items-center gap-3 mb-3">
      {number && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-bold tracking-wider shrink-0">
          {number}
        </div>
      )}
      {Icon && !number && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-foreground">
        {title}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
    <div className="space-y-3 text-[13px] leading-relaxed text-foreground/85 pl-11">
      {children}
    </div>
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
        className="bg-card text-foreground p-12 max-w-[210mm] mx-auto shadow-sm border border-border rounded-md"
        style={{ minHeight: "297mm" }}
      >
        {/* Header — Visual Law */}
        <header className="mb-10">
          <div className="flex items-center justify-between gap-6 pb-6 border-b-2 border-primary">
            <img
              src={logoRykas}
              alt="Rykas Mentoring"
              className="h-14 w-auto object-contain"
              crossOrigin="anonymous"
            />
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
                Instrumento Particular
              </p>
              <h1 className="text-lg font-bold tracking-tight uppercase leading-tight">
                Contrato de Prestação<br />de Serviços
              </h1>
              {data.contract_number && (
                <p className="text-[10px] text-muted-foreground mt-2 font-mono tracking-wider">
                  Nº {data.contract_number}
                </p>
              )}
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-4 italic">
            Este documento utiliza recursos de Visual Law para facilitar a leitura e compreensão das partes.
          </p>
        </header>

        {/* Partes — Cards lado a lado */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
              <User className="w-4 h-4" />
            </div>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.15em]">
              As Partes
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* CONTRATADA */}
            <div className="rounded-lg border border-border bg-muted/20 p-5">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/60">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  Contratada
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug mb-2">
                {data.company_name || "[empresa]"}
              </p>
              <dl className="space-y-1.5 text-[11px] text-foreground/75">
                {data.company_cnpj && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-14 shrink-0">CNPJ</dt>
                    <dd className="font-mono">{data.company_cnpj}</dd>
                  </div>
                )}
                {data.company_address && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-14 shrink-0">Sede</dt>
                    <dd>{data.company_address}</dd>
                  </div>
                )}
                {data.company_representative && (
                  <div className="flex gap-2 pt-1.5 border-t border-border/40 mt-2">
                    <dt className="text-muted-foreground w-14 shrink-0">Repr.</dt>
                    <dd>
                      {data.company_representative}
                      {data.company_representative_cpf && (
                        <span className="text-muted-foreground ml-1">
                          · CPF {data.company_representative_cpf}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* CONTRATANTE */}
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-primary/20">
                <User className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  Contratante
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug mb-2">
                {data.client_name}
              </p>
              <dl className="space-y-1.5 text-[11px] text-foreground/75">
                {data.client_cpf_cnpj && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-14 shrink-0">Doc.</dt>
                    <dd className="font-mono">{data.client_cpf_cnpj}</dd>
                  </div>
                )}
                {(data.client_nationality || data.client_marital_status) && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-14 shrink-0">Qualif.</dt>
                    <dd>
                      {[data.client_nationality, data.client_marital_status]
                        .filter(Boolean)
                        .join(", ")}
                    </dd>
                  </div>
                )}
                {data.client_address && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-14 shrink-0">End.</dt>
                    <dd>{data.client_address}</dd>
                  </div>
                )}
                {data.client_representative && (
                  <div className="flex gap-2 pt-1.5 border-t border-primary/20 mt-2">
                    <dt className="text-muted-foreground w-14 shrink-0">Repr.</dt>
                    <dd>
                      {data.client_representative}
                      {data.client_representative_cpf && (
                        <span className="text-muted-foreground ml-1">
                          · CPF {data.client_representative_cpf}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </section>

        {/* Objeto */}
        {data.service_mode !== "not_applicable" && (
          <Section title="Do Objeto" icon={FileText} number="1">
            <p className="whitespace-pre-line">
              {data.object_description ||
                "A CONTRATADA se obriga a prestar à CONTRATANTE os serviços descritos abaixo, conforme escopo, prazos e condições aqui estabelecidos."}
            </p>
          </Section>
        )}

        {/* Entregas */}
        {data.deliverables && data.deliverables.length > 0 && (
          <Section title="Das Entregas" icon={ListChecks} number="2">
            <ul className="space-y-2.5">
              {data.deliverables.map((d, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{d.title}</span>
                    {d.description && (
                      <span className="text-foreground/70"> — {d.description}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Modalidade */}
        {data.service_mode !== "not_applicable" && (
          <Section title="Da Modalidade de Execução" icon={Settings2} number="3">
            {data.service_mode === "hours" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border bg-muted/20 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Horas mensais
                  </p>
                  <p className="text-xl font-bold">{data.monthly_hours ?? 0}h</p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Hora excedente
                  </p>
                  <p className="text-xl font-bold">{formatCurrency(data.extra_hour_rate)}</p>
                </div>
                <p className="col-span-2 text-[12px] text-foreground/75">
                  Horas excedentes serão cobradas mediante aprovação prévia da CONTRATANTE.
                </p>
              </div>
            ) : (
              <p>
                Os serviços serão prestados conforme o escopo de entregas
                descrito na Cláusula 2ª, sem vinculação a carga horária mensal.
              </p>
            )}
          </Section>
        )}

        {/* Valores e Pagamento — destaque hero */}
        <Section title="Do Valor e Forma de Pagamento" icon={Wallet} number="4" breakBefore>
          <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 mb-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-80 mb-1">
              Valor total do contrato
            </p>
            <p className="text-3xl font-bold tracking-tight">
              {formatCurrency(totalValue)}
            </p>
            {data.payment_method && (
              <p className="text-[11px] mt-2 opacity-90">via {data.payment_method}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {((data.down_payment_value ?? 0) > 0) && (
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                  Entrada
                </p>
                <p className="text-base font-bold">{formatCurrency(data.down_payment_value)}</p>
                {data.down_payment_date && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    em {formatDate(data.down_payment_date)}
                  </p>
                )}
              </div>
            )}
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                Parcelas
              </p>
              <p className="text-base font-bold">{data.installments ?? 1}x</p>
              <p className="text-[10px] text-muted-foreground mt-1">mensais</p>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                Valor da parcela
              </p>
              <p className="text-base font-bold">{formatCurrency(data.installment_value)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                venc. dia {data.due_day ?? 10}
              </p>
            </div>
          </div>

          {data.first_due_date && (
            <p className="text-[12px] text-foreground/75">
              Primeiro vencimento em <strong>{formatDate(data.first_due_date)}</strong>,
              demais parcelas com vencimento todo dia <strong>{data.due_day ?? 10}</strong>.
            </p>
          )}
        </Section>

        {/* Mora */}
        <Section title="Da Mora e Inadimplência" icon={AlertTriangle} number="5">
          <div className="rounded-md border-l-4 border-l-amber-500 bg-amber-500/5 p-4 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[12px]">
              Em caso de atraso no pagamento, será aplicada{" "}
              <strong>multa de {data.late_fee_percentage ?? 2}%</strong> e{" "}
              <strong>juros de {data.late_interest_percentage ?? 1}% ao mês</strong>{" "}
              sobre o valor em aberto.
            </p>
          </div>
        </Section>

        {/* Vigência */}
        <Section title="Da Vigência" icon={CalendarClock} number="6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 text-primary px-5 py-3 text-center shrink-0">
              <p className="text-2xl font-bold leading-none">
                {data.contract_duration_months ?? 12}
              </p>
              <p className="text-[9px] uppercase tracking-wider mt-1">meses</p>
            </div>
            <p className="text-[12px]">
              Vigência contada a partir da data de assinatura,{" "}
              {data.has_renewal
                ? "com renovação automática por iguais períodos salvo manifestação em contrário com 30 dias de antecedência."
                : "encerrando-se automaticamente ao final deste prazo."}
            </p>
          </div>
        </Section>

        {/* Rescisão */}
        <Section title="Da Rescisão" icon={XCircle} number="7">
          <p>
            A rescisão antecipada por qualquer das partes implicará multa
            equivalente a{" "}
            <strong className="text-primary">
              {data.rescission_penalty_percentage ?? 10}%
            </strong>{" "}
            sobre o saldo remanescente do contrato.
          </p>
        </Section>

        {/* Foro */}
        <Section title="Do Foro" icon={Scale} number="8">
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
