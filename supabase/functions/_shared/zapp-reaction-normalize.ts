export interface NormalizedZappReaction {
  targetId: string;
  emoji: string;
  fromMe: boolean;
  senderJid: string;
  senderName: string | null;
}

export function reactionRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function reactionIdFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return reactionIdFromUnknown(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const record = reactionRecord(value);
  if (!record) return "";
  const key = reactionRecord(record.key);
  return firstString(
    record.messageId,
    record.message_id,
    record.messageid,
    record.MessageID,
    record.stanzaId,
    record.stanza_id,
    record.id,
    key?.messageId,
    key?.messageid,
    key?.id,
  );
}

export function reactionEnvelope(message: Record<string, unknown>): Record<string, unknown> | null {
  return reactionRecord(message.reaction) ||
    reactionRecord(message.reactionMessage) ||
    reactionRecord(reactionRecord(message.message)?.reactionMessage) ||
    reactionRecord(reactionRecord(message.message)?.reaction) ||
    reactionRecord(reactionRecord(message.content)?.reactionMessage) ||
    reactionRecord(reactionRecord(message.content)?.reaction) ||
    null;
}

export function isZappReaction(message: Record<string, unknown>): boolean {
  const declaredType = `${String(message.messageType ?? "")} ${String(message.type ?? "")}`.toLowerCase();
  const flatReaction = typeof message.reaction === "string" ? message.reaction.trim() : "";
  return declaredType.includes("reaction") || Boolean(flatReaction) || reactionEnvelope(message) !== null;
}

export function normalizeZappReaction(message: Record<string, unknown>): NormalizedZappReaction | null {
  if (!isZappReaction(message)) return null;

  const nested = reactionEnvelope(message);
  const nestedKey = reactionRecord(nested?.key);
  const contextInfo = reactionRecord(message.contextInfo);
  const messageContent = reactionRecord(message.message);
  const extendedText = reactionRecord(messageContent?.extendedTextMessage);

  const targetId = firstString(
    reactionIdFromUnknown(nested?.messageId),
    reactionIdFromUnknown(nested?.message_id),
    reactionIdFromUnknown(nestedKey?.id),
    reactionIdFromUnknown(nested?.id),
    reactionIdFromUnknown(message.quoted),
    reactionIdFromUnknown(message.reactionMessageId),
    reactionIdFromUnknown(message.quotedMessageId),
    reactionIdFromUnknown(message.quoted_message_id),
    reactionIdFromUnknown(contextInfo?.stanzaId),
    reactionIdFromUnknown(reactionRecord(extendedText?.contextInfo)),
    reactionIdFromUnknown(message.messageid),
  );

  const declaredType = `${String(message.messageType ?? "")} ${String(message.type ?? "")}`.toLowerCase();
  const flatReaction = typeof message.reaction === "string" ? message.reaction.trim() : "";
  let emoji = firstString(nested?.text, nested?.emoji, flatReaction);
  if (!emoji && declaredType.includes("reaction")) {
    emoji = firstString(message.reaction_text, message.text, message.body);
    if (!emoji && typeof message.content === "string") emoji = message.content.trim();
    if (/^\[rea[cç][aã]o\]$/i.test(emoji)) emoji = "";
  }
  if (emoji.length > 16) emoji = "";

  return {
    targetId,
    emoji,
    fromMe: message.fromMe === true || message.from_me === true || nested?.fromMe === true || nestedKey?.fromMe === true,
    senderJid: firstString(message.participant, message.sender, nested?.sender, message.chatid),
    senderName: firstString(message.senderName, message.pushName) || null,
  };
}

export function zappMessageIdSuffix(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes(":") ? trimmed.split(":").slice(1).join(":") : trimmed;
}