/** Situação do contrato usada na aba Clínica Ryka (quem está de fato ativo). */
export type ContractBucket = "active" | "pending" | "paused" | "exit" | "neutral";
export type ContractFilter = "active" | "hold" | "ended" | "none" | "all";

export interface ClientContractLite {
  id: string;
  client_id: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  product_id?: string | null;
}

const RANK: Record<ContractBucket, number> = { active: 0, paused: 1, pending: 2, exit: 3, neutral: 4 };
const when = (c: ClientContractLite) => c.start_date || c.created_at || "";

/** Contrato que representa a cliente: o em vigor vence; depois pausado/suspenso, pendente e encerrado; empate = o mais recente. */
export function pickClientContract<T extends ClientContractLite>(
  contracts: T[],
  bucketOf: (status: string | null) => ContractBucket,
): T | null {
  if (!contracts.length) return null;
  return [...contracts].sort(
    (a, b) => RANK[bucketOf(a.status)] - RANK[bucketOf(b.status)] || when(b).localeCompare(when(a)),
  )[0];
}

export function contractGroup(bucket: ContractBucket | null): Exclude<ContractFilter, "all"> {
  if (!bucket) return "none";
  if (bucket === "active") return "active";
  if (bucket === "paused" || bucket === "pending") return "hold";
  return "ended";
}

export const matchesContractFilter = (bucket: ContractBucket | null, filter: ContractFilter) =>
  filter === "all" || contractGroup(bucket) === filter;

export const CONTRACT_FILTER_LABEL: Record<ContractFilter, string> = {
  active: "Contrato ativo",
  hold: "Suspenso ou pausado",
  ended: "Encerrado ou cancelado",
  none: "Sem contrato",
  all: "Todos os contratos",
};

/** "2026-09-30" -> "30/09/2026" sem deslocar o dia pelo fuso. */
export const brDate = (d: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};
