/**
 * Normalização única de telefones para o ROY Eternum.
 *
 * Problema resolvido:
 *   Os mesmos números aparecem em formatos divergentes em clients/leads/deals/zapp_conversations:
 *     +5551992956336  (correto, E.164)
 *      5551992956336  (sem +)
 *     +555192956336   (sem 9º dígito)
 *      555192956336   (sem + e sem 9º dígito)
 *      51992956336    (sem DDI, com 9)
 *      5192956336     (sem DDI, sem 9)
 *
 * Estratégia:
 *   - canonicalE164(): formato canônico +55DDD9XXXXXXXX (com 9º dígito quando aplicável)
 *   - phoneVariants(): TODAS as variações possíveis, para queries `.in("phone_e164", variants)`
 *   - phoneCoreKey(): chave normalizada (DDD + últimos 8 dígitos) para deduplicação
 */

const BR_DDI = "55";

/** Remove tudo que não é dígito. */
export function digitsOnly(input: string): string {
  return (input || "").replace(/\D/g, "");
}

/**
 * Retorna o formato canônico E.164 com correções para celulares brasileiros.
 * Adiciona o 9º dígito quando faltar e o DDI +55 quando faltar.
 * Para números não-BR, apenas garante o `+`.
 */
export function canonicalE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const d = digitsOnly(input);
  if (d.length < 8) return null;

  // BR: DDI 55
  if (d.startsWith(BR_DDI) && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    // Celular BR moderno: DDD + 9 + 8 dígitos. Se faltar o 9º dígito, injeta.
    if (rest.length === 8 && /^[6-9]/.test(rest)) {
      return `+${BR_DDI}${ddd}9${rest}`;
    }
    return `+${d}`;
  }

  // BR sem DDI: DDD + número (10 ou 11 dígitos). Adiciona +55 e 9º dígito se necessário.
  if (!d.startsWith(BR_DDI) && (d.length === 10 || d.length === 11)) {
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    if (rest.length === 8 && /^[6-9]/.test(rest)) {
      return `+${BR_DDI}${ddd}9${rest}`;
    }
    return `+${BR_DDI}${d}`;
  }

  // Estrangeiro (DDI ≠ 55) ou outro formato — só prefixa +
  return `+${d}`;
}

/**
 * Retorna todas as variações plausíveis do número para lookup tolerante.
 * Inclui o canônico, sem 9º dígito, sem DDI, com/sem '+'.
 */
export function phoneVariants(input: string | null | undefined): string[] {
  if (!input) return [];
  const set = new Set<string>();
  const raw = String(input).trim();
  if (raw) set.add(raw);

  const d = digitsOnly(raw);
  if (!d) return Array.from(set);

  const canonical = canonicalE164(raw);
  if (canonical) {
    set.add(canonical);
    set.add(canonical.slice(1)); // sem '+'
  }

  // Variações BR: com/sem 9º dígito, com/sem DDI
  if (canonical && canonical.startsWith(`+${BR_DDI}`) && canonical.length === 14) {
    const ddd = canonical.slice(3, 5);
    const subscriber = canonical.slice(5); // 9XXXXXXXX (9 dígitos)
    const without9 = subscriber.slice(1); // 8 dígitos

    set.add(`+${BR_DDI}${ddd}${subscriber}`); // canônico
    set.add(`${BR_DDI}${ddd}${subscriber}`);
    set.add(`+${BR_DDI}${ddd}${without9}`); // sem 9
    set.add(`${BR_DDI}${ddd}${without9}`);
    set.add(`+${ddd}${subscriber}`); // sem DDI, com 9
    set.add(`${ddd}${subscriber}`);
    set.add(`+${ddd}${without9}`); // sem DDI, sem 9
    set.add(`${ddd}${without9}`);
  }

  // Garante o input bruto e versão só-dígitos
  set.add(d);
  set.add(`+${d}`);

  return Array.from(set).filter((v) => v && v.length >= 8);
}

/**
 * Chave de "núcleo" de comparação: DDD + últimos 8 dígitos (sem 9º, sem DDI).
 * Útil para detectar duplicatas que diferem apenas por formato.
 */
export function phoneCoreKey(input: string | null | undefined): string | null {
  if (!input) return null;
  const d = digitsOnly(input);
  if (d.length >= 12 && d.startsWith(BR_DDI)) {
    return d.slice(2, 4) + d.slice(-8);
  }
  if (d.length === 10 || d.length === 11) {
    return d.slice(0, 2) + d.slice(-8);
  }
  return d.length >= 8 ? d.slice(-10) : null;
}
