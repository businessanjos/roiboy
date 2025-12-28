import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { 
  Check, 
  X, 
  Edit2, 
  Sparkles, 
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  CheckCheck
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingClassification {
  id: string;
  original_description: string;
  suggested_description: string;
  amount: number;
  transaction_date: string;
  transaction_type: string;
  suggested_category_id: string | null;
  suggested_client_id: string | null;
  ai_confidence: number;
  ai_reasoning: string;
  status: string;
  category?: { id: string; name: string } | null;
  client?: { id: string; full_name: string } | null;
}

export function PendingClassifications() {
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    description: string;
    category_id: string;
  }>({ description: '', category_id: '' });

  // Fetch pending classifications
  const { data: pendingItems, isLoading } = useQuery({
    queryKey: ['pending-classifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_pending_classifications')
        .select(`
          *,
          category:financial_categories(id, name),
          client:clients(id, full_name)
        `)
        .eq('status', 'pending')
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return data as PendingClassification[];
    },
  });

  // Fetch categories for editing
  const { data: categories } = useQuery({
    queryKey: ['financial-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userProfile } = await supabase
        .from('users')
        .select('id, account_id')
        .eq('auth_user_id', userData.user?.id)
        .single();

      // Update status to confirmed
      const { error: updateError } = await supabase
        .from('financial_pending_classifications')
        .update({
          status: 'confirmed',
          reviewed_by: userProfile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (updateError) throw updateError;

      // Get the confirmed items to create financial entries
      const { data: confirmedItems } = await supabase
        .from('financial_pending_classifications')
        .select('*')
        .in('id', ids);

      if (confirmedItems) {
        const entries = confirmedItems.map(item => ({
          account_id: item.account_id,
          bank_account_id: item.bank_account_id,
          description: item.suggested_description || item.original_description,
          amount: item.amount,
          entry_type: item.transaction_type === 'credit' ? 'receivable' : 'payable',
          status: 'paid',
          due_date: item.transaction_date,
          payment_date: item.transaction_date,
          category_id: item.suggested_category_id,
          client_id: item.suggested_client_id,
          external_id: item.external_id,
          notes: `Importado via OFX - ${item.ai_reasoning}`,
          source: 'ofx_import',
        }));

        const { error: insertError } = await supabase
          .from('financial_entries')
          .insert(entries);

        if (insertError) throw insertError;
      }

      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['pending-classifications'] });
      queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
      setSelectedItems(new Set());
      toast({
        title: "Lançamentos confirmados",
        description: `${count} transação(ões) confirmada(s) e criada(s) como lançamentos.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao confirmar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userProfile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData.user?.id)
        .single();

      const { error } = await supabase
        .from('financial_pending_classifications')
        .update({
          status: 'rejected',
          reviewed_by: userProfile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['pending-classifications'] });
      setSelectedItems(new Set());
      toast({
        title: "Transações rejeitadas",
        description: `${count} transação(ões) rejeitada(s).`,
      });
    },
  });

  // Update classification mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, description, category_id }: { id: string; description: string; category_id: string }) => {
      const { error } = await supabase
        .from('financial_pending_classifications')
        .update({
          suggested_description: description,
          suggested_category_id: category_id || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-classifications'] });
      setEditingId(null);
      toast({ title: "Classificação atualizada" });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge className="bg-green-100 text-green-800">Alta confiança</Badge>;
    } else if (confidence >= 0.5) {
      return <Badge className="bg-yellow-100 text-yellow-800">Média confiança</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">Baixa confiança</Badge>;
  };

  const handleSelectAll = () => {
    if (selectedItems.size === pendingItems?.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pendingItems?.map(item => item.id)));
    }
  };

  const handleConfirmSelected = () => {
    if (selectedItems.size === 0) {
      toast({
        title: "Nenhum item selecionado",
        description: "Selecione ao menos uma transação para confirmar.",
        variant: "destructive",
      });
      return;
    }
    confirmMutation.mutate(Array.from(selectedItems));
  };

  const handleStartEdit = (item: PendingClassification) => {
    setEditingId(item.id);
    setEditValues({
      description: item.suggested_description || item.original_description,
      category_id: item.suggested_category_id || '',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pendingItems?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCheck className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma transação pendente</h3>
          <p className="text-muted-foreground text-center mt-2">
            Todas as transações foram classificadas. Importe um novo arquivo OFX para continuar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Classificações Pendentes
              </CardTitle>
              <CardDescription>
                {pendingItems.length} transação(ões) aguardando confirmação
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedItems.size === pendingItems.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleConfirmSelected}
                disabled={selectedItems.size === 0 || confirmMutation.isPending}
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Confirmar selecionados ({selectedItems.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className={`border rounded-lg p-4 transition-colors ${
                  selectedItems.has(item.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedItems.has(item.id)}
                    onCheckedChange={(checked) => {
                      const newSelected = new Set(selectedItems);
                      if (checked) {
                        newSelected.add(item.id);
                      } else {
                        newSelected.delete(item.id);
                      }
                      setSelectedItems(newSelected);
                    }}
                  />

                  <div className={`p-2 rounded-full ${
                    item.transaction_type === 'credit' 
                      ? 'bg-green-100 text-green-600' 
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {item.transaction_type === 'credit' 
                      ? <ArrowUpCircle className="h-5 w-5" />
                      : <ArrowDownCircle className="h-5 w-5" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editValues.description}
                          onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Descrição"
                        />
                        <Select
                          value={editValues.category_id}
                          onValueChange={(value) => setEditValues(prev => ({ ...prev, category_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories?.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateMutation.mutate({
                              id: item.id,
                              description: editValues.description,
                              category_id: editValues.category_id,
                            })}
                            disabled={updateMutation.isPending}
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">
                            {item.suggested_description || item.original_description}
                          </p>
                          {getConfidenceBadge(item.ai_confidence || 0)}
                        </div>
                        
                        {item.suggested_description !== item.original_description && (
                          <p className="text-xs text-muted-foreground line-through">
                            Original: {item.original_description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.category && (
                            <Badge variant="secondary">{item.category.name}</Badge>
                          )}
                          {item.client && (
                            <Badge variant="outline">{item.client.full_name}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>

                        {item.ai_reasoning && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                            <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            {item.ai_reasoning}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="text-right">
                    <p className={`font-bold ${
                      item.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {item.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(item.amount)}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleStartEdit(item)}
                      disabled={editingId === item.id}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => confirmMutation.mutate([item.id])}
                      disabled={confirmMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => rejectMutation.mutate([item.id])}
                      disabled={rejectMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
