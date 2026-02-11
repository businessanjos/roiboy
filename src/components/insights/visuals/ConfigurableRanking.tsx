import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FormatType } from "../visual-builder/types";
import { formatValueCompact } from "@/lib/formula-evaluator";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface ConfigurableRankingProps {
  data: AggregatedDataPoint[];
  formatting: {
    type: FormatType;
    decimals: number;
  };
}

interface UserAvatar {
  name: string;
  avatar_url: string | null;
}

const MEDAL_STYLES: Record<number, { bg: string; text: string; border: string; emoji: string }> = {
  0: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700', emoji: '🥇' },
  1: { bg: 'bg-slate-100 dark:bg-slate-800/50', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600', emoji: '🥈' },
  2: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-700', emoji: '🥉' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatCurrency(value: number, type: FormatType, decimals: number): string {
  if (type === 'currency') {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  if (type === 'percentage') {
    return `${value.toFixed(decimals)}%`;
  }
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function ConfigurableRanking({ data, formatting }: ConfigurableRankingProps) {
  const { currentUser } = useCurrentUser();
  const [avatars, setAvatars] = useState<Record<string, UserAvatar>>({});

  // Fetch user avatars
  useEffect(() => {
    if (!currentUser?.account_id || data.length === 0) return;

    const fetchAvatars = async () => {
      const names = data.map(d => d.name);
      const { data: users } = await supabase
        .from('users')
        .select('name, avatar_url')
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

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="h-full overflow-auto px-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-xs border-b">
            <th className="text-left py-2 px-1 w-8">#</th>
            <th className="text-left py-2 px-1">Vendedor</th>
            <th className="text-right py-2 px-1">Faturamento</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const medal = MEDAL_STYLES[index];
            const progress = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            const userAvatar = avatars[item.name];

            return (
              <tr
                key={item.name}
                className={`border-b border-border/50 transition-colors ${
                  medal ? medal.bg : 'hover:bg-muted/30'
                }`}
              >
                {/* Position */}
                <td className="py-2.5 px-1">
                  {medal ? (
                    <span className="text-base">{medal.emoji}</span>
                  ) : (
                    <span className="text-muted-foreground font-medium text-xs ml-0.5">
                      {index + 1}º
                    </span>
                  )}
                </td>

                {/* Avatar + Name + Progress Bar */}
                <td className="py-2.5 px-1">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={userAvatar?.avatar_url || undefined} alt={item.name} />
                      <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                        {getInitials(item.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium text-sm block truncate ${medal ? medal.text : 'text-foreground'}`}>
                        {item.name}
                      </span>
                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-muted rounded-full mt-1">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </td>

                {/* Value */}
                <td className="py-2.5 px-1 text-right">
                  <span className={`font-semibold tabular-nums ${medal ? medal.text : 'text-foreground'}`}>
                    {formatCurrency(item.value, formatting.type, formatting.decimals)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
