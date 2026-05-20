import { useState, useEffect } from "react";
import { Talent, useStrategy, useUpsertStrategy, callContentHQAI } from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Save, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function ContentHQStrategy({ talent }: { talent: Talent }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const { data: strategy } = useStrategy(talent.id, year, quarter);
  const upsert = useUpsertStrategy();
  const [aiLoading, setAiLoading] = useState(false);

  const [form, setForm] = useState({
    positioning: "",
    audience: "",
    tone: "",
    goals: "",
    big_bets: "",
  });

  useEffect(() => {
    setForm({
      positioning: strategy?.positioning || "",
      audience: strategy?.audience || "",
      tone: strategy?.tone || "",
      goals: Array.isArray(strategy?.goals) ? (strategy?.goals as string[]).join("\n") : "",
      big_bets: Array.isArray(strategy?.big_bets) ? (strategy?.big_bets as string[]).join("\n") : "",
    });
  }, [strategy?.id]);

  const handleSave = () => {
    upsert.mutate({
      id: strategy?.id,
      talent_id: talent.id,
      year, quarter,
      positioning: form.positioning,
      audience: form.audience,
      tone: form.tone,
      goals: form.goals.split("\n").filter(Boolean),
      big_bets: form.big_bets.split("\n").filter(Boolean),
    } as any);
  };

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const r = await callContentHQAI("generate_strategy", talent, { year, quarter, objective: "gerar leads qualificados de profissionais de estética interessados em mentoria de vendas, marketing, gestão e precificação" });
      setForm({
        positioning: r.positioning || "",
        audience: r.audience || "",
        tone: r.tone || "",
        goals: (r.goals || []).join("\n"),
        big_bets: (r.big_bets || []).join("\n"),
      });
      toast({ title: "Estratégia gerada", description: "Revise e salve." });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Estratégia trimestral — {talent.name}</h2>
          <p className="text-sm text-muted-foreground">Por que fazer. Posicionamento e direção do trimestre.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{[1,2,3,4].map(q => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" />
          <Button variant="outline" onClick={handleAI} disabled={aiLoading} className="gap-2">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar com IA
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        <Field label="Posicionamento" value={form.positioning} onChange={(v) => setForm({...form, positioning: v})} multiline />
        <Field label="Público-alvo (avatar)" value={form.audience} onChange={(v) => setForm({...form, audience: v})} multiline />
        <Field label="Tom de voz" value={form.tone} onChange={(v) => setForm({...form, tone: v})} multiline />
        <Field label="Objetivos (1 por linha)" value={form.goals} onChange={(v) => setForm({...form, goals: v})} multiline />
        <Field label="Big bets do trimestre (1 por linha)" value={form.big_bets} onChange={(v) => setForm({...form, big_bets: v})} multiline />
      </div>

      <Button onClick={handleSave} disabled={upsert.isPending} className="gap-2">
        <Save className="h-4 w-4" /> Salvar estratégia
      </Button>
    </Card>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {multiline
        ? <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
        : <Input value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}
