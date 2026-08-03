import { supabase } from '@/integrations/supabase/client';

interface NotifyBlockersParams {
  accountId: string;
  /** Usuário que preencheu o checklist. */
  actor: { id: string; name: string };
  /** Responsável pelo post (usuário do sistema). Recebe a notificação principal. */
  responsibleUserId?: string | null;
  checklistId?: string | null;
  postTitle: string;
  /** Rótulos dos itens negativos marcados. */
  blockers: string[];
  decision: string;
}

/**
 * Cria notificações in-app quando um item de reprovação automática é marcado
 * no checklist de conteúdo. Notifica o responsável pelo post e, quando o
 * checklist foi preenchido por outra pessoa, também quem preencheu.
 */
export async function notifyChecklistBlockers({
  accountId,
  actor,
  responsibleUserId,
  checklistId,
  postTitle,
  blockers,
  decision,
}: NotifyBlockersParams): Promise<number> {
  if (!accountId || blockers.length === 0) return 0;

  const recipients = new Set<string>();
  if (responsibleUserId) recipients.add(responsibleUserId);
  // Se não houver responsável definido, avisa quem preencheu para não perder o bloqueio.
  if (!responsibleUserId && actor.id) recipients.add(actor.id);
  if (!recipients.size) return 0;

  const list = blockers.slice(0, 3).join(' · ');
  const extra = blockers.length > 3 ? ` (+${blockers.length - 3})` : '';
  const title =
    decision === 'rejected'
      ? `Post reprovado no checklist: ${postTitle}`
      : `Reprovação automática no checklist: ${postTitle}`;

  const rows = Array.from(recipients).map((userId) => ({
    account_id: accountId,
    user_id: userId,
    type: 'content_checklist_blocker',
    title,
    content: `${blockers.length} item(ns) de reprovação marcados: ${list}${extra}`,
    link: '/social-media?platform=checklist',
    triggered_by_user_id: actor.id || null,
    source_type: 'content_approval_checklist',
    source_id: checklistId ?? null,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    console.error('[contentChecklistNotifications] insert error:', error);
    return 0;
  }
  return rows.length;
}
