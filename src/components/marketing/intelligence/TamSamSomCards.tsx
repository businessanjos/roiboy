import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Sparkles, Globe2, Target, Crosshair, ChevronRight } from "lucide-react";
import { extractHeadline } from "./marketBenchmarks";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Row = { id: string; query: string; answer: string; created_at: string };

const EXCLUSAO =
  "IMPORTANTE: considere APENAS profissionais e clínicas de ESTÉTICA AVANÇADA/MÉDICA (procedimentos estéticos, injetáveis, laser, tecnologias, harmonização facial/corporal, dermato, HOF). EXCLUA salões de beleza, barbearias, cabeleireiros, manicure/pedicure, depilação simples, estética capilar, SPAs de relaxamento e centros de bem-estar sem procedimentos estéticos.";

const PORTFOLIO =
  "Portfolio Eternum: produtos vão de R$ 997 (entrada — cursos/eventos/comunidades) até R$ 500.000 (mentoria high-ticket / Conselho). Ou seja: qualquer profissional de estética avançada/médica com capacidade de pagar a partir de R$ 997/ano faz parte do TAM — não filtre só por high-ticket.";

type Tier = {
  key: "tam" | "sam" | "som";
  label: string;
  short: string;
  icon: typeof Globe2;
  gradient: string;
  ring: string;
  text: string;
  bg: string;
  query: string;
  helper: string;
};

const tiers: Tier[] = [
  {
    key: "tam",
    label: "TAM — Mercado total endereçável",
    short: "TAM",
    icon: Globe2,
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    ring: "ring-purple-500/20",
    text: "text-purple-600",
    bg: "bg-purple-500/10",
    helper: "Universo TOTAL de profissionais da estética avançada no Brasil, sem nenhum filtro além de estarem no setor.",
    query: `Calcule o TAM (Total Addressable Market) do universo de ESTÉTICA AVANÇADA/MÉDICA no Brasil considerando TODOS os profissionais e clínicas do setor, sem filtro por ticket ou faturamento.

${EXCLUSAO}

${PORTFOLIO}

Traga:
1. **Número total** de profissionais + clínicas do setor no Brasil (soma consolidada, com fonte).
2. **Faturamento anual estimado do setor** (R$ bilhões, com CAGR dos últimos 3 anos).
3. **Composição**: quantos são médicos (dermato + outras especialidades que fazem estética), quantos dentistas com HOF, quantos biomédicos estetas, quantos esteticistas com formação avançada, quantas clínicas PJ.
4. **TAM em R$** = faturamento potencial se 100% do universo consumisse produtos de educação/mentoria/comunidade de R$ 997 a R$ 500k/ano (estime uma média ponderada realista).

Cite fontes oficiais (SBD, CFM, CFO, CFBM, ABIHPEC, Sebrae, IBGE, Euromonitor, ABEDV).`,
  },
  {
    key: "sam",
    label: "SAM — Mercado que Eternum atende",
    short: "SAM",
    icon: Target,
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    ring: "ring-blue-500/20",
    text: "text-blue-600",
    bg: "bg-blue-500/10",
    helper: "Fatia do TAM que efetivamente entra no perfil dos produtos Eternum (do R$ 997 ao R$ 500k).",
    query: `Calcule o SAM (Serviceable Addressable Market) para a Eternum Mentoring Club no Brasil.

${EXCLUSAO}

${PORTFOLIO}

Perfil Eternum: profissional de estética avançada JÁ EM OPERAÇÃO (não iniciante puro), buscando escalar clínica/autoridade/faturamento — pode ser desde o profissional que quer comprar um curso/comunidade de R$ 997 até o dono de clínica madura que investe R$ 40k–500k em mentoria high-ticket.

Traga:
1. **Número de profissionais + clínicas** que se encaixam nesse perfil (excluir estudantes, aposentados, quem faturou menos que o suficiente para investir R$ 997/ano em educação).
2. **Segmentação por capacidade de investimento anual em educação/mentoria**:
   - Faixa R$ 997 – R$ 5.000/ano (entrada)
   - Faixa R$ 5.000 – R$ 40.000/ano (intermediário)
   - Faixa R$ 40.000 – R$ 200.000/ano (mentoria premium)
   - Faixa R$ 200.000 – R$ 500.000/ano (Conselho / high-ticket)
3. **SAM em R$** = soma do potencial anual dessas faixas.
4. Fontes (Sebrae — perfil do empreendedor de estética, associações do setor, pesquisas de mercado brasileiro de educação executiva).`,
  },
  {
    key: "som",
    label: "SOM — Mercado capturável em 12 meses",
    short: "SOM",
    icon: Crosshair,
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    ring: "ring-emerald-500/20",
    text: "text-emerald-600",
    bg: "bg-emerald-500/10",
    helper: "Recorte realista que a Eternum consegue converter nos próximos 12 meses com a operação atual.",
    query: `Calcule o SOM (Serviceable Obtainable Market) da Eternum Mentoring Club para os PRÓXIMOS 12 MESES no Brasil.

${EXCLUSAO}

${PORTFOLIO}

Considere benchmarks de conversão realistas para negócios de educação/mentoria B2P (business-to-professional) no Brasil:
- Penetração típica de líderes de nicho em mercados fragmentados: 0,5% a 3% do SAM em 12 meses.
- Ciclo de venda de high-ticket (>R$ 40k) exige alta autoridade e tráfego qualificado — normalmente <0,3% do SAM/ano.
- Produtos de entrada (R$ 997 – R$ 5k) escalam mais rápido — 1% a 5% do SAM/ano é plausível para marca consolidada.

Traga:
1. **Número de clientes capturáveis em 12 meses**, quebrado por faixa de ticket (entrada / intermediário / premium / Conselho).
2. **Receita capturável em 12 meses (R$)** — soma das faixas.
3. **Premissas explícitas** usadas (% de conversão sobre SAM por faixa, CAC assumido, comparativos com players como Fernando Kimura, Mentoria Kaizen, iCEV, Faculdade Inspirar, Instituto BWS).
4. **Comparativo com o faturamento atual estimado da Eternum** — o SOM é X vezes a operação atual? Onde estão os pontos cegos (faixas subexploradas, canais não abertos)?`,
  },
];

