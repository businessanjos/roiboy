import { filterVisiblePeople, visiblePeopleQuery } from "@/lib/peopleVisibility";
import { useEffect, useMemo, useRef, useState } from "react";
import { productShortName, isRenewalProduct } from "@/lib/insights/productShortName";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FormatType, AppearanceConfig, FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { insightPaletteColors, readableTextOn } from "@/lib/insights/paletteColors";
import { useTvMode } from "../TvModeContext";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
  products?: { name: string; qty: number }[];
}

interface ConfigurableRankingProps {
  data: AggregatedDataPoint[];
  formatting: {
    type: FormatType;
    decimals: number;
  };
  appearance?: AppearanceConfig;
  /** Header labels follow the visual configuration ("Ver por" / "Medir por"). */
  dimensionLabel?: string;
  measureLabel?: string;
  /** Produtos escondidos das pílulas (nome completo ou sigla). */
  hiddenProducts?: string[];
  /** Company columns use the list only, with readable values beneath the name. */
  compact?: boolean;
  /** Shared density across company columns, even when one has a lone seller. */
  fitRowCount?: number;
  privacy?: { showNames: boolean; showPhotos: boolean; blurNumbers: boolean };
}

interface UserAvatar {
  name: string;
  avatar_url: string | null;
}

const MEDAL_EMOJI: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

const PODIUM_LAYOUT: Record<number, { height: number; order: number }> = {
  0: { height: 160, order: 2 },
  1: { height: 120, order: 1 },
  2: { height: 90, order: 3 },
};

