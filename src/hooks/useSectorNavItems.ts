import { useMemo } from "react";
import { Building2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { useSector } from "@/contexts/SectorContext";
import { roleNameMatches } from "@/lib/roles";
import { isManagementUser } from "@/lib/access/managementRoles";
import { isTrafficAgencyUser } from "@/lib/agency";
import { canViewZappAnalytics } from "@/lib/royZappAnalyticsAccess";
import type { NavItem } from "@/config/sectors";

export const SALES_REP_ROLES = ["SDR", "Closer", "Vendas", "Vendedor"];
export const SDR_ROLES = ["SDR"];
/**
 * Usuários SDR liberados para ver todo o setor Comercial (exceção nominal).
 * Continuam sujeitos aos bloqueios de gestão (ex.: /sales-team, /insights).
 */
export const SDR_FULL_VENDAS_EMAILS = new Set<string>([
  "rafaelaslongo@anjosbusiness.com",
]);
export const SDR_VENDAS_ALLOWED_ROUTES = new Set<string>([
  "/pipeline",
  "/leads",
  "/tasks",
  "/sales-calendar",
  "/clients",
  "/sales/contracts",
]);


/**
 * Itens de navegação do setor atual já filtrados por permissões, cargo e
 * exceções nominais. Fonte única usada pela sidebar (desktop) e pela
 * barra de abas inferior (mobile) para nunca divergirem.
 */
export function useSectorNavItems(): NavItem[] {
  const { currentUser } = useCurrentUser();
  const { isSuperAdmin } = useSuperAdmin();
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();
  const { currentSector } = useSector();

  return useMemo(() => {
    const teamRoleName = currentUser?.team_role_name;

    const showAllItems =
      isAdmin || isSuperAdmin || currentUser?.role === "admin" || currentUser?.is_also_admin;
    const isSalesRepUser = roleNameMatches(teamRoleName, SALES_REP_ROLES) && !showAllItems;

    if (!currentSector) return [];

    if (isTrafficAgencyUser(currentUser)) {
      return [
        { to: "/marketing/portal-agencia", icon: Building2, label: "Portal da Agência" },
      ] as NavItem[];
    }

    if (isSuperAdmin) {
      return currentSector.navItems.filter((item) => item.to !== "/notifications");
    }

    const emailLower = (currentUser?.email || "").toLowerCase();
    const isSdrExempt = SDR_FULL_VENDAS_EMAILS.has(emailLower);
    const isSdrUser = roleNameMatches(teamRoleName, SDR_ROLES) && !showAllItems && !isSdrExempt;

    let sectorItems = currentSector.navItems.filter((item) => item.to !== "/notifications");

    if (isSdrUser && currentSector.id === "vendas") {
      sectorItems = sectorItems.filter((item) => SDR_VENDAS_ALLOWED_ROUTES.has(item.to));
    }


    const userName = (currentUser?.name || "").toLowerCase();
    const userEmail = (currentUser?.email || "").toLowerCase();

    const BONUS_VIEWERS = ["maikol", "jonathan", "everton", "bruna"];
    const canSeeConsultantBonus = BONUS_VIEWERS.some(
      (k) => userName.includes(k) || userEmail.includes(k)
    );
    if (!canSeeConsultantBonus) {
      sectorItems = sectorItems.filter((item) => item.to !== "/operations/consultant-bonus");
    }

    const IG_RANKING_VIEWERS = ["maikol", "bruna", "everton", "jonathan", "andreia"];
    const canSeeIgRanking = IG_RANKING_VIEWERS.some(
      (k) => userName.includes(k) || userEmail.includes(k)
    );
    if (!canSeeIgRanking) {
      sectorItems = sectorItems.filter((item) => item.to !== "/operations/instagram-ranking");
    }

    const canSeeSalesDashboard = isManagementUser(currentUser, isSuperAdmin);
    if (!canSeeSalesDashboard) {
      sectorItems = sectorItems.filter((item) => item.to !== "/sales-dashboard");
    }

    if (userEmail !== "m.quintana@me.com") {
      sectorItems = sectorItems.filter((item) => item.to !== "/marketing/market-intelligence");
    }

    // Produtividade do ROY zAPP: apenas admins e heads (mesma regra da view interna).
    if (!canViewZappAnalytics(currentUser)) {
      sectorItems = sectorItems.filter((item) => !item.to.includes("view=analytics"));
    }

    if (showAllItems) return sectorItems;


    return sectorItems.filter((item) => {
      if (isSalesRepUser && item.to === "/sales-team") return false;
      if (isSalesRepUser && item.to === "/insights") return false;
      if (!item.permission) return true;
      if (permissionsLoading) return false;
      return hasPermission(item.permission);
    });
  }, [
    hasPermission,
    permissionsLoading,
    isSuperAdmin,
    isAdmin,
    currentSector,
    currentUser?.role,
    currentUser?.is_also_admin,
    currentUser?.team_role_name,
    currentUser?.name,
    currentUser?.email,
  ]);
}
