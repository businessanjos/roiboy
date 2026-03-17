import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Book, Plug, Users, UserCircle, Target } from "lucide-react";
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
import { useMemo } from "react";

const RESTRICTED_ROLES = ["SDR", "Closer", "Vendas", "Vendedor"];

export default function Settings() {
  const { hasVendasAccess } = useSectorAccess();
  const { currentUser } = useCurrentUser();

  const isSalesRep = useMemo(() => {
    const role = currentUser?.team_role_name;
    const isAdmin = currentUser?.role === "admin" || currentUser?.is_also_admin;
    return !!role && RESTRICTED_ROLES.includes(role) && !isAdmin;
  }, [currentUser?.team_role_name, currentUser?.role, currentUser?.is_also_admin]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie equipe, segurança, integrações e configurações do sistema.
        </p>
      </div>

      <Tabs defaultValue="team" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="team" className="gap-2">
            <UserCircle className="h-4 w-4" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="sectors" className="gap-2">
            <Users className="h-4 w-4" />
            Setores
          </TabsTrigger>
          {hasVendasAccess && (
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
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          <TeamManager />
        </TabsContent>

        <TabsContent value="sectors" className="space-y-4">
          <UserSectorAccessManager />
          <SectorPinSettings />
        </TabsContent>

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
      </Tabs>
    </div>
  );
}
