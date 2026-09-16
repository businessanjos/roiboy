export interface NormalizedZappReaction {
  targetId: string;
  emoji: string;
  operation: "set" | "remove" | "deferred";
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

function hasOwn(record: Record<string, unknown> | null, key: string): boolean {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, key));
}

function reactionTextFromRecord(record: Record<string, unknown> | null): string {
  if (!record) return "";
  const content = reactionRecord(record.content);
  const body = reactionRecord(record.body);
  const reaction = reactionRecord(record.reaction);
  return firstString(
    record.emoji,
    record.text,
    record.reaction_text,
    record.reactionText,
    typeof record.reaction === "string" ? record.reaction : "",
    content?.emoji,
    content?.text,
    content?.reaction,
    reaction?.emoji,
    reaction?.text,
    body?.emoji,
    body?.text,
    body?.reaction,
  );
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  const direct = reactionRecord(value);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    return reactionRecord(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

function nestedRecords(root: Record<string, unknown>, maxDepth = 5): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number) => {
    if (depth > maxDepth) return;
    const record = parseRecord(value);
    if (!record || seen.has(record)) return;
    seen.add(record);
    records.push(record);
    for (const nested of Object.values(record)) {
      if (nested && (typeof nested === "object" || typeof nested === "string")) visit(nested, depth + 1);
    }
  };
  visit(root, 0);
  return records;
}

function hasExplicitEmptyReaction(record: Record<string, unknown> | null): boolean {
  if (!record) return false;
  for (const key of ["emoji", "reaction_text", "reactionText"]) {
    if (hasOwn(record, key) && typeof record[key] === "string" && record[key].trim() === "") return true;
  }
  if (hasOwn(record, "reaction") && typeof record.reaction === "string" && record.reaction.trim() === "") return true;
  const nestedReaction = reactionRecord(record.reaction);
  if (nestedReaction && hasOwn(nestedReaction, "text") && String(nestedReaction.text ?? "").trim() === "") return true;
  return false;
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
  const contentRecord = reactionRecord(message.content);
  const bodyRecord = reactionRecord(message.body);
  const records = nestedRecords(message);

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
  let emoji = firstString(
    reactionTextFromRecord(nested),
    flatReaction,
    message.emoji,
    message.reaction_text,
    message.reactionText,
    reactionTextFromRecord(contentRecord),
    reactionTextFromRecord(bodyRecord),
    reactionTextFromRecord(messageContent),
    ...records.map(reactionTextFromRecord),
  );
  if (!emoji && declaredType.includes("reaction")) {
    emoji = firstString(message.reaction_text, message.text, message.body);
    if (!emoji && typeof message.content === "string") emoji = message.content.trim();
    if (/^\[rea[cç][aã]o\]$/i.test(emoji)) emoji = "";
  }
  if (emoji.length > 64) emoji = "";

  const explicitRemoval = records.some(hasExplicitEmptyReaction);
  const operation: NormalizedZappReaction["operation"] = emoji
    ? "set"
    : explicitRemoval
      ? "remove"
      : "deferred";

  return {
    targetId,
    emoji,
    operation,
    fromMe: message.fromMe === true || message.from_me === true || nested?.fromMe === true || nestedKey?.fromMe === true,
    senderJid: firstString(message.participant, message.sender, nested?.sender, message.chatid),
    senderName: firstString(message.senderName, message.pushName) || null,
  };
}

export function zappMessageIdSuffix(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes(":") ? trimmed.split(":").slice(1).join(":") : trimmed;
}