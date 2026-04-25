import { useSearchParams } from "react-router-dom";
import { SessionsManager } from "@/components/settings/SessionsManager";
import { SecurityAuditViewer } from "@/components/settings/SecurityAuditViewer";

import { IntegrationsContent } from "@/components/integrations/IntegrationsContent";
import { UserSectorAccessManager } from "@/components/settings/UserSectorAccessManager";
import { TeamManager } from "@/components/settings/TeamManager";
import { ActivityTypesManager } from "@/components/sales";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { LossReasonsManager } from "@/components/settings/LossReasonsManager";
import { SectorPinSettings } from "@/components/settings/SectorPinSettings";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { useMemo } from "react";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { roleNameMatches } from "@/lib/roles";

import { MeetingPreferencesCard } from "@/components/settings/MeetingPreferencesCard";
import { PlanUsageCard } from "@/components/plan";

import { ApiKeyTab } from "@/components/profile/ApiKeyTab";

const RESTRICTED_ROLES = ["SDR", "Closer", "Vendas", "Vendedor"];

export default function Settings() {
  const [searchParams] = useSearchParams();
  const { hasVendasAccess } = useSectorAccess();
  const { currentUser } = useCurrentUser();
  const { isAdmin } = usePermissions();

  const isSalesRep = useMemo(() => {
    const role = currentUser?.team_role_name;
    const isAdminUser = currentUser?.role === "admin" || currentUser?.is_also_admin;
    return roleNameMatches(role, RESTRICTED_ROLES) && !isAdminUser;
  }, [currentUser?.team_role_name, currentUser?.role, currentUser?.is_also_admin]);

  const activeTab = searchParams.get("tab") || "profile";

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileContent />;
      case "meetings":
        return <MeetingPreferencesCard />;
      case "plan":
        return (
          <div className="space-y-6">
            <PlanUsageCard />
          </div>
        );
      case "team":
        return !isSalesRep ? <TeamManager /> : null;
      case "sectors":
        return !isSalesRep ? (
          <div className="space-y-4">
            <UserSectorAccessManager />
            <SectorPinSettings />
          </div>
        ) : null;
      case "sales":
        return hasVendasAccess ? (
          <div className="space-y-6">
            <ActivityTypesManager />
            <LossReasonsManager />
          </div>
        ) : null;
      case "integrations":
        return <IntegrationsContent />;
      case "security":
        return (
          <div className="space-y-4">
            <SessionsManager />
            <SecurityAuditViewer />
          </div>
        );
      case "members-book":
        return null;
      case "api-key":
        return isAdmin && currentUser ? (
          <ApiKeyTab userId={currentUser.id} accountId={currentUser.account_id} />
        ) : null;
      default:
        return <ProfileContent />;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      {renderContent()}
    </div>
  );
}
