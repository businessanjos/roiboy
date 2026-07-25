import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ZAPP_VIEWS,
  ZAPP_SECTOR_LABELS,
  ZAPP_WHATSAPP_SECTORS,
  canPickSector,
  sanitizeViewList,
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
 * Painel de acesso por SETOR (não mais uma matriz de leitura).
 *
 * Fluxo: escolha o setor (ex.: Vendas) → veja quem entra no pipeline e quem
 * pode conversar/enviar mensagem pelo WhatsApp daquele setor → ajuste com um
 * clique. O bloco de alertas mostra exatamente os casos problemáticos, como
 * alguém de Customer Success com acesso ao WhatsApp do Comercial.
 */
export function RoyZappAccessMatrix({ accountId, onSelectUser }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<ZappWhatsAppSector>("vendas");
  const [savingKey, setSavingKey] = useState<string | null>(null);

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
          .select("user_id, views, zapp_sectors")
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
      const viewsMap = new Map<string, string[]>();
      (zappRes.data || []).forEach((row: any) => {
        zappMap.set(
          row.user_id,
          row.zapp_sectors === null || row.zapp_sectors === undefined
            ? null
            : sanitizeZappSectorList(row.zapp_sectors),
        );
        viewsMap.set(row.user_id, sanitizeViewList(row.views));
      });

      return { users, sectorMap, zappMap, viewsMap };
    },
  });

  /** Estado efetivo de um usuário em um setor. */
  const resolve = (user: MatrixUser, target: ZappWhatsAppSector) => {
    const unrestricted = user.role === "admin" || canPickSector(user.email);
    const pipelineSet = data?.sectorMap.get(user.id) ?? new Set<string>();
    const override = data?.zappMap.get(user.id) ?? null;
    const hasPipeline = unrestricted || pipelineSet.has(target);
    const hasZapp = unrestricted ? true : override === null ? hasPipeline : override.includes(target);
    return { unrestricted, hasPipeline, hasZapp, override, pipelineSet };
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.users
      .filter(
        (u) => !term || u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term),
      )
      .map((u) => {
        const state = resolve(u, sector);
        const homeSectors = ZAPP_WHATSAPP_SECTORS.filter((s) => state.pipelineSet.has(s));
        return { user: u, ...state, homeSectors };
      })
      .sort((a, b) => {
        const score = (r: typeof a) => (r.hasZapp ? 0 : r.hasPipeline ? 1 : 2);
        return score(a) - score(b) || (a.user.name || "").localeCompare(b.user.name || "");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, sector]);

  /** Casos de risco: pode falar pelo WhatsApp do setor sem trabalhar nele. */
  const risky = useMemo(
    () => rows.filter((r) => !r.unrestricted && r.hasZapp && !r.hasPipeline),
    [rows],
  );

  const withZapp = rows.filter((r) => r.hasZapp).length;
  const withPipeline = rows.filter((r) => r.hasPipeline).length;

  const materializeZapp = (user: MatrixUser) => {
    const { override, pipelineSet } = resolve(user, sector);
    return override ?? ZAPP_WHATSAPP_SECTORS.filter((s) => pipelineSet.has(s));
  };

  const saveZappSectors = async (user: MatrixUser, next: ZappWhatsAppSector[]) => {
    const views = data?.viewsMap.get(user.id);
    const { error } = await (supabase as any).from("user_royzapp_views").upsert(
      {
        account_id: accountId,
        user_id: user.id,
        views: views && views.length ? views : DEFAULT_ZAPP_VIEWS,
        zapp_sectors: ZAPP_WHATSAPP_SECTORS.filter((s) => next.includes(s)),
      },
      { onConflict: "account_id,user_id" },
    );
    if (error) throw error;
  };

  const toggleZapp = async (user: MatrixUser, enable: boolean) => {
    setSavingKey(`z-${user.id}`);
    try {
      const current = materializeZapp(user);
      const next = enable
        ? Array.from(new Set([...current, sector]))
        : current.filter((s) => s !== sector);
      await saveZappSectors(user, next as ZappWhatsAppSector[]);
      toast.success(
        `${enable ? "Liberado" : "Bloqueado"}: WhatsApp ${ZAPP_SECTOR_LABELS[sector]} — ${user.name}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-access-matrix", accountId] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar");
    } finally {
      setSavingKey(null);
    }
  };

  const togglePipeline = async (user: MatrixUser, enable: boolean) => {
    setSavingKey(`p-${user.id}`);
    try {
      const { error } = await supabase.from("user_sector_access").upsert(
        {
          account_id: accountId,
          user_id: user.id,
          sector_id: sector,
          is_active: enable,
        },
        { onConflict: "account_id,user_id,sector_id" },
      );
      if (error) throw error;
      toast.success(
        `${enable ? "Liberado" : "Bloqueado"}: pipeline ${ZAPP_SECTOR_LABELS[sector]} — ${user.name}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-access-matrix", accountId] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar");
    } finally {
      setSavingKey(null);
    }
  };

  const blockAllRisky = async () => {
    setSavingKey("bulk");
    try {
      for (const row of risky) {
        const current = materializeZapp(row.user);
        await saveZappSectors(
          row.user,
          current.filter((s) => s !== sector) as ZappWhatsAppSector[],
        );
      }
      toast.success(
        `${risky.length} usuário(s) bloqueado(s) no WhatsApp de ${ZAPP_SECTOR_LABELS[sector]}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-access-matrix", accountId] });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aplicar em lote");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          Quem acessa cada setor e cada WhatsApp
        </CardTitle>
        <CardDescription className="text-xs">
          Escolha o setor e ajuste na hora: <strong>Pipeline</strong> = áreas do sistema (negócios,
          dashboards). <strong>WhatsApp</strong> = ver conversas e enviar mensagens pelo número daquele
          setor no ROY zAPP.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Seletor de setor */}
        <div className="flex flex-wrap items-center gap-2">
          {ZAPP_WHATSAPP_SECTORS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sector === s ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setSector(s)}
            >
              {ZAPP_SECTOR_LABELS[s]}
            </Button>
          ))}
          <div className="relative ml-auto">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pessoa"
              className="h-8 pl-7 w-52 text-xs"
            />
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <SummaryTile
            icon={<Users className="h-3.5 w-3.5" />}
            label={`Pipeline ${ZAPP_SECTOR_LABELS[sector]}`}
            value={withPipeline}
          />
          <SummaryTile
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            label={`WhatsApp ${ZAPP_SECTOR_LABELS[sector]}`}
            value={withZapp}
          />
          <SummaryTile
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Acessos indevidos"
            value={risky.length}
            tone={risky.length ? "danger" : "ok"}
          />
        </div>

        {/* Alerta de risco */}
        {risky.length > 0 && (
          <Alert variant="destructive" className="py-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">
              {risky.length} pessoa(s) podem falar pelo WhatsApp de {ZAPP_SECTOR_LABELS[sector]} sem
              trabalhar nesse setor
            </AlertTitle>
            <AlertDescription className="text-xs space-y-2">
              <div className="flex flex-wrap gap-1.5 pt-1">
                {risky.slice(0, 12).map((r) => (
                  <Badge key={r.user.id} variant="outline" className="text-[10px]">
                    {r.user.name}
                    {r.homeSectors.length > 0 && (
                      <span className="opacity-70 ml-1">
                        ({r.homeSectors.map((s) => ZAPP_SECTOR_LABELS[s]).join(", ")})
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                disabled={savingKey === "bulk"}
                onClick={blockAllRisky}
              >
                {savingKey === "bulk" ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                )}
                Bloquear todos no WhatsApp de {ZAPP_SECTOR_LABELS[sector]}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum usuário encontrado com esse filtro.
          </p>
        ) : (
          <div className="rounded-lg border divide-y">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-[11px] font-medium text-muted-foreground bg-muted/40">
              <span>Pessoa</span>
              <span className="w-24 text-center">Pipeline</span>
              <span className="w-24 text-center">WhatsApp</span>
            </div>
            {rows.map((row) => {
              const isRisky = !row.unrestricted && row.hasZapp && !row.hasPipeline;
              return (
                <div
                  key={row.user.id}
                  className={cn(
                    "grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 items-center",
                    isRisky && "bg-destructive/5",
                  )}
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectUser?.(row.user.id)}
                      className="text-left"
                    >
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        {row.user.name}
                        {row.unrestricted && (
                          <Badge variant="secondary" className="h-4 text-[10px]">
                            Acesso total
                          </Badge>
                        )}
                        {isRisky && (
                          <Badge variant="destructive" className="h-4 text-[10px]">
                            Indevido
                          </Badge>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {row.user.email}
                        {row.homeSectors.length > 0 && (
                          <>
                            {" · "}
                            {row.homeSectors.map((s) => ZAPP_SECTOR_LABELS[s]).join(", ")}
                          </>
                        )}
                      </p>
                    </button>
                  </div>

                  <div className="w-24 flex justify-center">
                    <ToggleCell
                      checked={row.hasPipeline}
                      disabled={row.unrestricted || savingKey === `p-${row.user.id}`}
                      loading={savingKey === `p-${row.user.id}`}
                      tooltip={
                        row.unrestricted
                          ? "Admin / acesso total — sempre liberado"
                          : `Acesso às áreas do setor ${ZAPP_SECTOR_LABELS[sector]}`
                      }
                      onCheckedChange={(v) => togglePipeline(row.user, v)}
                    />
                  </div>

                  <div className="w-24 flex justify-center">
                    <ToggleCell
                      checked={row.hasZapp}
                      disabled={row.unrestricted || savingKey === `z-${row.user.id}`}
                      loading={savingKey === `z-${row.user.id}`}
                      tone="zapp"
                      tooltip={
                        row.unrestricted
                          ? "Admin / acesso total — sempre liberado"
                          : `Ver conversas e enviar mensagens pelo WhatsApp ${ZAPP_SECTOR_LABELS[sector]}`
                      }
                      onCheckedChange={(v) => toggleZapp(row.user, v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Desligar o WhatsApp de um setor não afeta o pipeline: a pessoa continua vendo negócios e
          dashboards do setor, mas não aparece nem envia mensagens pelo número daquele setor.
        </p>
      </CardContent>
    </Card>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "neutral" | "danger" | "ok";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 flex items-center gap-2",
        tone === "danger" && "border-destructive/40 bg-destructive/5",
        tone === "ok" && "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <span
        className={cn(
          "text-muted-foreground",
          tone === "danger" && "text-destructive",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function ToggleCell({
  checked,
  disabled,
  loading,
  tooltip,
  tone = "pipeline",
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  loading?: boolean;
  tooltip: string;
  tone?: "pipeline" | "zapp";
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={checked}
              disabled={disabled}
              onCheckedChange={onCheckedChange}
              className={cn(tone === "zapp" && "data-[state=checked]:bg-emerald-600")}
            />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-xs max-w-[220px]">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
