import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Dice5, Gift, Save, X, Trophy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

interface RoulettePool {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  account_id: string;
}

interface RoulettePrize {
  id: string;
  pool_id: string;
  account_id: string;
  label: string;
  cash_value: number;
  weight: number;
  color: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

const PRESET_COLORS = [
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#ef4444", // red
  "#14b8a6", // teal
  "#f97316", // orange
];

export function RoulettePoolsManager() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  const [poolDialogOpen, setPoolDialogOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<RoulettePool | null>(null);
  const [poolName, setPoolName] = useState("");
  const [poolDescription, setPoolDescription] = useState("");

  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);

  const poolsQuery = useQuery({
    queryKey: ["roulette-pools", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roulette_prize_pools")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RoulettePool[];
    },
    enabled: !!accountId,
  });

  const prizesQuery = useQuery({
    queryKey: ["roulette-prizes", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roulette_prizes")
        .select("*")
        .eq("account_id", accountId!)
        .order("display_order");
      if (error) throw error;
      return data as RoulettePrize[];
    },
    enabled: !!accountId,
  });

  const pools = poolsQuery.data ?? [];
  const allPrizes = prizesQuery.data ?? [];

  const savePool = useMutation({
    mutationFn: async (pool: Partial<RoulettePool> & { name: string }) => {
      if (pool.id) {
        const { error } = await supabase
          .from("roulette_prize_pools")
          .update({ name: pool.name, description: pool.description, is_active: pool.is_active ?? true })
          .eq("id", pool.id);
        if (error) throw error;
        return pool.id;
      } else {
        const { data, error } = await supabase
          .from("roulette_prize_pools")
          .insert({ name: pool.name, description: pool.description, account_id: accountId! })
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["roulette-pools"] });
      toast.success("Pool salvo! Agora adicione os prêmios abaixo.");
      setPoolDialogOpen(false);
      setEditingPool(null);
      setPoolName("");
      setPoolDescription("");
      setSelectedPoolId(newId); // Auto-seleciona para mostrar editor de prêmios
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deletePool = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roulette_prize_pools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roulette-pools"] });
      queryClient.invalidateQueries({ queryKey: ["roulette-prizes"] });
      toast.success("Pool removido");
      setSelectedPoolId(null);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const openNewPool = () => {
    setEditingPool(null);
    setPoolName("");
    setPoolDescription("");
    setPoolDialogOpen(true);
  };

  const openEditPool = (p: RoulettePool) => {
    setEditingPool(p);
    setPoolName(p.name);
    setPoolDescription(p.description || "");
    setPoolDialogOpen(true);
  };

  const selectedPool = pools.find((p) => p.id === selectedPoolId) ?? null;
  const selectedPrizes = allPrizes.filter((p) => p.pool_id === selectedPoolId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Dice5 className="h-5 w-5 text-amber-500" />
              Roletas de Prêmios
            </CardTitle>
            <CardDescription>
              Crie pools de prêmios reutilizáveis para campanhas de SPIFF do tipo Roleta.
            </CardDescription>
          </div>
          <Button onClick={openNewPool} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Pool
          </Button>
        </CardHeader>
        <CardContent>
          {pools.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Gift className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum pool cadastrado. Crie um para começar.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pools.map((pool) => {
                const prizes = allPrizes.filter((p) => p.pool_id === pool.id);
                const totalWeight = prizes.reduce((s, p) => s + p.weight, 0);
                const isSelected = selectedPoolId === pool.id;
                return (
                  <Card
                    key={pool.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      isSelected && "ring-2 ring-primary",
                    )}
                    onClick={() => setSelectedPoolId(pool.id)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{pool.name}</p>
                          {pool.description && (
                            <p className="text-xs text-muted-foreground truncate">{pool.description}</p>
                          )}
                        </div>
                        <div className="flex gap-0.5 -mr-2 -mt-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditPool(pool); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover pool "{pool.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Todos os prêmios deste pool também serão removidos. SPIFFs vinculados ficarão sem pool. Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deletePool.mutate(pool.id)} className="bg-destructive text-destructive-foreground">
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {prizes.length} {prizes.length === 1 ? "prêmio" : "prêmios"}
                        </Badge>
                        {totalWeight > 0 && (
                          <span className="text-[10px] text-muted-foreground">peso total: {totalWeight}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPool && (
        <PrizeListEditor
          pool={selectedPool}
          prizes={selectedPrizes}
          accountId={accountId!}
          onClose={() => setSelectedPoolId(null)}
        />
      )}

      <Dialog open={poolDialogOpen} onOpenChange={setPoolDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPool ? "Editar Pool" : "Novo Pool de Prêmios"}</DialogTitle>
            <DialogDescription>
              Um pool agrupa prêmios reutilizáveis para roletas de SPIFFs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Pool *</Label>
              <Input value={poolName} onChange={(e) => setPoolName(e.target.value)} placeholder="Ex: Roleta Black Friday" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea value={poolDescription} onChange={(e) => setPoolDescription(e.target.value)} rows={2} placeholder="Detalhes ou observações" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPoolDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => savePool.mutate({ id: editingPool?.id, name: poolName, description: poolDescription || null })}
              disabled={!poolName.trim() || savePool.isPending}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Editor de prêmios do pool selecionado ──
function PrizeListEditor({ pool, prizes, accountId, onClose }: {
  pool: RoulettePool;
  prizes: RoulettePrize[];
  accountId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const totalWeight = prizes.reduce((s, p) => s + p.weight, 0);

  const savePrize = useMutation({
    mutationFn: async (prize: Partial<RoulettePrize>) => {
      if (prize.id) {
        const { id, ...payload } = prize;
        const { error } = await supabase.from("roulette_prizes").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("roulette_prizes").insert({
          pool_id: pool.id,
          account_id: accountId,
          label: prize.label || "Novo prêmio",
          cash_value: prize.cash_value ?? 0,
          weight: prize.weight ?? 1,
          color: prize.color ?? PRESET_COLORS[prizes.length % PRESET_COLORS.length],
          display_order: prizes.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roulette-prizes"] }),
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deletePrize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roulette_prizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roulette-prizes"] });
      toast.success("Prêmio removido");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Prêmios de "{pool.name}"
          </CardTitle>
          <CardDescription>
            {prizes.length} {prizes.length === 1 ? "prêmio" : "prêmios"} • Peso total: {totalWeight}
            {totalWeight === 0 && " • Adicione prêmios para começar"}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => savePrize.mutate({ label: "Novo prêmio", cash_value: 0, weight: 1 })} className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar Prêmio
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {prizes.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            Nenhum prêmio. Clique em "Adicionar Prêmio".
          </div>
        ) : (
          <div className="space-y-2">
            {prizes.map((prize) => {
              const probability = totalWeight > 0 ? (prize.weight / totalWeight) * 100 : 0;
              return (
                <PrizeRow
                  key={prize.id}
                  prize={prize}
                  probability={probability}
                  onSave={(updates) => savePrize.mutate({ id: prize.id, ...updates })}
                  onDelete={() => deletePrize.mutate(prize.id)}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrizeRow({ prize, probability, onSave, onDelete }: {
  prize: RoulettePrize;
  probability: number;
  onSave: (updates: Partial<RoulettePrize>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(prize.label);
  const [cashValue, setCashValue] = useState(prize.cash_value);
  const [weight, setWeight] = useState(prize.weight);
  const [color, setColor] = useState(prize.color || PRESET_COLORS[0]);

  const dirty = label !== prize.label || cashValue !== prize.cash_value || weight !== prize.weight || color !== (prize.color || PRESET_COLORS[0]);

  return (
    <div className="rounded-md border bg-card p-2 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-md flex-shrink-0 border-2 border-background shadow"
          style={{ backgroundColor: color }}
        />
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Camiseta, R$ 200, Day-off..."
          className="h-8 text-sm flex-1"
        />
        <Badge variant="outline" className="text-[10px] tabular-nums">
          {probability.toFixed(1)}%
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!dirty}
          onClick={() => onSave({ label, cash_value: cashValue, weight, color })}
        >
          <Save className={cn("h-3.5 w-3.5", dirty && "text-primary")} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 pl-10">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Valor (R$, opcional)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={cashValue || ""}
            onChange={(e) => setCashValue(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Peso (raridade)</Label>
          <Input
            type="number"
            min={1}
            value={weight}
            onChange={(e) => setWeight(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Cor</Label>
          <div className="flex gap-1 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition-transform",
                  color === c ? "border-foreground scale-110" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
