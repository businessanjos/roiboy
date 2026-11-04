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
