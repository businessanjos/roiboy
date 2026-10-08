import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Cake, CalendarClock } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { buildCxOverview } from "@/lib/cxQueueOverview";

export default function CxQueueDashboard({ overview }: { overview: ReturnType<typeof buildCxOverview> }) {
  return (
    <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_240px]" aria-label="Previsão de aniversários">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-4">
          <Cake className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Parabéns por dia</h3>
          <span className="ml-auto text-xs text-muted-foreground">{overview.birthdays} no período</span>
        </div>
        <ChartContainer className="h-[200px] w-full aspect-auto" config={{ birthdays: { label: "Parabéns previstos", color: "hsl(var(--primary))" } }}>
          <BarChart data={overview.days} accessibilityLayer margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={10} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel} />} />
            <Bar dataKey="birthdays" fill="var(--color-birthdays)" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
        <p className="mt-2 text-xs text-muted-foreground">Horário de Brasília · Pendentes sem agendamento usam a próxima data de aniversário como previsão.</p>
      </div>
      <div className="lg:border-l lg:border-border lg:pl-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3"><CalendarClock className="h-4 w-4 text-primary" />Dias com mais parabéns</h3>
        {overview.peakDays.length ? <ol className="divide-y divide-border">
          {overview.peakDays.map((day, index) => (
            <li key={day.key} className="flex items-center gap-3 py-3">
              <span className="text-xs text-muted-foreground tabular-nums">0{index + 1}</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{day.label}</p><p className="text-xs text-muted-foreground capitalize">{day.fullLabel.split(",")[0]}</p></div>
              <span className="text-lg font-semibold text-primary tabular-nums">{day.birthdays}</span>
            </li>
          ))}
        </ol> : <p className="text-sm text-muted-foreground py-3">Nenhum parabéns previsto neste período.</p>}
        {(overview.overdue > 0 || overview.undated > 0) && <div className="border-t border-border mt-3 pt-3 space-y-1 text-xs text-muted-foreground">
          {overview.overdue > 0 && <p>{overview.overdue} agendamento(s) vencido(s)</p>}
          {overview.undated > 0 && <p>{overview.undated} momento(s) sem data prevista</p>}
        </div>}
      </div>
    </section>
  );
}