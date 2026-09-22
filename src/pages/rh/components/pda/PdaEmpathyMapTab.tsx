import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { EMPATHY_QUESTIONS, pronounsFor } from "@/lib/rh/pdaContent";

type MapRow = Record<string, any>;

export default function PdaEmpathyMapTab({
  personId,
  accountId,
  sourceTable = "hr_collaborators",
  gender,
}: {
  personId: string;
  accountId?: string | null;
  sourceTable?: string;
  gender?: string | null;
}) {
  const { currentUser } = useCurrentUser();
  const [row, setRow] = useState<MapRow>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const p = pronounsFor(gender);

  const fetchMap = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hr_pda_empathy_maps")
      .select("*")
      .eq("person_id", personId)
      .maybeSingle();
    setRow(data || {});
    setLoading(false);
  }, [personId]);

  useEffect(() => { fetchMap(); }, [fetchMap]);

  const set = (key: string, value: string) => setRow(r => ({ ...r, [key]: value }));

  const save = async () => {
    setSaving(true);
    const payload: MapRow = {
      account_id: accountId,
      person_id: personId,
      source_table: sourceTable,
      updated_by: currentUser?.id || null,
    };
    EMPATHY_QUESTIONS.forEach(q => {
      payload[`angel_${q.key}`] = row[`angel_${q.key}`] || null;
      payload[`mgmt_${q.key}`] = row[`mgmt_${q.key}`] || null;
    });
    const { error } = await supabase
      .from("hr_pda_empathy_maps")
      .upsert(payload as any, { onConflict: "person_id" });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar o mapa de empatia"); return; }
    toast.success("Mapa de empatia salvo");
    fetchMap();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Resposta do Anjo e visão da gestão, lado a lado.</p>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {EMPATHY_QUESTIONS.map(q => (
        <Card key={q.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{q.question(p)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Resposta do Anjo</p>
              <Textarea rows={3} value={row[`angel_${q.key}`] || ""} onChange={(e) => set(`angel_${q.key}`, e.target.value)} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Visão da gestão</p>
              <Textarea rows={3} value={row[`mgmt_${q.key}`] || ""} onChange={(e) => set(`mgmt_${q.key}`, e.target.value)} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
