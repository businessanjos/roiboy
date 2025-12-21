import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LoginSecurityResult {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutMinutes: number;
}

// Generate a simple device fingerprint
function generateDeviceFingerprint(): string {
  const { userAgent, language, platform } = navigator;
  const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const fingerprint = `${userAgent}|${language}|${platform}|${screenInfo}|${timezone}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16);
}

export function useLoginSecurity() {
  const [isCheckingLock, setIsCheckingLock] = useState(false);

  const checkAccountLock = useCallback(async (email: string): Promise<LoginSecurityResult> => {
    setIsCheckingLock(true);
    try {
      const { data, error } = await supabase.rpc('is_account_locked', { p_email: email });
      
      if (error) {
        console.error('Error checking account lock:', error);
        return { isLocked: false, remainingAttempts: 5, lockoutMinutes: 0 };
      }
      
      if (data) {
        return { isLocked: true, remainingAttempts: 0, lockoutMinutes: 15 };
      }
      
      // Get remaining attempts count
      const { count } = await supabase
        .from('login_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('email', email.toLowerCase())
        .eq('success', false)
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
      
      const attempts = count || 0;
      return { isLocked: false, remainingAttempts: Math.max(0, 5 - attempts), lockoutMinutes: 0 };
    } catch (err) {
      console.error('Error in checkAccountLock:', err);
      return { isLocked: false, remainingAttempts: 5, lockoutMinutes: 0 };
    } finally {
      setIsCheckingLock(false);
    }
  }, []);

  const recordLoginAttempt = useCallback(async (
    email: string,
    success: boolean,
    ipAddress?: string
  ): Promise<void> => {
    try {
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_ip_address: ipAddress || 'unknown',
        p_user_agent: navigator.userAgent,
        p_success: success
      });
    } catch (err) {
      console.error('Error recording login attempt:', err);
    }
  }, []);

  const checkNewDevice = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const fingerprint = generateDeviceFingerprint();
      const { data, error } = await supabase.rpc('is_new_device', {
        p_user_id: userId,
        p_device_fingerprint: fingerprint
      });
      
      if (error) {
        console.error('Error checking new device:', error);
        return false;
      }
      
      return data === true;
    } catch (err) {
      console.error('Error in checkNewDevice:', err);
      return false;
    }
  }, []);

  const registerSession = useCallback(async (
    userId: string,
    accountId: string,
    sessionToken: string
  ): Promise<void> => {
    try {
      const fingerprint = generateDeviceFingerprint();
      
      // First, clean up any existing sessions with same fingerprint for this user
      await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('device_fingerprint', fingerprint);
      
      const { error } = await supabase.from('user_sessions').insert({
        user_id: userId,
        account_id: accountId,
        session_token: sessionToken,
        ip_address: 'client-side',
        user_agent: navigator.userAgent,
        device_fingerprint: fingerprint,
        is_trusted: false,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      
      if (error) {
        console.error('Error inserting session:', error);
      }
    } catch (err) {
      console.error('Error registering session:', err);
    }
  }, []);

  const trustDevice = useCallback(async (sessionId: string): Promise<void> => {
    try {
      await supabase
        .from('user_sessions')
        .update({ is_trusted: true })
        .eq('id', sessionId);
    } catch (err) {
      console.error('Error trusting device:', err);
    }
  }, []);

  const terminateSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId);
    } catch (err) {
      console.error('Error terminating session:', err);
    }
  }, []);

  const terminateAllSessions = useCallback(async (userId: string, exceptSessionId?: string): Promise<void> => {
    try {
      let query = supabase.from('user_sessions').delete().eq('user_id', userId);
      
      if (exceptSessionId) {
        query = query.neq('id', exceptSessionId);
      }
      
      await query;
    } catch (err) {
      console.error('Error terminating all sessions:', err);
    }
  }, []);

  const getDeviceFingerprint = useCallback((): string => {
    return generateDeviceFingerprint();
  }, []);

  return {
    isCheckingLock,
    checkAccountLock,
    recordLoginAttempt,
    checkNewDevice,
    registerSession,
    trustDevice,
    terminateSession,
    terminateAllSessions,
    getDeviceFingerprint
  };
}
