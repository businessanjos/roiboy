import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { FormatType } from "../visual-builder/types";
import { PresentationOptions } from "./RankingPresentationDialog";
import { cn } from "@/lib/utils";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface UserAvatar {
  name: string;
  avatar_url: string | null;
}

interface RankingPresentationViewProps {
  title: string;
  data: AggregatedDataPoint[];
  formatting: { type: FormatType; decimals: number };
  options: PresentationOptions;
  onClose: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatValue(value: number, type: FormatType, decimals: number): string {
  if (type === "currency") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  if (type === "percentage") return `${value.toFixed(decimals)}%`;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const MEDAL_EMOJI: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };
const PODIUM_GRADIENTS: Record<number, string> = {
  0: "from-primary to-primary/80",
  1: "from-muted-foreground/60 to-muted-foreground/40",
  2: "from-accent to-accent/80",
};
const PODIUM_BORDER: Record<number, string> = {
  0: "border-primary",
  1: "border-muted-foreground/50",
  2: "border-accent",
};
const PODIUM_HEIGHTS: Record<number, number> = { 0: 220, 1: 160, 2: 120 };

export function RankingPresentationView({
  title,
  data,
  formatting,
  options,
  onClose,
}: RankingPresentationViewProps) {
  const { currentUser } = useCurrentUser();
  const [avatars, setAvatars] = useState<Record<string, UserAvatar>>({});

  useEffect(() => {
    if (!currentUser?.account_id || data.length === 0) return;
    const fetchAvatars = async () => {
      const names = data.map((d) => d.name);
      const { data: users } = await supabase
        .from("users")
        .select("name, avatar_url")
        .eq("account_id", currentUser.account_id)
        .in("name", names);
      if (users) {
        const map: Record<string, UserAvatar> = {};
        for (const user of users) map[user.name] = user;
        setAvatars(map);
      }
    };
    fetchAvatars();
  }, [currentUser?.account_id, data]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const top3 = data.slice(0, 3);

  const podiumOrder =
    top3.length >= 2
      ? [top3[1], top3[0], ...(top3[2] ? [top3[2]] : [])]
      : top3;

  const displayName = (name: string) =>
    options.showNames ? name : "• • •";

  const content = (
    <div className="fixed inset-0 z-[9999] bg-background text-foreground flex flex-col overflow-hidden">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors z-10"
      >
        <X className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Header */}
      <div className="text-center pt-8 pb-4 flex-shrink-0">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        <p className="text-muted-foreground text-sm">Atualizado em tempo real</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 px-8 pb-8 overflow-hidden">
        {/* Podium */}
        {top3.length >= 2 && (
          <div className="lg:w-[45%] flex items-end justify-center gap-3 shrink-0 pb-4">
            {podiumOrder.map((item) => {
              const originalIndex = top3.indexOf(item);
              const gradient = PODIUM_GRADIENTS[originalIndex];
              const border = PODIUM_BORDER[originalIndex];
              const height = PODIUM_HEIGHTS[originalIndex];
              const order = originalIndex === 0 ? 2 : originalIndex === 1 ? 1 : 3;
              const avatar = avatars[item.name];

              return (
                <div
                  key={item.name}
                  className="flex flex-col items-center"
                  style={{ order }}
                >
                  {options.showPhotos ? (
                    <Avatar className={cn("h-16 w-16 border-[3px] mb-2", border)}>
                      <AvatarImage src={avatar?.avatar_url || undefined} alt={item.name} />
                      <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                        {getInitials(item.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-16 w-16 mb-2" />
                  )}

                  <span className="font-medium text-sm text-foreground truncate max-w-[100px] text-center">
                    {options.showNames ? item.name.split(" ")[0] : "• • •"}
                  </span>

                  <span
                    className={cn(
                      "text-sm text-muted-foreground font-medium tabular-nums mb-2",
                      options.blurNumbers && "blur-md select-none"
                    )}
                  >
                    {formatValue(item.value, formatting.type, formatting.decimals)}
                  </span>

                  <div
                    className={cn(
                      "w-[90px] rounded-t-xl bg-gradient-to-t flex items-center justify-center",
                      gradient
                    )}
                    style={{ height: `${height}px` }}
                  >
                    <span className="text-primary-foreground font-bold text-2xl drop-shadow-sm">
                      {originalIndex + 1}º
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ranking table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="text-muted-foreground border-b border-border text-sm">
                <th className="text-left py-3 px-2 w-12">#</th>
                {options.showPhotos && <th className="w-12" />}
                <th className="text-left py-3 px-2">Vendedor</th>
                <th className="text-right py-3 px-2">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const progress = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                const avatar = avatars[item.name];
                const medal = MEDAL_EMOJI[index];

                return (
                  <tr
                    key={item.name}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      index < 3 ? "bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <td className="py-3 px-2">
                      {medal ? (
                        <span className="text-xl">{medal}</span>
                      ) : (
                        <span className="text-muted-foreground font-medium text-sm ml-0.5">
                          {index + 1}º
                        </span>
                      )}
                    </td>
                    {options.showPhotos && (
                      <td className="py-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={avatar?.avatar_url || undefined} alt={item.name} />
                          <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                            {getInitials(item.name)}
                          </AvatarFallback>
                        </Avatar>
                      </td>
                    )}
                    <td className="py-3 px-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground block truncate">
                          {displayName(item.name)}
                        </span>
                        <div className="w-full max-w-[300px] h-1.5 bg-muted rounded-full mt-1">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span
                        className={cn(
                          "font-semibold tabular-nums text-foreground",
                          options.blurNumbers && "blur-md select-none"
                        )}
                      >
                        {formatValue(item.value, formatting.type, formatting.decimals)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
