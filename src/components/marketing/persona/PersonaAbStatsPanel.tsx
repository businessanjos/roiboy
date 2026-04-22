import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp, FlaskConical, ThumbsUp, ThumbsDown, Trophy, Sigma, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import { usePersonaAbStats } from "@/hooks/usePersonaAbStats";
import { twoProportionZTest, formatP, formatPct } from "@/lib/stats/proportionTest";

export function PersonaAbStatsPanel() {
  const [open, setOpen] = useState(false);
  const { data: stats, isLoading } = usePersonaAbStats(30);

  if (isLoading || !stats || stats.total === 0) return null;

  // Teste estatístico (z-test de duas proporções) sobre taxa de escolha A vs B
  const test = twoProportionZTest(stats.chosenA, stats.decided, stats.chosenB, stats.decided);
  const winner = test.winner ?? (stats.acceptRateA > stats.acceptRateB ? "A" : stats.acceptRateB > stats.acceptRateA ? "B" : null);

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-background">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle className="text-lg">A/B Test: prompts COM vs SEM Destaques</CardTitle>
              <CardDescription className="mt-0.5">
                {stats.total} testes nos últimos 30 dias · {stats.decided} decididos
                {winner && (
                  <> · Vencedor: <Badge className="ml-1" variant={test.significant ? "default" : "secondary"}>
                    Variante {winner}{test.significant ? " ✓" : " (provisório)"}
                  </Badge></>
                )}
                {test.minSampleReached && (
                  <> · p = <span className="font-semibold tabular-nums">{formatP(test.pValue)}</span></>
                )}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 pt-0">
          <StatTestBlock test={test} />
          <div className="grid md:grid-cols-2 gap-4">
            <VariantCard
              label="Variante A — Com DESTAQUES"
              accent="pink"
              chosen={stats.chosenA}
              decided={stats.decided}
              acceptRate={stats.acceptRateA}
              thumbsUp={stats.thumbsUpA}
              thumbsDown={stats.thumbsDownA}
              thumbsUpRate={stats.thumbsUpRateA}
              savedWithoutEdit={stats.savedWithoutEditA}
              isWinner={winner === "A"}
            />
            <VariantCard
              label="Variante B — Sem DESTAQUES (controle)"
              accent="slate"
              chosen={stats.chosenB}
              decided={stats.decided}
              acceptRate={stats.acceptRateB}
              thumbsUp={stats.thumbsUpB}
              thumbsDown={stats.thumbsDownB}
              thumbsUpRate={stats.thumbsUpRateB}
              savedWithoutEdit={stats.savedWithoutEditB}
              isWinner={winner === "B"}
            />
          </div>

          {Object.keys(stats.byField).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Por campo (escolhas A / B / total)
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {Object.entries(stats.byField).sort((a, b) => b[1].total - a[1].total).map(([field, v]) => (
                  <div key={field} className="text-xs flex items-center justify-between border rounded px-2 py-1 bg-muted/30">
                    <span className="font-medium truncate mr-2">{field}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      <span className="text-pink-500 font-semibold">{v.a}</span>
                      {" / "}
                      <span className="font-semibold">{v.b}</span>
                      {" / "}
                      {v.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.decided < 10 && (
            <p className="text-xs text-muted-foreground italic">
              ⚠️ Ainda há poucos dados ({stats.decided} decisões). Recomendado pelo menos 30 testes para conclusão estatística.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function VariantCard({
  label, accent, chosen, decided, acceptRate, thumbsUp, thumbsDown, thumbsUpRate, savedWithoutEdit, isWinner,
}: {
  label: string;
  accent: "pink" | "slate";
  chosen: number;
  decided: number;
  acceptRate: number;
  thumbsUp: number;
  thumbsDown: number;
  thumbsUpRate: number;
  savedWithoutEdit: number;
  isWinner: boolean;
}) {
  const accentClass = accent === "pink" ? "border-pink-500/30 bg-pink-500/5" : "border-border bg-muted/20";
  const barClass = accent === "pink" ? "[&>div]:bg-pink-500" : "";
  return (
    <div className={`rounded-lg border ${accentClass} p-3 space-y-2.5`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        {isWinner && <Trophy className="h-4 w-4 text-amber-500" />}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Taxa de escolha</span>
          <span className="font-semibold tabular-nums">{acceptRate}% ({chosen}/{decided})</span>
        </div>
        <Progress value={acceptRate} className={`h-1.5 ${barClass}`} />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-600">
            <ThumbsUp className="h-3 w-3" /> {thumbsUp}
          </span>
          <span className="flex items-center gap-1 text-rose-600">
            <ThumbsDown className="h-3 w-3" /> {thumbsDown}
          </span>
          <span className="text-muted-foreground tabular-nums">({thumbsUpRate}% 👍)</span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Salvos sem edição: <span className="font-semibold text-foreground tabular-nums">{savedWithoutEdit}</span>
      </div>
    </div>
  );
}

function StatTestBlock({ test }: { test: ReturnType<typeof twoProportionZTest> }) {
  const { significant, significanceLabel, minSampleReached, pValue, z, diff, ciLow, ciHigh, pA, pB, winner, message } = test;

  // Visual: cor / ícone conforme resultado
  const variantStyles = !minSampleReached
    ? { border: "border-muted-foreground/30", bg: "bg-muted/30", icon: <MinusCircle className="h-5 w-5 text-muted-foreground" />, label: "Amostra insuficiente" }
    : significant
      ? { border: "border-emerald-500/40", bg: "bg-emerald-500/5", icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />, label: `Diferença ${significanceLabel}` }
      : significanceLabel === "tendência"
        ? { border: "border-amber-500/40", bg: "bg-amber-500/5", icon: <AlertCircle className="h-5 w-5 text-amber-600" />, label: "Tendência (não conclusivo)" }
        : { border: "border-border", bg: "bg-muted/20", icon: <MinusCircle className="h-5 w-5 text-muted-foreground" />, label: "Sem diferença significativa" };

  const diffPct = (diff * 100).toFixed(1);
  const diffSign = diff > 0 ? "+" : "";

  return (
    <div className={`rounded-lg border ${variantStyles.border} ${variantStyles.bg} p-3 space-y-2`}>
      <div className="flex items-start gap-2">
        {variantStyles.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sigma className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold">Teste estatístico (z-test de duas proporções)</span>
            <Badge variant={significant ? "default" : "secondary"} className="text-xs">{variantStyles.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </div>
      </div>

      {minSampleReached && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1.5 border-t border-border/40">
          <Stat label="Taxa A" value={formatPct(pA)} />
          <Stat label="Taxa B" value={formatPct(pB)} />
          <Stat
            label="Diferença (A−B)"
            value={`${diffSign}${diffPct} pp`}
            valueClass={significant ? (winner === "A" ? "text-emerald-600" : "text-rose-600") : ""}
          />
          <Stat label="p-value" value={formatP(pValue)} />
          <Stat label="z-score" value={z.toFixed(2)} />
          <Stat
            label="IC 95% da diferença"
            value={`[${(ciLow * 100).toFixed(1)}; ${(ciHigh * 100).toFixed(1)}] pp`}
            wide
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueClass = "", wide = false }: { label: string; value: string; valueClass?: string; wide?: boolean }) {
  return (
    <div className={`text-xs ${wide ? "col-span-2" : ""}`}>
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
