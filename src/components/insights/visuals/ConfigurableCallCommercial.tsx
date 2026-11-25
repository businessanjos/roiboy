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
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    // Layout pixels, not transformed screen pixels: zoom must not amplify density decisions.
    const update = () => setHeight(element.clientHeight);
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

  const rowSpace = height > 0 ? (height - 26) / filteredData.length : 70;
  const dense = rowSpace < 70;
  const scale = Math.min(m * (tv.tv ? tv.scale : 1), dense ? 1 : 1.2);
  const dimensions = {
    "--calls-name-size": `${Math.round(Math.min(tv.tv ? 20 : 18, Math.max(14, (dense ? 16 : 18) * scale)))}px`,
    "--calls-value-size": `${Math.round(Math.min(tv.tv ? 30 : 28, Math.max(20, (dense ? 24 : 26) * scale)))}px`,
    "--calls-avatar-size": `${dense ? 30 : 34}px`,
    "--calls-row-height": `${Math.max(56, Math.min(78, rowSpace))}px`,
  } as CSSProperties;
  return (
    <div ref={containerRef} className="commercial-calls" style={dimensions} role="table" aria-label="Calls por vendedor">
      <div role="row" className="commercial-calls-grid commercial-calls-head border-b border-border/70 text-xs font-medium text-muted-foreground" data-sales={showSales}>
        <span role="columnheader">Vendedor</span>
        <span role="columnheader" className="flex items-center justify-center gap-1 whitespace-nowrap"><Calendar className="h-3 w-3" />A fazer</span>
        <span role="columnheader" className="flex items-center justify-center gap-1 whitespace-nowrap"><CheckCircle2 className="h-3 w-3" />Feitas</span>
        {showSales && <span role="columnheader" className="flex items-center justify-center gap-1 whitespace-nowrap"><Target className="h-3 w-3" />Vendas</span>}
      </div>
      <div role="rowgroup" className="divide-y divide-border/60">
        {filteredData.map((item) => {
          const userAvatar = avatars[item.name];
          const scheduled = item.value; // agendadas em aberto
          const completed = item.count ?? 0; // concluídas
          const sales = item.salesMonth ?? 0; // vendas ganhas no mês atual
          const conversion = completed > 0 ? (sales / completed) * 100 : 0;

          return (
            <div role="row"
              key={item.name}
              className="commercial-calls-grid commercial-calls-row"
              data-sales={showSales}
            >
              <div role="cell" className="flex min-w-0 items-center gap-2">
                <Avatar className="commercial-calls-avatar shrink-0 border border-border">
                  <AvatarImage src={userAvatar?.avatar_url || undefined} alt={item.name} />
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{getInitials(item.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <span className="commercial-calls-name block font-semibold text-foreground">{item.name}</span>
                  {showSales && <span className="block text-xs leading-tight text-muted-foreground" title={`${sales} venda(s) ganha(s) neste mês • ${conversion.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das calls feitas`}><span className="font-semibold tabular-nums text-primary">{conversion.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span> conversão</span>}
                </div>
              </div>
              <span role="cell" aria-label={`${scheduled} calls a fazer`} className="commercial-calls-number text-center font-semibold tabular-nums text-foreground">{scheduled.toLocaleString('pt-BR')}</span>
              <span role="cell" aria-label={`${completed} calls feitas`} className="commercial-calls-number text-center font-semibold tabular-nums text-foreground">{completed.toLocaleString('pt-BR')}</span>
              {showSales && <span role="cell" aria-label={`${sales} vendas`} className="commercial-calls-number text-center font-bold tabular-nums text-primary">{sales.toLocaleString('pt-BR')}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
