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
import { PERMISSIONS, usePermissions } from "@/hooks/usePermissions";
import { ProfileContent } from "@/components/profile/ProfileContent";

import { MeetingPreferencesCard } from "@/components/settings/MeetingPreferencesCard";
import { PlanUsageCard } from "@/components/plan";

import { ApiKeyTab } from "@/components/profile/ApiKeyTab";
import { TechProjectsTokensManager } from "@/components/settings/TechProjectsTokensManager";

export default function Settings() {
  const [searchParams] = useSearchParams();
  const { hasVendasAccess } = useSectorAccess();
  const { currentUser } = useCurrentUser();
  const { isAdmin, hasPermission } = usePermissions();
  const canViewSettings = isAdmin || hasPermission(PERMISSIONS.SETTINGS_VIEW);
  const canEditSettings = isAdmin || hasPermission(PERMISSIONS.SETTINGS_EDIT);

  const activeTab = searchParams.get("tab") || "profile";

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileContent />;
      case "meetings":
        return <MeetingPreferencesCard />;
      case "plan":
        return canViewSettings ? (
          <div className="space-y-6">
            <PlanUsageCard />
          </div>
        ) : null;
      case "team":
        return isAdmin ? <TeamManager /> : null;
      case "sectors":
        return isAdmin ? (
          <div className="space-y-4">
            <UserSectorAccessManager />
            <SectorPinSettings />
          </div>
        ) : null;
      case "sales":
        return hasVendasAccess && canEditSettings ? (
          <div className="space-y-6">
            <ActivityTypesManager />
            <LossReasonsManager />
          </div>
        ) : null;
      case "integrations":
        return canEditSettings ? <IntegrationsContent /> : null;
      case "security":
        return canViewSettings ? (
          <div className="space-y-4">
            <SessionsManager />
            <SecurityAuditViewer />
          </div>
        ) : null;
      case "members-book":
        return null;
      case "api-key":
        return isAdmin && currentUser ? (
          <ApiKeyTab userId={currentUser.id} accountId={currentUser.account_id} />
        ) : null;
      case "tech-tokens":
        return isAdmin ? <TechProjectsTokensManager /> : null;
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
