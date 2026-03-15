import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2, Target, Percent, CalendarDays, FileText, Calculator,
  AlertTriangle, Gift, DollarSign, TrendingUp, Users, ShieldCheck,
  Lightbulb, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: string; title: string; icon: typeof Target; description: string; tips: string[]; examples?: string[];
}

const IMPLEMENTATION_STEPS: Step[] = [
  { id: 'step1', title: '1. Defina as Metas Base (Cotas)', icon: Target, description: 'Estabeleça as metas que servirão de referência para o comissionamento.', tips: ['Número de oportunidades geradas', 'Número de novos clientes conquistados', 'Valor total de vendas fechadas (R$)', 'Vendas na base existente (Cross-sell / Up-sell)', 'Ajuste a meta conforme o nível de senioridade do vendedor'], examples: ['Junior: R$ 30.000/mês | Pleno: R$ 50.000/mês | Sênior: R$ 80.000/mês'] },
  { id: 'step2', title: '2. Defina o Percentual de Comissão', icon: Percent, description: 'O equilíbrio é o ideal: percentual baixo demais não motiva; alto demais compromete a saúde financeira.', tips: ['Mercado: percentual médio entre 2,5% e 10%', 'Quanto maior o valor agregado, maior deve ser o percentual', 'Produtos padronizados permitem percentuais menores', 'Vendas consultivas justificam percentuais maiores'], examples: ['Varejo simples: 2,5%–5% | B2B consultivo: 5%–8% | Enterprise: 7%–10%'] },
  { id: 'step3', title: '3. Estabeleça Datas e Prazos', icon: CalendarDays, description: 'Determine os períodos de apuração das vendas e as datas de pagamento.', tips: ['Defina a data de corte mensal (ex: dia 25)', 'Estipule margem de 10 dias para acertar comissionamento', 'Determine quando o pagamento será feito', 'Alinhe com o time financeiro e contábil'] },
  { id: 'step4', title: '4. Defina Regras e Política de Estorno', icon: FileText, description: 'Preveja cenários como cancelamentos, devoluções e inadimplência.', tips: ['Quais produtos/serviços são comissionáveis?', 'O que acontece em caso de devolução?', 'Comissão é paga após faturamento ou recebimento?', 'Defina a política de chargebacks'] },
  { id: 'step5', title: '5. Calcule e Monitore', icon: Calculator, description: 'Implemente a fórmula e monitore resultados regularmente.', tips: ['Fórmula: Total das Vendas × Percentual = Comissão', 'Use um CRM para rastrear vendas', 'Monitore mensalmente se o plano está funcionando'], examples: ['R$ 60.000 × 6% = R$ 3.600 | R$ 100.000 × 8% = R$ 8.000'] },
];

const COMMISSION_VS_BONUS = {
  commission: { title: 'Comissão', icon: DollarSign, color: 'text-primary', bgColor: 'bg-primary/10', points: ['Ligada diretamente às ações de venda', 'Padronizada por time/cargo', 'Calculada sobre vendas individuais ou do time', 'Frequência: mensal'] },
  bonus: { title: 'Bonificação', icon: Gift, color: 'text-amber-500', bgColor: 'bg-amber-500/10', points: ['Premiação por atingimento de metas da empresa', 'Pode ser paga a todos os colaboradores', 'Geralmente é um % do salário anual', 'Frequência: trimestral, semestral ou anual'] },
};

const COMMISSION_TRIGGERS = [
  { title: 'Após pagamento do cliente', description: 'Comissão só é liberada após confirmação do recebimento.', icon: ShieldCheck },
  { title: 'Por fidelidade do cliente', description: 'Bônus por clientes que permanecem ativos por X meses.', icon: Users },
  { title: 'Percentual menor para vendas com desconto', description: 'Vendas com descontos acima de X% recebem comissão reduzida.', icon: AlertTriangle },
  { title: 'Prêmios por mix de produtos', description: 'Bônus para vendedores que vendem produtos de várias categorias.', icon: TrendingUp },
];

const NON_MONETARY_INCENTIVES = ['Viagens e experiências', 'Equipamentos', 'Troféus e reconhecimento', 'Cursos de capacitação', 'Campanhas internas com premiações', 'Dias de folga adicionais'];

export default function CommissionGuide() {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const toggleStep = (stepId: string) => setCompletedSteps(prev => prev.includes(stepId) ? prev.filter(s => s !== stepId) : [...prev, stepId]);
  const progress = (completedSteps.length / IMPLEMENTATION_STEPS.length) * 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-lg">Guia de Implementação</CardTitle><CardDescription>Passo a passo para criar um plano de comissionamento eficaz</CardDescription></div>
            <Badge variant={progress === 100 ? 'default' : 'secondary'} className="text-sm">{completedSteps.length}/{IMPLEMENTATION_STEPS.length} etapas</Badge>
          </div>
          <div className="mt-3 w-full bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {IMPLEMENTATION_STEPS.map(step => {
          const Icon = step.icon; const isCompleted = completedSteps.includes(step.id);
          return (
            <Card key={step.id} className={cn('transition-all', isCompleted && 'border-primary/30 bg-primary/[0.02]')}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="cursor-pointer mt-0.5" onClick={() => toggleStep(step.id)}>
                    {isCompleted ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />}
                  </div>
                  <div className="flex-1">
                    <CardTitle className={cn('text-base flex items-center gap-2', isCompleted && 'line-through text-muted-foreground')}><Icon className="w-4 h-4 text-primary" />{step.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">{step.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pl-12 space-y-3">
                <div><p className="text-xs font-semibold text-muted-foreground mb-2">PONTOS IMPORTANTES:</p>
                  <ul className="space-y-1.5">{step.tips.map((tip, i) => (<li key={i} className="text-xs text-muted-foreground flex items-start gap-2"><ArrowRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />{tip}</li>))}</ul>
                </div>
                {step.examples && <div className="p-3 bg-muted/50 rounded-lg"><p className="text-xs font-semibold mb-1">Exemplos:</p>{step.examples.map((ex, i) => <p key={i} className="text-xs text-muted-foreground">{ex}</p>)}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator />

      <Card>
        <CardHeader><CardTitle className="text-lg">Comissão vs Bonificação</CardTitle><CardDescription>Conceitos distintos que podem coexistir</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(COMMISSION_VS_BONUS).map(item => {
              const Icon = item.icon;
              return (<div key={item.title} className={cn('p-4 rounded-lg border', item.bgColor)}>
                <div className="flex items-center gap-2 mb-3"><Icon className={cn('w-5 h-5', item.color)} /><h3 className="font-semibold text-sm">{item.title}</h3></div>
                <ul className="space-y-2">{item.points.map((p, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />{p}</li>)}</ul>
              </div>);
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Gatilhos Alternativos de Comissão</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COMMISSION_TRIGGERS.map((t, i) => { const Icon = t.icon; return (<div key={i} className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"><div className="flex items-center gap-2 mb-1.5"><Icon className="w-4 h-4 text-primary" /><h4 className="text-sm font-semibold">{t.title}</h4></div><p className="text-xs text-muted-foreground">{t.description}</p></div>); })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" />Incentivos Não Monetários</CardTitle></CardHeader>
        <CardContent><div className="flex flex-wrap gap-2">{NON_MONETARY_INCENTIVES.map((inc, i) => <Badge key={i} variant="secondary" className="text-xs font-normal py-1.5">{inc}</Badge>)}</div></CardContent>
      </Card>
    </div>
  );
}