interface Props {
  onOpenDetail?: (query: string) => void;
}

export function TamSamSomCards({ onOpenDetail }: Props) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mi-tsm-cards", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_market_research")
        .select("id, query, answer, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: !!currentUser?.account_id,
  });

  const latestByQuery = useMemo(() => {
    const map = new Map<string, Row>();
    (data ?? []).forEach((r) => {
      if (!map.has(r.query)) map.set(r.query, r);
    });
    return map;
  }, [data]);

  async function runOne(tier: Tier) {
    setRunning(tier.key);
    try {
      const { data, error } = await supabase.functions.invoke("mi-market-research", {
        body: { query: tier.query, focus: "tam", recency: "year", model: "sonar-pro" },
      });
      if (error) throw new Error(await extractEdgeFunctionError(error, "Falha na pesquisa"));
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`✓ ${tier.short} atualizado`);
      qc.invalidateQueries({ queryKey: ["mi-tsm-cards", currentUser?.account_id] });
      qc.invalidateQueries({ queryKey: ["mi-market-research", currentUser?.account_id] });
    } catch (e: any) {
      toast.error(`${tier.short}: ${e?.message || "erro"}`);
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    for (const t of tiers) {
      if (latestByQuery.has(t.query)) continue;
      await runOne(t);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" /> TAM · SAM · SOM
          </h2>
          <p className="text-xs text-muted-foreground">
            Mercado total, mercado atendível e mercado capturável em 12 meses — considerando todo o portfolio (R$ 997 a R$ 500k).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={runAll} disabled={!!running}>
          {running ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
          Preencher faltantes
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const latest = latestByQuery.get(tier.query);
          const { value, snippet } = extractHeadline(latest?.answer);
          const isRunning = running === tier.key;

          return (
            <Card
              key={tier.key}
              className={`relative overflow-hidden ring-1 ${tier.ring} bg-gradient-to-br ${tier.gradient} hover:shadow-lg transition-shadow`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${tier.bg}`}>
                      <Icon className={`h-5 w-5 ${tier.text}`} />
                    </div>
                    <div>
                      <p className={`text-[11px] font-bold tracking-widest uppercase ${tier.text}`}>{tier.short}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">{tier.label.replace(`${tier.short} — `, "")}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => runOne(tier)}
                    disabled={isRunning || !!running}
                    title={latest ? "Atualizar" : "Calcular"}
                  >
                    {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                <div className="min-h-[3rem]">
                  {isLoading ? (
                    <div className="h-8 w-32 rounded bg-muted animate-pulse" />
                  ) : value ? (
                    <p className={`text-3xl font-bold tabular-nums leading-tight ${tier.text}`}>{value}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Sem cálculo ainda</p>
                  )}
                </div>

                {snippet ? (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3 leading-relaxed">{snippet}</p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3 leading-relaxed">{tier.helper}</p>
                )}

                <div className="mt-3 flex items-center justify-between gap-2">
                  {latest ? (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true, locale: ptBR })}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Nunca calculado</span>
                  )}
                  {latest && onOpenDetail && (
                    <button
                      type="button"
                      onClick={() => onOpenDetail(tier.query)}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Ver memória de cálculo <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
