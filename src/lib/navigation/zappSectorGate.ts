/**
 * Aviso ao clicar em uma tela do ROY zAPP sem setor de WhatsApp selecionado.
 *
 * Sem `?sector=` na URL, o RoyZapp sempre mostra a tela "Escolha o setor para
 * atender" — o clique no menu muda a URL (`?view=tags`, `?view=team`…) mas
 * nenhuma tela abre, então parece que o botão está quebrado. Em vez de deixar
 * o clique mudo, devolvemos o aviso do que falta.
 *
 * Regras:
 * - Só vale dentro do ROY zAPP (`/roy-zapp`, incluindo `/roy-zapp/atendimentos`).
 * - Se a URL já tem `sector`, a tela abre de verdade e não há aviso.
 * - Sem nenhum WhatsApp liberado para a pessoa, o aviso é outro: não adianta
 *   pedir para escolher um setor que ela não pode abrir.
 */
export function zappSectorGateMessage(params: {
  pathname: string;
  search: string;
  hasOpenableSector: boolean;
}): string | null {
  const { pathname, search, hasOpenableSector } = params;
  if (!pathname.startsWith("/roy-zapp")) return null;
  if (new URLSearchParams(search).get("sector")) return null;
  return hasOpenableSector
    ? "Selecione o setor desejado"
    : "Nenhum WhatsApp liberado para o seu usuário";
}
