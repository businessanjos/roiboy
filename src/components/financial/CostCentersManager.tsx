import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CostCentersManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function CostCentersManager({ open, onOpenChange }: CostCentersManagerProps) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
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
    enabled: !!accountId && open,
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
      setIsFormOpen(false);
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
    setIsFormOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Centros de Custo
          </DialogTitle>
          <DialogDescription>
            Organize receitas e despesas por departamento ou projeto
          </DialogDescription>
        </DialogHeader>

        {isFormOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }}
            className="space-y-4 border rounded-lg p-4"
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
                    className={`w-6 h-6 rounded-full border-2 ${formData.color === color ? "border-foreground ring-2 ring-offset-2" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => { setIsFormOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editingCenter ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" onClick={() => setIsFormOpen(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Novo Centro de Custo
          </Button>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : centers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum centro de custo cadastrado
          </p>
        ) : (
          <div className="space-y-2">
            {centers.map((center) => (
              <div
                key={center.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: center.color }}
                  />
                  <div>
                    <span className="font-medium">{center.name}</span>
                    {center.code && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {center.code}
                      </Badge>
                    )}
                    {center.description && (
                      <p className="text-xs text-muted-foreground">{center.description}</p>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
