import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MATERIAL_REQUEST_STATUSES,
  categoryLabel,
  statusColor,
  statusLabel,
  type MaterialRequestStatus,
} from "@/lib/agency";
import { useMaterialRequests, useUpdateMaterialRequest } from "@/hooks/useMaterialRequests";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MaterialRequestDrawer } from "./MaterialRequestDrawer";

interface Props {
  agencyId?: string;
  showAgencyName?: boolean;
  /** When true, hides status column controls (read-only for agency users) */
  agencyView?: boolean;
}

export function MaterialRequestsList({ agencyId, showAgencyName = false, agencyView = false }: Props) {
  const { data: requests = [], isLoading } = useMaterialRequests(agencyId);
  const update = useUpdateMaterialRequest();
  const [openId, setOpenId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, typeof requests> = {};
    MATERIAL_REQUEST_STATUSES.forEach((s) => (map[s.value] = []));
    requests.forEach((r) => {
      if (!map[r.status]) map[r.status] = [];
      map[r.status].push(r);
    });
    return map;
  }, [requests]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando solicitações...</p>;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {MATERIAL_REQUEST_STATUSES.map((col) => (
          <div key={col.value} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: col.color }}
                />
                <span className="text-sm font-medium">{col.label}</span>
              </div>
              <Badge variant="outline" className="text-xs">{grouped[col.value]?.length ?? 0}</Badge>
            </div>
            <div className="space-y-2 min-h-[40px]">
              {(grouped[col.value] ?? []).map((r) => (
                <Card
                  key={r.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setOpenId(r.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm leading-tight">{r.title}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{categoryLabel(r.category)}</div>
                  {showAgencyName && r.agency && (
                    <Badge
                      variant="outline"
                      className="text-xs mt-2"
                      style={{ borderColor: r.agency.color, color: r.agency.color }}
                    >
                      {r.agency.name}
                    </Badge>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                  </div>
                  {!agencyView && (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={r.status}
                        onValueChange={(v) => update.mutate({ id: r.id, patch: { status: v as MaterialRequestStatus } })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIAL_REQUEST_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!requests.length && (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          Nenhuma solicitação ainda.
        </Card>
      )}

      {openId && (
        <MaterialRequestDrawer
          requestId={openId}
          open={!!openId}
          onOpenChange={(v) => !v && setOpenId(null)}
          agencyView={agencyView}
        />
      )}
    </>
  );
}
