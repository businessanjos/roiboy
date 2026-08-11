/**
 * Controle de acesso do RoyZapp.
 *
 * - Somente os e-mails em `SECTOR_PICKER_EMAILS` podem ver a tela "Escolha o
 *   setor para atender". Todos os outros usuários entram direto no setor que
 *   o admin liberou para eles (via `user_sector_access`).
 * - As telas internas (views) liberadas por usuário vivem em
 *   `user_royzapp_views.views`; sem registro, aplica-se `DEFAULT_ZAPP_VIEWS`.
 */
import type { ZappView } from "@/lib/royZappRoutes";
import { ZAPP_VIEWS } from "@/lib/royZappRoutes";

/** Únicos usuários autorizados a escolher entre setores. */
export const SECTOR_PICKER_EMAILS = [
  "m.quintana@me.com",
  "coachevertonsantos@gmail.com",
] as const;

export function canPickSector(email?: string | null): boolean {
  if (!email) return false;
  return (SECTOR_PICKER_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

/** Telas do RoyZapp que podem ser liberadas individualmente. */
export const ZAPP_VIEW_LABELS: Record<ZappView, string> = {
  inbox: "Conversas",
  team: "Equipe",
  departments: "Departamentos",
  tags: "Tags",
  settings: "Configurações",
  playbook: "Playbook",
  marketing: "Eventos",
  sector: "Área do setor",
  meetings: "Reuniões",
  "whatsapp-admin": "Conexões WhatsApp",
  analytics: "Produtividade",
};

/**
 * Padrão para quem ainda não tem configuração explícita do admin.
 * Menu operacional completo — só a administração de conexões WhatsApp
 * (`whatsapp-admin`) fica reservada a admins/pickers.
 */
export const DEFAULT_ZAPP_VIEWS: ZappView[] = [
  "inbox",
  "team",
  "departments",
  "tags",
  "settings",
  "playbook",
  "marketing",
  "sector",
  "meetings",
];

export const ALL_ZAPP_VIEWS: ZappView[] = [...ZAPP_VIEWS];

export function sanitizeViewList(values: unknown): ZappView[] {
  if (!Array.isArray(values)) return [];
  return ALL_ZAPP_VIEWS.filter((v) => values.includes(v));
}

/**
 * Setores que possuem WhatsApp (ROY zAPP) e, portanto, podem ser liberados
 * ou bloqueados individualmente **apenas dentro do ROY zAPP**.
 *
 * IMPORTANTE: este controle é INDEPENDENTE do acesso geral ao setor
 * (`user_sector_access`). Um usuário pode ter acesso ao pipeline Comercial
 * (setor "vendas") e continuar bloqueado no WhatsApp do Comercial.
 */
export const ZAPP_WHATSAPP_SECTORS = ["operacoes", "financeiro", "vendas", "marketing"] as const;
export type ZappWhatsAppSector = (typeof ZAPP_WHATSAPP_SECTORS)[number];

export const ZAPP_SECTOR_LABELS: Record<ZappWhatsAppSector, string> = {
  operacoes: "Customer Success",
  financeiro: "Finanças",
  vendas: "Vendas",
  marketing: "Marketing",
};

/** Normaliza a lista salva em `user_royzapp_views.zapp_sectors`. */
export function sanitizeZappSectorList(values: unknown): ZappWhatsAppSector[] {
  if (!Array.isArray(values)) return [];
  return ZAPP_WHATSAPP_SECTORS.filter((s) => values.includes(s));
}

/**
 * REGRA ÚNICA de acesso ao WhatsApp de um setor no ROY zAPP.
 *
 * Precedência (nesta ordem, sem exceções):
 * 1. Configuração explícita em `user_royzapp_views.zapp_sectors` — vence
 *    SEMPRE, inclusive para admins e pickers. Foi o bug do Jonathan: admin
 *    configurado só para "vendas" caía no WhatsApp de Customer Success.
 * 2. Sem configuração explícita: admin/picker abre qualquer setor.
 * 3. Caso contrário: herda o acesso geral ao setor (`user_sector_access`).
 *
 * Qualquer tela nova do ROY zAPP deve usar esta função — nunca reimplementar.
 */
export function canOpenZappSectorFor(params: {
  sectorId: string;
  explicitZappSectors: ZappWhatsAppSector[] | null | undefined;
  unrestricted: boolean;
  hasGeneralSectorAccess: boolean;
}): boolean {
  const { sectorId, explicitZappSectors, unrestricted, hasGeneralSectorAccess } = params;
  if (explicitZappSectors && explicitZappSectors.length > 0) {
    return explicitZappSectors.includes(sectorId as ZappWhatsAppSector);
  }
  if (unrestricted) return true;
  return hasGeneralSectorAccess;
}

/** Setores de WhatsApp efetivamente abertos para o usuário. */
export function resolveAllowedZappSectors(params: {
  explicitZappSectors: ZappWhatsAppSector[] | null | undefined;
  unrestricted: boolean;
  generalSectorIds: Iterable<string>;
}): ZappWhatsAppSector[] {
  const general = new Set(params.generalSectorIds);
  return ZAPP_WHATSAPP_SECTORS.filter((id) =>
    canOpenZappSectorFor({
      sectorId: id,
      explicitZappSectors: params.explicitZappSectors,
      unrestricted: params.unrestricted,
      hasGeneralSectorAccess: general.has(id),
    }),
  );
}

