import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wifi } from "lucide-react";
import { useTvConnHistory } from "@/hooks/useTvWall";
import { CONN_LABEL, dropsToday, tvConn } from "@/lib/tv/tvConn";
import { cn } from "@/lib/utils";
import { SignalBars, hhmm } from "./TvConnRelease";

const SEAL: Record<string, string> = {
  boa: "border-success/40 bg-success/10", instavel: "border-warning/40 bg-warning/10",
  ruim: "border-destructive/40 bg-destructive/10", offline: "border-border bg-muted",
};

export function ConnectionTab({ slot, status }: { slot: number; status?: any }) {
  const c = tvConn(status);
  const { data: hist = [], isLoading } = useTvConnHistory(slot);
  const drops = dropsToday(hist);
  const chart = hist.map((h) => ({ t: hhmm(h.created_at), latencia: h.latency_ms, perda: h.packet_loss_pct }));
  const stat = (label: string, v: string) => (
    <div className="rounded-md border p-2.5 text-center"><p className="text-lg font-semibold">{v}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
  );

  return (
    <div className="space-y-4">
      <div className={cn("flex items-center gap-3 rounded-lg border p-3", c ? SEAL[c] : "bg-muted")}>
        <SignalBars status={status} size="lg" />
        <div>
          <p className="font-semibold">{c ? CONN_LABEL[c] : "Ainda não medida"}</p>
          <p className="text-xs text-muted-foreground">Média dos últimos 10 min</p>
        </div>
      </div>
      {(c === "instavel" || c === "ruim") && (
        <p className="flex gap-2 rounded-md border px-3 py-2 text-xs"><Wifi className="h-4 w-4 shrink-0" />Wi-Fi fraco onde a TV está. Cabo de rede ou um repetidor resolvem.</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {stat("tempo de resposta", status?.latency_ms != null ? `${status.latency_ms} ms` : "—")}
        {stat("perda", status?.packet_loss_pct != null ? `${status.packet_loss_pct}%` : "—")}
        {stat("quedas hoje", status?.drops_today != null ? String(status.drops_today) : "—")}
      </div>

      <section className="space-y-1.5">
        <p className="text-xs font-medium">Últimas 24 h</p>
        {isLoading ? <div className="h-44 rounded-md bg-muted animate-pulse" />
          : chart.length < 2 ? <p className="text-xs text-muted-foreground py-6 text-center">Ainda sem dados suficientes.</p>
          : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} minTickGap={30} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="p" orientation="right" domain={[0, 100]} hide />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="l" type="monotone" dataKey="latencia" name="Latência (ms)" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} connectNulls />
                  <Line yAxisId="p" type="monotone" dataKey="perda" name="Perda (%)" stroke="hsl(var(--destructive))" dot={false} strokeWidth={1.5} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
      </section>

      <section className="space-y-1.5">
        <p className="text-xs font-medium">Quedas de hoje</p>
        {drops.length ? (
          <ul className="divide-y text-xs">{drops.map((d) => <li key={d} className="py-1.5">Caiu da rede às {hhmm(d)}</li>)}</ul>
        ) : <p className="text-xs text-muted-foreground">Nenhuma queda registrada hoje.</p>}
      </section>
    </div>
  );
}
