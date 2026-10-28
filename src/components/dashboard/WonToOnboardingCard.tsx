import { Timer } from "lucide-react";
import { StatusMetricCard } from "@/components/dashboard/StatusMetricCard";
import { useWonToOnboardingTime } from "@/hooks/useWonToOnboardingTime";

interface Props {
  accountId?: string;
  monthsBack?: number;
  /** Restringe o cálculo a estes clientes (filtro de formação do dashboard). */
  clientIds?: string[] | null;
}

export function WonToOnboardingCard({ accountId, monthsBack = 6, clientIds }: Props) {
  const { data, isLoading } = useWonToOnboardingTime(accountId, monthsBack, clientIds);

  const avg = data?.avg_days;
  const display = isLoading ? "..." : avg != null ? `${avg.toFixed(1)}d` : "—";
  const sample = data?.sample_count ?? 0;
  const days = (value?: number | null) =>
    value != null ? `${value.toFixed(1).replace(".", ",")} dias` : "—";

  return (
    <StatusMetricCard
      label="Ganho → Onboarding"
      value={display}
      icon={Timer}
      accentClass="border-l-indigo-500"
      valueClass="text-indigo-600"
      iconClass="text-indigo-500"
      details={{
        title: "Tempo entre a venda e o início do onboarding",
        lines: [
          `Conta quantos dias se passam desde o dia em que o negócio foi marcado como ganho até o dia em que o onboarding do cliente começou.`,
        ],
        rows: data
          ? [
              { label: "Metade dos clientes começa em até", value: days(data.median_days) },
              { label: "Mais rápido", value: days(data.min_days) },
              { label: "Mais demorado", value: days(data.max_days) },
              { label: "Clientes considerados", value: sample },
            ]
          : undefined,
        footer: `${sample} cliente${sample === 1 ? "" : "s"} · últimos ${monthsBack} meses`,
      }}
    />
  );
}
