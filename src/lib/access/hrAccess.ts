import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserSectorAccess } from "@/hooks/useUserSectorAccess";

/**
 * Lista histórica de e-mails com acesso ao RH. Mantida como atalho, mas o
 * acesso oficial agora vem do painel de administração (setor "rh" ativo),
 * para que liberar alguém não exija alterar código.
 */
export const RH_ALLOWED_EMAILS = [
  "m.quintana@me.com",
  "coachevertonsantos@gmail.com",
  "rh@anjosbusiness.com.br",
  "diessica@consultoria-luma.com",
  "jaqueline@consultoria-luma.com",
  "brualmeida.est@hotmail.com",
  "arthur.mudri@hotmail.com",
  "jessicamarcato@anjosbusiness.com",
  "anjosgroup.dados@anjosbusiness.com",
];

export function emailHasHRAccess(email?: string | null): boolean {
  return RH_ALLOWED_EMAILS.includes((email || "").toLowerCase());
}

/**
 * true  = pode ver o RH
 * false = bloqueado
 * null  = ainda carregando (não redirecionar)
 */
export function useCanAccessHR(): boolean | null {
  const { currentUser, loading } = useCurrentUser();
  const { sectorAccess, loading: sectorLoading } = useUserSectorAccess();

  if (loading || !currentUser) return null;
  if (emailHasHRAccess(currentUser.email)) return true;
  if (sectorLoading) return null;
  return sectorAccess.some((a) => a.sector_id === "rh" && a.is_active);
}
