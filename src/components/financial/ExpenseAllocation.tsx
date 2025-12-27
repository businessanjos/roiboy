import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Building2,
  DollarSign,
  Percent,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ExpenseAllocationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  entryAmount: number;
  entryDescription: string;
}

interface CostCenter {
  id: string;
  name: string;
  color: string;
}

interface Allocation {
  id?: string;
  cost_center_id: string;
  percentage: number;
  amount: number;
  cost_center?: CostCenter;
}

export function ExpenseAllocation({ 
  open, 
  onOpenChange, 
  entryId, 
  entryAmount, 
  entryDescription 
}: ExpenseAllocationProps) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [allocations, setAllocations] = useState<Allocation[]>([]);

  // Fetch cost centers
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, name, color")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CostCenter[];
    },
    enabled: !!accountId && open,
  });

  // Fetch existing allocations
  const { data: existingAllocations = [] } = useQuery({
    queryKey: ["entry-allocations", entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const { data, error } = await (supabase as any)
        .from("financial_entry_allocations")
        .select(`
          id, cost_center_id, percentage, amount,
          cost_center:cost_centers(id, name, color)
        `)
        .eq("entry_id", entryId);
      if (error) throw error;
      return data as Allocation[];
    },
    enabled: !!entryId && open,
  });

  // Initialize allocations from existing data
  useEffect(() => {
    if (existingAllocations.length > 0) {
      setAllocations(existingAllocations);
    } else if (allocations.length === 0) {
      // Add one empty allocation by default
      setAllocations([{ cost_center_id: "", percentage: 100, amount: entryAmount }]);
    }
  }, [existingAllocations, entryAmount]);

  // Save allocations mutation
  const saveMutation = useMutation({
    mutationFn: async (allocs: Allocation[]) => {
      // Delete existing allocations
      await (supabase as any)
        .from("financial_entry_allocations")
        .delete()
        .eq("entry_id", entryId);

      // Insert new allocations
      if (allocs.length > 0 && allocs.some(a => a.cost_center_id)) {
        const validAllocs = allocs.filter(a => a.cost_center_id);
        const { error } = await (supabase as any)
          .from("financial_entry_allocations")
          .insert(
            validAllocs.map(a => ({
              account_id: accountId,
              entry_id: entryId,
              cost_center_id: a.cost_center_id,
              percentage: a.percentage,
              amount: a.amount,
            }))
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      onOpenChange(false);
      toast({ title: "Rateio salvo com sucesso" });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o rateio.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const addAllocation = () => {
    setAllocations([...allocations, { cost_center_id: "", percentage: 0, amount: 0 }]);
  };

  const removeAllocation = (index: number) => {
    const newAllocations = allocations.filter((_, i) => i !== index);
    if (newAllocations.length === 0) {
      newAllocations.push({ cost_center_id: "", percentage: 100, amount: entryAmount });
    }
    redistributePercentages(newAllocations);
  };

  const updateAllocation = (index: number, field: "cost_center_id" | "percentage", value: string | number) => {
    const newAllocations = [...allocations];
    
    if (field === "cost_center_id") {
      newAllocations[index].cost_center_id = value as string;
    } else if (field === "percentage") {
      const percentage = Math.min(100, Math.max(0, Number(value)));
      newAllocations[index].percentage = percentage;
      newAllocations[index].amount = (entryAmount * percentage) / 100;
    }
    
    setAllocations(newAllocations);
  };

  const redistributePercentages = (allocs: Allocation[]) => {
    if (allocs.length === 0) return;
    
    const evenPercentage = Math.floor(100 / allocs.length);
    const remainder = 100 - (evenPercentage * allocs.length);
    
    allocs.forEach((alloc, i) => {
      alloc.percentage = evenPercentage + (i === 0 ? remainder : 0);
      alloc.amount = (entryAmount * alloc.percentage) / 100;
    });
    
    setAllocations([...allocs]);
  };

  const distributeEqually = () => {
    redistributePercentages(allocations);
  };

  // Calculate totals
  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
  const isValid = Math.abs(totalPercentage - 100) < 0.01 && allocations.every(a => a.cost_center_id);
  const hasAllocations = allocations.some(a => a.cost_center_id);

  // Get available cost centers (not already selected)
  const getAvailableCostCenters = (currentId: string) => {
    const selectedIds = allocations.map(a => a.cost_center_id).filter(id => id !== currentId);
    return costCenters.filter(cc => !selectedIds.includes(cc.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Rateio por Centro de Custo
          </DialogTitle>
          <DialogDescription>
            Distribua o lançamento entre diferentes centros de custo
          </DialogDescription>
        </DialogHeader>

        {/* Entry Info */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{entryDescription}</div>
                <div className="text-sm text-muted-foreground">
                  Valor total a ratear
                </div>
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(entryAmount)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Allocations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Distribuição</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={distributeEqually}>
                Distribuir Igualmente
              </Button>
              <Button variant="outline" size="sm" onClick={addAllocation}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {allocations.map((allocation, index) => (
              <div 
                key={index} 
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex-1">
                  <Select
                    value={allocation.cost_center_id}
                    onValueChange={(v) => updateAllocation(index, "cost_center_id", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o centro de custo" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableCostCenters(allocation.cost_center_id).map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: cc.color }} 
                            />
                            {cc.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-24">
                  <div className="relative">
                    <Input
                      type="number"
                      value={allocation.percentage}
                      onChange={(e) => updateAllocation(index, "percentage", e.target.value)}
                      className="pr-8"
                      min={0}
                      max={100}
                    />
                    <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="w-32 text-right">
                  <Badge variant="secondary" className="font-mono">
                    {formatCurrency(allocation.amount)}
                  </Badge>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAllocation(index)}
                  disabled={allocations.length === 1}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Progress & Validation */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total alocado</span>
            <span className={totalPercentage === 100 ? "text-green-600" : "text-destructive"}>
              {totalPercentage.toFixed(1)}% ({formatCurrency(totalAmount)})
            </span>
          </div>
          <Progress 
            value={Math.min(totalPercentage, 100)} 
            className={totalPercentage > 100 ? "[&>div]:bg-destructive" : ""}
          />
          
          {totalPercentage !== 100 && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {totalPercentage < 100 
                ? `Faltam ${(100 - totalPercentage).toFixed(1)}% para completar o rateio`
                : `O rateio excede ${(totalPercentage - 100).toFixed(1)}%`
              }
            </div>
          )}
          
          {!hasAllocations && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Selecione pelo menos um centro de custo
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate(allocations)}
            disabled={!isValid || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Rateio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