/** Junta produtos pela sigla (vendas novas primeiro), mantendo os nomes no tooltip. */
function groupProducts(products: { name: string; qty: number }[], hidden?: string[]) {
  const hiddenSet = new Set((hidden ?? []).map((h) => h.trim().toLowerCase()));
  if (hiddenSet.size) {
    products = products.filter((p) => {
      const base = p.name.replace(/^\s*ren(ova[cç][aã]o)?\.?\s*/i, '').trim().toLowerCase();
      return !hiddenSet.has(p.name.trim().toLowerCase()) && !hiddenSet.has(base)
        && !hiddenSet.has(productShortName(p.name).replace(/^REN\.\s*/, '').toLowerCase());
    });
  }
  const map = new Map<string, { short: string; qty: number; renewal: boolean; items: { name: string; qty: number }[] }>();
  for (const p of products) {
    const short = productShortName(p.name);
    const g = map.get(short) ?? { short, qty: 0, renewal: isRenewalProduct(p.name), items: [] };
    g.qty += p.qty; g.items.push(p); map.set(short, g);
  }
  return Array.from(map.values()).sort((a, b) => Number(a.renewal) - Number(b.renewal) || b.qty - a.qty);
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
  colors,
}: {
  data: AggregatedDataPoint[];
  avatars: Record<string, UserAvatar>;
  formatting: ConfigurableRankingProps['formatting'];
  fontMultiplier: number;
  colors: string[];
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
        const config = PODIUM_LAYOUT[originalIndex];
        if (!config) return null;
        const userAvatar = avatars[item.name];
        const color = colors[originalIndex % colors.length];

        return (
          <div
            key={item.name}
            className="flex flex-col items-center"
            style={{ order: config.order }}
          >
            {/* Avatar */}
            <Avatar
              className="shrink-0 border-[3px] mb-1.5"
              style={{ height: Math.round(48 * fontMultiplier), width: Math.round(48 * fontMultiplier), borderColor: color }}
            >
              <AvatarImage src={userAvatar?.avatar_url || undefined} alt={item.name} />
              <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: `${color}22`, color }}>
                {getInitials(item.name)}
              </AvatarFallback>
            </Avatar>

            {/* Name */}
            <span className="font-medium text-foreground truncate text-center leading-tight"  style={{ fontSize: `${Math.round(11 * fontMultiplier)}px`, maxWidth: `${Math.round(80 * fontMultiplier)}px` }}>
              {item.name.split(' ')[0]}
            </span>

            {/* Value */}
            <span className="text-muted-foreground font-medium tabular-nums mb-1.5" style={{ fontSize: `${Math.round(10 * fontMultiplier)}px` }}>
              {formatCurrency(item.value, formatting.type, formatting.decimals)}
            </span>

            {/* Podium base */}
            <div
              className="rounded-t-lg flex items-center justify-center"
              style={{
                height: `${Math.round(config.height * Math.min(fontMultiplier, 1.4))}px`,
                width: `${Math.round(72 * fontMultiplier)}px`,
                backgroundImage: `linear-gradient(to top, ${color}, ${color}b3)`,
              }}
            >
              <span className="font-bold text-lg drop-shadow-sm" style={{ color: readableTextOn(color) }}>
                {originalIndex + 1}º
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ConfigurableRanking({ data: sourceData, formatting, appearance, dimensionLabel, measureLabel, hiddenProducts, compact = false, fitRowCount, privacy }: ConfigurableRankingProps) {
  const data = useMemo(() => filterVisiblePeople(sourceData), [sourceData]);
  const tv = useTvMode();
  const m = FONT_SCALE_MULTIPLIERS[appearance?.fontScale || 'normal'] * tv.scale;
  const { currentUser } = useCurrentUser();
  const [avatars, setAvatars] = useState<Record<string, UserAvatar>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPodium, setShowPodium] = useState(true);
  const [boxHeight, setBoxHeight] = useState(0);
  const [boxWidth, setBoxWidth] = useState(0);

  // Detect container size for responsive podium / row fitting
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setShowPodium(entry.contentRect.width >= 500);
        setBoxHeight(entry.contentRect.height);
        setBoxWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [data.length > 0]);

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

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const hasPodiumData = data.length >= 2;
  const colors = insightPaletteColors(appearance?.colorPalette);

  // Company rankings keep a single ordered column, regardless of its width.
  const rowHeight = Math.round((compact ? 72 : 44) * m);
  const denseTv = compact && tv.tv && boxHeight / Math.max(fitRowCount ?? data.length, 1) < 140;
  const narrowTv = compact && tv.tv && boxWidth > 0 && boxWidth < 560;
  const headerHeight = Math.round(30 * m);
  const visibleRows =
    tv.tv && boxHeight > 0
      ? compact
        ? data.length
        : Math.max(3, Math.floor((boxHeight - headerHeight) / rowHeight))
      : data.length;
  const rows = data.slice(0, visibleRows);

  if (compact) {
    return (
      <div ref={containerRef} className={`h-full min-w-0 ${tv.tv ? 'overflow-hidden' : 'overflow-auto'}`}>
        <ol
          className={`grid w-full grid-cols-1 ${tv.tv ? 'max-w-[54rem] gap-2.5' : 'max-w-[40rem] gap-2'}`}
          style={{ fontSize: `${Math.round((tv.tv ? (narrowTv ? 16 : denseTv ? 18 : 22) : 14) * m)}px` }}
        >
          {rows.map((item, index) => {
            const emoji = MEDAL_EMOJI[index];
            const isTop = index < 3;
            const rowColor = colors[index % colors.length];
            const progress = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            const userAvatar = avatars[item.name];
            return (
              <li
                key={item.name}
                className={`flex min-w-0 ${tv.tv ? 'items-center' : 'items-start'} rounded-lg border border-border/60 bg-card ${tv.tv && !narrowTv ? 'gap-3 px-4 py-3' : 'gap-2 px-3 py-2.5'}`}
                style={{ ...(isTop ? { borderColor: `${rowColor}33`, backgroundColor: `${rowColor}0d` } : {}), ...(tv.tv ? { minHeight: narrowTv ? 90 : denseTv ? 84 : 124 } : {}) }}
              >
                <span className={`${tv.tv && !narrowTv ? 'w-7' : 'w-5'} shrink-0 text-center`}>
                  {emoji ? <span className={`${tv.tv ? 'text-2xl' : 'text-base'} leading-none`}>{emoji}</span> : (
                    <span className="text-xs font-medium text-muted-foreground">{index + 1}º</span>
                  )}
                </span>
                {privacy?.showPhotos !== false && <Avatar className="shrink-0" style={{ height: Math.round((tv.tv ? (narrowTv ? 32 : denseTv ? 40 : 48) : 36) * m), width: Math.round((tv.tv ? (narrowTv ? 32 : denseTv ? 40 : 48) : 36) * m) }}>
                  <AvatarImage src={userAvatar?.avatar_url || undefined} alt={privacy?.showNames === false ? 'Vendedor' : item.name} />
                  <AvatarFallback className="text-[10px] font-medium" style={{ backgroundColor: `${rowColor}22`, color: rowColor }}>
                    {getInitials(item.name)}
                  </AvatarFallback>
                </Avatar>}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="min-w-0 break-words font-medium leading-snug text-foreground">
                    {privacy?.showNames === false ? '• • •' : item.name}
                  </span>
                  <span style={tv.tv ? { fontSize: Math.round((narrowTv ? 18 : denseTv ? 20 : 28) * m) } : undefined} className={`shrink-0 font-bold tabular-nums text-foreground ${privacy?.blurNumbers ? 'blur-md select-none' : ''}`}>
                    {formatCurrency(item.value, formatting.type, formatting.decimals)}
                  </span>
                  </div>
                  <div className={`mt-1.5 ${tv.tv ? 'h-2' : 'h-1.5'} w-full rounded-full bg-muted`}>
                    <div className="h-full rounded-full transition-all duration-500 motion-reduce:transition-none" style={{ width: `${progress}%`, backgroundColor: rowColor }} />
                  </div>
                  {item.products && item.products.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {groupProducts(item.products, hiddenProducts).map(g => (
                        <span
                          key={g.short}
                          title={g.items.map(i => `${i.qty}x ${i.name}`).join('\n')}
                          className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-semibold leading-none tabular-nums ${g.renewal ? 'border-renewal/30 bg-renewal/10 text-foreground' : 'border-primary/30 bg-primary/10 text-foreground'}`}
                          style={{ fontSize: `${Math.round((tv.tv ? 14 : 11) * m)}px` }}
                        >
                          <span className={g.renewal ? 'text-renewal' : 'text-primary'}>{g.qty}x</span>
                          {g.short}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`h-full px-1 flex gap-4 ${tv.tv ? 'overflow-hidden' : 'overflow-auto'}`}>
      {/* Podium - left side */}
      {!compact && showPodium && hasPodiumData && (
        <div className="w-[40%] shrink-0 flex items-end justify-center">
          <Podium data={data} avatars={avatars} formatting={formatting} fontMultiplier={m} colors={colors} />
        </div>
      )}

      {/* Table - right side */}
      <div className="flex-1 min-w-0">
        <table className={compact ? 'w-full table-fixed' : 'w-full'} style={{ fontSize: `${Math.round(14 * m)}px` }}>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-muted-foreground border-b" style={{ fontSize: `${Math.round(12 * m)}px` }}>
              <th className="text-left py-2 px-1 w-8">#</th>
              <th className="text-left py-2 px-1 truncate">{dimensionLabel || 'Item'}</th>
              {!compact && <th className="text-right py-2 px-1 truncate">{measureLabel || 'Valor'}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => {
              const emoji = MEDAL_EMOJI[index];
              const rowColor = colors[index % colors.length];
              const isTop = index < 3;
              const progress = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
              const userAvatar = avatars[item.name];

              return (
                <tr
                  key={item.name}
                  className="border-b border-border/50 transition-colors hover:bg-muted/30"
                  style={isTop ? { backgroundColor: `${rowColor}1f` } : undefined}
                >
                  <td className="py-2.5 px-1">
                    {emoji ? (
                      <span className="text-base">{emoji}</span>
                    ) : (
                      <span className="text-muted-foreground font-medium text-xs ml-0.5">
                        {index + 1}º
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-1">
                    <div className={`flex gap-2.5 ${compact ? 'items-start' : 'items-center'}`}>
                      {privacy?.showPhotos !== false && <Avatar className="shrink-0" style={{ height: Math.round(32 * m), width: Math.round(32 * m) }}>
                        <AvatarImage src={userAvatar?.avatar_url || undefined} alt={privacy?.showNames === false ? 'Vendedor' : item.name} />
                        <AvatarFallback className="text-[10px] font-medium" style={{ backgroundColor: `${rowColor}22`, color: rowColor }}>
                          {getInitials(item.name)}
                        </AvatarFallback>
                      </Avatar>}
                      <div className="flex-1 min-w-0">
                        <span
                          className={compact ? 'block break-words font-medium leading-snug' : 'font-medium block truncate'}
                          style={{ fontSize: `${Math.round(14 * m)}px`, color: isTop ? rowColor : undefined }}
                        >
                          {privacy?.showNames === false ? '• • •' : item.name}
                        </span>
                        {compact && <span className={`mt-1 block font-semibold tabular-nums text-foreground ${privacy?.blurNumbers ? 'blur-md select-none' : ''}`}>{formatCurrency(item.value, formatting.type, formatting.decimals)}</span>}
                        <div className="w-full h-1.5 bg-muted rounded-full mt-1">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${progress}%`, backgroundColor: rowColor }}
                          />
                        </div>
                        {item.products && item.products.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {groupProducts(item.products, hiddenProducts).map(g => (
                              <span
                                key={g.short}
                                title={g.items.map(i => `${i.qty}x ${i.name}`).join('\n')}
                              className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-semibold leading-none tabular-nums ${g.renewal ? 'border-renewal/30 bg-renewal/10 text-foreground' : 'border-primary/30 bg-primary/10 text-foreground'}`}
                                style={{ fontSize: `${Math.round(11 * m)}px` }}
                              >
                                <span className={g.renewal ? 'text-renewal' : 'text-primary'}>{g.qty}x</span>
                                {g.short}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {!compact && <td className="py-2.5 px-1 text-right">
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: isTop ? rowColor : undefined }}
                    >
                      {formatCurrency(item.value, formatting.type, formatting.decimals)}
                    </span>
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
