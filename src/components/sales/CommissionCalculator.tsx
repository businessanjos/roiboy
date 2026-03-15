import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { DollarSign, TrendingUp, Users, Target, Calculator, Info, ChevronRight, ArrowUpRight, ArrowDownRight, Zap, Shield, BarChart3, Lightbulb, CheckCircle2, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import CommissionGuide from './CommissionGuide';

interface CommissionModel {
  id: string; name: string; description: string; icon: typeof DollarSign; color: string; bgColor: string; bestFor: string[]; pros: string[]; cons: string[];
}

interface QuotaConfig {
  baseSalary: number; monthlyTarget: number; commissionRate: number; acceleratorRate: number; deceleratorRate: number; floor: number; ceiling: number; teamSize: number;
}

const COMMISSION_MODELS: CommissionModel[] = [
  { id: 'scaled', name: 'Escalonado', description: 'Percentual varia de acordo com a faixa de atingimento da meta.', icon: TrendingUp, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', bestFor: ['Equipes com incentivo progressivo', 'Empresas com metas claras'], pros: ['Incentiva superação de metas', 'Justo para diferentes perfis'], cons: ['Complexo de calcular', 'Requer definição clara de faixas'] },
  { id: 'recurring', name: 'Recorrente', description: 'Comissão paga mensalmente enquanto o cliente mantiver contrato.', icon: ArrowUpRight, color: 'text-blue-500', bgColor: 'bg-blue-500/10', bestFor: ['SaaS e assinatura', 'Serviços recorrentes'], pros: ['Incentiva retenção', 'Renda previsível'], cons: ['Atrasa ganhos imediatos'] },
  { id: 'team', name: 'Por Equipe', description: 'Comissão pelo desempenho coletivo do time.', icon: Users, color: 'text-violet-500', bgColor: 'bg-violet-500/10', bestFor: ['Vendas colaborativas', 'Times pequenos'], pros: ['Fortalece espírito de equipe'], cons: ['Pode desmotivar top performers'] },
  { id: 'ote', name: 'OTE', description: 'Salário fixo + variável. Transparência total.', icon: Target, color: 'text-amber-500', bgColor: 'bg-amber-500/10', bestFor: ['Atração de talentos', 'Vendas consultivas B2B'], pros: ['Transparência total', 'Atrai talentos'], cons: ['Custo fixo elevado'] },
  { id: 'pure', name: 'Comissão Pura', description: 'Baixo fixo, alta variável.', icon: Zap, color: 'text-red-500', bgColor: 'bg-red-500/10', bestFor: ['Varejo', 'Alto volume'], pros: ['Baixo custo fixo', 'Sem limite de ganhos'], cons: ['Alta rotatividade'] },
  { id: 'gross_revenue', name: 'Por Faturamento Bruto', description: 'Comissão sobre faturamento bruto total.', icon: BarChart3, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', bestFor: ['Margens altas', 'Produtos padronizados'], pros: ['Simples de calcular'], cons: ['Ignora rentabilidade'] },
  { id: 'profit_margin', name: 'Por Margem de Lucro', description: 'Comissão baseada na margem, não no faturamento.', icon: Shield, color: 'text-teal-500', bgColor: 'bg-teal-500/10', bestFor: ['Margens variáveis', 'Vendas consultivas'], pros: ['Protege margens'], cons: ['Mais complexo'] },
  { id: 'bonus', name: 'Modelo de Bônus', description: 'Remuneração variável por metas específicas.', icon: Award, color: 'text-orange-500', bgColor: 'bg-orange-500/10', bestFor: ['Crescimento acelerado', 'Performance excepcional'], pros: ['Incentiva alta performance', 'Flexível'], cons: ['Pode frustrar se metas forem irrealistas'] },
];

const GLOSSARY_ITEMS = [
  { term: 'Cota / Meta', definition: 'Objetivo de vendas que o vendedor precisa atingir em um período.' },
  { term: 'Piso / Mínimo', definition: 'Valor mínimo de vendas necessário para ativar o comissionamento.' },
  { term: 'Teto / Máximo', definition: 'Limite máximo de comissão que o vendedor pode receber.' },
  { term: 'Gatilho (Trigger)', definition: 'Valor que dispara um aumento na taxa de comissão ou um bônus.' },
  { term: 'Acelerador', definition: 'Multiplicador aplicado à comissão quando supera a meta.' },
  { term: 'Desacelerador', definition: 'Multiplicador que reduz a comissão quando não atinge a meta.' },
  { term: 'OTE', definition: 'On-Target-Earnings: valor total ao bater 100% da meta.' },
  { term: 'Estorno / Chargeback', definition: 'Reversão da comissão quando o cliente cancela.' },
  { term: 'Split Fixo/Variável', definition: 'Divisão entre salário fixo e variável. Ex: 60/40.' },
  { term: 'Ticket Médio', definition: 'Valor médio de cada venda fechada.' },
  { term: 'Churn Rate', definition: 'Taxa de cancelamento de clientes.' },
];

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const pn = (v: string) => parseFloat(v.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
const dn = (v: number) => v === 0 ? '' : String(v);

export default function CommissionCalculator() {
  const [activeSection, setActiveSection] = useState('models');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaConfig>({ baseSalary: 3000, monthlyTarget: 50000, commissionRate: 5, acceleratorRate: 1.2, deceleratorRate: 0.8, floor: 50, ceiling: 200, teamSize: 5 });
  const [actualSales, setActualSales] = useState(50000);
  const [grossRevenue, setGrossRevenue] = useState(100000);
  const [profitMargin, setProfitMargin] = useState(30);
  const [tiers, setTiers] = useState([{ min: 0, max: 49, rate: 0 }, { min: 50, max: 79, rate: 3 }, { min: 80, max: 99, rate: 5 }, { min: 100, max: 119, rate: 7 }, { min: 120, max: 200, rate: 10 }]);
  const [oteSplit, setOteSplit] = useState(60);
  const [bonusConfig, setBonusConfig] = useState({ targetBonus: 500, superBonus: 1000, superThreshold: 120, cashSaleBonus: 200, cashSalesCount: 3, retentionBonus: 300, retentionMet: true, highMarginBonus: 150, highMarginCount: 2 });

  const selectedModelData = COMMISSION_MODELS.find(m => m.id === selectedModel);

  const calculation = useMemo(() => {
    const achievementPct = (actualSales / quota.monthlyTarget) * 100;
    const results: Record<string, { commission: number; totalEarnings: number; details: string }> = {};

    const scaledTier = tiers.find(t => achievementPct >= t.min && achievementPct <= t.max);
    const scaledRate = scaledTier?.rate || 0;
    const scaledCommission = actualSales * (scaledRate / 100);
    results.scaled = { commission: scaledCommission, totalEarnings: quota.baseSalary + scaledCommission, details: `Atingimento: ${achievementPct.toFixed(0)}% → Faixa: ${scaledRate}%` };

    const recurringCommission = actualSales * (quota.commissionRate / 100);
    results.recurring = { commission: recurringCommission, totalEarnings: quota.baseSalary + recurringCommission, details: `${quota.commissionRate}% sobre MRR de ${fmt(actualSales)}` };

    const teamCommission = (actualSales * (quota.commissionRate / 100)) / quota.teamSize;
    results.team = { commission: teamCommission, totalEarnings: quota.baseSalary + teamCommission, details: `Total: ${fmt(actualSales * (quota.commissionRate / 100))} ÷ ${quota.teamSize} membros` };

    const oteTotal = quota.baseSalary * 12; const fixedAnnual = oteTotal * (oteSplit / 100); const variableAnnual = oteTotal * ((100 - oteSplit) / 100);
    const oteAchievement = Math.min(achievementPct / 100, quota.ceiling / 100); const oteVariable = (variableAnnual / 12) * oteAchievement;
    results.ote = { commission: oteVariable, totalEarnings: (fixedAnnual / 12) + oteVariable, details: `Fixo: ${fmt(fixedAnnual / 12)} + Variável: ${fmt(oteVariable)}` };

    const pureCommission = actualSales * (quota.commissionRate / 100); const pureFloorMet = achievementPct >= quota.floor;
    results.pure = { commission: pureFloorMet ? pureCommission : 0, totalEarnings: quota.baseSalary + (pureFloorMet ? pureCommission : 0), details: pureFloorMet ? `${quota.commissionRate}% sobre ${fmt(actualSales)}` : `Piso não atingido` };

    const grossCommission = grossRevenue * (quota.commissionRate / 100);
    results.gross_revenue = { commission: grossCommission, totalEarnings: quota.baseSalary + grossCommission, details: `${quota.commissionRate}% sobre ${fmt(grossRevenue)}` };

    const profitValue = grossRevenue * (profitMargin / 100); const profitCommission = profitValue * (quota.commissionRate / 100);
    results.profit_margin = { commission: profitCommission, totalEarnings: quota.baseSalary + profitCommission, details: `Margem: ${fmt(profitValue)} → ${quota.commissionRate}%` };

    const bonusMetaBatida = achievementPct >= 100 ? bonusConfig.targetBonus : 0;
    const bonusSuperacao = achievementPct >= bonusConfig.superThreshold ? bonusConfig.superBonus : 0;
    const totalBonus = bonusMetaBatida + bonusSuperacao + (bonusConfig.cashSaleBonus * bonusConfig.cashSalesCount) + (bonusConfig.retentionMet ? bonusConfig.retentionBonus : 0) + (bonusConfig.highMarginBonus * bonusConfig.highMarginCount);
    results.bonus = { commission: totalBonus, totalEarnings: quota.baseSalary + totalBonus, details: `Bônus total: ${fmt(totalBonus)}` };

    const multiplier = achievementPct >= 100 ? quota.acceleratorRate : quota.deceleratorRate;
    const baseCommission = actualSales * (quota.commissionRate / 100);
    return { achievementPct, results, multiplier, baseCommission, adjustedCommission: baseCommission * multiplier };
  }, [actualSales, quota, tiers, oteSplit, grossRevenue, profitMargin, bonusConfig]);

  const currentResult = selectedModel ? calculation.results[selectedModel] : null;

  return (
    <div className="space-y-6">
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="models" className="gap-2"><Lightbulb className="w-4 h-4 hidden sm:inline" /><span className="text-xs sm:text-sm">Modelos</span></TabsTrigger>
          <TabsTrigger value="calculator" className="gap-2"><Calculator className="w-4 h-4 hidden sm:inline" /><span className="text-xs sm:text-sm">Calculadora</span></TabsTrigger>
          <TabsTrigger value="guide" className="gap-2"><CheckCircle2 className="w-4 h-4 hidden sm:inline" /><span className="text-xs sm:text-sm">Guia</span></TabsTrigger>
          <TabsTrigger value="glossary" className="gap-2"><Info className="w-4 h-4 hidden sm:inline" /><span className="text-xs sm:text-sm">Glossário</span></TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <div className="space-y-4">
            <div className="text-center mb-6"><h2 className="text-xl font-bold mb-2">Escolha o Modelo de Comissionamento</h2><p className="text-muted-foreground text-sm max-w-2xl mx-auto">Cada modelo tem vantagens e desvantagens.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COMMISSION_MODELS.map(model => {
                const Icon = model.icon; const isSelected = selectedModel === model.id;
                return (
                  <Card key={model.id} className={cn('cursor-pointer transition-all hover:shadow-md', isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/30')} onClick={() => setSelectedModel(model.id)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className={cn('p-2.5 rounded-lg', model.bgColor)}><Icon className={cn('w-5 h-5', model.color)} /></div>
                        <div className="flex-1 min-w-0"><CardTitle className="text-base flex items-center gap-2">{model.name}{isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}</CardTitle><CardDescription className="text-xs mt-1 line-clamp-2">{model.description}</CardDescription></div>
                      </div>
                    </CardHeader>
                    {isSelected && (
                      <CardContent className="pt-0 space-y-3">
                        <div><p className="text-xs font-semibold text-muted-foreground mb-1.5">IDEAL PARA:</p><div className="flex flex-wrap gap-1.5">{model.bestFor.map((item, i) => <Badge key={i} variant="secondary" className="text-xs font-normal">{item}</Badge>)}</div></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Vantagens</p><ul className="space-y-0.5">{model.pros.map((p, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-1"><ChevronRight className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{p}</li>)}</ul></div>
                          <div><p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Desvantagens</p><ul className="space-y-0.5">{model.cons.map((c, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-1"><ChevronRight className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />{c}</li>)}</ul></div>
                        </div>
                        <Button size="sm" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); setActiveSection('calculator'); }}><Calculator className="w-4 h-4 mr-2" />Simular</Button>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="calculator">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Configuração Base</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {!selectedModel && <div className="p-3 bg-muted/50 rounded-lg text-center"><p className="text-sm text-muted-foreground">Selecione um modelo:</p><div className="flex flex-wrap gap-2 mt-3 justify-center">{COMMISSION_MODELS.map(m => <Badge key={m.id} variant={selectedModel === m.id ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setSelectedModel(m.id)}>{m.name}</Badge>)}</div></div>}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs">Salário Base (R$)</Label><Input type="number" value={dn(quota.baseSalary)} onChange={e => setQuota(p => ({ ...p, baseSalary: pn(e.target.value) }))} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Meta Mensal (R$)</Label><Input type="number" value={dn(quota.monthlyTarget)} onChange={e => setQuota(p => ({ ...p, monthlyTarget: pn(e.target.value) }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedModel !== 'bonus' && <div className="space-y-1.5"><Label className="text-xs">Taxa de Comissão (%)</Label><Input type="number" step="0.5" value={dn(quota.commissionRate)} onChange={e => setQuota(p => ({ ...p, commissionRate: pn(e.target.value) }))} /></div>}
                    {selectedModel === 'team' && <div className="space-y-1.5"><Label className="text-xs">Tamanho do Time</Label><Input type="number" value={dn(quota.teamSize)} onChange={e => setQuota(p => ({ ...p, teamSize: parseInt(e.target.value) || 1 }))} /></div>}
                    {selectedModel === 'ote' && <div className="space-y-1.5"><Label className="text-xs">Split Fixo/Variável (%)</Label><div className="flex items-center gap-2"><Input type="number" value={dn(oteSplit)} onChange={e => setOteSplit(Math.min(90, Math.max(10, parseInt(e.target.value) || 50)))} /><span className="text-xs text-muted-foreground whitespace-nowrap">{oteSplit}/{100 - oteSplit}</span></div></div>}
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-emerald-500" />Acelerador</Label><Input type="number" step="0.1" value={dn(quota.acceleratorRate)} onChange={e => setQuota(p => ({ ...p, acceleratorRate: pn(e.target.value) }))} /></div>
                    <div className="space-y-1.5"><Label className="text-xs flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" />Desacelerador</Label><Input type="number" step="0.1" value={dn(quota.deceleratorRate)} onChange={e => setQuota(p => ({ ...p, deceleratorRate: pn(e.target.value) }))} /></div>
                  </div>
                  {selectedModel === 'scaled' && (<><Separator /><div><Label className="text-xs font-semibold mb-2 block">Faixas</Label><div className="space-y-2">{tiers.map((tier, i) => (<div key={i} className="flex items-center gap-2 text-xs"><Input type="number" className="w-16 h-8 text-xs" value={dn(tier.min)} onChange={e => { const n = [...tiers]; n[i].min = parseInt(e.target.value) || 0; setTiers(n); }} /><span className="text-muted-foreground">a</span><Input type="number" className="w-16 h-8 text-xs" value={dn(tier.max)} onChange={e => { const n = [...tiers]; n[i].max = parseInt(e.target.value) || 0; setTiers(n); }} /><span className="text-muted-foreground">% →</span><Input type="number" step="0.5" className="w-16 h-8 text-xs" value={dn(tier.rate)} onChange={e => { const n = [...tiers]; n[i].rate = parseFloat(e.target.value) || 0; setTiers(n); }} /><span className="text-muted-foreground">%</span></div>))}<Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setTiers(p => [...p, { min: p[p.length - 1]?.max + 1 || 0, max: 300, rate: 12 }])}>+ Faixa</Button></div></div></>)}
                  {selectedModel === 'gross_revenue' && (<><Separator /><div className="space-y-1.5"><Label className="text-xs">Faturamento Bruto (R$)</Label><Input type="number" value={dn(grossRevenue)} onChange={e => setGrossRevenue(pn(e.target.value))} /></div></>)}
                  {selectedModel === 'profit_margin' && (<><Separator /><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">Faturamento (R$)</Label><Input type="number" value={dn(grossRevenue)} onChange={e => setGrossRevenue(pn(e.target.value))} /></div><div className="space-y-1.5"><Label className="text-xs">Margem (%)</Label><Input type="number" value={dn(profitMargin)} onChange={e => setProfitMargin(pn(e.target.value))} /></div></div></>)}
                  {selectedModel === 'bonus' && (<><Separator /><div><Label className="text-xs font-semibold mb-2 block">Bônus por Meta</Label><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">Bônus meta batida (R$)</Label><Input type="number" value={dn(bonusConfig.targetBonus)} onChange={e => setBonusConfig(p => ({ ...p, targetBonus: pn(e.target.value) }))} /></div><div className="space-y-1.5"><Label className="text-xs">Bônus superação (R$)</Label><Input type="number" value={dn(bonusConfig.superBonus)} onChange={e => setBonusConfig(p => ({ ...p, superBonus: pn(e.target.value) }))} /></div></div><div className="space-y-1.5 mt-3"><Label className="text-xs">Gatilho superação (%)</Label><Input type="number" value={dn(bonusConfig.superThreshold)} onChange={e => setBonusConfig(p => ({ ...p, superThreshold: pn(e.target.value) }))} /></div></div><Separator /><div><Label className="text-xs font-semibold mb-2 block">Bônus por Indicadores</Label><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">Bônus venda à vista (R$)</Label><Input type="number" value={dn(bonusConfig.cashSaleBonus)} onChange={e => setBonusConfig(p => ({ ...p, cashSaleBonus: pn(e.target.value) }))} /></div><div className="space-y-1.5"><Label className="text-xs">Qtd vendas à vista</Label><Input type="number" value={dn(bonusConfig.cashSalesCount)} onChange={e => setBonusConfig(p => ({ ...p, cashSalesCount: parseInt(e.target.value) || 0 }))} /></div></div><div className="grid grid-cols-2 gap-3 mt-3"><div className="space-y-1.5"><Label className="text-xs">Bônus retenção (R$)</Label><Input type="number" value={dn(bonusConfig.retentionBonus)} onChange={e => setBonusConfig(p => ({ ...p, retentionBonus: pn(e.target.value) }))} /><div className="flex items-center gap-2 mt-1"><Checkbox id="retentionMet" checked={bonusConfig.retentionMet} onCheckedChange={v => setBonusConfig(p => ({ ...p, retentionMet: !!v }))} /><label htmlFor="retentionMet" className="text-[10px] text-muted-foreground">Meta atingida</label></div></div><div className="space-y-1.5"><Label className="text-xs">Bônus alta margem (R$)</Label><Input type="number" value={dn(bonusConfig.highMarginBonus)} onChange={e => setBonusConfig(p => ({ ...p, highMarginBonus: pn(e.target.value) }))} /><div className="space-y-1.5 mt-1"><Label className="text-[10px]">Qtd alta margem</Label><Input type="number" className="h-7 text-xs" value={dn(bonusConfig.highMarginCount)} onChange={e => setBonusConfig(p => ({ ...p, highMarginCount: parseInt(e.target.value) || 0 }))} /></div></div></div></div></>)}
                </CardContent>
              </Card>
              <Card><CardHeader className="pb-3"><CardTitle className="text-base">Simulação</CardTitle></CardHeader><CardContent><div className="space-y-1.5"><Label className="text-xs">Vendas Realizadas (R$)</Label><Input type="number" value={dn(actualSales)} onChange={e => setActualSales(pn(e.target.value))} className="text-lg font-semibold" /><p className="text-xs text-muted-foreground">Atingimento: <span className={cn('font-semibold', calculation.achievementPct >= 100 ? 'text-emerald-500' : 'text-amber-500')}>{calculation.achievementPct.toFixed(0)}%</span></p></div></CardContent></Card>
            </div>
            <div className="space-y-4">
              {selectedModel && currentResult ? (<>
                <Card className="border-primary/30">
                  <CardHeader className="pb-3"><div className="flex items-center gap-2">{selectedModelData && <selectedModelData.icon className={cn('w-5 h-5', selectedModelData.color)} />}<CardTitle className="text-base">Resultado: {selectedModelData?.name}</CardTitle></div></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4"><div className="p-4 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground mb-1">Comissão</p><p className="text-2xl font-bold text-primary">{fmt(currentResult.commission)}</p></div><div className="p-4 rounded-lg bg-primary/5 text-center"><p className="text-xs text-muted-foreground mb-1">Ganho Total</p><p className="text-2xl font-bold">{fmt(currentResult.totalEarnings)}</p></div></div>
                    <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground"><p className="font-medium text-foreground text-xs mb-1">Detalhamento:</p><p className="text-xs">{currentResult.details}</p></div>
                    <Separator />
                    <div><p className="text-xs font-semibold mb-2">Com Acelerador/Desacelerador:</p><div className="flex items-center gap-3"><Badge variant={calculation.achievementPct >= 100 ? 'default' : 'destructive'} className="gap-1">{calculation.achievementPct >= 100 ? <><ArrowUpRight className="w-3 h-3" />{quota.acceleratorRate}x</> : <><ArrowDownRight className="w-3 h-3" />{quota.deceleratorRate}x</>}</Badge><span className="text-sm">{fmt(calculation.baseCommission)} × {calculation.multiplier} = <strong>{fmt(calculation.adjustedCommission)}</strong></span></div></div>
                  </CardContent>
                </Card>
                <Card><CardHeader className="pb-3"><CardTitle className="text-base">Comparativo Rápido</CardTitle></CardHeader><CardContent><div className="space-y-2">{COMMISSION_MODELS.map(model => { const result = calculation.results[model.id]; if (!result) return null; const Icon = model.icon; return (<div key={model.id} className={cn('flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer', selectedModel === model.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30 hover:bg-muted/50')} onClick={() => setSelectedModel(model.id)}><div className="flex items-center gap-2"><Icon className={cn('w-4 h-4', model.color)} /><span className="text-xs font-medium">{model.name}</span></div><div className="text-right"><p className="text-xs font-bold">{fmt(result.totalEarnings)}</p><p className="text-[10px] text-muted-foreground">comissão: {fmt(result.commission)}</p></div></div>); })}</div></CardContent></Card>
              </>) : (<Card><CardContent className="p-12 text-center"><Calculator className="w-12 h-12 mx-auto mb-4 text-muted-foreground" /><h3 className="text-lg font-semibold mb-2">Selecione um modelo</h3></CardContent></Card>)}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="guide"><CommissionGuide /></TabsContent>

        <TabsContent value="glossary">
          <Card><CardHeader><CardTitle className="text-lg">Glossário de Comissionamento</CardTitle></CardHeader><CardContent className="space-y-0">{GLOSSARY_ITEMS.map((item, i) => (<div key={i} className={cn('py-4', i > 0 && 'border-t border-border')}><h3 className="font-semibold text-sm flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-primary" />{item.term}</h3><p className="text-sm text-muted-foreground pl-6">{item.definition}</p></div>))}</CardContent></Card>
          <Card className="mt-4"><CardHeader><CardTitle className="text-lg">Referência de Mercado</CardTitle></CardHeader><CardContent><div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><div><p className="text-sm font-semibold">Varejo e produtos simples</p></div><Badge variant="secondary" className="text-sm font-bold">2,5% – 5%</Badge></div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><div><p className="text-sm font-semibold">B2B e vendas consultivas</p></div><Badge variant="secondary" className="text-sm font-bold">5% – 8%</Badge></div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50"><div><p className="text-sm font-semibold">Enterprise e vendas complexas</p></div><Badge variant="secondary" className="text-sm font-bold">7% – 10%</Badge></div>
          </div></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
