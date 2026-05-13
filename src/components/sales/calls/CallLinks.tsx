import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Link2, Plus, ExternalLink, Edit2, Trash2, Copy, Calendar, Search } from 'lucide-react';
import { toast } from 'sonner';

interface CallLink {
  id: string;
  account_id: string;
  user_id: string;
  title: string;
  url: string;
  notes: string | null;
  call_date: string | null;
  created_at: string;
}

const emptyForm = { title: '', url: '', notes: '', call_date: '' };

export function CallLinks() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CallLink | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<CallLink | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['call-links', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_links')
        .select('*')
        .eq('account_id', accountId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CallLink[];
    },
    enabled: !!accountId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.url.trim()) {
        throw new Error('Título e URL são obrigatórios');
      }
      const payload = {
        account_id: accountId!,
        user_id: currentUser?.id!,
        title: form.title.trim(),
        url: form.url.trim(),
        notes: form.notes.trim() || null,
        call_date: form.call_date || null,
      };
      if (editing) {
        const { error } = await supabase.from('call_links').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('call_links').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-links'] });
      toast.success(editing ? 'Link atualizado!' : 'Link adicionado!');
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('call_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-links'] });
      toast.success('Link removido');
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (link: CallLink) => {
    setEditing(link);
    setForm({
      title: link.title,
      url: link.url,
      notes: link.notes || '',
      call_date: link.call_date || '',
    });
    setDialogOpen(true);
  };

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const filtered = links.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.url.toLowerCase().includes(q) ||
      (l.notes || '').toLowerCase().includes(q)
    );
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20 flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Links de Calls
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Salve links de gravações de calls para fácil acesso do time.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Link
        </Button>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, url ou notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Link2 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {links.length === 0
                ? 'Nenhum link cadastrado ainda. Clique em "Adicionar Link" para começar.'
                : 'Nenhum link encontrado com esses termos.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((link) => (
              <div
                key={link.id}
                className="group rounded-lg border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate" title={link.title}>
                      {link.title}
                    </h3>
                    {link.call_date && (
                      <Badge variant="secondary" className="mt-1 gap-1 text-[10px]">
                        <Calendar className="w-3 h-3" />
                        {new Date(link.call_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </Badge>
                    )}
                  </div>
                </div>

                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline break-all line-clamp-2 block"
                  title={link.url}
                >
                  {link.url}
                </a>

                {link.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2" title={link.notes}>
                    {link.notes}
                  </p>
                )}

                <div className="flex items-center gap-1 pt-1 border-t">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1 text-xs"
                  >
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" /> Abrir
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1 text-xs"
                    onClick={() => handleCopy(link.url)}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </Button>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(link)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(link)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar link' : 'Adicionar link de call'}</DialogTitle>
            <DialogDescription>
              Cole o link da gravação (Google Drive, Daily, Loom, etc.) para fácil acesso do time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Call Maria Silva — 12/05"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data da call</Label>
              <Input
                type="date"
                value={form.call_date}
                onChange={(e) => setForm({ ...form, call_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Contexto, cliente, vendedor, observações..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover link?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" será removido. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
