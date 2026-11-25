import { filterVisiblePeople, visiblePeopleQuery } from "@/lib/peopleVisibility";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, CheckCircle2, Target } from "lucide-react";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { FormatType, FONT_SCALE_MULTIPLIERS, AppearanceConfig } from "../visual-builder/types";
import { useTvMode } from "../TvModeContext";
import "./ConfigurableCallCommercial.css";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  salesMonth?: number;
}

interface ConfigurableCallCommercialProps {
  data: AggregatedDataPoint[];
  formatting: {
    type: FormatType;
    decimals: number;
  };
  hiddenUsers?: string[];
  appearance?: AppearanceConfig;
}

interface UserAvatar {
  name: string;
  avatar_url: string | null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ConfigurableCallCommercial({ data, hiddenUsers, appearance }: ConfigurableCallCommercialProps) {
  const tv = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[appearance?.fontScale || 'normal'];
  const { currentUser } = useCurrentUser();
  const { filters } = useInsightsFilters();
  // Vendas/conversão são do mês: no filtro de Ano o card fica oculto.
  const showSales = filters.preset !== 'year';
  const [avatars, setAvatars] = useState<Record<string, UserAvatar>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    // Layout pixels, not transformed screen pixels: zoom must not amplify density decisions.
    const update = () => setSize(previous => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      return previous.width === width && previous.height === height ? previous : { width, height };
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Fetch user avatars
  useEffect(() => {
    if (!currentUser?.account_id || data.length === 0) return;

    const fetchAvatars = async () => {
      const names = data.map(d => d.name);
      const { data: users } = await visiblePeopleQuery(supabase
        .from('users')
        .select('name, avatar_url'))
        .eq('account_id', currentUser.account_id)
        .in('name', names);

      if (users) {
        const map: Record<string, UserAvatar> = {};
        for (const user of users) {
          map[user.name] = user;
        }
        setAvatars(map);
      }
    };

    fetchAvatars();
  }, [currentUser?.account_id, data]);

  const filteredData = filterVisiblePeople(hiddenUsers?.length
    ? data.filter(d => !hiddenUsers.includes(d.name))
    : data);

  if (!filteredData || filteredData.length === 0) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  // Both normal and TV layouts keep the same separated metric blocks.
  // Width only selects columns; font sizes respond to row height and the chosen font setting.
  const columns = size.width >= (tv.tv ? 260 : 360) && filteredData.length > 1 ? 2 : 1;
  const rows = Math.ceil(filteredData.length / columns);
  const rowSpace = size.height > 0 ? (size.height - 4 - (rows - 1) * 12) / rows : 114;
  const dense = rowSpace < 114;
  const scale = Math.min(m * (tv.tv ? tv.scale : 1), dense ? 1 : 1.15);
  const dimensions = {
    "--calls-columns": columns,
    "--calls-name-size": `${Math.round(Math.min(18, Math.max(14, (dense ? 14 : 16) * scale)))}px`,
    "--calls-value-size": `${Math.round(Math.min(30, Math.max(22, (dense ? 24 : 26) * scale)))}px`,
    "--calls-avatar-size": `${dense ? 28 : 32}px`,
    "--calls-block-height": `${dense ? 60 : 72}px`,
  } as CSSProperties;
  return (
    <div ref={containerRef} className="commercial-calls" style={dimensions} role="group" aria-label="Calls por vendedor">
      <div className="commercial-calls-sellers">
        {filteredData.map((item) => {
          const userAvatar = avatars[item.name];
          const scheduled = item.value; // agendadas em aberto
          const completed = item.count ?? 0; // concluídas
          const sales = item.salesMonth ?? 0; // vendas ganhas no mês atual
          const conversion = completed > 0 ? (sales / completed) * 100 : 0;

          return (
            <section key={item.name} className="commercial-calls-seller" aria-label={item.name}>
              <div className="commercial-calls-identity flex min-w-0 items-center gap-2">
                <Avatar className="commercial-calls-avatar shrink-0 border border-border">
                  <AvatarImage src={userAvatar?.avatar_url || undefined} alt={item.name} />
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{getInitials(item.name)}</AvatarFallback>
                </Avatar>
                <span className="commercial-calls-name font-semibold text-foreground">{item.name}</span>
              </div>
              <div className="commercial-calls-metrics" data-sales={showSales}>
                {[
                  { label: 'A fazer', value: scheduled, Icon: Calendar, accent: 'text-warning', salesMetric: false, accessible: `${scheduled} calls a fazer` },
                  { label: 'Feitas', value: completed, Icon: CheckCircle2, accent: 'text-success', salesMetric: false, accessible: `${completed} calls feitas` },
                  ...(showSales ? [{ label: 'Vendas', value: sales, Icon: Target, accent: 'text-primary', salesMetric: true, accessible: `${sales} vendas` }] : []),
                ].map(({ label, value, Icon, accent, salesMetric, accessible }) => (
                  <div key={label}
                    className={`commercial-calls-block rounded-md border ${salesMetric ? 'border-primary/30 bg-primary/10' : 'border-border bg-muted/60'}`}
                    aria-label={accessible}
                    title={salesMetric ? `${sales} venda(s) ganha(s) neste mês • ${conversion.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das calls feitas` : undefined}
                  >
                    <span className={`commercial-calls-number font-bold tabular-nums ${salesMetric ? 'text-primary' : 'text-foreground'}`}>{value.toLocaleString('pt-BR')}</span>
                    <span className="commercial-calls-label flex items-center justify-center gap-1 font-medium text-muted-foreground"><Icon className={`h-3 w-3 shrink-0 ${accent}`} />{label}</span>
                    {salesMetric && <span className="commercial-calls-conversion font-semibold tabular-nums text-primary">{conversion.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
