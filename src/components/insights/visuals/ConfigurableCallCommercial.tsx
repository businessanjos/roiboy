import { filterVisiblePeople, visiblePeopleQuery } from "@/lib/peopleVisibility";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, CheckCircle2, Target } from "lucide-react";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { FormatType, FONT_SCALE_MULTIPLIERS, AppearanceConfig } from "../visual-builder/types";
import { useTvMode } from "../TvModeContext";

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
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  if (tv.tv) {
    return (
      <div className="h-full min-h-0 overflow-auto">
        <div className="grid grid-cols-2 gap-4">
          {filteredData.map(item => {
            const completed = item.count ?? 0;
            const sales = item.salesMonth ?? 0;
            const conversion = completed > 0 ? (sales / completed) * 100 : 0;
            return (
              <section key={item.name} className="min-w-0">
                <div className="mb-3 flex min-w-0 items-center gap-2.5">
                  <Avatar className="h-10 w-10 shrink-0 border border-border">
                    <AvatarImage src={avatars[item.name]?.avatar_url || undefined} alt={item.name} />
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{getInitials(item.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 break-words text-lg font-semibold leading-tight text-foreground" style={{ fontSize: Math.round(18 * m) }}>{item.name}</span>
                </div>
                <div className={`grid gap-2 ${showSales ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {[
                    { label: 'A fazer', value: item.value, Icon: Calendar, accent: 'text-warning' },
                    { label: 'Feitas', value: completed, Icon: CheckCircle2, accent: 'text-success' },
                    ...(showSales ? [{ label: 'Vendas', value: sales, Icon: Target, accent: 'text-primary' }] : []),
                  ].map(({ label, value, Icon, accent }) => (
                    <div key={label} className={`relative flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 ${label === 'Vendas' ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted'}`}>
                      <span className="font-bold leading-none tabular-nums text-foreground" style={{ fontSize: Math.round(28 * m) }}>{value}</span>
                      <span className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground"><Icon className={`h-3 w-3 ${accent}`} />{label}</span>
                      {label === 'Vendas' && <span className="absolute -top-2 right-1 rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold leading-none tabular-nums text-primary-foreground">{conversion.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</span>}
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

  return (
    <div className="h-full overflow-auto px-2 py-3">
      <div className="flex flex-wrap gap-4 justify-center">
        {filteredData.map((item) => {
          const userAvatar = avatars[item.name];
          const scheduled = item.value; // agendadas em aberto
          const completed = item.count ?? 0; // concluídas
          const sales = item.salesMonth ?? 0; // vendas ganhas no mês atual
          const conversion = completed > 0 ? (sales / completed) * 100 : 0;

          return (
            <div
              key={item.name}
              className="flex flex-col items-center gap-2 min-w-[120px]"
            >
              {/* Avatar */}
              <Avatar className="h-14 w-14 shrink-0 border-2 border-border">
                <AvatarImage src={userAvatar?.avatar_url || undefined} alt={item.name} />
                <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                  {getInitials(item.name)}
                </AvatarFallback>
              </Avatar>

              {/* Name */}
              <span className="font-medium text-foreground truncate max-w-[120px] text-center leading-tight" style={{ fontSize: `${Math.round(12 * m)}px` }}>
                {item.name}
              </span>

              {/* Pills */}
              <div className="flex gap-1">
                {/* Agendadas em aberto */}
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted px-2 py-2 w-[58px]">
                  <Calendar className="h-3.5 w-3.5 text-warning" />
                  <span className="font-bold text-foreground tabular-nums leading-none" style={{ fontSize: `${Math.round(18 * m)}px` }}>
                    {scheduled}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium leading-none">
                    A fazer
                  </span>
                </div>

                {/* Concluídas */}
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted px-2 py-2 w-[58px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="font-bold text-foreground tabular-nums leading-none" style={{ fontSize: `${Math.round(18 * m)}px` }}>
                    {completed}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium leading-none">
                    Feitas
                  </span>
                </div>

                {/* Vendas do mês + conversão */}
                {showSales && (<div
                  className="relative flex flex-col items-center gap-0.5 rounded-lg bg-primary/10 ring-1 ring-primary/30 px-2 py-2 w-[58px]"
                  title={`${sales} venda(s) ganha(s) neste mês • ${conversion.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das calls feitas`}
                >
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span className="font-bold text-foreground tabular-nums leading-none" style={{ fontSize: `${Math.round(18 * m)}px` }}>
                    {sales}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium leading-none">
                    Vendas
                  </span>
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-px text-[9px] font-bold leading-none text-primary-foreground tabular-nums whitespace-nowrap">
                    {conversion.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                  </span>
                </div>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
