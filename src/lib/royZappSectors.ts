/**
 * Setores de WhatsApp disponíveis no RoyZapp.
 *
 * Fonte única para labels amigáveis e picker inline. Não confundir com
 * `SectorId` (setores do app inteiro em `src/config/sectors.ts`) — este
 * subconjunto representa apenas os setores que operam números de WhatsApp.
 */
import type { SectorId } from "@/config/sectors";

export interface RoyZappSector {
  id: SectorId;
  label: string;
  description: string;
}

export const ROY_ZAPP_SECTORS: RoyZappSector[] = [
  { id: "vendas", label: "Comercial", description: "Pipeline comercial e leads" },
  { id: "operacoes", label: "Customer Success", description: "Atendimento CX/CS" },
  { id: "financeiro", label: "Financeiro", description: "Cobranças e pagamentos" },
];

const LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  ROY_ZAPP_SECTORS.map((s) => [s.id, s.label]),
);

export function royZappSectorLabel(id: string | null | undefined): string {
  if (!id) return "";
  return LABEL_BY_ID[id] ?? id;
}
