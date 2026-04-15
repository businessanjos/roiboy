import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, Gift, Percent, DollarSign } from "lucide-react";
import { useQuotasIncentives, IncentiveTier } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";

export function IncentivePlanSection() {
  const now = new Date();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { activePlan, plans, productRates, tiers, loading, savePlan, saveProductRate, saveTiers } = useQuotasIncentives(now.getFullYear(), now.getMonth() + 1);

  const [planName, setPlanName] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [bonusBase, setBonusBase] = useState(0);
  const [draftRates, setDraftRates] = useState<Record<string, { percent: number; fixed: number }>>({});
  const [draftTiers, setDraftTiers] = useState<{ min: number; max: string; multiplier: number; label: string }[]>([]);

  const productsQuery = useQuery({
    queryKey: ["active-products", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const products = productsQuery.data ?? [];

  // Sync state from active plan
  useEffect(() => {
    if (activePlan) {
      setPlanName(activePlan.name);
      setPlanDesc(activePlan.description || "");
      setBonusBase(Number(activePlan.bonus_base_value));
    }
  }, [activePlan]);

  useEffect(() => {
    if (tiers.length > 0) {
      setDraftTiers(
        tiers.map((t) => ({
          min: Number(t.min_achievement_percent),
          max: t.max_achievement_percent != null ? String(t.max_achievement_percent) : "",
          multiplier: Number(t.bonus_multiplier),
          label: t.label || "",
        }))
      );
    } else if (!activePlan) {
      // Default tiers
      setDraftTiers([
        { min: 80, max: "100", multiplier: 0.5, label: "Bronze" },
        { min: 100, max: "120", multiplier: 1, label: "Prata" },
        { min: 120, max: "", multiplier: 1.5, label: "Ouro" },
      ]);
    }
  }, [tiers, activePlan]);

  const getRate = (productId: string) => {
    if (draftRates[productId]) return draftRates[productId];
    const existing = productRates.find((r) => r.product_id === productId);
    return existing ? { percent: Number(existing.commission_percent), fixed: Number(existing.fixed_amount) } : { percent: 0, fixed: 0 };
  };

  const handleSavePlan = async () => {
    await savePlan.mutateAsync({
      id: activePlan?.id,
      name: planName,
      description: planDesc,
      bonus_base_value: bonusBase,
      is_active: true,
    });
  };

  const handleSaveRates = async () => {
    const planId = activePlan?.id || plans[0]?.id;
    if (!planId) return;
    for (const [productId, rate] of Object.entries(draftRates)) {
      await saveProductRate.mutateAsync({
        plan_id: planId,
        product_id: productId,
        commission_percent: rate.percent,
        fixed_amount: rate.fixed,
      });
    }
    setDraftRates({});
  };

  const handleSaveTiers = async () => {
    const planId = activePlan?.id || plans[0]?.id;
    if (!planId) return;
    await saveTiers.mutateAsync({
      planId,
      tiers: draftTiers.map((t) => ({
        plan_id: planId,
        min_achievement_percent: t.min,
        max_achievement_percent: t.max ? parseFloat(t.max) : null,
        bonus_multiplier: t.multiplier,
        label: t.label || null,
      })),
    });
  };

  const addTier = () => {
    const last = draftTiers[draftTiers.length - 1];
    const newMin = last ? (last.max ? parseFloat(last.max) : last.min + 20) : 0;
    setDraftTiers([...draftTiers, { min: newMin, max: "", multiplier: 1, label: "" }]);
  };

  const removeTier = (idx: number) => {
    setDraftTiers(draftTiers.filter((_, i) => i !== idx));
  };

  if (loading || productsQuery.isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-60" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Plan config */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Configuração do Plano
              </CardTitle>
              <CardDescription>Modelo híbrido: comissão por produto + bônus por atingimento</CardDescription>
            </div>
            <Button onClick={handleSavePlan} disabled={savePlan.isPending} className="gap-1.5">
              <Save className="h-4 w-4" />
              Salvar Plano
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Plano</Label>
              <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Ex: Plano Comercial 2026" />
            </div>
            <div className="space-y-2">
              <Label>Bônus Base (R$) — ao atingir 100%</Label>
              <Input
                type="number"
                value={bonusBase || ""}
                onChange={(e) => setBonusBase(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição / Regras</Label>
            <Textarea value={planDesc} onChange={(e) => setPlanDesc(e.target.value)} rows={3} placeholder="Descreva as regras gerais do plano..." />
          </div>
        </CardContent>
      </Card>

      {/* Commission per product */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Comissão por Produto
            </CardTitle>
            <Button onClick={handleSaveRates} disabled={Object.keys(draftRates).length === 0 || saveProductRate.isPending} size="sm" className="gap-1.5">
              <Save className="h-4 w-4" />
              Salvar Taxas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Preço (R$)</TableHead>
                <TableHead className="text-center w-[130px]">Comissão (%)</TableHead>
                <TableHead className="text-center w-[150px]">Valor Fixo (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const rate = getRate(product.id);
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {(Number(product.price) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        className="w-24 text-center mx-auto"
                        value={rate.percent || ""}
                        onChange={(e) => setDraftRates((prev) => ({
                          ...prev,
                          [product.id]: { ...getRate(product.id), percent: parseFloat(e.target.value) || 0 },
                        }))}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        className="w-32 text-center mx-auto"
                        value={rate.fixed || ""}
                        onChange={(e) => setDraftRates((prev) => ({
                          ...prev,
                          [product.id]: { ...getRate(product.id), fixed: parseFloat(e.target.value) || 0 },
                        }))}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bonus tiers */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Faixas de Bônus por Atingimento
              </CardTitle>
              <CardDescription>Multiplicadores aplicados sobre o bônus base</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addTier} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Faixa
              </Button>
              <Button onClick={handleSaveTiers} disabled={saveTiers.isPending} size="sm" className="gap-1.5">
                <Save className="h-4 w-4" />
                Salvar Faixas
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Label</TableHead>
                <TableHead className="text-center w-[130px]">De (%)</TableHead>
                <TableHead className="text-center w-[130px]">Até (%)</TableHead>
                <TableHead className="text-center w-[130px]">Multiplicador</TableHead>
                <TableHead className="text-right w-[130px]">Bônus (R$)</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftTiers.map((tier, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      value={tier.label}
                      onChange={(e) => {
                        const t = [...draftTiers];
                        t[idx] = { ...t[idx], label: e.target.value };
                        setDraftTiers(t);
                      }}
                      placeholder="Ex: Ouro"
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={tier.min}
                      onChange={(e) => {
                        const t = [...draftTiers];
                        t[idx] = { ...t[idx], min: parseFloat(e.target.value) || 0 };
                        setDraftTiers(t);
                      }}
                      className="w-24 text-center mx-auto"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={tier.max}
                      onChange={(e) => {
                        const t = [...draftTiers];
                        t[idx] = { ...t[idx], max: e.target.value };
                        setDraftTiers(t);
                      }}
                      className="w-24 text-center mx-auto"
                      placeholder="∞"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      step={0.1}
                      value={tier.multiplier}
                      onChange={(e) => {
                        const t = [...draftTiers];
                        t[idx] = { ...t[idx], multiplier: parseFloat(e.target.value) || 0 };
                        setDraftTiers(t);
                      }}
                      className="w-24 text-center mx-auto"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {bonusBase > 0 ? `R$ ${((bonusBase * tier.multiplier) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeTier(idx)} className="h-8 w-8">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {draftTiers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma faixa configurada. Clique em "+ Faixa" para adicionar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
