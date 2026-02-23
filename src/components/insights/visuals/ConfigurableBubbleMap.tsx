import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapDataPoint } from "@/hooks/useMapVisualData";
import { MapPin } from "lucide-react";

interface ConfigurableBubbleMapProps {
  data: MapDataPoint[];
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function ConfigurableBubbleMap({ data }: ConfigurableBubbleMapProps) {
  const maxRevenue = useMemo(() => Math.max(...data.map(d => d.revenue), 1), [data]);
  const totalRevenue = useMemo(() => data.reduce((sum, d) => sum + d.revenue, 0), [data]);
  const top10 = useMemo(() => data.slice(0, 10), [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sem dados de localização</p>
        </div>
      </div>
    );
  }

  const minRadius = 6;
  const maxRadius = 35;

  return (
    <div className="flex h-full gap-3">
      {/* Map */}
      <div className="flex-[3] min-h-[280px] rounded-lg overflow-hidden border border-border">
        <MapContainer
          center={[-14.2, -51.9]}
          zoom={4}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {data.map((point, index) => {
            const radius = minRadius + (point.revenue / maxRevenue) * (maxRadius - minRadius);
            return (
              <CircleMarker
                key={`${point.city}-${index}`}
                center={[point.lat, point.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: 'hsl(217, 91%, 60%)',
                  fillOpacity: 0.55,
                  color: 'hsl(217, 91%, 45%)',
                  weight: 1.5,
                }}
              >
                <LeafletTooltip direction="top" offset={[0, -radius]}>
                  <div className="text-xs">
                    <p className="font-semibold">{point.city}</p>
                    <p>{formatCurrency(point.revenue)}</p>
                    <p className="text-muted-foreground">{point.dealCount} {point.dealCount === 1 ? 'negócio' : 'negócios'}</p>
                  </div>
                </LeafletTooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Top 10 Table */}
      <div className="flex-[2] flex flex-col min-w-[200px]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-foreground">TOP 10 Regiões</span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 px-1 text-muted-foreground font-medium text-xs">#</th>
                <th className="text-left py-1.5 px-1 text-muted-foreground font-medium text-xs">Cidade</th>
                <th className="text-right py-1.5 px-1 text-muted-foreground font-medium text-xs">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((item, index) => (
                <tr key={item.city} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-1.5 px-1 text-muted-foreground text-xs">{index + 1}</td>
                  <td className="py-1.5 px-1 text-foreground text-xs truncate max-w-[140px]" title={item.city}>
                    {item.city.replace(', Brasil', '')}
                  </td>
                  <td className="py-1.5 px-1 text-right font-medium text-xs text-foreground">
                    {formatCurrency(item.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td colSpan={2} className="py-2 px-1 font-semibold text-xs text-foreground">Total</td>
                <td className="py-2 px-1 text-right font-semibold text-xs text-foreground">
                  {formatCurrency(totalRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
