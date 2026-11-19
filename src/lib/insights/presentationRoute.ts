/**
 * Rotas de painel do Insights — superfícies de apresentação.
 *
 * As TVs espelham exatamente esses dashboards, então tudo que "pula" na tela
 * (avisos flutuantes, sininho de notificações) deve ficar de fora deles.
 * A regra é a mesma para o cabeçalho, o rodapé mobile e os toasteres.
 */
export function isInsightsDashboardRoute(pathname: string): boolean {
  return pathname === "/insights" || pathname.startsWith("/insights/");
}
