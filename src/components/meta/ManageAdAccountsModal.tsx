import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AdAccount { id: string; accountId: string; name: string; currency?: string; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  allAccounts: AdAccount[];
  onSaved: () => void;
}

export function ManageAdAccountsModal({ open, onOpenChange, allAccounts, onSaved }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase.from('user_meta_selected_accounts').select('ad_account_id').eq('user_id', user.id).then(({ data }) => {
      if (data && data.length > 0) setSelected(new Set(data.map((r: any) => r.ad_account_id)));
      else setSelected(new Set(allAccounts.map(a => a.id)));
      setLoading(false);
    });
  }, [open, user, allAccounts]);

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const handleSave = async () => {
    if (!user || selected.size === 0) { toast.error('Selecione ao menos uma conta'); return; }
    setSaving(true);
    try {
      await supabase.from('user_meta_selected_accounts').delete().eq('user_id', user.id);
      const rows = Array.from(selected).map(id => {
        const acc = allAccounts.find(a => a.id === id);
        return { user_id: user.id, ad_account_id: id, ad_account_name: acc?.name || null };
      });
      const { error } = await supabase.from('user_meta_selected_accounts').insert(rows);
      if (error) throw error;
      toast.success('Contas salvas!');
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Contas de Anúncio</DialogTitle>
          <DialogDescription>Escolha quais contas exibir.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto py-2">
            {allAccounts.map(acc => (
              <label key={acc.id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50">
                <Checkbox checked={selected.has(acc.id)} onCheckedChange={() => toggle(acc.id)} />
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{acc.name}</p>
                  {acc.currency && <p className="text-xs text-muted-foreground">{acc.currency}</p>}
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center pt-2">
          <p className="text-xs text-muted-foreground">{selected.size} de {allAccounts.length} selecionada(s)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || selected.size === 0}>
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
