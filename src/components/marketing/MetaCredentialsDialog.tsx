import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, KeyRound, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MetaCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string | null;
  profileUsername?: string;
}

export function MetaCredentialsDialog({
  open,
  onOpenChange,
  profileId,
  profileUsername,
}: MetaCredentialsDialogProps) {
  const qc = useQueryClient();
  const [igBusinessId, setIgBusinessId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (!open || !profileId) return;
    (async () => {
      const { data } = await supabase
        .from('instagram_profiles')
        .select('ig_business_account_id, meta_access_token')
        .eq('id', profileId)
        .maybeSingle();
      setIgBusinessId(data?.ig_business_account_id || '');
      setHasExisting(!!data?.meta_access_token);
      setAccessToken('');
    })();
  }, [open, profileId]);

  const handleSave = async () => {
    if (!profileId) return;
    if (!igBusinessId.trim()) {
      toast.error('Informe o ID da conta Instagram Business');
      return;
    }
    if (!accessToken.trim() && !hasExisting) {
      toast.error('Informe o Access Token');
      return;
    }

    setLoading(true);
    try {
      const update: any = {
        ig_business_account_id: igBusinessId.trim(),
      };
      if (accessToken.trim()) {
        update.meta_access_token = accessToken.trim();
        // Long-lived token = ~60 dias
        update.token_expires_at = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      }

      const { error } = await supabase
        .from('instagram_profiles')
        .update(update)
        .eq('id', profileId);

      if (error) throw error;

      toast.success('Credenciais salvas com sucesso');
      qc.invalidateQueries({ queryKey: ['instagram-profiles'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar credenciais');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Configurar Meta Graph API
          </DialogTitle>
          <DialogDescription>
            {profileUsername ? <>Para o perfil <span className="font-semibold">@{profileUsername}</span>.</> : null}
            {' '}Conecte os dados oficiais do Instagram via Meta.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription className="text-xs space-y-1">
            <p>
              <strong>Como obter:</strong> acesse o{' '}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                Graph API Explorer <ExternalLink className="h-3 w-3" />
              </a>
              {' '}com seu App Meta selecionado.
            </p>
            <p>1. Selecione as permissões: <code className="text-[10px]">instagram_basic</code>, <code className="text-[10px]">instagram_manage_insights</code>, <code className="text-[10px]">pages_show_list</code>, <code className="text-[10px]">pages_read_engagement</code>.</p>
            <p>2. Gere o token e converta-o em <strong>Long-Lived Token</strong> (~60 dias).</p>
            <p>3. Para descobrir o ID da conta Business, faça <code className="text-[10px]">GET /me/accounts</code> e depois <code className="text-[10px]">GET /{`{page-id}`}?fields=instagram_business_account</code>.</p>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ig-business-id">ID da Conta Instagram Business</Label>
            <Input
              id="ig-business-id"
              placeholder="Ex: 17841405822304914"
              value={igBusinessId}
              onChange={(e) => setIgBusinessId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-token">
              Access Token {hasExisting && <span className="text-xs text-muted-foreground">(deixe vazio para manter o atual)</span>}
            </Label>
            <Input
              id="access-token"
              type="password"
              placeholder={hasExisting ? '••••••••••••••••' : 'EAAxxxxxxx...'}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Token de longa duração (~60 dias). Renove antes de expirar.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
