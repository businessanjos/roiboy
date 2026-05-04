import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Zap, Loader2, CheckCircle2, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface FacebookPage { id: string; name: string; access_token: string; is_active: boolean; }

export function LeadAdsConfig() {
  const { user } = useAuth();
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-leadads-subscription', { body: { action: 'list_pages' } });
      if (error) throw error;
      if (data?.success) setPages(data.pages || []);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (page: FacebookPage) => {
    setTogglingId(page.id);
    try {
      const action = page.is_active ? 'unsubscribe' : 'subscribe';
      const { data, error } = await supabase.functions.invoke('manage-leadads-subscription', {
        body: { action, page_id: page.id, page_name: page.name, page_access_token: page.access_token },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(page.is_active ? `Captação desativada para "${page.name}"` : `Captação ativada para "${page.name}"`);
        setPages(prev => prev.map(p => p.id === page.id ? { ...p, is_active: !p.is_active } : p));
      } else {
        toast.error(data?.error || 'Erro');
      }
    } catch { toast.error('Erro ao atualizar'); }
    finally { setTogglingId(null); }
  };

  const activeCount = pages.filter(p => p.is_active).length;

  return (
    <Card className="bg-card/50 border-border/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-amber-500" />
              Lead Ads — Captação Automática
            </CardTitle>
            <CardDescription>Ative para receber leads de formulários direto no seu pipeline.</CardDescription>
          </div>
          {activeCount > 0 && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              {activeCount} {activeCount === 1 ? 'página ativa' : 'páginas ativas'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
        ) : pages.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Nenhuma página do Facebook encontrada. Sua conta Meta precisa ter uma página vinculada.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {pages.map(page => {
              const toggling = togglingId === page.id;
              return (
                <div key={page.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/30 bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{page.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {page.is_active ? (
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Capturando leads</span>
                        ) : 'Captação desativada'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {toggling ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Switch checked={page.is_active} onCheckedChange={() => handleToggle(page)} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">Leads dos formulários entram automaticamente.</p>
          <Button variant="ghost" size="sm" onClick={load} disabled={isLoading} className="gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />Atualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
