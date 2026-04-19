import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Zap, Save, Dice5, Trophy } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState<string>("all");
  const [prizeType, setPrizeType] = useState<"fixed" | "roulette">("fixed");
  const [bonusAmount, setBonusAmount] = useState(0);
  const [bonusType, setBonusType] = useState("fixed");
  const [targetQty, setTargetQty] = useState(1);
  const [triggerPerValue, setTriggerPerValue] = useState(10000);
  const [rouletteMin, setRouletteMin] = useState(0);
  const [rouletteMax, setRouletteMax] = useState(100);
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

  const handleSave = async () => {
    await saveSpiff.mutateAsync({
      name,
      description: description || null,
      product_id: productId === "all" ? null : productId,
      bonus_amount: prizeType === "roulette" ? rouletteMax : bonusAmount,
      bonus_type: prizeType === "roulette" ? "fixed" : bonusType,
      target_quantity: prizeType === "roulette" ? 0 : targetQty,
      prize_type: prizeType,
      trigger_per_value: prizeType === "roulette" ? triggerPerValue : 0,
      roulette_min_prize: prizeType === "roulette" ? rouletteMin : 0,
      roulette_max_prize: prizeType === "roulette" ? rouletteMax : 0,
      start_date: startDate,
      end_date: endDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      is_active: true,
      plan_id: activePlan?.id || null,
    } as any);
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
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
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
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
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Novo SPIFF
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Campanha SPIFF</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Nome da Campanha</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Roleta da Sorte — Outubro" />
                  </div>

                  {/* Tipo de Prêmio — define o restante do form */}
                  <div className="space-y-2">
                    <Label>Tipo de Prêmio</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPrizeType("fixed")}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
                          prizeType === "fixed"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Trophy className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Bônus Fixo</p>
                          <p className="text-[10px] text-muted-foreground">Valor por meta de qtd</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrizeType("roulette")}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
                          prizeType === "roulette"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Dice5 className="h-4 w-4 text-amber-500 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Roleta da Sorte</p>
                          <p className="text-[10px] text-muted-foreground">Giro a cada R$ captado</p>
                        </div>
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
                  {prizeType === "fixed" ? (
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
                  ) : (
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
                      <p className="text-[10px] text-muted-foreground italic">
                        Os giros ganhos por cada vendedor serão calculados automaticamente com base nos negócios fechados no período. O sorteio em si é feito fora do sistema (roleta física ou digital).
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
                    Criar SPIFF
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
                  return (
                    <TableRow key={spiff.id} className={expired ? "opacity-50" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {isRoulette && <Dice5 className="h-3.5 w-3.5 text-amber-500" />}
                          {spiff.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product?.name || "Todos"}</TableCell>
                      <TableCell className="text-center text-xs">
                        {isRoulette ? (
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                              Roleta da Sorte
                            </Badge>
                            <p className="text-muted-foreground">
                              1 giro / R$ {formatBRL(Number((spiff as any).trigger_per_value || 0))}
                            </p>
                            <p className="text-muted-foreground">
                              R$ {formatBRL(Number((spiff as any).roulette_min_prize || 0))} – R$ {formatBRL(Number((spiff as any).roulette_max_prize || 0))}
                            </p>
                          </div>
                        ) : (
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
                        <Button variant="ghost" size="icon" onClick={() => deleteSpiff.mutate(spiff.id)} className="h-8 w-8">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Painéis de giros pendentes — um por spiff de roleta ativo */}
          {spiffs
            .filter((s) => (s as any).prize_type === "roulette" && s.is_active && !isExpired(s.end_date))
            .map((spiff) => (
              <RouletteSpinsPanel key={`spins-${spiff.id}`} spiff={spiff as any} />
            ))}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// ── Painel de giros pendentes por vendedor ──
function RouletteSpinsPanel({ spiff }: { spiff: any }) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const triggerPerValue = Number(spiff.trigger_per_value || 0);

  const dealsQuery = useQuery({
    queryKey: ["roulette-spins", accountId, spiff.id, spiff.start_date, spiff.end_date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, entry_value, value, responsible_user_id, won_at, status")
        .eq("account_id", accountId!)
        .eq("status", "won")
        .gte("won_at", spiff.start_date)
        .lte("won_at", `${spiff.end_date}T23:59:59`);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; entry_value: number | null; value: number | null; responsible_user_id: string | null; won_at: string | null; status: string }>;
    },
    enabled: !!accountId && triggerPerValue > 0,
  });

  const userIds = Array.from(new Set((dealsQuery.data ?? []).map((d) => d.responsible_user_id).filter(Boolean) as string[]));

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

  const summary = userIds.map((uid) => {
    const total = (dealsQuery.data ?? [])
      .filter((d) => d.responsible_user_id === uid)
      .reduce((acc, d) => acc + Number(d.entry_value || 0), 0);
    const spins = triggerPerValue > 0 ? Math.floor(total / triggerPerValue) : 0;
    const remainder = triggerPerValue > 0 ? total - spins * triggerPerValue : 0;
    const toNextSpin = triggerPerValue > 0 ? triggerPerValue - remainder : 0;
    const user = usersQuery.data?.find((u) => u.id === uid);
    return { uid, name: user?.name || "—", total, spins, toNextSpin };
  }).sort((a, b) => b.spins - a.spins);

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
              Soma o valor dos negócios ganhos por cada vendedor no período da campanha e divide por R$ {formatBRL(triggerPerValue)} para calcular os giros. Os prêmios são sorteados separadamente (roleta física ou digital) entre R$ {formatBRL(Number(spiff.roulette_min_prize || 0))} e R$ {formatBRL(Number(spiff.roulette_max_prize || 0))}.
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
              <TableHead className="text-center text-xs">Giros</TableHead>
              <TableHead className="text-center text-xs">Falta p/ próximo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((s) => (
              <TableRow key={s.uid}>
                <TableCell className="text-sm font-medium">{s.name}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">R$ {formatBRL(Math.round(s.total))}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={s.spins > 0 ? "default" : "secondary"} className="text-xs">
                    {s.spins} {s.spins === 1 ? "giro" : "giros"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                  R$ {formatBRL(Math.round(s.toNextSpin))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
