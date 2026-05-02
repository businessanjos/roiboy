import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, MoreHorizontal, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface PaymentMethod {
  id: string;
  name: string;
  contract_label: string;
  has_entrada: boolean;
  has_parcelas: boolean;
  is_active: boolean;
  display_order: number;
}

const emptyForm = {
  name: "",
  contract_label: "",
  has_entrada: false,
  has_parcelas: false,
  is_active: true,
  display_order: 0,
};

export default function FinancialPaymentMethodsPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["payment-methods", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("account_id", accountId)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PaymentMethod[];
    },
    enabled: !!accountId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const payload = {
        account_id: accountId,
        name: data.name.trim(),
        contract_label: (data.contract_label || data.name).trim(),
        has_entrada: data.has_entrada,
        has_parcelas: data.has_parcelas,
        is_active: data.is_active,
        display_order: Number(data.display_order) || 0,
      };
      if (editing) {
        const { error } = await supabase
          .from("payment_methods")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_methods").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: editing ? "Forma de pagamento atualizada" : "Forma de pagamento criada" });
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Não foi possível salvar.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      toast({ title: "Forma de pagamento excluída" });
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Não foi possível excluir.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setEditing(null);
  };

  const handleEdit = (m: PaymentMethod) => {
    setEditing(m);
    setFormData({
      name: m.name,
      contract_label: m.contract_label,
      has_entrada: m.has_entrada,
      has_parcelas: m.has_parcelas,
      is_active: m.is_active,
      display_order: m.display_order ?? 0,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Formas de Pagamento
          </h1>
          <p className="text-muted-foreground">
            Configure as formas de pagamento aceitas. Aparecem no Wizard de contratos e nos lançamentos financeiros.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Forma
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : methods.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p>Nenhuma forma de pagamento cadastrada</p>
              <Button variant="link" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                Cadastrar primeira forma
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Texto no contrato</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{m.display_order}</TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.contract_label}</TableCell>
                    <TableCell>
                      <Badge variant={m.has_entrada ? "default" : "outline"}>
                        {m.has_entrada ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.has_parcelas ? "default" : "outline"}>
                        {m.has_parcelas ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.is_active ? "default" : "secondary"}>
                        {m.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(m)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Excluir esta forma de pagamento?")) {
                                deleteMutation.mutate(m.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}</DialogTitle>
            <DialogDescription>
              Configure como o pagamento aparece para o time e no contrato.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome interno *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: PIX à vista"
                required
              />
              <p className="text-xs text-muted-foreground">
                Nome mostrado no dropdown do Wizard e nos lançamentos.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Texto no contrato</Label>
              <Input
                value={formData.contract_label}
                onChange={(e) => setFormData({ ...formData, contract_label: e.target.value })}
                placeholder="Ex: Pagamento via PIX à vista"
              />
              <p className="text-xs text-muted-foreground">
                Frase que será inserida no contrato. Se vazio, usa o nome interno.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Tem entrada?</Label>
                  <p className="text-xs text-muted-foreground">Mostra campo de valor de entrada</p>
                </div>
                <Switch
                  checked={formData.has_entrada}
                  onCheckedChange={(v) => setFormData({ ...formData, has_entrada: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Tem parcelas?</Label>
                  <p className="text-xs text-muted-foreground">Mostra campos de parcelamento</p>
                </div>
                <Switch
                  checked={formData.has_parcelas}
                  onCheckedChange={(v) => setFormData({ ...formData, has_parcelas: v })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ordem de exibição</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Ativa</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || !formData.name.trim()}>
                {saveMutation.isPending ? "Salvando..." : editing ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
