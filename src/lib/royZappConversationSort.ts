/**
 * Ordenação canônica da lista de conversas do ROY zAPP (estilo WhatsApp):
 * fixadas primeiro, depois estritamente pela última mensagem (desc).
 *
 * NUNCA usar `updated_at` do assignment aqui (nem na query do banco): esse campo
 * não muda quando chega/sai mensagem e faz a conversa aparecer no lugar errado.
 */
export interface SortableConversation {
  id: string;
  isPinned?: boolean;
  /** Data da última mensagem (contact.lastMessageAt / zapp_conversation.last_message_at). */
  lastMessageAt?: string | null;
  /** Fallback quando não há mensagem alguma (created_at do assignment). */
  fallbackAt?: string | null;
}

export function conversationRecencyMs(c: SortableConversation): number {
  const raw = c.lastMessageAt || c.fallbackAt;
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

export function compareConversationsByRecency(
  a: SortableConversation,
  b: SortableConversation
): number {
  if (a.isPinned && !b.isPinned) return -1;
  if (!a.isPinned && b.isPinned) return 1;

  const dateA = conversationRecencyMs(a);
  const dateB = conversationRecencyMs(b);
  if (dateB !== dateA) return dateB - dateA;

  // Tiebreak determinístico para não embaralhar entre renders/realtime.
  return String(b.id).localeCompare(String(a.id));
}
