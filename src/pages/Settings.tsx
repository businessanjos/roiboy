import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Book } from "lucide-react";
import { SessionsManager } from "@/components/settings/SessionsManager";
import { SecurityAuditViewer } from "@/components/settings/SecurityAuditViewer";
import { MembersBookSettings } from "@/components/settings/MembersBookSettings";

export default function Settings() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie segurança e configurações do Members Book.
        </p>
      </div>

      <Tabs defaultValue="security" className="space-y-4">
        <TabsList>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="members-book" className="gap-2">
            <Book className="h-4 w-4" />
            Members Book
          </TabsTrigger>
        </TabsList>

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
