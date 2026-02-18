import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FormatType, AppearanceConfig, FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";

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
  appearance?: AppearanceConfig;
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

const PODIUM_CONFIG: Record<number, { height: number; gradient: string; borderColor: string; order: number }> = {
  0: { height: 160, gradient: 'from-amber-400 to-amber-500', borderColor: 'border-amber-400', order: 2 },
  1: { height: 120, gradient: 'from-slate-300 to-slate-400', borderColor: 'border-slate-400', order: 1 },
  2: { height: 90, gradient: 'from-orange-400 to-orange-500', borderColor: 'border-orange-400', order: 3 },
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

function Podium({
  data,
  avatars,
  formatting,
  fontMultiplier,
}: {
  data: AggregatedDataPoint[];
  avatars: Record<string, UserAvatar>;
  formatting: ConfigurableRankingProps['formatting'];
  fontMultiplier: number;
}) {
  const top3 = data.slice(0, 3);
  // Reorder: 2nd, 1st, 3rd
  const podiumOrder = top3.length >= 2
    ? [top3[1], top3[0], ...(top3[2] ? [top3[2]] : [])]
    : top3;

  return (
    <div className="flex items-end justify-center gap-2 px-2 pb-2 pt-4">
      {podiumOrder.map((item) => {
        const originalIndex = top3.indexOf(item);
        const config = PODIUM_CONFIG[originalIndex];
        if (!config) return null;
        const userAvatar = avatars[item.name];

        return (
          <div
            key={item.name}
            className="flex flex-col items-center"
            style={{ order: config.order }}
          >
            {/* Avatar */}
            <Avatar className={`h-12 w-12 shrink-0 border-[3px] ${config.borderColor} mb-1.5`}>
              <AvatarImage src={userAvatar?.avatar_url || undefined} alt={item.name} />
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {getInitials(item.name)}
              </AvatarFallback>
            </Avatar>

            {/* Name */}
            <span className="font-medium text-foreground truncate max-w-[80px] text-center leading-tight" style={{ fontSize: `${Math.round(11 * fontMultiplier)}px` }}>
              {item.name.split(' ')[0]}
            </span>

            {/* Value */}
            <span className="text-muted-foreground font-medium tabular-nums mb-1.5" style={{ fontSize: `${Math.round(10 * fontMultiplier)}px` }}>
              {formatCurrency(item.value, formatting.type, formatting.decimals)}
            </span>

            {/* Podium base */}
            <div
              className={`w-[72px] rounded-t-lg bg-gradient-to-t ${config.gradient} flex items-center justify-center`}
              style={{ height: `${config.height}px` }}
            >
              <span className="text-white font-bold text-lg drop-shadow-sm">
                {originalIndex + 1}º
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ConfigurableRanking({ data, formatting, appearance }: ConfigurableRankingProps) {
  const m = FONT_SCALE_MULTIPLIERS[appearance?.fontScale || 'normal'];
  const { currentUser } = useCurrentUser();
  const [avatars, setAvatars] = useState<Record<string, UserAvatar>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPodium, setShowPodium] = useState(true);

  // Detect container width for responsive podium
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setShowPodium(entry.contentRect.width >= 500);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
  const hasPodiumData = data.length >= 2;

  return (
    <div ref={containerRef} className="h-full overflow-auto px-1 flex gap-4">
      {/* Podium - left side */}
      {showPodium && hasPodiumData && (
        <div className="w-[40%] shrink-0 flex items-end justify-center">
          <Podium data={data} avatars={avatars} formatting={formatting} fontMultiplier={m} />
        </div>
      )}

      {/* Table - right side */}
      <div className="flex-1 min-w-0">
        <table className="w-full" style={{ fontSize: `${Math.round(14 * m)}px` }}>
          <thead>
            <tr className="text-muted-foreground border-b" style={{ fontSize: `${Math.round(12 * m)}px` }}>
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
                  <td className="py-2.5 px-1">
                    {medal ? (
                      <span className="text-base">{medal.emoji}</span>
                    ) : (
                      <span className="text-muted-foreground font-medium text-xs ml-0.5">
                        {index + 1}º
                      </span>
                    )}
                  </td>
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
                        <div className="w-full h-1.5 bg-muted rounded-full mt-1">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
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
    </div>
  );
}
