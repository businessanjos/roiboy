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

/** Padrão para quem ainda não tem configuração explícita do admin. */
export const DEFAULT_ZAPP_VIEWS: ZappView[] = ["inbox", "team", "tags", "playbook"];

export const ALL_ZAPP_VIEWS: ZappView[] = [...ZAPP_VIEWS];

export function sanitizeViewList(values: unknown): ZappView[] {
  if (!Array.isArray(values)) return [];
  return ALL_ZAPP_VIEWS.filter((v) => values.includes(v));
}
