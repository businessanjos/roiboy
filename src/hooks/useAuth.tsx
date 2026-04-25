import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error?: Error; redirected?: boolean }>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Safety timeout - force loading to false after 5s
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        setLoading(prev => {
          if (prev) {
            console.warn("[useAuth] Safety timeout: forcing loading to false after 5s");
            return false;
          }
          return prev;
        });
      }
    }, 5000);

    // Helper: check if the server has marked this user for forced re-login.
    // If yes, sign out immediately so they pick up the new role/permissions.
    const enforceForceRelogin = async (currentSession: Session) => {
      try {
        // Use the real login timestamp, not the JWT iat.
        // A background token refresh can create a new iat after force_relogin_at,
        // which would incorrectly let an old browser session keep access.
        const sessionStartedAtMs = currentSession.user.last_sign_in_at
          ? new Date(currentSession.user.last_sign_in_at).getTime()
          : (() => {
              try {
                const payload = JSON.parse(
                  atob(currentSession.access_token.split(".")[1])
                );
                return typeof payload.iat === "number" ? payload.iat * 1000 : Date.now();
              } catch {
                return Date.now();
              }
            })();

        const { data, error } = await supabase.rpc("check_force_relogin", {
          p_session_issued_at: new Date(sessionStartedAtMs).toISOString(),
        });
        if (error) {
          console.warn("[useAuth] force_relogin check failed:", error.message);
          return false;
        }
        if (data === true) {
          console.warn("[useAuth] Server requested forced re-login. Signing out.");
          await supabase.auth.signOut();
          if (mounted) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return true;
        }
      } catch (err) {
        console.warn("[useAuth] force_relogin check threw:", err);
      }
      return false;
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;
        
        // Only update if there's a meaningful change.
        // IMPORTANT: For TOKEN_REFRESHED keep the previous user reference if the
        // user id hasn't changed, so downstream effects keyed on user don't re-run
        // and create a fetch loop.
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setLoading(false);
        } else if (currentSession) {
          setSession(currentSession);
          setUser((prev) =>
            prev && prev.id === currentSession.user.id ? prev : currentSession.user
          );
          setLoading(false);

          // Defer the RPC check so we don't block the auth listener.
          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
            setTimeout(() => {
              if (mounted) void enforceForceRelogin(currentSession);
            }, 0);
          }
        }
      }
    );

    // THEN check for existing session
    const initializeSession = async () => {
      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error("Error getting session:", error);
          setLoading(false);
          return;
        }
        
        if (existingSession) {
          setSession(existingSession);
          setUser(existingSession.user);
          // Check forced re-login on resume
          setTimeout(() => {
            if (mounted) void enforceForceRelogin(existingSession);
          }, 0);
        }
        setLoading(false);
      } catch (err) {
        console.error("Session initialization error:", err);
        if (mounted) setLoading(false);
      }
    };

    initializeSession();

    // Re-check force_relogin whenever the tab regains focus, so a super admin's
    // role/email/password/inactivation changes apply within seconds instead of
    // waiting for the next ~1h token refresh.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (mounted && s) void enforceForceRelogin(s);
      });
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: {
        prompt: "select_account",
      },
    });

    return {
      error: result.error instanceof Error ? result.error : result.error ? new Error(String(result.error)) : undefined,
      redirected: result.redirected,
    };
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { 
          name,
          full_name: name,
          phone,
        },
      },
    });

    // Note: account and user records are created automatically by the 
    // handle_new_user trigger in the database

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signInWithGoogle, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
