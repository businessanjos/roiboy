/**
 * Escolhe um único item ativo entre destinos de navegação, considerando
 * pathname e query string (ex.: /roy-zapp?view=inbox vs ?view=analytics).
 * Retorna -1 quando nenhum casa.
 */
export function pickActiveNavIndex(targets: string[], pathname: string, search: string): number {
  const current = new URLSearchParams(search);
  let best = -1;
  let bestScore = -1;
  targets.forEach((to, idx) => {
    const [path, query = ""] = to.split("?");
    const pathMatch = pathname === path || pathname.startsWith(path + "/");
    if (!pathMatch) return;
    const params = new URLSearchParams(query);
    let queryMatches = 0;
    for (const [k, v] of params.entries()) {
      if (current.get(k) !== v) return; // query exigida e diferente → não é este
      queryMatches++;
    }
    // Caminho mais específico vence; empate decidido por mais parâmetros casados.
    const score = path.length * 100 + queryMatches;
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  });
  return best;
}

/**
 * Destino ativo único dentro de uma lista completa (ex.: todos os itens do
 * setor). Retorna o `to` vencedor ou null. Use a lista completa para que uma
 * rota filha mais específica (ex.: /clients/medicos) nunca marque o pai.
 */
export function resolveActiveTarget(targets: string[], pathname: string, search: string): string | null {
  const idx = pickActiveNavIndex(targets, pathname, search);
  return idx === -1 ? null : targets[idx];
}
