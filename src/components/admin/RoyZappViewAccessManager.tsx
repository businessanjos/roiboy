import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import type { ZappView } from "@/lib/royZappRoutes";
import {
  ALL_ZAPP_VIEWS,
  DEFAULT_ZAPP_VIEWS,
  ZAPP_VIEW_LABELS,
  ZAPP_SECTOR_LABELS,
  ZAPP_WHATSAPP_SECTORS,
  canPickSector,
  sanitizeViewList,
  sanitizeZappSectorList,
  type ZappWhatsAppSector,
} from "@/lib/royZappAccess";

interface Props {
  userId: string;
  accountId: string;
  email?: string | null;
  isAccountAdmin?: boolean;
}

interface AccessRow {
  views: ZappView[];
  zappSectors: ZappWhatsAppSector[] | null;
}

/**
 * Acesso do usuário DENTRO do ROY zAPP — independente do acesso geral ao setor.
 * Ex.: liberar o pipeline Comercial sem liberar o WhatsApp do Comercial.
 */
export function RoyZappViewAccessManager({ userId, accountId, email, isAccountAdmin }: Props) {
  const unrestricted = canPickSector(email) || isAccountAdmin;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-royzapp-views", userId, accountId],
    enabled: !!userId && !!accountId && !unrestricted,
    queryFn: async (): Promise<AccessRow | null> => {
      const { data, error } = await (supabase as any)
        .from("user_royzapp_views")
        .select("views, zapp_sectors")
        .eq("account_id", accountId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        views: sanitizeViewList(data.views),
        zappSectors:
          data.zapp_sectors === null || data.zapp_sectors === undefined
            ? null
            : sanitizeZappSectorList(data.zapp_sectors),
      };
    },
  });

  const [selected, setSelected] = useState<ZappView[]>(DEFAULT_ZAPP_VIEWS);
  const [restrictSectors, setRestrictSectors] = useState(false);
  const [zappSectors, setZappSectors] = useState<ZappWhatsAppSector[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setSelected(data?.views?.length ? data.views : DEFAULT_ZAPP_VIEWS);
    setRestrictSectors(Array.isArray(data?.zappSectors));
    setZappSectors(data?.zappSectors ?? []);
    setDirty(false);
  }, [data, isLoading]);

  if (unrestricted) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        Acesso total ao ROY zAPP (admin / seleção de setores liberada).
      </div>
    );
  }

  const toggleView = (view: ZappView, checked: boolean) => {
    if (view === "inbox") return; // Conversas é obrigatória
    setSelected((prev) => (checked ? [...prev, view] : prev.filter((v) => v !== view)));
    setDirty(true);
  };

  const toggleSector = (sector: ZappWhatsAppSector, checked: boolean) => {
    setZappSectors((prev) => (checked ? [...prev, sector] : prev.filter((s) => s !== sector)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const views = ALL_ZAPP_VIEWS.filter((v) => v === "inbox" || selected.includes(v));
      const { error } = await (supabase as any).from("user_royzapp_views").upsert(
        {
          account_id: accountId,
          user_id: userId,
          views,
          zapp_sectors: restrictSectors
            ? ZAPP_WHATSAPP_SECTORS.filter((s) => zappSectors.includes(s))
            : null,
        },
        { onConflict: "account_id,user_id" }
      );
      if (error) throw error;
      toast.success("Acesso ao ROY zAPP atualizado");
      setDirty(false);
      await refetch();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar acesso ao ROY zAPP");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            Acesso dentro do ROY zAPP
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Independente do acesso ao setor. Ex.: pode ver o pipeline de Vendas e continuar sem o WhatsApp de Vendas.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Salvar ROY zAPP
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-3">
          {/* WhatsApps de setor liberados no RoyZapp */}
          <div className="rounded-md border p-2.5 space-y-2 bg-muted/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium">WhatsApp por setor (só no ROY zAPP)</p>
                <p className="text-[11px] text-muted-foreground">
                  {restrictSectors
                    ? "Só os setores marcados abaixo abrem no ROY zAPP."
                    : "Herdando os setores gerais do usuário. Ative para restringir apenas o ROY zAPP."}
                </p>
              </div>
              <Switch
                checked={restrictSectors}
                onCheckedChange={(v) => {
                  setRestrictSectors(v);
                  setDirty(true);
                }}
              />
            </div>
            {restrictSectors && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ZAPP_WHATSAPP_SECTORS.map((sector) => (
                  <label
                    key={sector}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer bg-background"
                  >
                    <Checkbox
                      checked={zappSectors.includes(sector)}
                      onCheckedChange={(v) => toggleSector(sector, v === true)}
                    />
                    <span className="truncate">{ZAPP_SECTOR_LABELS[sector]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Telas internas */}
          <div className="space-y-2">
            <p className="text-xs font-medium">Telas do ROY zAPP</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {ALL_ZAPP_VIEWS.map((view) => (
                <label
                  key={view}
                  className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer bg-muted/20"
                >
                  <Checkbox
                    checked={view === "inbox" ? true : selected.includes(view)}
                    disabled={view === "inbox"}
                    onCheckedChange={(v) => toggleView(view, v === true)}
                  />
                  <span className="truncate">{ZAPP_VIEW_LABELS[view]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
