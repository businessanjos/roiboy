import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Repeat,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Calendar,
  User,
  Tag,
  XCircle,
  PlayCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialPageHeader, FinancialEmptyState } from "@/components/financial/_shared";

interface RecurringTemplate {
  id: string;
  description: string;
  entry_type: string;
  amount: number;
  recurrence_type: string;
  recurrence_end_date: string | null;
  category_name: string | null;
  client_name: string | null;
  next_due_date: string | null;
  total_generated: number;
}

const recurrenceLabels: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export default function FinancialRecurringPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["recurring-templates", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase.rpc("get_recurring_templates", {
        p_account_id: accountId,
      });
      if (error) throw error;
      return data as RecurringTemplate[];
    },
    enabled: !!accountId,
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("process_recurring_entries");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-templates"] });
      toast({
        title: "Recorrências processadas",
        description: count > 0 
          ? `${count} lançamento${count > 1 ? "s" : ""} gerado${count > 1 ? "s" : ""} com sucesso.`
          : "Nenhum lançamento pendente para gerar.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível processar as recorrências.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_entries")
        .update({ 
          is_recurring: false,
          recurrence_type: null,
          recurrence_end_date: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-templates"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      setCancelingId(null);
      toast({ title: "Recorrência cancelada" });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível cancelar a recorrência.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              <div>
                <CardTitle>Lançamentos Recorrentes</CardTitle>
                <CardDescription>
                  Gerencie lançamentos que se repetem automaticamente
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {processMutation.isPending ? "Processando..." : "Gerar Próximos"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum lançamento recorrente configurado</p>
              <p className="text-sm mt-2">
                Crie um novo lançamento e marque como "recorrente" para aparecer aqui.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Próximo</TableHead>
                  <TableHead>Gerados</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.description}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {template.category_name && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {template.category_name}
                            </span>
                          )}
                          {template.client_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {template.client_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.entry_type === "receivable" ? (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          <ArrowDownCircle className="h-3 w-3 mr-1" />
                          Receita
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-500 text-red-600">
                          <ArrowUpCircle className="h-3 w-3 mr-1" />
                          Despesa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {recurrenceLabels[template.recurrence_type] || template.recurrence_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(template.amount)}
                    </TableCell>
                    <TableCell>
                      {template.next_due_date ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(template.next_due_date), "dd/MM/yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      {template.recurrence_end_date && (
                        <div className="text-xs text-muted-foreground">
                          Até {format(new Date(template.recurrence_end_date), "dd/MM/yyyy")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.total_generated}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCancelingId(template.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!cancelingId} onOpenChange={() => setCancelingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Recorrência</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá parar a geração automática de novos lançamentos. Os lançamentos já gerados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelingId && cancelMutation.mutate(cancelingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar Recorrência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
