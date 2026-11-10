import { CheckCircle2, AlertTriangle, Users, Megaphone, CalendarCheck, LogIn } from "lucide-react";
import { daysSince } from "@/lib/ryka/clinicUsage";

export interface RykaUsage {
  last_login_at: string | null; active_users_7d: number | null; active_users_30d: number | null;
  leads_30d: number | null; appointments_30d: number | null; consultations_30d: number | null;
  has_action_plan: boolean | null; action_plan_updated_at: string | null; modules_used: string[] | null; snapshot_date: string;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const MOD: Record<string, string> = { marketing: "Marketing", vendas: "Vendas", clinico: "Clínico", royzapp: "RoyZapp" };

/** Etapa 3.3 mostra o plano; 3.5 mostra os números do mês. Somente leitura, dados vindos da Ryka. */
export function RykaUsagePanel({ usage, mode }: { usage: RykaUsage | null | undefined; mode: "plan" | "monthly" }) {
  if (usage === undefined) return null;
  if (!usage) return (
    <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
      Ainda não há dados da Clínica Ryka desta cliente (acesso não liberado ou clínica não vinculada).
    </div>
  );
  const plan = usage.has_action_plan;
  const planCard = (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${plan ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40"}`}>
      {plan ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
      <div className="text-sm">
        <p className="font-semibold">{plan ? "Plano de ação ativo na Ryka" : "Ainda sem plano de ação na Ryka"}</p>
        <p className="text-muted-foreground">{plan ? `Atualizado em ${fmt(usage.action_plan_updated_at)}` : "Monte o plano a partir do modelo base abaixo."}</p>
      </div>
    </div>
  );
  if (mode === "plan") return <div className="mt-4">{planCard}</div>;
  const d = daysSince(usage.last_login_at);
  const stats = [
    { icon: LogIn, label: "Último acesso", value: usage.last_login_at ? (d === 0 ? "hoje" : `há ${d} ${d === 1 ? "dia" : "dias"}`) : "nunca" },
    { icon: Users, label: "Equipe ativa (7d / 30d)", value: `${usage.active_users_7d ?? 0} / ${usage.active_users_30d ?? 0}` },
    { icon: Megaphone, label: "Leads em 30 dias", value: String(usage.leads_30d ?? 0) },
    { icon: CalendarCheck, label: "Agendamentos / consultas", value: `${usage.appointments_30d ?? 0} / ${usage.consultations_30d ?? 0}` },
  ];
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Clínica na Ryka — últimos 30 dias</h3>
        <span className="text-xs text-muted-foreground">dados de {fmt(usage.snapshot_date)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/40 p-2.5">
            <s.icon className="h-4 w-4 text-primary" />
            <p className="mt-1 text-lg font-semibold leading-tight">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      {!!usage.modules_used?.length && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {usage.modules_used.map((m) => <span key={m} className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium">{MOD[m] ?? m}</span>)}
        </div>
      )}
      <div className="mt-3">{planCard}</div>
    </section>
  );
}
