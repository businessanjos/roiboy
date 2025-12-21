import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSecurityAudit } from "@/hooks/useSecurityAudit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  Shield, 
  ShieldCheck, 
  LogOut, 
  Trash2,
  Clock,
  MapPin
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserSession {
  id: string;
  user_agent: string;
  ip_address: string | null;
  device_fingerprint: string | null;
  city: string | null;
  country: string | null;
  is_trusted: boolean;
  last_active_at: string;
  created_at: string;
  expires_at: string;
}

function getDeviceIcon(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return <Smartphone className="h-5 w-5" />;
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return <Tablet className="h-5 w-5" />;
  }
  return <Monitor className="h-5 w-5" />;
}

function getDeviceName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  
  // Browser detection
  let browser = "Navegador";
  if (ua.includes('chrome') && !ua.includes('edge')) browser = "Chrome";
  else if (ua.includes('firefox')) browser = "Firefox";
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = "Safari";
  else if (ua.includes('edge')) browser = "Edge";
  else if (ua.includes('opera')) browser = "Opera";
  
  // OS detection
  let os = "";
  if (ua.includes('windows')) os = "Windows";
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = "macOS";
  else if (ua.includes('linux') && !ua.includes('android')) os = "Linux";
  else if (ua.includes('android')) os = "Android";
  else if (ua.includes('iphone') || ua.includes('ipad')) os = "iOS";
  
  return os ? `${browser} em ${os}` : browser;
}

// Generate fingerprint to identify current session
function getCurrentFingerprint(): string {
  const { userAgent, language, platform } = navigator;
  const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const fingerprint = `${userAgent}|${language}|${platform}|${screenInfo}|${timezone}`;
  
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16);
}

export function SessionsManager() {
  const { currentUser } = useCurrentUser();
  const { logSessionTerminated } = useSecurityAudit();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState<string | null>(null);
  const [currentFingerprint] = useState(() => getCurrentFingerprint());

  useEffect(() => {
    if (currentUser?.id) {
      fetchSessions();
    }
  }, [currentUser?.id]);

  const fetchSessions = async () => {
    if (!currentUser?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('last_active_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      toast.error('Erro ao carregar sessões');
    } finally {
      setLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    setTerminating(sessionId);
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      
      logSessionTerminated(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Sessão encerrada');
    } catch (err) {
      console.error('Error terminating session:', err);
      toast.error('Erro ao encerrar sessão');
    } finally {
      setTerminating(null);
    }
  };

  const handleTerminateAllOthers = async () => {
    if (!currentUser?.id) return;
    
    const currentSession = sessions.find(s => s.device_fingerprint === currentFingerprint);
    
    try {
      let query = supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', currentUser.id);
      
      if (currentSession) {
        query = query.neq('id', currentSession.id);
      }
      
      const { error } = await query;
      if (error) throw error;
      
      setSessions(prev => currentSession ? prev.filter(s => s.id === currentSession.id) : []);
      toast.success('Todas as outras sessões foram encerradas');
    } catch (err) {
      console.error('Error terminating all sessions:', err);
      toast.error('Erro ao encerrar sessões');
    }
  };

  const handleTrustDevice = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_trusted: true })
        .eq('id', sessionId);

      if (error) throw error;
      
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, is_trusted: true } : s
      ));
      toast.success('Dispositivo marcado como confiável');
    } catch (err) {
      console.error('Error trusting device:', err);
      toast.error('Erro ao confiar no dispositivo');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sessões Ativas</CardTitle>
          <CardDescription>Gerencie seus dispositivos conectados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Sessões Ativas
            </CardTitle>
            <CardDescription>
              {sessions.length} {sessions.length === 1 ? 'dispositivo conectado' : 'dispositivos conectados'}
            </CardDescription>
          </div>
          {sessions.length > 1 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair de todos
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Encerrar todas as sessões?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso desconectará todos os outros dispositivos. Você permanecerá conectado neste dispositivo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleTerminateAllOthers}>
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma sessão ativa encontrada</p>
          </div>
        ) : (
          sessions.map(session => {
            const isCurrentSession = session.device_fingerprint === currentFingerprint;
            
            return (
              <div 
                key={session.id} 
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  isCurrentSession ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted">
                  {getDeviceIcon(session.user_agent)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {getDeviceName(session.user_agent)}
                    </span>
                    {isCurrentSession && (
                      <Badge variant="default" className="text-xs">
                        Este dispositivo
                      </Badge>
                    )}
                    {session.is_trusted && (
                      <Badge variant="secondary" className="text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Confiável
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    {(session.city || session.country) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[session.city, session.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {session.ip_address && session.ip_address !== 'client-side' && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {session.ip_address}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Ativo {formatDistanceToNow(new Date(session.last_active_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!session.is_trusted && !isCurrentSession && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleTrustDevice(session.id)}
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </Button>
                  )}
                  {!isCurrentSession && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleTerminateSession(session.id)}
                      disabled={terminating === session.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
