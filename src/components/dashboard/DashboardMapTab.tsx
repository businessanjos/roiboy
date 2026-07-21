import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Globe, Users, Filter } from "lucide-react";
import {
  BR_UFS, BR_REGIONS, UF_BY_CODE, COUNTRY_GEO, CONTINENTS,
  normalizeCountry, type BRRegion, type Continent,
} from "@/lib/geoData";

interface ClientRow {
  id: string;
  city: string | null;
  state: string | null;
  country: string | null;
  gender: string | null;
  products: string[]; // product ids
}

interface ProductOption { id: string; name: string; color: string | null }

const PRIMARY = "hsl(217, 91%, 55%)";
const PRIMARY_FILL = "hsl(217, 91%, 55%)";

function isBrazil(c?: string | null) {
  return !!c && c.trim().toLowerCase() === "brasil";
}

// -- Data hook ---------------------------------------------------------------
function useActiveClientsGeo() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  return useQuery({
    queryKey: ["dashboard-map-clients", accountId],
    enabled: !!accountId,
    staleTime: 120_000,
    queryFn: async (): Promise<{ clients: ClientRow[]; products: ProductOption[] }> => {
      // Fetch active clients paginated
      let clients: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, city, state, country, gender")
          .eq("account_id", accountId!)
          .eq("status", "active")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        clients = clients.concat(data || []);
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }

      const ids = clients.map(c => c.id);
      const cpMap = new Map<string, string[]>();
      if (ids.length) {
        for (let i = 0; i < ids.length; i += 500) {
          const batch = ids.slice(i, i + 500);
          const { data, error } = await supabase
            .from("client_products")
            .select("client_id, product_id")
            .in("client_id", batch);
          if (error) throw error;
          for (const row of data || []) {
            const list = cpMap.get(row.client_id) || [];
            list.push(row.product_id);
            cpMap.set(row.client_id, list);
          }
        }
      }

      const { data: prods } = await supabase
        .from("products")
        .select("id, name, color")
        .eq("account_id", accountId!)
        .order("name");

      return {
        clients: clients.map(c => ({
          id: c.id,
          city: c.city,
          state: c.state,
          country: c.country,
          gender: c.gender,
          products: cpMap.get(c.id) || [],
        })),
        products: (prods || []) as ProductOption[],
      };
    },
  });
}

// -- Maps --------------------------------------------------------------------
interface MarkerPoint { lat: number; lng: number; label: string; count: number; sub?: string }

function BubbleMap({
  points, center, zoom, minZoom, maxZoom, worldCopy,
}: {
  points: MarkerPoint[]; center: [number, number]; zoom: number;
  minZoom?: number; maxZoom?: number; worldCopy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(ref.current, {
      center, zoom, minZoom, maxZoom,
      scrollWheelZoom: true, worldCopyJump: !!worldCopy,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OSM',
      noWrap: !worldCopy,
    }).addTo(map);

    const max = Math.max(1, ...points.map(p => p.count));
    for (const p of points) {
      const r = 6 + (p.count / max) * 28;
      L.circleMarker([p.lat, p.lng], {
        radius: r,
        fillColor: PRIMARY_FILL,
        color: PRIMARY,
        weight: 1.5,
        fillOpacity: 0.55,
      })
        .bindTooltip(
          `<div style="font-size:12px"><b>${p.label}</b><br/>${p.count} ${p.count === 1 ? "cliente" : "clientes"}${p.sub ? `<br/><span style='color:#888'>${p.sub}</span>` : ""}</div>`,
          { direction: "top", offset: [0, -r] }
        )
        .addTo(map);
    }

    setTimeout(() => map.invalidateSize(), 150);
    return () => { map.remove(); mapRef.current = null; };
  }, [points, center, zoom, minZoom, maxZoom, worldCopy]);

  return <div ref={ref} className="w-full h-full min-h-[380px] rounded-lg overflow-hidden border border-border" />;
}

