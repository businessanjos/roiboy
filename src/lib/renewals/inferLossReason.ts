/**
 * Quando o motivo oficial está vazio, tenta ler o motivo já escrito na ficha
 * (status, observações e justificativa do contrato). Apenas exibição: não grava nada.
 */
export interface LossReasonSource {
  contractStatus?: string | null;
  notes?: string | null;
  justification?: string | null;
  statusReason?: string | null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Somente motivos da lista oficial do catálogo.
const RULES: Array<[RegExp, string]> = [
  [/inadimpl|parcelas? em atraso|negativad|cheque|nao paga|sem pagamento/, "Cliente não retorna – Inadimplente"],
  [/financeir|dinheiro|investimento|condic(ao|oes) financeira/, "Financeiro"],
  [/saude|cirurgia|internad|gravid|licenca|doenca|pessoa(l|is)|familia/, "Problemas pessoais"],
  [/sem tempo|falta de tempo|nao tem tempo/, "Falta de tempo / priorização"],
];

export function inferLossReason(src: LossReasonSource): string | null {
  const text = norm([src.justification, src.statusReason, src.notes].filter(Boolean).join(" \n "));
  if (!text.trim()) return null;
  for (const [re, label] of RULES) if (re.test(text)) return label;
  return null;
}
