import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Zap, Save, Dice5, Trophy, Pencil, Gift, CreditCard, X } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PaymentMethodSpiffPanel } from "./PaymentMethodSpiffPanel";
import { RouletteSpinDialog } from "./RouletteSpinDialog";

const formatBRL = (v: number) => v.toLocaleString("pt-BR");
const parseBRL = (s: string) => {
  const digits = s.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

export function SpiffsSection() {
  const now = new Date();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { spiffs, activePlan, saveSpiff, deleteSpiff } = useQuotasIncentives(now.getFullYear(), now.getMonth() + 1);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState<string>("all");
  const [prizeType, setPrizeType] = useState<"fixed" | "roulette" | "custom" | "payment_method">("fixed");
  const [bonusAmount, setBonusAmount] = useState(0);
  const [bonusType, setBonusType] = useState("fixed");
  const [targetQty, setTargetQty] = useState(1);
  const [triggerPerValue, setTriggerPerValue] = useState(10000);
  const [rouletteMin, setRouletteMin] = useState(0);
  const [rouletteMax, setRouletteMax] = useState(100);
  const [roulettePoolId, setRoulettePoolId] = useState<string>("range");
  const [triggerSalesCount, setTriggerSalesCount] = useState(3);
  const [triggerWindowDays, setTriggerWindowDays] = useState(7);
  const [triggerWeekStartDay, setTriggerWeekStartDay] = useState<string>("rolling"); // "rolling" | "0".."6"
  const [customPrizeDescription, setCustomPrizeDescription] = useState("");
  const [paymentTiers, setPaymentTiers] = useState<Array<{ label: string; bonus: number; min_parcelas: number; max_parcelas: number; includes_cash: boolean }>>([]);
  const [participantUserIds, setParticipantUserIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");

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

  // Closers ativos (para seleção de participantes em SPIFFs de pagamento)
  const closersQuery = useQuery({
    queryKey: ["spiffs-closers", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_collaborators")
        .select("user_id, full_name, position")
        .eq("account_id", accountId!)
        .not("user_id", "is", null)
        .or("position.ilike.%closer%,position.ilike.%executiv%");
      if (error) throw error;
      return (data ?? []).filter((c: any) => {
        const pos = (c.position || "").toLowerCase();
        return !pos.includes("sdr") && !pos.includes("gerente") && !pos.includes("manager");
      });
    },
    enabled: !!accountId,
  });
  const closers = closersQuery.data ?? [];

  // Pools de prêmios para roleta
  const poolsQuery = useQuery({
    queryKey: ["roulette-pools", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roulette_prize_pools")
        .select("id, name")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });
  const roulettePools = poolsQuery.data ?? [];

  const handleSave = async () => {
    await saveSpiff.mutateAsync({
      ...(editingId ? { id: editingId } : {}),
      name,
      description: description || null,
      product_id: productId === "all" ? null : productId,
      bonus_amount: prizeType === "roulette" ? rouletteMax : prizeType === "custom" ? 0 : bonusAmount,
      bonus_type: prizeType === "fixed" ? bonusType : "fixed",
      target_quantity: prizeType === "fixed" ? targetQty : 0,
      prize_type: prizeType,
      trigger_per_value: prizeType === "roulette" ? triggerPerValue : 0,
      roulette_min_prize: prizeType === "roulette" ? rouletteMin : 0,
      roulette_max_prize: prizeType === "roulette" ? rouletteMax : 0,
      roulette_pool_id: prizeType === "roulette" && roulettePoolId !== "range" ? roulettePoolId : null,
      trigger_sales_count: prizeType === "custom" ? triggerSalesCount : 0,
      trigger_window_days: prizeType === "custom" ? triggerWindowDays : 7,
      trigger_week_start_day:
        prizeType === "custom" && triggerWeekStartDay !== "rolling" && triggerWeekStartDay !== "last-business-day"
          ? parseInt(triggerWeekStartDay)
          : null,
      trigger_window_type:
        prizeType === "custom" && triggerWeekStartDay === "last-business-day" ? "last-business-day" : null,
      custom_prize_description: prizeType === "custom" ? customPrizeDescription || null : null,
      payment_tiers: prizeType === "payment_method" ? paymentTiers : null,
      participant_user_ids: prizeType === "payment_method" && participantUserIds.length > 0 ? participantUserIds : null,
      start_date: startDate,
      end_date: endDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      is_active: true,
      plan_id: activePlan?.id || null,
    } as any);
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setProductId("all");
    setPrizeType("fixed");
    setBonusAmount(0);
    setBonusType("fixed");
    setTargetQty(1);
    setTriggerPerValue(10000);
    setRouletteMin(0);
    setRouletteMax(100);
    setRoulettePoolId("range");
    setTriggerSalesCount(3);
    setTriggerWindowDays(7);
    setTriggerWeekStartDay("rolling");
    setCustomPrizeDescription("");
    setPaymentTiers([]);
    setParticipantUserIds([]);
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
  };

  const openEdit = (spiff: any) => {
    setEditingId(spiff.id);
    setName(spiff.name || "");
    setDescription(spiff.description || "");
    setProductId(spiff.product_id || "all");
    const pType: "fixed" | "roulette" | "custom" | "payment_method" =
      spiff.prize_type === "roulette" ? "roulette"
      : spiff.prize_type === "custom" ? "custom"
      : spiff.prize_type === "payment_method" ? "payment_method"
      : "fixed";
    setPrizeType(pType);
    setBonusAmount(Number(spiff.bonus_amount) || 0);
    setBonusType(spiff.bonus_type || "fixed");
    setTargetQty(Number(spiff.target_quantity) || 1);
    setTriggerPerValue(Number(spiff.trigger_per_value) || 10000);
    setRouletteMin(Number(spiff.roulette_min_prize) || 0);
    setRouletteMax(Number(spiff.roulette_max_prize) || 100);
    setRoulettePoolId(spiff.roulette_pool_id || "range");
    setTriggerSalesCount(Number(spiff.trigger_sales_count) || 3);
    setTriggerWindowDays(Number(spiff.trigger_window_days) || 7);
    setTriggerWeekStartDay(
      spiff.trigger_window_type === "last-business-day"
        ? "last-business-day"
        : spiff.trigger_week_start_day !== null && spiff.trigger_week_start_day !== undefined
          ? String(spiff.trigger_week_start_day)
          : "rolling"
    );
    setCustomPrizeDescription(spiff.custom_prize_description || "");
    setPaymentTiers(Array.isArray(spiff.payment_tiers) ? spiff.payment_tiers : []);
    setParticipantUserIds(Array.isArray(spiff.participant_user_ids) ? spiff.participant_user_ids : []);
    setStartDate(spiff.start_date || new Date().toISOString().split("T")[0]);
    setEndDate(spiff.end_date || "");
    setOpen(true);
  };

  const isExpired = (endDate: string) => new Date(endDate) < new Date();

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                SPIFFs — Incentivos Temporários
              </CardTitle>
              <CardDescription>Campanhas de curto prazo: bônus fixo por meta ou roleta da sorte por valor captado</CardDescription>
            </div>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" onClick={() => resetForm()}>
                  <Plus className="h-4 w-4" />
                  Novo SPIFF
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Campanha SPIFF" : "Criar Campanha SPIFF"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Nome da Campanha</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Roleta da Sorte — Outubro" />
                  </div>

                  {/* Tipo de Prêmio — define o restante do form */}
                  <div className="space-y-2">
                    <Label>Tipo de Prêmio</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setPrizeType("fixed")}
                        className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-colors text-left ${
                          prizeType === "fixed"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Trophy className="h-4 w-4 text-primary shrink-0" />
                        <p className="text-sm font-medium leading-tight">Bônus Fixo</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Valor por meta de qtd</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrizeType("roulette")}
                        className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-colors text-left ${
                          prizeType === "roulette"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Dice5 className="h-4 w-4 text-amber-500 shrink-0" />
                        <p className="text-sm font-medium leading-tight">Roleta $</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Giro a cada R$ captado</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrizeType("custom")}
                        className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-colors text-left ${
                          prizeType === "custom"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Gift className="h-4 w-4 text-pink-500 shrink-0" />
                        <p className="text-sm font-medium leading-tight">Roleta Custom</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Prêmio livre por nº de vendas</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPrizeType("payment_method");
                          if (paymentTiers.length === 0) {
                            setPaymentTiers([
                              { label: "Pix / À vista / 1x", bonus: 1000, min_parcelas: 1, max_parcelas: 1, includes_cash: true },
                              { label: "2x ou 3x cartão", bonus: 750, min_parcelas: 2, max_parcelas: 3, includes_cash: false },
                              { label: "4x, 5x ou 6x cartão", bonus: 550, min_parcelas: 4, max_parcelas: 6, includes_cash: false },
                              { label: "7x a 10x cartão", bonus: 400, min_parcelas: 7, max_parcelas: 10, includes_cash: false },
                              { label: "11x ou 12x cartão", bonus: 250, min_parcelas: 11, max_parcelas: 12, includes_cash: false },
                            ]);
                          }
                        }}
                        className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-colors text-left ${
                          prizeType === "payment_method"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <CreditCard className="h-4 w-4 text-purple-500 shrink-0" />
                        <p className="text-sm font-medium leading-tight">Forma de Pagamento</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Bônus por faixa de parcelas</p>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder={prizeType === "roulette"
                        ? "Ex: A cada R$ 10.000 captado de entrada, executivo gira a roleta com prêmios de R$ 0 a R$ 100."
                        : "Regras e detalhes..."}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Produto Alvo</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Produtos</SelectItem>
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Campos condicionais por tipo de prêmio */}
                  {prizeType === "fixed" && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Bônus por meta de quantidade</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Tipo</Label>
                          <Select value={bonusType} onValueChange={setBonusType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">R$ Fixo</SelectItem>
                              <SelectItem value="percent">%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Bônus ({bonusType === "fixed" ? "R$" : "%"})</Label>
                          <Input type="number" value={bonusAmount || ""} onChange={(e) => setBonusAmount(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Meta de Qtd</Label>
                          <Input type="number" min={1} value={targetQty} onChange={(e) => setTargetQty(parseInt(e.target.value) || 1)} />
                        </div>
                      </div>
                    </div>
                  )}

                  {prizeType === "roulette" && (
                    <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Dice5 className="h-4 w-4 text-amber-600" />
                        <p className="text-xs font-medium">Configuração da Roleta</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Gatilho — 1 giro a cada (R$ de entrada captada)</Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="pl-8"
                            value={triggerPerValue ? formatBRL(triggerPerValue) : ""}
                            onChange={(e) => setTriggerPerValue(parseBRL(e.target.value))}
                            placeholder="10.000"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Ex: R$ 10.000 → quem captar R$ 30.000 gira 3x
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo de prêmios</Label>
                        <Select value={roulettePoolId} onValueChange={setRoulettePoolId}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="range">Faixa de R$ (mín → máx)</SelectItem>
                            {roulettePools.length > 0 && (
                              <>
                                <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase">Pools cadastrados</div>
                                {roulettePools.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>🎁 {p.name}</SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          Pools customizados são gerenciados na aba "Roletas".
                        </p>
                      </div>

                      {roulettePoolId === "range" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Prêmio Mínimo (R$)</Label>
                            <Input type="number" min={0} value={rouletteMin || ""} onChange={(e) => setRouletteMin(parseFloat(e.target.value) || 0)} placeholder="0" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Prêmio Máximo (R$)</Label>
                            <Input type="number" min={0} value={rouletteMax || ""} onChange={(e) => setRouletteMax(parseFloat(e.target.value) || 0)} placeholder="100" />
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground italic">
                        Os giros são calculados automaticamente. Quando o vendedor clicar em "Girar", o sistema sorteia o prêmio respeitando os pesos configurados.
                      </p>
                    </div>
                  )}

                  {prizeType === "custom" && (
                    <div className="rounded-lg border-2 border-pink-500/30 bg-pink-500/5 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-pink-600" />
                        <p className="text-xs font-medium">Configuração da Roleta Custom</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Vendas necessárias (qtd)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={triggerSalesCount || ""}
                            onChange={(e) => setTriggerSalesCount(parseInt(e.target.value) || 1)}
                            placeholder="3"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Janela</Label>
                          <Select
                            value={
                              triggerWeekStartDay === "last-business-day"
                                ? "last-business-day"
                                : triggerWeekStartDay === "rolling"
                                ? `rolling-${triggerWindowDays}`
                                : `week-${triggerWeekStartDay}`
                            }
                            onValueChange={(v) => {
                              if (v === "last-business-day") {
                                setTriggerWeekStartDay("last-business-day");
                                setTriggerWindowDays(1);
                              } else if (v.startsWith("rolling-")) {
                                setTriggerWeekStartDay("rolling");
                                setTriggerWindowDays(parseInt(v.replace("rolling-", "")));
                              } else {
                                const day = v.replace("week-", "");
                                setTriggerWeekStartDay(day);
                                setTriggerWindowDays(7);
                              }
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="last-business-day">Último dia útil do mês</SelectItem>
                              <SelectItem value="rolling-1">Últimas 24h (rolante)</SelectItem>
                              <SelectItem value="rolling-7">Últimos 7 dias (rolante)</SelectItem>
                              <SelectItem value="rolling-14">Últimos 14 dias (rolante)</SelectItem>
                              <SelectItem value="rolling-30">Últimos 30 dias (rolante)</SelectItem>
                              <SelectItem value="week-0">Semana Dom→Sáb</SelectItem>
                              <SelectItem value="week-1">Semana Seg→Dom</SelectItem>
                              <SelectItem value="week-2">Semana Ter→Seg</SelectItem>
                              <SelectItem value="week-3">Semana Qua→Ter</SelectItem>
                              <SelectItem value="week-4">Semana Qui→Qua</SelectItem>
                              <SelectItem value="week-5">Semana Sex→Qui</SelectItem>
                              <SelectItem value="week-6">Semana Sáb→Sex</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Ex: 3 vendas em uma semana (Qua→Ter), ou "War Day" no último dia útil do mês.
                      </p>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Prêmio (descrição livre)</Label>
                        <Textarea
                          value={customPrizeDescription}
                          onChange={(e) => setCustomPrizeDescription(e.target.value)}
                          rows={2}
                          placeholder="Ex: Vale Zara, vale restaurante, vale spa, à escolha do vendedor — até R$ 200"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">
                        O prêmio é customizado pelo próprio vendedor. O sistema apenas conta as vendas e mostra quem ganhou giros pendentes.
                      </p>
                    </div>
                  )}

                  {prizeType === "payment_method" && (
                    <div className="rounded-lg border-2 border-purple-500/30 bg-purple-500/5 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-purple-600" />
                          <p className="text-xs font-medium">Faixas de Bônus por Forma de Pagamento</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => setPaymentTiers([...paymentTiers, { label: "Nova faixa", bonus: 0, min_parcelas: 1, max_parcelas: 1, includes_cash: false }])}
                        >
                          <Plus className="h-3 w-3" />
                          Faixa
                        </Button>
                      </div>

                      {paymentTiers.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Adicione faixas para configurar os bônus.</p>
                      )}

                      <div className="space-y-2">
                        {paymentTiers.map((tier, idx) => (
                          <div key={idx} className="rounded-md border bg-background p-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={tier.label}
                                onChange={(e) => {
                                  const next = [...paymentTiers];
                                  next[idx] = { ...next[idx], label: e.target.value };
                                  setPaymentTiers(next);
                                }}
                                placeholder="Ex: 2x ou 3x cartão"
                                className="h-8 text-xs flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setPaymentTiers(paymentTiers.filter((_, i) => i !== idx))}
                              >
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Bônus (R$)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={tier.bonus || ""}
                                  onChange={(e) => {
                                    const next = [...paymentTiers];
                                    next[idx] = { ...next[idx], bonus: parseFloat(e.target.value) || 0 };
                                    setPaymentTiers(next);
                                  }}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Parcelas mín</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={12}
                                  value={tier.min_parcelas || ""}
                                  onChange={(e) => {
                                    const next = [...paymentTiers];
                                    next[idx] = { ...next[idx], min_parcelas: parseInt(e.target.value) || 1 };
                                    setPaymentTiers(next);
                                  }}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Parcelas máx</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={12}
                                  value={tier.max_parcelas || ""}
                                  onChange={(e) => {
                                    const next = [...paymentTiers];
                                    next[idx] = { ...next[idx], max_parcelas: parseInt(e.target.value) || 1 };
                                    setPaymentTiers(next);
                                  }}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tier.includes_cash}
                                onChange={(e) => {
                                  const next = [...paymentTiers];
                                  next[idx] = { ...next[idx], includes_cash: e.target.checked };
                                  setPaymentTiers(next);
                                }}
                                className="h-3.5 w-3.5"
                              />
                              <span>Inclui Pix / À vista nesta faixa</span>
                            </label>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5 pt-2 border-t">
                        <Label className="text-xs">Closers participantes (vazio = todos os Closers ativos)</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {closers.map((c) => {
                            const selected = participantUserIds.includes(c.user_id!);
                            return (
                              <Badge
                                key={c.user_id}
                                variant={selected ? "default" : "outline"}
                                className="cursor-pointer text-[10px]"
                                onClick={() => {
                                  if (selected) {
                                    setParticipantUserIds(participantUserIds.filter((u) => u !== c.user_id));
                                  } else {
                                    setParticipantUserIds([...participantUserIds, c.user_id!]);
                                  }
                                }}
                              >
                                {c.full_name}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-foreground italic">
                        Cada venda é classificada na primeira faixa que combinar (parcelas + Pix/À vista quando marcado). Vendas sem o campo "Parcelas" preenchido não pontuam.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Início</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleSave} disabled={!name || saveSpiff.isPending} className="w-full gap-1.5">
                    <Save className="h-4 w-4" />
                    {editingId ? "Salvar Alterações" : "Criar SPIFF"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {spiffs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum SPIFF criado. Crie campanhas temporárias para impulsionar vendas específicas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Mecânica</TableHead>
                  <TableHead className="text-center">Período</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spiffs.map((spiff) => {
                  const product = products.find((p) => p.id === spiff.product_id);
                  const expired = isExpired(spiff.end_date);
                  const isRoulette = (spiff as any).prize_type === "roulette";
                  const isCustom = (spiff as any).prize_type === "custom";
                  const isPayment = (spiff as any).prize_type === "payment_method";
                  return (
                    <TableRow key={spiff.id} className={expired ? "opacity-50" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {isRoulette && <Dice5 className="h-3.5 w-3.5 text-amber-500" />}
                          {isCustom && <Gift className="h-3.5 w-3.5 text-pink-500" />}
                          {isPayment && <CreditCard className="h-3.5 w-3.5 text-purple-500" />}
                          {spiff.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product?.name || "Todos"}</TableCell>
                      <TableCell className="text-center text-xs">
                        {isRoulette && (
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                              Roleta $
                            </Badge>
                            <p className="text-muted-foreground">
                              1 giro / R$ {formatBRL(Number((spiff as any).trigger_per_value || 0))}
                            </p>
                            <p className="text-muted-foreground">
                              R$ {formatBRL(Number((spiff as any).roulette_min_prize || 0))} – R$ {formatBRL(Number((spiff as any).roulette_max_prize || 0))}
                            </p>
                          </div>
                        )}
                        {isCustom && (
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="text-[10px] border-pink-500/40 text-pink-700 dark:text-pink-400">
                              Roleta Custom
                            </Badge>
                            <p className="text-muted-foreground">
                              {(spiff as any).trigger_sales_count || 0} vendas /{" "}
                              {(spiff as any).trigger_window_type === "last-business-day"
                                ? "Último dia útil"
                                : (spiff as any).trigger_week_start_day !== null && (spiff as any).trigger_week_start_day !== undefined
                                  ? ["Sem Dom→Sáb","Sem Seg→Dom","Sem Ter→Seg","Sem Qua→Ter","Sem Qui→Qua","Sem Sex→Qui","Sem Sáb→Sex"][(spiff as any).trigger_week_start_day]
                                  : `${(spiff as any).trigger_window_days || 7}d`}
                            </p>
                            {(spiff as any).custom_prize_description && (
                              <p className="text-muted-foreground italic line-clamp-1 max-w-[180px] mx-auto">
                                {(spiff as any).custom_prize_description}
                              </p>
                            )}
                          </div>
                        )}
                        {isPayment && (
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-700 dark:text-purple-400">
                              Forma de Pagamento
                            </Badge>
                            <p className="text-muted-foreground">
                              {Array.isArray((spiff as any).payment_tiers) ? (spiff as any).payment_tiers.length : 0} faixa(s)
                            </p>
                          </div>
                        )}
                        {!isRoulette && !isCustom && !isPayment && (
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="text-[10px]">Bônus Fixo</Badge>
                            <p className="text-muted-foreground">
                              {spiff.bonus_type === "fixed"
                                ? `R$ ${Number(spiff.bonus_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                : `${spiff.bonus_amount}%`}
                              {" "}por {spiff.target_quantity} unid.
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {new Date(spiff.start_date).toLocaleDateString("pt-BR")} — {new Date(spiff.end_date).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-center">
                        {expired
                          ? <Badge variant="outline" className="text-muted-foreground">Encerrado</Badge>
                          : spiff.is_active
                            ? <Badge variant="default">Ativo</Badge>
                            : <Badge variant="secondary">Inativo</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(spiff)} className="h-8 w-8" title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteSpiff.mutate(spiff.id)} className="h-8 w-8" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
      </Card>
    </TooltipProvider>
  );
}

// Field ID do custom field "Item da Venda" — referencia products.id em deal_field_values.value_text
const ITEM_DA_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";

// ── Painel de giros pendentes por vendedor ──
export function RouletteSpinsPanel({ spiff, restrictToUserId }: { spiff: any; restrictToUserId?: string }) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const triggerPerValue = Number(spiff.trigger_per_value || 0);
  const targetProductId: string | null = spiff.product_id || null;

  const dealsQuery = useQuery({
    queryKey: ["roulette-spins", accountId, spiff.id, spiff.start_date, spiff.end_date, targetProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, entry_value, received_value, value, responsible_user_id, won_at, status")
        .eq("account_id", accountId!)
        .eq("status", "won")
        .gte("won_at", spiff.start_date)
        .lte("won_at", `${spiff.end_date}T23:59:59`);
      if (error) throw error;
      let deals = (data ?? []) as Array<{ id: string; entry_value: number | null; received_value: number | null; value: number | null; responsible_user_id: string | null; won_at: string | null; status: string }>;

      // Filtro por produto-alvo da campanha (via custom field "Item da Venda")
      if (targetProductId && deals.length > 0) {
        const dealIds = deals.map((d) => d.id);
        const { data: fvs } = await supabase
          .from("deal_field_values")
          .select("deal_id, value_text")
          .eq("field_id", ITEM_DA_VENDA_FIELD_ID)
          .in("deal_id", dealIds);
        const matchingIds = new Set((fvs ?? []).filter((f: any) => f.value_text === targetProductId).map((f: any) => f.deal_id));
        deals = deals.filter((d) => matchingIds.has(d.id));
      }
      return deals;
    },
    enabled: !!accountId && triggerPerValue > 0,
  });

  // Busca apenas Closers/Executivos Comerciais (exclui SDR, Gerente, Sócios)
  // SPIFFs/Cash Collect são exclusivos para Closers (executivos comerciais).
  const salesTeamQuery = useQuery({
    queryKey: ["sales-team-closers-roulette", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_collaborators")
        .select("user_id, full_name, position")
        .eq("account_id", accountId!)
        .not("user_id", "is", null)
        .or("position.ilike.%closer%,position.ilike.%executiv%");
      if (error) throw error;
      return (data ?? []).filter((c: any) => {
        const pos = (c.position || "").toLowerCase();
        return !pos.includes("sdr") && !pos.includes("gerente") && !pos.includes("manager");
      });
    },
    enabled: !!accountId,
  });

  const teamUserIds = (salesTeamQuery.data ?? []).map((c) => c.user_id).filter(Boolean) as string[];
  const allowedSet = new Set(teamUserIds);
  // Apenas inclui vendas feitas por Closers da lista permitida
  const dealUserIds = Array.from(new Set(
    (dealsQuery.data ?? [])
      .map((d) => d.responsible_user_id)
      .filter((uid): uid is string => !!uid && allowedSet.has(uid))
  ));
  const userIds = Array.from(new Set([...dealUserIds, ...teamUserIds]));

  const usersQuery = useQuery({
    queryKey: ["spin-users", accountId, userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .in("id", userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  // Giros já consumidos (registrados via roleta)
  const spinsLogQuery = useQuery({
    queryKey: ["spiff-spins", accountId, spiff.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spiff_spins")
        .select("user_id, prize_amount, spun_at")
        .eq("spiff_id", spiff.id)
        .order("spun_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });

  const consumedByUser = new Map<string, { count: number; total: number }>();
  for (const log of spinsLogQuery.data ?? []) {
    const cur = consumedByUser.get(log.user_id) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(log.prize_amount || 0);
    consumedByUser.set(log.user_id, cur);
  }

  const summary = userIds.map((uid) => {
    const total = (dealsQuery.data ?? [])
      .filter((d) => d.responsible_user_id === uid)
      .reduce((acc, d) => acc + Number(d.received_value ?? d.entry_value ?? 0), 0);
    const earnedSpins = triggerPerValue > 0 ? Math.floor(total / triggerPerValue) : 0;
    const remainder = triggerPerValue > 0 ? total - earnedSpins * triggerPerValue : 0;
    const toNextSpin = triggerPerValue > 0 ? triggerPerValue - remainder : 0;
    const consumed = consumedByUser.get(uid) ?? { count: 0, total: 0 };
    const pendingSpins = Math.max(0, earnedSpins - consumed.count);
    const user = usersQuery.data?.find((u) => u.id === uid);
    const collab = (salesTeamQuery.data ?? []).find((c) => c.user_id === uid);
    return {
      uid,
      name: user?.name || collab?.full_name || "—",
      total,
      earnedSpins,
      pendingSpins,
      consumedCount: consumed.count,
      consumedTotal: consumed.total,
      toNextSpin,
    };
  }).sort((a, b) => b.pendingSpins - a.pendingSpins || b.earnedSpins - a.earnedSpins || a.name.localeCompare(b.name));

  const visibleSummary = restrictToUserId ? summary.filter((s) => s.uid === restrictToUserId) : summary;

  const [spinUser, setSpinUser] = useState<{ uid: string; name: string; pending: number } | null>(null);

  if (triggerPerValue <= 0) return null;

  return (
    <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Dice5 className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-medium">Giros pendentes — {spiff.name}</p>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[10px] cursor-help">como funciona?</Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              Soma o campo "Entrada" dos negócios ganhos por cada vendedor no período e divide por R$ {formatBRL(triggerPerValue)} para calcular os giros. Clique em "Girar" para sortear o prêmio entre R$ {formatBRL(Number(spiff.roulette_min_prize || 0))} e R$ {formatBRL(Number(spiff.roulette_max_prize || 0))} e registrar o resultado.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      {summary.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum negócio ganho no período ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Vendedor</TableHead>
              <TableHead className="text-center text-xs">Captado</TableHead>
              <TableHead className="text-center text-xs">Giros pendentes</TableHead>
              <TableHead className="text-center text-xs">Histórico</TableHead>
              <TableHead className="text-center text-xs">Falta p/ próximo</TableHead>
              <TableHead className="text-right text-xs">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((s) => (
              <TableRow key={s.uid}>
                <TableCell className="text-sm font-medium">{s.name}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">R$ {formatBRL(Math.round(s.total))}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={s.pendingSpins > 0 ? "default" : "secondary"} className="text-xs">
                    {s.pendingSpins} {s.pendingSpins === 1 ? "giro" : "giros"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-xs tabular-nums">
                  {s.consumedCount > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {s.consumedCount}× • R$ {formatBRL(Math.round(s.consumedTotal))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                  R$ {formatBRL(Math.round(s.toNextSpin))}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant={s.pendingSpins > 0 ? "default" : "outline"}
                    disabled={s.pendingSpins <= 0}
                    onClick={() => setSpinUser({ uid: s.uid, name: s.name, pending: s.pendingSpins })}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Dice5 className="h-3.5 w-3.5" />
                    Girar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {spinUser && (
        <RouletteSpinDialog
          open={!!spinUser}
          onOpenChange={(o) => { if (!o) setSpinUser(null); }}
          spiff={spiff}
          user={{ uid: spinUser.uid, name: spinUser.name }}
          pendingSpins={spinUser.pending}
        />
      )}
    </div>
  );
}

// ── Painel de giros pendentes — Roleta Custom (vendas em janela) ──
export function CustomSpinsPanel({ spiff }: { spiff: any }) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const triggerSalesCount = Number(spiff.trigger_sales_count || 0);
  const windowDays = Number(spiff.trigger_window_days || 7);
  const windowType: string | null = spiff.trigger_window_type || null;
  const weekStartDay: number | null =
    spiff.trigger_week_start_day !== null && spiff.trigger_week_start_day !== undefined
      ? Number(spiff.trigger_week_start_day)
      : null;

  // Helper: último dia útil do mês corrente (seg-sex). Se cair em sáb/dom, recua até sexta.
  const getLastBusinessDayOfMonth = (ref: Date): Date => {
    const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0); // último dia do mês
    while (last.getDay() === 0 || last.getDay() === 6) {
      last.setDate(last.getDate() - 1);
    }
    return last;
  };

  // Cálculo da janela atual:
  // - "last-business-day": exatamente o último dia útil do mês corrente (00:00 → 23:59)
  // - weekStartDay definido: alinha à semana customizada (ex: Qua 00:00 → Ter 23:59).
  // - Senão: usa janela rolante de N dias até hoje.
  const today = new Date();
  let windowStart: Date;
  let windowEnd: Date;
  if (windowType === "last-business-day") {
    const lbd = getLastBusinessDayOfMonth(today);
    windowStart = new Date(lbd);
    windowStart.setHours(0, 0, 0, 0);
    windowEnd = new Date(lbd);
    windowEnd.setHours(23, 59, 59, 999);
  } else if (weekStartDay !== null) {
    const todayDow = today.getDay(); // 0=Dom..6=Sab
    const diff = (todayDow - weekStartDay + 7) % 7;
    windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - diff);
    windowStart.setHours(0, 0, 0, 0);
    windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 6);
    windowEnd.setHours(23, 59, 59, 999);
  } else {
    windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - windowDays + 1);
    windowStart.setHours(0, 0, 0, 0);
    windowEnd = new Date(today);
    windowEnd.setHours(23, 59, 59, 999);
  }
  const campaignEnd = new Date(spiff.end_date);
  campaignEnd.setHours(23, 59, 59, 999);
  // A janela semanal/rolante/last-business-day é o que importa — start_date da campanha não corta a janela.
  // Apenas limitar pelo end_date.
  const effectiveStart = windowStart;
  const effectiveEnd = windowEnd < campaignEnd ? windowEnd : campaignEnd;

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const windowLabel = windowType === "last-business-day"
    ? `Último dia útil (${effectiveStart.toLocaleDateString("pt-BR")})`
    : weekStartDay !== null
      ? `Semana ${dayNames[weekStartDay]}→${dayNames[(weekStartDay + 6) % 7]} (${effectiveStart.toLocaleDateString("pt-BR")} a ${effectiveEnd.toLocaleDateString("pt-BR")})`
      : `Últimos ${windowDays}d`;

  const targetProductId: string | null = spiff.product_id || null;

  const dealsQuery = useQuery({
    queryKey: ["custom-spins", accountId, spiff.id, effectiveStart.toISOString(), effectiveEnd.toISOString(), targetProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, responsible_user_id, won_at, status")
        .eq("account_id", accountId!)
        .eq("status", "won")
        .gte("won_at", effectiveStart.toISOString())
        .lte("won_at", effectiveEnd.toISOString());
      if (error) throw error;
      let deals = (data ?? []) as Array<{ id: string; responsible_user_id: string | null; won_at: string | null }>;

      // Filtro por produto-alvo da campanha (via custom field "Item da Venda")
      if (targetProductId && deals.length > 0) {
        const dealIds = deals.map((d) => d.id);
        const { data: fvs } = await supabase
          .from("deal_field_values")
          .select("deal_id, value_text")
          .eq("field_id", ITEM_DA_VENDA_FIELD_ID)
          .in("deal_id", dealIds);
        const matchingIds = new Set((fvs ?? []).filter((f: any) => f.value_text === targetProductId).map((f: any) => f.deal_id));
        deals = deals.filter((d) => matchingIds.has(d.id));
      }
      return deals;
    },
    enabled: !!accountId && triggerSalesCount > 0,
  });

  // Busca apenas Closers/Executivos Comerciais (exclui SDR, Gerente, etc.)
  // SPIFFs de incentivo são exclusivos para Closers (executivos comerciais).
  const salesTeamQuery = useQuery({
    queryKey: ["sales-team-closers", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_collaborators")
        .select("user_id, full_name, position")
        .eq("account_id", accountId!)
        .not("user_id", "is", null)
        .or("position.ilike.%closer%,position.ilike.%executiv%");
      if (error) throw error;
      // Garantia extra: remove qualquer cargo que contenha SDR ou Gerente
      return (data ?? []).filter((c: any) => {
        const pos = (c.position || "").toLowerCase();
        return !pos.includes("sdr") && !pos.includes("gerente") && !pos.includes("manager");
      });
    },
    enabled: !!accountId,
  });

  const teamUserIds = (salesTeamQuery.data ?? []).map((c) => c.user_id).filter(Boolean) as string[];
  const allowedSet = new Set(teamUserIds);
  // Apenas inclui vendas feitas por Closers da lista permitida
  const dealUserIds = Array.from(new Set(
    (dealsQuery.data ?? [])
      .map((d) => d.responsible_user_id)
      .filter((uid): uid is string => !!uid && allowedSet.has(uid))
  ));
  const userIds = Array.from(new Set([...dealUserIds, ...teamUserIds]));

  const usersQuery = useQuery({
    queryKey: ["custom-spin-users", accountId, userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase.from("users").select("id, name").in("id", userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const summary = userIds.map((uid) => {
    const sales = (dealsQuery.data ?? []).filter((d) => d.responsible_user_id === uid).length;
    const spins = triggerSalesCount > 0 ? Math.floor(sales / triggerSalesCount) : 0;
    const remainder = triggerSalesCount > 0 ? sales - spins * triggerSalesCount : 0;
    const toNext = triggerSalesCount > 0 ? triggerSalesCount - remainder : 0;
    const user = usersQuery.data?.find((u) => u.id === uid);
    const collab = (salesTeamQuery.data ?? []).find((c) => c.user_id === uid);
    return { uid, name: user?.name || collab?.full_name || "—", sales, spins, toNext };
  }).sort((a, b) => b.spins - a.spins || b.sales - a.sales || a.name.localeCompare(b.name));

  if (triggerSalesCount <= 0) return null;

  return (
    <div className="rounded-lg border-2 border-pink-500/30 bg-pink-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Gift className="h-4 w-4 text-pink-600" />
        <p className="text-sm font-medium">Giros pendentes — {spiff.name}</p>
        <Badge variant="outline" className="text-[10px] border-pink-500/40 text-pink-700 dark:text-pink-400">
          {triggerSalesCount} vendas / {windowLabel}
        </Badge>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[10px] cursor-help">como funciona?</Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              {weekStartDay !== null
                ? `Conta os negócios ganhos por cada vendedor na semana atual (${dayNames[weekStartDay]} 00:00 → ${dayNames[(weekStartDay + 6) % 7]} 23:59).`
                : `Conta os negócios ganhos por cada vendedor nos últimos ${windowDays} dias.`}
              {" "}A cada {triggerSalesCount} vendas, o vendedor ganha 1 giro. O prêmio é livre — escolhido pelo próprio vendedor (ex: "{spiff.custom_prize_description || "vale presente"}").
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      {spiff.custom_prize_description && (
        <p className="text-xs text-muted-foreground italic">🎁 Prêmio: {spiff.custom_prize_description}</p>
      )}
      {summary.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhuma venda ganha na janela atual ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Vendedor</TableHead>
              <TableHead className="text-center text-xs">Vendas (janela)</TableHead>
              <TableHead className="text-center text-xs">Giros</TableHead>
              <TableHead className="text-center text-xs">Falta p/ próximo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((s) => (
              <TableRow key={s.uid}>
                <TableCell className="text-sm font-medium">{s.name}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{s.sales}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={s.spins > 0 ? "default" : "secondary"} className="text-xs">
                    {s.spins} {s.spins === 1 ? "giro" : "giros"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                  {s.toNext} {s.toNext === 1 ? "venda" : "vendas"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
