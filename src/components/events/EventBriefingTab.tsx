import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Target, Users, MessageSquare, TrendingUp, AlertTriangle, Truck, Shirt, FileText } from "lucide-react";

interface Props {
  eventId: string;
  accountId: string | null;
}

interface Briefing {
  id?: string;
  objective: string;
  target_audience: string;
  key_messages: string;
  success_metrics: string;
  risks: string;
  logistics: string;
  dress_code: string;
  additional_notes: string;
}

const EMPTY: Briefing = {
  objective: "",
  target_audience: "",
  key_messages: "",
  success_metrics: "",
  risks: "",
  logistics: "",
  dress_code: "",
  additional_notes: "",
};

const FIELDS: Array<{
  key: keyof Briefing;
  label: string;
  icon: any;
  placeholder: string;
  rows?: number;
}> = [
  { key: "objective", label: "Objetivo do evento", icon: Target, placeholder: "Qual o propósito principal? O que queremos alcançar?", rows: 3 },
  { key: "target_audience", label: "Público-alvo", icon: Users, placeholder: "Quem participará? Qual o perfil ideal?", rows: 3 },
  { key: "key_messages", label: "Mensagens-chave", icon: MessageSquare, placeholder: "O que precisa ser comunicado? Tópicos centrais.", rows: 4 },
  { key: "success_metrics", label: "Métricas de sucesso", icon: TrendingUp, placeholder: "Como mediremos o sucesso? NPS, presença, leads...", rows: 3 },
  { key: "risks", label: "Riscos e contingências", icon: AlertTriangle, placeholder: "O que pode dar errado? Plano B?", rows: 3 },
  { key: "logistics", label: "Logística", icon: Truck, placeholder: "Transporte, hospedagem, alimentação, equipamentos.", rows: 4 },
  { key: "dress_code", label: "Dress code", icon: Shirt, placeholder: "Traje recomendado para equipe e participantes.", rows: 2 },
  { key: "additional_notes", label: "Observações", icon: FileText, placeholder: "Qualquer detalhe adicional relevante.", rows: 3 },
];

export default function EventBriefingTab({ eventId, accountId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Briefing>(EMPTY);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoading(true);
      const { data: row } = await supabase
        .from("event_briefings")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle();
      if (row) {
        setData({
          id: row.id,
          objective: row.objective ?? "",
          target_audience: row.target_audience ?? "",
          key_messages: row.key_messages ?? "",
          success_metrics: row.success_metrics ?? "",
          risks: row.risks ?? "",
          logistics: row.logistics ?? "",
          dress_code: row.dress_code ?? "",
          additional_notes: row.additional_notes ?? "",
        });
      }
      setLoading(false);
    })();
  }, [eventId, accountId]);

  const handleSave = async () => {
    if (!accountId) return;
    setSaving(true);
    const payload = {
      event_id: eventId,
      account_id: accountId,
      objective: data.objective || null,
      target_audience: data.target_audience || null,
      key_messages: data.key_messages || null,
      success_metrics: data.success_metrics || null,
      risks: data.risks || null,
      logistics: data.logistics || null,
      dress_code: data.dress_code || null,
      additional_notes: data.additional_notes || null,
    };
    const { error } = await supabase
      .from("event_briefings")
      .upsert(payload, { onConflict: "event_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Briefing salvo" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Briefing & Visão Completa</h3>
          <p className="text-sm text-muted-foreground">
            Documento central do evento. Tudo que a equipe precisa saber antes da execução.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar briefing"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {FIELDS.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {f.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={data[f.key] as string}
                  onChange={(e) => setData((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={f.rows ?? 3}
                  className="resize-none"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
