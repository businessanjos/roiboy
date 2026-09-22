import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
import { AlertTriangle } from "lucide-react";
import type { HRCollaborator } from "@/hooks/useHRCollaborators";
import { useHRPdaOptions } from "@/hooks/useHRPdaOptions";
import {
  computeSynergyPct, formatMoney, optionColor, PDA_COLORS, synergyFromPct,
  tenureMonths, THERMOMETER_DEFAULT,
} from "@/lib/rh/pda";

type Slice = { name: string; value: number; color: string; raw: string | null };

function Donut({
  title, data, onSlice,
}: { title: string; data: Slice[]; onSlice?: (raw: string | null) => void }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
        ) : (
          <>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    onClick={(e: any) => onSlice?.(e?.payload?.raw ?? null)}
                  >
                    {data.map(d => (
                      <Cell key={d.name} fill={d.color} stroke="transparent" className={onSlice ? "cursor-pointer" : ""} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(v: any, n: any) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {data.map(d => (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => onSlice?.(d.raw)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name} · {d.value}
                </button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function PdaDashboardView({
  collaborators,
  canSeeSalary = false,
  onSlice,
}: {
  collaborators: HRCollaborator[];
  canSeeSalary?: boolean;
  onSlice?: (
    field: "sector" | "level" | "phase" | "thermo" | "hierarchy" | "dominant" | "quality" | "synergy",
    value: string,
  ) => void;
}) {
  const navigate = useNavigate();
  const { optionsFor } = useHRPdaOptions();

  const rows = collaborators;

  const byOption = (fieldKey: string, get: (c: HRCollaborator) => string | null | undefined): Slice[] => {
    const opts = optionsFor(fieldKey as any);
    const counts = new Map<string, number>();
    rows.forEach(c => {
      const v = get(c);
      if (!v) return;
      counts.set(v, (counts.get(v) || 0) + 1);
    });
    const ordered = [
      ...opts.filter(o => counts.has(o.value)).map(o => ({ name: o.label, value: counts.get(o.value)!, color: o.color, raw: o.value })),
      ...[...counts.keys()].filter(k => !opts.some(o => o.value === k))
        .map(k => ({ name: k, value: counts.get(k)!, color: optionColor(opts, k), raw: k })),
    ];
    return ordered;
  };

  const synergyRows = useMemo(
    () => rows.map(c => ({
      c,
      pct: computeSynergyPct(c.pda_role_profile, (c as any).pda_dominant_profile, (c as any).pda_secondary_profile),
    })),
    [rows],
  );

  const synergySlices: Slice[] = useMemo(() => {
    let yes = 0, no = 0;
    synergyRows.forEach(({ pct }) => {
      const s = synergyFromPct(pct);
      if (s === true) yes++;
      else if (s === false) no++;
    });
    return [
      { name: "SIM", value: yes, color: PDA_COLORS.verde, raw: "SIM" },
      { name: "NÃO", value: no, color: PDA_COLORS.vermelho, raw: "NAO" },
    ].filter(s => s.value > 0);
  }, [synergyRows]);

  const avgSynergy = useMemo(() => {
    const vals = synergyRows.map(r => r.pct).filter((n): n is number => n != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [synergyRows]);

  const avgTenure = useMemo(() => {
    const vals = rows.map(c => tenureMonths(c.hire_date, c.termination_date)).filter((n): n is number => n != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [rows]);

  const payroll = (match: string) =>
    rows.filter(c => (c.registration_company || "").toLowerCase().includes(match))
      .reduce((s, c) => s + (Number((c as any).salary_with_charges) || 0), 0);

  const alerts = useMemo(
    () => synergyRows
      .filter(({ c, pct }) => ((c as any).pda_thermometer || THERMOMETER_DEFAULT) === "Demissão" || synergyFromPct(pct) === false)
      .map(({ c, pct }) => ({
        c,
        reasons: [
          ((c as any).pda_thermometer || THERMOMETER_DEFAULT) === "Demissão" ? "Termômetro: Demissão" : null,
          synergyFromPct(pct) === false ? "Sinergia: NÃO" : null,
        ].filter(Boolean).join(" · "),
      })),
    [synergyRows],
  );

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Atenção ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {alerts.map(({ c, reasons }) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate((c as any).__route || `/rh/collaborators/${c.id}`)}
                className="rounded-md border bg-background px-2.5 py-1.5 text-xs hover:border-primary/50"
              >
                <span className="font-medium">{c.full_name}</span>
                <span className="text-muted-foreground"> — {reasons}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Donut title="Sinergia (perfil da vaga x perfil do Anjo)" data={synergySlices} onSlice={v => v && onSlice?.("synergy", v)} />
        <Donut title="Perfis Dominantes" data={byOption("pda_profile", c => (c as any).pda_dominant_profile)} onSlice={v => v && onSlice?.("dominant", v)} />
        <Donut title="Nível dos colaboradores" data={byOption("pda_level", c => c.pda_level)} onSlice={v => v && onSlice?.("level", v)} />
        <Donut title="QM - Qualidade da Mudança" data={byOption("pda_change_quality", c => (c as any).pda_change_quality)} onSlice={v => v && onSlice?.("quality", v)} />
        <Donut title="Fase do Anjo" data={byOption("pda_phase", c => (c as any).pda_phase)} onSlice={v => v && onSlice?.("phase", v)} />
        <Donut title="Hierarquia" data={byOption("pda_hierarchy", c => (c as any).pda_hierarchy)} onSlice={v => v && onSlice?.("hierarchy", v)} />

        <Stat
          title="% de Sinergia"
          value={avgSynergy == null ? "—" : `${avgSynergy.toFixed(1)}%`}
          hint="Média do % de sinergia dos colaboradores com perfil preenchido"
        />
        <Stat
          title="Tempo médio dos Anjos (em meses)"
          value={avgTenure == null ? "—" : avgTenure.toFixed(1)}
          hint="Média do tempo de casa"
        />
        {canSeeSalary && (
          <>
            <Stat title="Custo da folha Eternum Club" value={formatMoney(payroll("eternum"))} hint="Soma dos salários com encargos" />
            <Stat title="Custo da folha Anjos Business" value={formatMoney(payroll("anjos"))} hint="Soma dos salários com encargos" />
          </>
        )}
        <Donut
          title="Termômetro"
          data={byOption("pda_thermometer", c => (c as any).pda_thermometer || THERMOMETER_DEFAULT)}
          onSlice={v => v && onSlice?.("thermo", v)}
        />
      </div>
    </div>
  );
}
