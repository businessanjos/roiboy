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
  0: "from-amber-400 to-amber-500",
  1: "from-slate-300 to-slate-400",
  2: "from-orange-400 to-orange-500",
};
const PODIUM_BORDER: Record<number, string> = {
  0: "border-amber-400",
  1: "border-slate-400",
  2: "border-orange-400",
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

  // Fetch avatars
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

  // ESC to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Request fullscreen
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder =
    top3.length >= 2
      ? [top3[1], top3[0], ...(top3[2] ? [top3[2]] : [])]
      : top3;

  const displayName = (name: string) =>
    options.showNames ? name : "• • •";

  const content = (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col overflow-hidden">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Header */}
      <div className="text-center pt-8 pb-4 flex-shrink-0">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Trophy className="h-8 w-8 text-amber-400" />
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        </div>
        <p className="text-white/50 text-sm">Atualizado em tempo real</p>
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
                  {/* Avatar */}
                  {options.showPhotos ? (
                    <Avatar
                      className={cn(
                        "h-16 w-16 border-[3px] mb-2",
                        border
                      )}
                    >
                      <AvatarImage
                        src={avatar?.avatar_url || undefined}
                        alt={item.name}
                      />
                      <AvatarFallback className="text-sm font-semibold bg-white/10 text-white">
                        {getInitials(item.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-16 w-16 mb-2" />
                  )}

                  {/* Name */}
                  <span className="font-medium text-sm text-white/90 truncate max-w-[100px] text-center">
                    {options.showNames ? item.name.split(" ")[0] : "• • •"}
                  </span>

                  {/* Value */}
                  <span
                    className={cn(
                      "text-sm text-white/60 font-medium tabular-nums mb-2",
                      options.blurNumbers && "blur-md select-none"
                    )}
                  >
                    {formatValue(item.value, formatting.type, formatting.decimals)}
                  </span>

                  {/* Podium base */}
                  <div
                    className={cn(
                      "w-[90px] rounded-t-xl bg-gradient-to-t flex items-center justify-center",
                      gradient
                    )}
                    style={{ height: `${height}px` }}
                  >
                    <span className="text-white font-bold text-2xl drop-shadow-md">
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
              <tr className="text-white/40 border-b border-white/10 text-sm">
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
                      "border-b border-white/5 transition-colors",
                      index < 3 ? "bg-white/5" : "hover:bg-white/5"
                    )}
                  >
                    <td className="py-3 px-2">
                      {medal ? (
                        <span className="text-xl">{medal}</span>
                      ) : (
                        <span className="text-white/40 font-medium text-sm ml-0.5">
                          {index + 1}º
                        </span>
                      )}
                    </td>
                    {options.showPhotos && (
                      <td className="py-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={avatar?.avatar_url || undefined}
                            alt={item.name}
                          />
                          <AvatarFallback className="text-[10px] font-medium bg-white/10 text-white">
                            {getInitials(item.name)}
                          </AvatarFallback>
                        </Avatar>
                      </td>
                    )}
                    <td className="py-3 px-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-white/90 block truncate">
                          {displayName(item.name)}
                        </span>
                        <div className="w-full max-w-[300px] h-1.5 bg-white/10 rounded-full mt-1">
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
                          "font-semibold tabular-nums text-white/90",
                          options.blurNumbers && "blur-md select-none"
                        )}
                      >
                        {formatValue(
                          item.value,
                          formatting.type,
                          formatting.decimals
                        )}
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
