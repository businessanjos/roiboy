// Contatos internos = números da própria equipe (registro manual em
// zapp_internal_contacts + telefones dos colaboradores). Eles não são
// atendimento de cliente: a mesma regra do RPC zapp_productivity_metrics.

/** Espelho de public.zapp_phone_core(text): só dígitos, DDD + últimos 8. */
export function zappPhoneCore(phone: string | null | undefined): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const n = digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (n.length < 10) return n || null;
  return n.slice(0, 2) + n.slice(-8);
}

export function buildInternalCoreSet(
  phones: (string | null | undefined)[],
): Set<string> {
  const cores = new Set<string>();
  for (const phone of phones) {
    const core = zappPhoneCore(phone);
    if (core) cores.add(core);
  }
  return cores;
}

export function isInternalContactPhone(
  phone: string | null | undefined,
  cores: Set<string>,
): boolean {
  if (!cores.size) return false;
  const core = zappPhoneCore(phone);
  return !!core && cores.has(core);
}

/**
 * Telefones de um cadastro de cliente: o principal mais os extras
 * (clients.additional_phones, um array jsonb que costuma vir como strings).
 */
export function clientRecordPhones(record: {
  phone_e164?: string | null;
  additional_phones?: unknown;
}): (string | null)[] {
  const phones: (string | null)[] = [record.phone_e164 ?? null];
  const extras = record.additional_phones;
  if (Array.isArray(extras)) {
    for (const item of extras) {
      if (typeof item === "string") {
        phones.push(item);
      } else if (item && typeof item === "object") {
        const entry = item as Record<string, unknown>;
        for (const key of ["phone", "phone_e164", "value", "number"]) {
          const value = entry[key];
          if (typeof value === "string") {
            phones.push(value);
            break;
          }
        }
      }
    }
  }
  return phones;
}

/**
 * Cadastro de cliente que na verdade é alguém da equipe: o telefone (principal
 * ou extra) bate com um número interno. Apresentação only — o registro fica
 * onde está, só deixa de ser tratado como cliente.
 */
export function isInternalClientRecord(
  record: { phone_e164?: string | null; additional_phones?: unknown },
  cores: Set<string>,
): boolean {
  if (!cores.size) return false;
  return clientRecordPhones(record).some((phone) => isInternalContactPhone(phone, cores));
}
