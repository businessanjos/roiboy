/** Reconhece, pelas mensagens já enviadas no RoyZapp, quais etapas do Onboarding a consultora já fez.
 * Só olha mensagens enviadas pela equipe (saída). Pura: sem banco, fácil de testar. */
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const RULES: [string, (t: string) => boolean][] = [
  ["0-0", (t) => /boas.?vindas|seja bem.?vind/.test(t)],
  ["0-1", (t) => /rykasystem|clinica ryka/.test(t) && /senha|login|acesso/.test(t)],
  ["0-2", (t) => /grupo/.test(t) && /mentoria|whats/.test(t)],
  ["1-0", (t) => /cadastro empresarial|\/f\/f53653f9/.test(t)],
  ["2-0", (t) => /meet\.google\.com/.test(t)],
];

export function detectOnboardingSteps(messages: { content?: string | null; direction?: string | null }[]): Set<string> {
  const found = new Set<string>();
  for (const m of messages) {
    if (m.direction !== "outbound" || !m.content) continue;
    const t = norm(m.content);
    for (const [k, test] of RULES) if (test(t)) found.add(k);
  }
  return found;
}
