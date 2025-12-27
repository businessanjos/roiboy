import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit2, Trash2, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CostCenter {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string;
  is_active: boolean;
}

const centerColors = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
];

export default function FinancialCostCentersPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    color: centerColors[0],
  });

  const { data: centers = [], isLoading } = useQuery({
    queryKey: ["cost-centers", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("account_id", accountId)
        .order("display_order");
      if (error) throw error;
      return data as CostCenter[];
    },
    enabled: !!accountId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        account_id: accountId,
        name: data.name,
        code: data.code || null,
        description: data.description || null,
        color: data.color,
      };

      if (editingCenter) {
        const { error } = await supabase
          .from("cost_centers")
          .update(payload)
          .eq("id", editingCenter.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cost_centers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: editingCenter ? "Centro de custo atualizado" : "Centro de custo criado" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_centers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      toast({ title: "Centro de custo excluído" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", code: "", description: "", color: centerColors[0] });
    setEditingCenter(null);
  };

  const handleEdit = (center: CostCenter) => {
    setEditingCenter(center);
    setFormData({
      name: center.name,
      code: center.code || "",
      description: center.description || "",
      color: center.color,
    });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Centros de Custo
          </h1>
          <p className="text-muted-foreground">Organize receitas e despesas por departamento ou projeto</p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Centro de Custo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : centers.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum centro de custo cadastrado</p>
              <Button variant="link" onClick={handleCreate}>
                Criar primeiro centro de custo
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {centers.map((center) => (
                <div
                  key={center.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: center.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{center.name}</span>
                        {center.code && (
                          <Badge variant="outline" className="text-xs">
                            {center.code}
                          </Badge>
                        )}
                      </div>
                      {center.description && (
                        <p className="text-sm text-muted-foreground">{center.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(center)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Deseja excluir este centro de custo?")) {
                          deleteMutation.mutate(center.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCenter ? "Editar Centro de Custo" : "Novo Centro de Custo"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Marketing"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ex: MKT"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do centro de custo..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {centerColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 transition-all ${formData.color === color ? "border-foreground ring-2 ring-offset-2" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingCenter ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
