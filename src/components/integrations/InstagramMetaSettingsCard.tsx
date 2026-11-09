import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Instagram, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaCredentialsDialog } from '@/components/marketing/MetaCredentialsDialog';

interface InstagramSettingsProfile {
  id: string;
  username: string;
  sync_error: string | null;
  meta_access_token: string | null;
  ig_business_account_id: string | null;
}

export function InstagramMetaSettingsCard() {
  const { currentUser } = useCurrentUser();
  const [selectedProfile, setSelectedProfile] = useState<InstagramSettingsProfile | null>(null);

  const { data: profiles = [], isLoading, refetch } = useQuery({
    queryKey: ['instagram-meta-settings', currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_profiles')
        .select('id, username, sync_error, meta_access_token, ig_business_account_id')
        .eq('account_id', currentUser!.account_id)
        .order('username');
      if (error) throw error;
      return (data || []) as InstagramSettingsProfile[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Instagram className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Meta API do Instagram</CardTitle>
            <CardDescription>
              Configure uma vez por perfil para sincronizar seguidores, publicações e métricas.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum perfil do Instagram cadastrado. Conecte um perfil em Marketing → Redes.
          </p>
        ) : (
          profiles.map((profile) => {
            const configured = !!profile.meta_access_token && !!profile.ig_business_account_id;
            return (
              <div key={profile.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">@{profile.username}</p>
                    <Badge variant={configured && !profile.sync_error ? 'default' : 'secondary'} className="gap-1">
                      {configured && !profile.sync_error ? (
                        <><CheckCircle2 className="h-3 w-3" /> Configurado</>
                      ) : (
                        <><AlertCircle className="h-3 w-3" /> Requer atenção</>
                      )}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profile.sync_error
                      ? 'A conexão precisa ser revisada para voltar a sincronizar.'
                      : configured
                        ? 'Credenciais salvas para este perfil.'
                        : 'Informe o ID comercial e o token da Meta.'}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectedProfile(profile)}>
                  <KeyRound className="h-3.5 w-3.5" />
                  {configured ? 'Gerenciar conexão' : 'Configurar Meta API'}
                </Button>
              </div>
            );
          })
        )}
      </CardContent>

      <MetaCredentialsDialog
        open={!!selectedProfile}
        onOpenChange={(open) => !open && setSelectedProfile(null)}
        profileId={selectedProfile?.id || null}
        profileUsername={selectedProfile?.username}
        onSaved={() => { void refetch(); }}
      />
    </Card>
  );
}
