import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Book, Plug, Users, UserCircle, Target, User, CreditCard, Receipt, Video, Key } from "lucide-react";
import { SessionsManager } from "@/components/settings/SessionsManager";
import { SecurityAuditViewer } from "@/components/settings/SecurityAuditViewer";
import { MembersBookSettings } from "@/components/settings/MembersBookSettings";
import { IntegrationsContent } from "@/components/integrations/IntegrationsContent";
import { UserSectorAccessManager } from "@/components/settings/UserSectorAccessManager";
import { TeamManager } from "@/components/settings/TeamManager";
import { ActivityTypesManager } from "@/components/sales";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { SectorPinSettings } from "@/components/settings/SectorPinSettings";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { useMemo } from "react";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { SubscriptionManager } from "@/components/settings/SubscriptionManager";
import { MeetingPreferencesCard } from "@/components/settings/MeetingPreferencesCard";
import { PlanUsageCard } from "@/components/plan";
import { BillingContent } from "@/components/billing/BillingContent";
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
    return !!role && RESTRICTED_ROLES.includes(role) && !isAdminUser;
  }, [currentUser?.team_role_name, currentUser?.role, currentUser?.is_also_admin]);

  // Support ?tab= query param for backward compat with /profile?tab=subscription etc.
  const defaultTab = searchParams.get("tab") || (isSalesRep ? "profile" : "profile");

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie seu perfil, equipe, segurança e configurações do sistema.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="flex-wrap">
          {/* Profile tabs - always visible */}
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Meu Perfil
          </TabsTrigger>
          <TabsTrigger value="usage" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Uso do Plano
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Assinatura
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <Receipt className="h-4 w-4" />
            Cobranças
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2">
            <Video className="h-4 w-4" />
            Reuniões
          </TabsTrigger>

          {/* Admin/Manager only tabs */}
          {!isSalesRep && (
            <>
              <TabsTrigger value="team" className="gap-2">
                <UserCircle className="h-4 w-4" />
                Equipe
              </TabsTrigger>
              <TabsTrigger value="sectors" className="gap-2">
                <Users className="h-4 w-4" />
                Setores
              </TabsTrigger>
            </>
          )}
          {hasVendasAccess && !isSalesRep && (
            <TabsTrigger value="sales" className="gap-2">
              <Target className="h-4 w-4" />
              Vendas
            </TabsTrigger>
          )}
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="members-book" className="gap-2">
            <Book className="h-4 w-4" />
            Members Book
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="api-key" className="gap-2">
              <Key className="h-4 w-4" />
              API Key
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile tabs content */}
        <TabsContent value="profile" className="space-y-4">
          <ProfileContent />
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <PlanUsageCard />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionManager />
        </TabsContent>

        <TabsContent value="billing">
          <BillingContent />
        </TabsContent>

        <TabsContent value="meetings" className="space-y-6">
          <MeetingPreferencesCard />
        </TabsContent>

        {/* Admin/Manager tabs content */}
        {!isSalesRep && (
          <>
            <TabsContent value="team" className="space-y-4">
              <TeamManager />
            </TabsContent>

            <TabsContent value="sectors" className="space-y-4">
              <UserSectorAccessManager />
              <SectorPinSettings />
            </TabsContent>
          </>
        )}

        {hasVendasAccess && (
          <TabsContent value="sales" className="space-y-4">
            <ActivityTypesManager />
          </TabsContent>
        )}

        <TabsContent value="integrations" className="space-y-4">
          <IntegrationsContent />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SessionsManager />
          <SecurityAuditViewer />
        </TabsContent>

        <TabsContent value="members-book" className="space-y-4">
          <MembersBookSettings />
        </TabsContent>

        {isAdmin && currentUser && (
          <TabsContent value="api-key" className="space-y-6">
            <ApiKeyTab userId={currentUser.id} accountId={currentUser.account_id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
