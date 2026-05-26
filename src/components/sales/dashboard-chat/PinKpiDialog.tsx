import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kpi: { label: string; value: number; value_text?: string; unit?: string | null; comparison?: string; trend?: string };
  question: string;
  onPinned?: () => void;
}

const COLORS = ["blue", "emerald", "amber", "purple", "rose", "cyan"];

export function PinKpiDialog({ open, onOpenChange, kpi, question, onPinned }: Props) {
  const [label, setLabel] = useState(kpi.label);
  const [color, setColor] = useState("blue");
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("no auth");
      const { data: u } = await supabase.from("users").select("account_id").eq("auth_user_id", user.id).maybeSingle();
      if (!u?.account_id) throw new Error("no account");
      const { error } = await supabase.from("sales_dashboard_pinned_kpis").insert({
        account_id: u.account_id,
        auth_user_id: user.id,
        label,
        color,
        unit: kpi.unit ?? null,
        question,
        last_value: kpi.value,
        last_value_text: kpi.value_text ?? null,
        last_comparison: kpi.comparison ?? null,
        last_trend: kpi.trend ?? null,
        last_computed_at: new Date().toISOString(),
        is_shared: shared,
      });
      if (error) throw error;
      onPinned?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao fixar KPI");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fixar KPI no Dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rótulo</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <Label>Cor</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLORS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Compartilhar com a equipe</Label>
              <p className="text-xs text-muted-foreground">Outros gestores verão este KPI.</p>
            </div>
            <Switch checked={shared} onCheckedChange={setShared} />
          </div>
          <div className="p-3 rounded-md bg-muted text-sm">
            <p className="text-xs text-muted-foreground">Valor atual</p>
            <p className="text-xl font-bold">{kpi.value_text ?? kpi.value}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !label.trim()}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Fixar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
