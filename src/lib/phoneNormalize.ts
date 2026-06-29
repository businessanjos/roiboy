/**
 * Frontend mirror de supabase/functions/_shared/phone-normalize.ts
 * Mantém o mesmo comportamento para lookups tolerantes de telefone (BR).
 */

const BR_DDI = "55";

export function digitsOnly(input: string): string {
  return (input || "").replace(/\D/g, "");
}

export function canonicalE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  const d = digitsOnly(raw);
  if (d.length < 8) return null;

  const hasPlus = raw.startsWith("+");
  if (hasPlus && !d.startsWith(BR_DDI)) return `+${d}`;

  if (d.startsWith(BR_DDI) && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    if (rest.length === 8 && /^[6-9]/.test(rest)) {
      return `+${BR_DDI}${ddd}9${rest}`;
    }
    return `+${d}`;
  }

  if (!hasPlus && !d.startsWith(BR_DDI) && (d.length === 10 || d.length === 11)) {
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    if (rest.length === 8 && /^[6-9]/.test(rest)) {
      return `+${BR_DDI}${ddd}9${rest}`;
    }
    return `+${BR_DDI}${d}`;
  }

  return `+${d}`;
}

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
    set.add(canonical.slice(1));
  }

  if (canonical && canonical.startsWith(`+${BR_DDI}`) && canonical.length === 14) {
    const ddd = canonical.slice(3, 5);
    const subscriber = canonical.slice(5);
    const without9 = subscriber.slice(1);

    set.add(`+${BR_DDI}${ddd}${subscriber}`);
    set.add(`${BR_DDI}${ddd}${subscriber}`);
    set.add(`+${BR_DDI}${ddd}${without9}`);
    set.add(`${BR_DDI}${ddd}${without9}`);
    set.add(`+${ddd}${subscriber}`);
    set.add(`${ddd}${subscriber}`);
    set.add(`+${ddd}${without9}`);
    set.add(`${ddd}${without9}`);
  }

  return Array.from(set);
}

export function phoneCoreKey(input: string | null | undefined): string | null {
  if (!input) return null;
  const d = digitsOnly(String(input));
  if (d.length < 10) return null;
  const ddd = d.length >= 12 ? d.slice(-11, -9) : d.slice(0, 2);
  const last8 = d.slice(-8);
  return `${ddd}${last8}`;
}
