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
