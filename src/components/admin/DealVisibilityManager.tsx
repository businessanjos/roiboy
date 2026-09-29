import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  accountId: string;
  isAccountAdmin?: boolean;
}

type Flags = { can_view_open: boolean; can_view_won: boolean; can_view_lost: boolean };
const EMPTY: Flags = { can_view_open: false, can_view_won: false, can_view_lost: false };

const OPTIONS: { key: keyof Flags; label: string }[] = [
  { key: "can_view_open", label: "Ver negócios abertos de toda a equipe" },
  { key: "can_view_won", label: "Ver negócios ganhos de toda a equipe" },
  { key: "can_view_lost", label: "Ver negócios perdidos de toda a equipe" },
];

/** Liberação, pelo gestor, de negócios que não são do próprio usuário. */
export function DealVisibilityManager({ userId, accountId, isAccountAdmin }: Props) {
  const qc = useQueryClient();
  const [flags, setFlags] = useState<Flags>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["deal-visibility", accountId, userId],
    enabled: !!userId && !!accountId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_deal_visibility")
        .select("can_view_open, can_view_won, can_view_lost")
        .eq("account_id", accountId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as Flags) ?? EMPTY;
    },
  });

  useEffect(() => {
    if (data) setFlags(data);
  }, [data]);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("user_deal_visibility")
      .upsert({ account_id: accountId, user_id: userId, ...flags }, { onConflict: "account_id,user_id" });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar. Só gestores podem alterar essa liberação.");
      return;
    }
    toast.success("Visibilidade de negócios atualizada");
    qc.invalidateQueries({ queryKey: ["deal-visibility", accountId, userId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Visibilidade de negócios</h4>
      </div>
      {isAccountAdmin ? (
        <p className="text-xs text-muted-foreground">Administradores já veem todos os negócios.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Por padrão, a pessoa vê só os negócios em que é responsável, SDR ou responsável pela renovação.
          </p>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="space-y-2">
              {OPTIONS.map((o) => (
                <div key={o.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <Label htmlFor={`dv-${o.key}`} className="text-sm font-normal">{o.label}</Label>
                  <Switch
                    id={`dv-${o.key}`}
                    checked={flags[o.key]}
                    onCheckedChange={(v) => setFlags((f) => ({ ...f, [o.key]: v }))}
                  />
                </div>
              ))}
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar visibilidade
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
