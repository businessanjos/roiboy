import { useEffect, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DeletedDeal {
  id: string;
  title: string | null;
  value: number | null;
  status: string;
  deleted_at: string;
  deleted_by: string | null;
  responsible_user_id: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  responsible_name?: string | null;
  deleted_by_name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored?: () => void;
}

export function DeletedDealsDrawer({ open, onOpenChange, onRestored }: Props) {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState<DeletedDeal[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchDeleted = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id, title, value, status, deleted_at, deleted_by, responsible_user_id,
          contact_name, contact_phone, contact_email,
          responsible_user:users!deals_responsible_user_id_fkey(name)
        `)
        .eq('account_id', currentUser.account_id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      // Resolve deleted_by names
      const authIds = Array.from(
        new Set((data || []).map((d: any) => d.deleted_by).filter(Boolean))
      ) as string[];
      let byNames: Record<string, string> = {};
      if (authIds.length) {
        const { data: usersData } = await supabase
          .from('users')
          .select('auth_user_id, name')
          .in('auth_user_id', authIds);
        for (const u of usersData || []) {
          if (u.auth_user_id) byNames[u.auth_user_id] = u.name;
        }
      }

      setDeals(
        (data || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          value: d.value,
          status: d.status,
          deleted_at: d.deleted_at,
          deleted_by: d.deleted_by,
          responsible_user_id: d.responsible_user_id,
          contact_name: d.contact_name,
          contact_phone: d.contact_phone,
          contact_email: d.contact_email,
          responsible_name: d.responsible_user?.name ?? null,
          deleted_by_name: d.deleted_by ? byNames[d.deleted_by] ?? null : null,
        }))
      );
    } catch (e: any) {
      toast({ title: 'Erro ao carregar excluídos', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id, toast]);

  useEffect(() => {
    if (open) fetchDeleted();
  }, [open, fetchDeleted]);

  const handleRestore = async (dealId: string) => {
    if (!currentUser?.account_id) return;
    setRestoringId(dealId);
    try {
      const { error } = await supabase
        .from('deals')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);
      if (error) throw error;
      setDeals(prev => prev.filter(d => d.id !== dealId));
      toast({ title: 'Negociação restaurada' });
      onRestored?.();
    } catch (e: any) {
      toast({ title: 'Erro ao restaurar', description: e.message, variant: 'destructive' });
    } finally {
      setRestoringId(null);
    }
  };

  const handlePurge = async (dealId: string) => {
    if (!currentUser?.account_id) return;
    if (!confirm('Apagar PERMANENTEMENTE esta negociação? Esta ação não pode ser desfeita.')) return;
    setPurgingId(dealId);
    try {
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', dealId)
        .eq('account_id', currentUser.account_id);
      if (error) throw error;
      setDeals(prev => prev.filter(d => d.id !== dealId));
      toast({ title: 'Negociação apagada permanentemente' });
    } catch (e: any) {
      toast({ title: 'Erro ao apagar', description: e.message, variant: 'destructive' });
    } finally {
      setPurgingId(null);
    }
  };

  const term = search.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const filteredDeals = !term
    ? deals
    : deals.filter(d => {
        const haystack = [d.title, d.contact_name, d.contact_email, d.responsible_name, d.deleted_by_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (haystack.includes(term)) return true;
        if (digits.length >= 4 && (d.contact_phone || "").replace(/\D/g, "").includes(digits)) return true;
        return false;
      });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Negócios Excluídos</SheetTitle>
          <SheetDescription>
            Negócios marcados como excluídos podem ser restaurados ou apagados em definitivo.
            Eles ficam fora do pipeline e dos relatórios padrão.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, contato, telefone, e-mail ou responsável..."
            className="pl-9"
          />
        </div>

        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : filteredDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {deals.length === 0 ? "Nenhum negócio excluído." : "Nenhum resultado para essa busca."}
            </p>
          ) : (
            filteredDeals.map(d => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 p-3 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{d.title || '(Sem título)'}</span>
                    <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-x-2">
                    <span>
                      Excluído em{' '}
                      {format(new Date(d.deleted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {d.deleted_by_name && <span>por {d.deleted_by_name}</span>}
                    {d.responsible_name && <span>· Resp: {d.responsible_name}</span>}
                    {typeof d.value === 'number' && (
                      <span>
                        · R${' '}
                        {d.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(d.id)}
                    disabled={restoringId === d.id}
                  >
                    {restoringId === d.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3 mr-1" />
                    )}
                    Restaurar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handlePurge(d.id)}
                    disabled={purgingId === d.id}
                  >
                    {purgingId === d.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
