import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Loader2, Trash2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaign: { id: string; name: string } | null;
  adAccountId: string;
}

interface AlertRule {
  id?: string;
  enabled: boolean;
  cpl_max: string;
  roas_min: string;
  ctr_min: string;
  frequency_max: string;
  spend_daily_max: string;
  cooldown_hours: number;
  date_preset: string;
}

const empty: AlertRule = {
  enabled: true, cpl_max: "", roas_min: "", ctr_min: "", frequency_max: "", spend_daily_max: "",
  cooldown_hours: 6, date_preset: "last_3d",
};

export function CampaignAlertsDialog({ open, onOpenChange, campaign, adAccountId }: Props) {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rule, setRule] = useState<AlertRule>(empty);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !campaign) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("meta_campaign_alerts")
        .select("*")
        .eq("campaign_id", campaign.id)
        .maybeSingle();
      if (data) {
        setRule({
          id: data.id,
          enabled: data.enabled,
          cpl_max: data.cpl_max?.toString() || "",
          roas_min: data.roas_min?.toString() || "",
          ctr_min: data.ctr_min?.toString() || "",
          frequency_max: data.frequency_max?.toString() || "",
          spend_daily_max: data.spend_daily_max?.toString() || "",
          cooldown_hours: data.cooldown_hours || 6,
          date_preset: data.date_preset || "last_3d",
        });
      } else {
        setRule(empty);
      }
      const { data: ev } = await supabase
        .from("meta_campaign_alert_events")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setEvents(ev || []);
      setLoading(false);
    })();
  }, [open, campaign]);

  if (!campaign) return null;

  const num = (v: string) => v.trim() === "" ? null : parseFloat(v.replace(",", "."));

  const save = async () => {
    if (!currentUser) { toast.error("Usuário não autenticado"); return; }
    setSaving(true);
    try {
      const payload: any = {
        account_id: currentUser.account_id,
        created_by: currentUser.auth_user_id,
        ad_account_id: adAccountId,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        enabled: rule.enabled,
        cpl_max: num(rule.cpl_max),
        roas_min: num(rule.roas_min),
        ctr_min: num(rule.ctr_min),
        frequency_max: num(rule.frequency_max),
        spend_daily_max: num(rule.spend_daily_max),
        cooldown_hours: rule.cooldown_hours,
        date_preset: rule.date_preset,
        notify_user_ids: [currentUser.auth_user_id],
      };
      const q = rule.id
        ? supabase.from("meta_campaign_alerts").update(payload).eq("id", rule.id)
        : supabase.from("meta_campaign_alerts").insert(payload);
      const { error } = await q;
      if (error) throw error;
      toast.success("Alerta salvo");
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!rule.id) return;
    if (!confirm("Remover regra de alerta?")) return;
    const { error } = await supabase.from("meta_campaign_alerts").delete().eq("id", rule.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Alerta removido");
    onOpenChange(false);
  };

  const testNow = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("meta-alerts-evaluator", { body: {} });
      if (error) throw error;
      toast.success("Avaliação executada");
    } catch (e: any) { toast.error(e.message || "Erro"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bell className="w-4 h-4" /> Alertas de Performance</DialogTitle>
        </DialogHeader>
        {loading ? <Skeleton className="h-64 w-full" /> : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground truncate">{campaign.name}</p>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
              <div>
                <p className="text-sm font-medium">Alerta ativo</p>
                <p className="text-xs text-muted-foreground">Avaliado a cada 30 minutos</p>
              </div>
              <Switch checked={rule.enabled} onCheckedChange={(v) => setRule({ ...rule, enabled: v })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPL máximo (R$)</Label>
                <Input type="number" step="0.01" value={rule.cpl_max} onChange={e => setRule({ ...rule, cpl_max: e.target.value })} placeholder="ex: 50" />
              </div>
              <div>
                <Label>ROAS mínimo</Label>
                <Input type="number" step="0.01" value={rule.roas_min} onChange={e => setRule({ ...rule, roas_min: e.target.value })} placeholder="ex: 2.0" />
              </div>
              <div>
                <Label>CTR mínimo (%)</Label>
                <Input type="number" step="0.01" value={rule.ctr_min} onChange={e => setRule({ ...rule, ctr_min: e.target.value })} placeholder="ex: 1.0" />
              </div>
              <div>
                <Label>Frequência máxima</Label>
                <Input type="number" step="0.1" value={rule.frequency_max} onChange={e => setRule({ ...rule, frequency_max: e.target.value })} placeholder="ex: 3.5" />
              </div>
              <div>
                <Label>Gasto máximo no período (R$)</Label>
                <Input type="number" step="0.01" value={rule.spend_daily_max} onChange={e => setRule({ ...rule, spend_daily_max: e.target.value })} placeholder="ex: 500" />
              </div>
              <div>
                <Label>Cooldown (h)</Label>
                <Input type="number" min="1" value={rule.cooldown_hours} onChange={e => setRule({ ...rule, cooldown_hours: parseInt(e.target.value) || 6 })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Deixe em branco os limiares que não quer monitorar. Você será notificado dentro do app quando houver violação.</p>

            {events.length > 0 && (
              <div className="pt-3 border-t border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico de disparos</p>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {events.map(ev => (
                    <div key={ev.id} className="text-xs p-2 rounded-md bg-muted/30 border border-border/30">
                      <p className="font-medium">{ev.message}</p>
                      <p className="text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex sm:justify-between gap-2">
          <div className="flex gap-2">
            {rule.id && (
              <Button variant="outline" size="sm" onClick={remove} className="text-destructive">
                <Trash2 className="w-3.5 h-3.5 mr-1" />Remover
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={testNow} disabled={saving}>Testar agora</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
