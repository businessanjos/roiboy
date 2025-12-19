import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import type { Json } from "@/integrations/supabase/types";

type AuditAction = 
  | "create" 
  | "update" 
  | "delete" 
  | "login" 
  | "logout" 
  | "view" 
  | "export" 
  | "import"
  | "assign"
  | "complete"
  | "archive";

type EntityType = 
  | "client" 
  | "user" 
  | "event" 
  | "task" 
  | "contract" 
  | "product" 
  | "form" 
  | "followup"
  | "subscription"
  | "settings"
  | "integration"
  | "role"
  | "permission";

interface LogAuditParams {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  details?: Json;
}

export function useAuditLog() {
  const { currentUser } = useCurrentUser();

  const logAudit = useCallback(async ({
    action,
    entityType,
    entityId,
    entityName,
    details = {}
  }: LogAuditParams) => {
    if (!currentUser) return;

    try {
      await supabase.from("audit_logs").insert([{
        account_id: currentUser.account_id,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_email: currentUser.email,
        action,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        details,
        user_agent: navigator.userAgent
      }]);
    } catch (error) {
      console.error("Error logging audit:", error);
    }
  }, [currentUser]);

  return { logAudit };
}
