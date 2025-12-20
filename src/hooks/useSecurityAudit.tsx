import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export type SecurityEventType = 
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_reset_request'
  | 'password_reset_success'
  | 'signup_success'
  | 'admin_action'
  | 'permission_denied'
  | 'suspicious_activity';

interface SecurityAuditDetails {
  action?: string;
  target_id?: string;
  target_type?: string;
  error_message?: string;
  [key: string]: unknown;
}

export function useSecurityAudit() {
  const { currentUser } = useCurrentUser();

  const logSecurityEvent = useCallback(async (
    eventType: SecurityEventType,
    details?: SecurityAuditDetails
  ) => {
    try {
      // Get client info
      const userAgent = navigator.userAgent;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertPayload: any = {
        event_type: eventType,
        user_id: currentUser?.id || null,
        account_id: currentUser?.account_id || null,
        user_agent: userAgent,
        details: details ? JSON.parse(JSON.stringify(details)) : {}
      };
      
      const { error } = await supabase
        .from('security_audit_logs')
        .insert([insertPayload]);

      if (error) {
        console.error('Failed to log security event:', error);
      }
    } catch (err) {
      // Don't throw - logging should not break the app
      console.error('Error logging security event:', err);
    }
  }, [currentUser]);

  const logLoginSuccess = useCallback(() => {
    logSecurityEvent('login_success');
  }, [logSecurityEvent]);

  const logLoginFailure = useCallback((errorMessage?: string) => {
    logSecurityEvent('login_failure', { error_message: errorMessage });
  }, [logSecurityEvent]);

  const logLogout = useCallback(() => {
    logSecurityEvent('logout');
  }, [logSecurityEvent]);

  const logPasswordResetRequest = useCallback((email: string) => {
    // Don't log the actual email for privacy, just that a request was made
    logSecurityEvent('password_reset_request', { email_domain: email.split('@')[1] });
  }, [logSecurityEvent]);

  const logPasswordResetSuccess = useCallback(() => {
    logSecurityEvent('password_reset_success');
  }, [logSecurityEvent]);

  const logSignupSuccess = useCallback(() => {
    logSecurityEvent('signup_success');
  }, [logSecurityEvent]);

  const logAdminAction = useCallback((action: string, targetId?: string, targetType?: string) => {
    logSecurityEvent('admin_action', { action, target_id: targetId, target_type: targetType });
  }, [logSecurityEvent]);

  const logPermissionDenied = useCallback((action: string) => {
    logSecurityEvent('permission_denied', { action });
  }, [logSecurityEvent]);

  const logSuspiciousActivity = useCallback((description: string, details?: Record<string, unknown>) => {
    logSecurityEvent('suspicious_activity', { description, ...details });
  }, [logSecurityEvent]);

  return {
    logSecurityEvent,
    logLoginSuccess,
    logLoginFailure,
    logLogout,
    logPasswordResetRequest,
    logPasswordResetSuccess,
    logSignupSuccess,
    logAdminAction,
    logPermissionDenied,
    logSuspiciousActivity
  };
}