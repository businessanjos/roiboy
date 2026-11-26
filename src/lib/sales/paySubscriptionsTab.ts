/** A aba Assinaturas (RykaPay) do negócio só existe depois do ganho; antes disso nada é consultado. */
export function canShowPaySubscriptions(dealStatus: string | null | undefined): boolean {
  return dealStatus === "won";
}

/** Aba efetivamente aberta: se Assinaturas não pode aparecer, volta para o Histórico. */
export function resolveDealDetailTab(activeTab: string, dealStatus: string | null | undefined): string {
  return activeTab === "pay-subscriptions" && !canShowPaySubscriptions(dealStatus) ? "history" : activeTab;
}
