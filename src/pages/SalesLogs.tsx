import { useMemo } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { isManagementUser } from "@/lib/access/managementRoles";

/**
 * Logs da equipe comercial — exclusivo para gestores e administradores.
 */
export default function SalesLogs() {
  const { currentUser, loading } = useCurrentUser();
  const { isSuperAdmin } = useSuperAdmin();

  const allowed = useMemo(
    () => isManagementUser(currentUser, isSuperAdmin),
    [currentUser, isSuperAdmin],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-warning" />
              <CardTitle>Acesso restrito</CardTitle>
            </div>
            <CardDescription>
              Os logs da equipe comercial são exclusivos para Gerentes, Diretores, C-Levels,
              Sócios e Administradores.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Logs</h1>
        <p className="text-sm text-muted-foreground">
          Histórico do que a equipe comercial fez em negócios e tarefas.
        </p>
      </div>
      <AuditLogViewer scope="commercial" />
    </div>
  );
}
