import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, CheckCircle2 } from "lucide-react";
import { FormatType, FONT_SCALE_MULTIPLIERS, AppearanceConfig } from "../visual-builder/types";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
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
  const m = FONT_SCALE_MULTIPLIERS[appearance?.fontScale || 'normal'];
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

  const filteredData = hiddenUsers?.length
    ? data.filter(d => !hiddenUsers.includes(d.name))
    : data;

  if (!filteredData || filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
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
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted px-3 py-2 min-w-[52px]">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-bold text-foreground tabular-nums leading-none" style={{ fontSize: `${Math.round(18 * m)}px` }}>
                    {scheduled}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium leading-none">
                    Agend.
                  </span>
                </div>

                {/* Concluídas */}
                <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted px-3 py-2 min-w-[52px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-bold text-foreground tabular-nums leading-none" style={{ fontSize: `${Math.round(18 * m)}px` }}>
                    {completed}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium leading-none">
                    Conc.
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
