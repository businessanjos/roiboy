import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Tag, Percent, DollarSign, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  min_value: number | null;
  is_active: boolean;
  applies_to_subscriptions: boolean;
  created_at: string;
}

interface CouponFormData {
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  valid_from: string;
  valid_until: string;
  min_value: number | null;
  is_active: boolean;
  applies_to_subscriptions: boolean;
}

const defaultFormData: CouponFormData = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: 10,
  max_uses: null,
  valid_from: new Date().toISOString().split("T")[0],
  valid_until: "",
  min_value: null,
  is_active: true,
  applies_to_subscriptions: true,
};

export function CouponsManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState<CouponFormData>(defaultFormData);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Coupon[];
    },
  });

  const { data: usageStats } = useQuery({
    queryKey: ["coupon-usage-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupon_usages")
        .select("coupon_id, discount_applied");

      if (error) throw error;

      const stats: Record<string, { count: number; total: number }> = {};
      data.forEach((usage) => {
        if (!stats[usage.coupon_id]) {
          stats[usage.coupon_id] = { count: 0, total: 0 };
        }
        stats[usage.coupon_id].count++;
        stats[usage.coupon_id].total += Number(usage.discount_applied);
      });

      return stats;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CouponFormData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data: user } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!user) throw new Error("Usuário não encontrado");

      const { error } = await supabase.from("coupons").insert({
        account_id: user.account_id,
        code: data.code.toUpperCase(),
        description: data.description || null,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        max_uses: data.max_uses,
        valid_from: new Date(data.valid_from).toISOString(),
        valid_until: data.valid_until ? new Date(data.valid_until).toISOString() : null,
        min_value: data.min_value,
        is_active: data.is_active,
        applies_to_subscriptions: data.applies_to_subscriptions,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Cupom criado com sucesso!");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      if (error.message.includes("unique")) {
        toast.error("Já existe um cupom com este código");
      } else {
        toast.error("Erro ao criar cupom");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CouponFormData }) => {
      const { error } = await supabase
        .from("coupons")
        .update({
          code: data.code.toUpperCase(),
          description: data.description || null,
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          max_uses: data.max_uses,
          valid_from: new Date(data.valid_from).toISOString(),
          valid_until: data.valid_until ? new Date(data.valid_until).toISOString() : null,
          min_value: data.min_value,
          is_active: data.is_active,
          applies_to_subscriptions: data.applies_to_subscriptions,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Cupom atualizado com sucesso!");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao atualizar cupom");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      toast.success("Cupom excluído com sucesso!");
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Erro ao excluir cupom");
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCoupon(null);
    setFormData(defaultFormData);
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      max_uses: coupon.max_uses,
      valid_from: coupon.valid_from.split("T")[0],
      valid_until: coupon.valid_until ? coupon.valid_until.split("T")[0] : "",
      min_value: coupon.min_value,
      is_active: coupon.is_active,
      applies_to_subscriptions: coupon.applies_to_subscriptions,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error("Informe o código do cupom");
      return;
    }

    if (formData.discount_value <= 0) {
      toast.error("Informe um valor de desconto válido");
      return;
    }

    if (formData.discount_type === "percentage" && formData.discount_value > 100) {
      toast.error("Desconto percentual não pode ser maior que 100%");
      return;
    }

    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getCouponStatus = (coupon: Coupon) => {
    if (!coupon.is_active) return { label: "Inativo", variant: "secondary" as const };
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return { label: "Expirado", variant: "destructive" as const };
    }
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return { label: "Esgotado", variant: "outline" as const };
    }
    return { label: "Ativo", variant: "default" as const };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Cupons de Desconto
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData(defaultFormData)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingCoupon ? "Editar Cupom" : "Novo Cupom"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="DESCONTO10"
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_type">Tipo</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value: "percentage" | "fixed") =>
                      setFormData({ ...formData, discount_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount_value">
                    Valor do Desconto{" "}
                    {formData.discount_type === "percentage" ? "(%)" : "(R$)"}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    min="0"
                    step={formData.discount_type === "percentage" ? "1" : "0.01"}
                    value={formData.discount_value}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_value: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_uses">Limite de Usos (opcional)</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    min="1"
                    value={formData.max_uses || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_uses: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="Ilimitado"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valid_from">Válido a partir de</Label>
                  <Input
                    id="valid_from"
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) =>
                      setFormData({ ...formData, valid_from: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Válido até (opcional)</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) =>
                      setFormData({ ...formData, valid_until: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_value">Valor Mínimo (opcional)</Label>
                <Input
                  id="min_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.min_value || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_value: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Sem mínimo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descrição do cupom..."
                  rows={2}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Cupom Ativo</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="applies_to_subscriptions">Aplica em Assinaturas</Label>
                  <Switch
                    id="applies_to_subscriptions"
                    checked={formData.applies_to_subscriptions}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, applies_to_subscriptions: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingCoupon ? "Salvar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : !coupons?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cupom cadastrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => {
                const status = getCouponStatus(coupon);
                const stats = usageStats?.[coupon.id];

                return (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <div className="font-mono font-semibold">{coupon.code}</div>
                      {coupon.description && (
                        <div className="text-xs text-muted-foreground">
                          {coupon.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {coupon.discount_type === "percentage" ? (
                          <>
                            <Percent className="h-3 w-3" />
                            {coupon.discount_value}%
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(coupon.discount_value)}
                          </>
                        )}
                      </div>
                      {stats && (
                        <div className="text-xs text-muted-foreground">
                          Total: {formatCurrency(stats.total)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(coupon.valid_from), "dd/MM/yy", { locale: ptBR })}
                        {coupon.valid_until && (
                          <>
                            {" - "}
                            {format(new Date(coupon.valid_until), "dd/MM/yy", {
                              locale: ptBR,
                            })}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {coupon.current_uses}
                        {coupon.max_uses && ` / ${coupon.max_uses}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(coupon)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(coupon.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O histórico de uso será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
