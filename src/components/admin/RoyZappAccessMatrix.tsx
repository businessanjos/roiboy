import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Loader2, MessageSquare, Search, LayoutGrid, X, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ZAPP_SECTOR_LABELS,
  ZAPP_WHATSAPP_SECTORS,
  canPickSector,
  sanitizeZappSectorList,
  type ZappWhatsAppSector,
} from "@/lib/royZappAccess";

interface Props {
  accountId: string;
  onSelectUser?: (userId: string) => void;
}

interface MatrixUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Matriz de leitura rápida: por usuário, quais setores liberam o PIPELINE
 * (áreas do sistema) e quais WhatsApps aparecem dentro do ROY zAPP.
 * São controles independentes — a matriz existe para evitar confusão.
 */
export function RoyZappAccessMatrix({ accountId, onSelectUser }: Props) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const [onlyDivergent, setOnlyDivergent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-access-matrix", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const [usersRes, accessRes, zappRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, email, role, is_active")
          .eq("account_id", accountId)
          .order("name"),
        supabase
          .from("user_sector_access")
          .select("user_id, sector_id, is_active")
          .eq("account_id", accountId),
        (supabase as any)
          .from("user_royzapp_views")
          .select("user_id, zapp_sectors")
          .eq("account_id", accountId),
      ]);
      if (usersRes.error) throw usersRes.error;
      if (accessRes.error) throw accessRes.error;
      if (zappRes.error) throw zappRes.error;

      const users = (usersRes.data || []).filter((u: any) => u.is_active !== false) as MatrixUser[];

      const sectorMap = new Map<string, Set<string>>();
      (accessRes.data || []).forEach((row: any) => {
        if (!row.is_active) return;
        if (!sectorMap.has(row.user_id)) sectorMap.set(row.user_id, new Set());
        sectorMap.get(row.user_id)!.add(row.sector_id);
      });

      const zappMap = new Map<string, ZappWhatsAppSector[] | null>();
      (zappRes.data || []).forEach((row: any) => {
        zappMap.set(
          row.user_id,
          row.zapp_sectors === null || row.zapp_sectors === undefined
            ? null
            : sanitizeZappSectorList(row.zapp_sectors)
        );
      });

      return { users, sectorMap, zappMap };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.users
      .filter(
        (u) =>
          !term ||
          u.name?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term)
      )
      .map((u) => {
        const unrestricted = u.role === "admin" || canPickSector(u.email);
        const pipeline = data.sectorMap.get(u.id) ?? new Set<string>();
        const zappOverride = data.zappMap.get(u.id) ?? null;
        const cells = ZAPP_WHATSAPP_SECTORS.map((sector) => {
          const hasPipeline = unrestricted || pipeline.has(sector);
          const hasZapp = unrestricted
            ? true
            : zappOverride === null
              ? hasPipeline
              : zappOverride.includes(sector);
          return { sector, hasPipeline, hasZapp };
        });
        return {
          user: u,
          unrestricted,
          inheriting: !unrestricted && zappOverride === null,
          cells,
          divergent: cells.some((c) => c.hasPipeline !== c.hasZapp),
        };
      })
      .filter((r) => !onlyDivergent || r.divergent);
  }, [data, search, onlyDivergent]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="flex items-start gap-2 text-left flex-1 min-w-[240px]"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 mt-0.5 text-muted-foreground transition-transform",
                isOpen && "rotate-90",
              )}
            />
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                Matriz de acesso: Pipeline x WhatsApp (ROY zAPP)
              </CardTitle>
              <CardDescription className="text-xs">
                São controles independentes. <strong>P</strong> = áreas do sistema (pipeline,
                dashboards) do setor. <strong>Z</strong> = WhatsApp daquele setor dentro do ROY zAPP.
              </CardDescription>
            </div>
          </button>
          {isOpen ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar usuário"
                  className="h-8 pl-7 w-48 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant={onlyDivergent ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setOnlyDivergent((v) => !v)}
              >
                Só divergentes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setIsOpen(false)}
              >
                <ChevronUp className="h-3.5 w-3.5 mr-1" />
                Fechar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setIsOpen(true)}
            >
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
              Expandir matriz
            </Button>
          )}
        </div>
      </CardHeader>
      {isOpen && (
      <CardContent>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum usuário encontrado com esse filtro.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left font-medium text-muted-foreground pb-2 pr-3 sticky left-0 bg-card">
                    Usuário
                  </th>
                  {ZAPP_WHATSAPP_SECTORS.map((sector) => (
                    <th key={sector} className="pb-2 px-2 font-medium text-muted-foreground">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{ZAPP_SECTOR_LABELS[sector]}</span>
                        <span className="text-[10px] opacity-70">P · Z</span>
                      </div>
                    </th>
                  ))}
                  <th className="pb-2 px-2 font-medium text-muted-foreground text-right">
                    ROY zAPP
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.user.id}
                    className={cn(
                      "border-t hover:bg-muted/30 transition-colors",
                      onSelectUser && "cursor-pointer"
                    )}
                    onClick={() => onSelectUser?.(row.user.id)}
                  >
                    <td className="py-2 pr-3 border-t sticky left-0 bg-card">
                      <div className="min-w-0">
                        <p className="font-medium truncate flex items-center gap-1.5">
                          {row.user.name}
                          {row.unrestricted && (
                            <Badge variant="secondary" className="h-4 text-[10px]">
                              Total
                            </Badge>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {row.user.email}
                        </p>
                      </div>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.sector} className="py-2 px-2 border-t">
                        <div className="flex items-center justify-center gap-1.5">
                          <Flag on={cell.hasPipeline} label="P" tone="pipeline" />
                          <Flag on={cell.hasZapp} label="Z" tone="zapp" />
                        </div>
                      </td>
                    ))}
                    <td className="py-2 px-2 border-t text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] h-5",
                          row.unrestricted
                            ? "border-primary/40 text-primary"
                            : row.inheriting
                              ? "text-muted-foreground"
                              : "border-amber-500/50 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {row.unrestricted
                          ? "Sem restrição"
                          : row.inheriting
                            ? "Herda setores"
                            : "Lista própria"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap pt-3 mt-3 border-t text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Flag on label="P" tone="pipeline" /> Pipeline / áreas do setor liberadas
          </span>
          <span className="flex items-center gap-1.5">
            <Flag on label="Z" tone="zapp" /> WhatsApp do setor no ROY zAPP
          </span>
          <span className="flex items-center gap-1.5">
            <Flag on={false} label="P" tone="pipeline" /> sem acesso
          </span>
        </div>
      </CardContent>
      )}
    </Card>

  );
}

function Flag({
  on,
  label,
  tone,
}: {
  on: boolean;
  label: string;
  tone: "pipeline" | "zapp";
}) {
  return (
    <span
      title={
        tone === "pipeline"
          ? on
            ? "Pipeline liberado"
            : "Pipeline bloqueado"
          : on
            ? "WhatsApp liberado no ROY zAPP"
            : "WhatsApp bloqueado no ROY zAPP"
      }
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold border",
        !on && "bg-muted/40 text-muted-foreground border-border",
        on && tone === "pipeline" && "bg-primary/10 text-primary border-primary/30",
        on && tone === "zapp" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      )}
    >
      {label}
      {on ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
    </span>
  );
}