// -- Main --------------------------------------------------------------------
export function DashboardMapTab() {
  const { data, isLoading } = useActiveClientsGeo();
  const [productFilter, setProductFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all"); // continent OR "BR:Sudeste"

  const clients = data?.clients ?? [];
  const products = data?.products ?? [];

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (productFilter !== "all" && !c.products.includes(productFilter)) return false;
      if (genderFilter !== "all" && (c.gender || "") !== genderFilter) return false;
      if (regionFilter !== "all") {
        if (regionFilter.startsWith("BR:")) {
          const region = regionFilter.slice(3) as BRRegion;
          if (!isBrazil(c.country)) return false;
          const uf = c.state ? UF_BY_CODE[c.state.toUpperCase()] : undefined;
          if (!uf || uf.region !== region) return false;
        } else {
          const country = normalizeCountry(c.country);
          if (!country || country.continent !== regionFilter) return false;
        }
      }
      return true;
    });
  }, [clients, productFilter, genderFilter, regionFilter]);

  // Aggregations
  const byCountry = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of filtered) {
      const key = (c.country || "Desconhecido").trim();
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  }, [filtered]);

  const byUF = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of filtered) {
      if (!isBrazil(c.country) || !c.state) continue;
      const uf = c.state.toUpperCase();
      m.set(uf, (m.get(uf) || 0) + 1);
    }
    return m;
  }, [filtered]);

  const byCity = useMemo(() => {
    const m = new Map<string, { count: number; state: string; country: string }>();
    for (const c of filtered) {
      if (!c.city) continue;
      const key = `${c.city.trim()}|${c.state || ""}|${c.country || ""}`;
      const existing = m.get(key);
      if (existing) existing.count += 1;
      else m.set(key, { count: 1, state: c.state || "", country: c.country || "" });
    }
    return m;
  }, [filtered]);

  // World map points (per country using centroids)
  const worldPoints = useMemo<MarkerPoint[]>(() => {
    const arr: MarkerPoint[] = [];
    for (const [name, count] of byCountry) {
      const geo = normalizeCountry(name);
      if (!geo) continue;
      arr.push({ lat: geo.lat, lng: geo.lng, label: geo.name, count, sub: geo.continent });
    }
    return arr;
  }, [byCountry]);

  // BR map points (per UF)
  const brPoints = useMemo<MarkerPoint[]>(() => {
    const arr: MarkerPoint[] = [];
    for (const [uf, count] of byUF) {
      const info = UF_BY_CODE[uf];
      if (!info) continue;
      arr.push({ lat: info.lat, lng: info.lng, label: `${info.name} (${info.uf})`, count, sub: info.region });
    }
    return arr;
  }, [byUF]);

  const stateRanking = useMemo(() => {
    return [...byUF.entries()]
      .map(([uf, count]) => ({ uf, count, name: UF_BY_CODE[uf]?.name ?? uf, region: UF_BY_CODE[uf]?.region ?? "-" }))
      .sort((a, b) => b.count - a.count);
  }, [byUF]);

  const cityRanking = useMemo(() => {
    return [...byCity.entries()]
      .map(([key, v]) => {
        const [city] = key.split("|");
        return { city, state: v.state, country: v.country, count: v.count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [byCity]);

  const totalOnMap = filtered.length;
  const untracked = filtered.filter(c => !c.country || !String(c.country).trim()).length;
  const totalActive = clients.length;
  const withLocation = clients.filter(c => (c.country && String(c.country).trim()) || (c.state && String(c.state).trim()) || (c.city && String(c.city).trim())).length;
  const coveragePct = totalActive > 0 ? Math.round((withLocation / totalActive) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>

            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">Todos os produtos</SelectItem>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Gênero" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os gêneros</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Região" /></SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="all">Todas as regiões</SelectItem>
                <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Continentes</div>
                {CONTINENTS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Regiões do Brasil</div>
                {BR_REGIONS.map(r => (
                  <SelectItem key={`BR:${r}`} value={`BR:${r}`}>Brasil — {r}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" /> {totalOnMap} ativo(s)
              </Badge>
              {untracked > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {untracked} sem localização
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> Mundo
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="h-[380px] flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
            ) : worldPoints.length === 0 ? (
              <EmptyMap message="Sem clientes ativos na seleção" height={380} />
            ) : (
              <div className="h-[380px]">
                <BubbleMap points={worldPoints} center={[10, -10]} zoom={2} minZoom={1} worldCopy />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Brasil
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="h-[380px] flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
            ) : brPoints.length === 0 ? (
              <EmptyMap message="Sem clientes ativos no Brasil" height={380} />
            ) : (
              <div className="h-[380px]">
                <BubbleMap points={brPoints} center={[-14.2, -51.9]} zoom={4} minZoom={3} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ranking por Estado</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {stateRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium w-8">#</th>
                    <th className="text-left py-2 font-medium">Estado</th>
                    <th className="text-left py-2 font-medium">Região</th>
                    <th className="text-right py-2 font-medium">Mentorados</th>
                  </tr>
                </thead>
                <tbody>
                  {stateRanking.map((r, i) => (
                    <tr key={r.uf} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1.5 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="py-1.5 font-medium">{r.name} <span className="text-muted-foreground">({r.uf})</span></td>
                      <td className="py-1.5 text-muted-foreground text-xs">{r.region}</td>
                      <td className="py-1.5 text-right font-semibold">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ranking por Cidade (top 30)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {cityRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>
            ) : (
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="text-left py-2 font-medium w-8">#</th>
                      <th className="text-left py-2 font-medium">Cidade</th>
                      <th className="text-left py-2 font-medium">UF</th>
                      <th className="text-right py-2 font-medium">Mentorados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cityRanking.map((r, i) => (
                      <tr key={`${r.city}-${r.state}-${i}`} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-1.5 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="py-1.5 font-medium truncate max-w-[200px]" title={r.city}>{r.city}</td>
                        <td className="py-1.5 text-muted-foreground text-xs">{r.state || (r.country && r.country !== "Brasil" ? r.country : "-")}</td>
                        <td className="py-1.5 text-right font-semibold">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyMap({ message, height }: { message: string; height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2">
        <MapPin className="h-8 w-8 opacity-40" />
        {message}
      </div>
    </div>
  );
}
