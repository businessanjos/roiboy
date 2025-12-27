import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Book, Plug, Users } from "lucide-react";
import { SessionsManager } from "@/components/settings/SessionsManager";
import { SecurityAuditViewer } from "@/components/settings/SecurityAuditViewer";
import { MembersBookSettings } from "@/components/settings/MembersBookSettings";
import { IntegrationsContent } from "@/components/integrations/IntegrationsContent";
import { UserSectorAccessManager } from "@/components/settings/UserSectorAccessManager";

export default function Settings() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie segurança, integrações e configurações do sistema.
        </p>
      </div>

      <Tabs defaultValue="sectors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sectors" className="gap-2">
            <Users className="h-4 w-4" />
            Setores
          </TabsTrigger>
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

        <TabsContent value="sectors" className="space-y-4">
          <UserSectorAccessManager />
        </TabsContent>

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
