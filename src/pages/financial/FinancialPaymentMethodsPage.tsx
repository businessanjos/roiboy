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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

type Category = "a_vista" | "parcelado";

interface PaymentMethod {
  id: string;
  name: string;
  contract_label: string;
  category: Category;
  is_active: boolean;
  display_order: number;
}

const emptyForm = {
  name: "",
  contract_label: "",
  category: "a_vista" as Category,
  is_active: true,
  display_order: 0,
};

const CATEGORY_LABEL: Record<Category, string> = {
  a_vista: "À vista",
  parcelado: "Parcelado",
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
        .order("category", { ascending: true })
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
        category: data.category,
        has_entrada: false,
        has_parcelas: data.category === "parcelado",
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
      category: m.category,
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
            Cada forma é classificada como <strong>À vista</strong> ou <strong>Parcelado</strong>. No Wizard de contratos, primeiro escolhe-se a modalidade e depois o método.
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
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Texto no contrato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{m.display_order}</TableCell>
                    <TableCell>
                      <Badge variant={m.category === "parcelado" ? "default" : "secondary"}>
                        {CATEGORY_LABEL[m.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.contract_label}</TableCell>
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
              Configure como o pagamento aparece no Wizard e no contrato.
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
              <Label>Modalidade *</Label>
              <Select
                value={formData.category}
                onValueChange={(v: Category) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                "Parcelado" libera campos de nº de parcelas, valor e vencimento (com opção de entrada) no Wizard.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Pix, Boleto, Cartão de Crédito"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Texto no contrato</Label>
              <Input
                value={formData.contract_label}
                onChange={(e) => setFormData({ ...formData, contract_label: e.target.value })}
                placeholder="Ex: À vista via Pix"
              />
              <p className="text-xs text-muted-foreground">
                Frase usada como base no contrato. Se vazio, usa o nome.
              </p>
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
