import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link as LinkIcon, AlertCircle } from "lucide-react";

interface OpenFinanceAccount {
  connection_id: string;
  institution: string;
  account_id: string;
  account_name: string;
  account_number: string;
  account_type: string;
  balance: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bankAccountId: string;
  bankAccountName: string;
}

export function OpenFinanceLinkDialog({ open, onOpenChange, bankAccountId, bankAccountName }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<OpenFinanceAccount | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    enabled: open,
    queryKey: ["openfinance-list-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        accounts?: OpenFinanceAccount[];
        error?: string;
      }>("openfinance-list-accounts", { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      return data.accounts ?? [];
    },
    retry: false,
  });

  const linkMutation = useMutation({
    mutationFn: async (acc: OpenFinanceAccount) => {
      const { error } = await supabase
        .from("bank_accounts")
        .update({
          openfinance_connection_id: acc.connection_id,
          openfinance_account_id: acc.account_id,
          openfinance_institution: acc.institution,
        })
        .eq("id", bankAccountId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts-all"] });
      toast({ title: "Conta vinculada ao Open Finance" });
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao vincular", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conectar Open Finance — {bankAccountName}</DialogTitle>
          <DialogDescription>
            Selecione abaixo qual conta do banco.mcp.ai deve ser vinculada para sincronizar saldo e movimentações.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Não foi possível buscar contas</p>
              <p className="text-muted-foreground mt-1">{(error as Error).message}</p>
              <p className="text-muted-foreground mt-2">
                Verifique se os secrets <code>BANCO_MCP_URL</code> e <code>BANCO_MCP_TOKEN</code> estão configurados
                e se você já autorizou ao menos um banco em banco.mcp.ai.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {data && data.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma conta encontrada. Conecte um banco em banco.mcp.ai primeiro.
          </p>
        )}

        {data && data.length > 0 && (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.map((a) => {
              const isSel = selected?.account_id === a.account_id;
              return (
                <button
                  key={`${a.connection_id}-${a.account_id}`}
                  type="button"
                  onClick={() => setSelected(a)}
                  className={`w-full text-left rounded-md border p-3 transition ${
                    isSel ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{a.account_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.institution} • {a.account_number || a.account_id}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{a.account_type}</Badge>
                      {a.balance != null && (
                        <div className="text-xs text-muted-foreground mt-1">
                          R$ {a.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!selected || linkMutation.isPending}
            onClick={() => selected && linkMutation.mutate(selected)}
          >
            {linkMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LinkIcon className="h-4 w-4 mr-2" />
            )}
            Vincular conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
