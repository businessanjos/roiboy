import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import type { ZappView } from "@/lib/royZappRoutes";
import {
  ALL_ZAPP_VIEWS,
  DEFAULT_ZAPP_VIEWS,
  ZAPP_VIEW_LABELS,
  canPickSector,
  sanitizeViewList,
} from "@/lib/royZappAccess";

interface Props {
  userId: string;
  accountId: string;
  email?: string | null;
  isAccountAdmin?: boolean;
}

/** Seleção das telas do RoyZapp liberadas para um usuário. */
export function RoyZappViewAccessManager({ userId, accountId, email, isAccountAdmin }: Props) {
  const unrestricted = canPickSector(email) || isAccountAdmin;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-royzapp-views", userId, accountId],
    enabled: !!userId && !!accountId && !unrestricted,
    queryFn: async (): Promise<ZappView[] | null> => {
      const { data, error } = await (supabase as any)
        .from("user_royzapp_views")
        .select("views")
        .eq("account_id", accountId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? sanitizeViewList(data.views) : null;
    },
  });

  const [selected, setSelected] = useState<ZappView[]>(DEFAULT_ZAPP_VIEWS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setSelected(data ?? DEFAULT_ZAPP_VIEWS);
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

  const toggle = (view: ZappView, checked: boolean) => {
    if (view === "inbox") return; // Conversas é obrigatória
    setSelected((prev) => (checked ? [...prev, view] : prev.filter((v) => v !== view)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const views = ALL_ZAPP_VIEWS.filter((v) => v === "inbox" || selected.includes(v));
      const { error } = await (supabase as any)
        .from("user_royzapp_views")
        .upsert({ account_id: accountId, user_id: userId, views }, { onConflict: "account_id,user_id" });
      if (error) throw error;
      toast.success("Telas do ROY zAPP atualizadas");
      setDirty(false);
      await refetch();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar telas do ROY zAPP");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            2. Telas dentro do ROY zAPP
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Vale para os setores liberados no passo 1 — não dá acesso a setor nenhum.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Salvar telas
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {ALL_ZAPP_VIEWS.map((view) => (
            <label
              key={view}
              className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer bg-muted/20"
            >
              <Checkbox
                checked={view === "inbox" ? true : selected.includes(view)}
                disabled={view === "inbox"}
                onCheckedChange={(v) => toggle(view, v === true)}
              />
              <span className="truncate">{ZAPP_VIEW_LABELS[view]}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
