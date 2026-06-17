import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EXIT_QUESTIONS = [
  { key: "real_reason", label: "Qual o motivo real da sua saída?" },
  { key: "what_worked", label: "O que funcionou bem na sua experiência aqui?" },
  { key: "what_failed", label: "O que poderíamos melhorar (gestão, processos, cultura)?" },
  { key: "leadership", label: "Como você avalia sua liderança direta?" },
  { key: "would_return", label: "Você voltaria a trabalhar conosco? Em que condições?" },
  { key: "recommend", label: "Recomendaria a empresa para um amigo?" },
];

export default function PublicExitInterview() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [offboarding, setOffboarding] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [nps, setNps] = useState(7);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("hr_offboardings" as any)
        .select("id, exit_interview, exit_nps, exit_interview_submitted_at, exit_interview_token")
        .eq("exit_interview_token", token as string)
        .maybeSingle();
      if (data) {
        setOffboarding(data);
        setAnswers((data as any).exit_interview || {});
        setNps((data as any).exit_nps ?? 7);
        setSubmitted(!!(data as any).exit_interview_submitted_at);
      }
      setLoading(false);
    })();
  }, [token]);

  async function submit() {
    const { error } = await supabase
      .from("hr_offboardings" as any)
      .update({
        exit_interview: answers,
        exit_nps: nps,
        exit_interview_submitted_at: new Date().toISOString(),
      } as any)
      .eq("exit_interview_token", token as string);
    if (error) return toast.error("Erro: " + error.message);
    setSubmitted(true);
    toast.success("Respostas enviadas. Obrigado!");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!offboarding) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Link inválido ou expirado.</div>;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-emerald-50 to-white">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Obrigado!</h1>
            <p className="text-muted-foreground">Suas respostas foram registradas. Desejamos sucesso na sua próxima jornada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Entrevista de Saída</h1>
          <p className="text-sm text-muted-foreground">Suas respostas são confidenciais e ajudam a empresa a melhorar.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <Label className="text-sm font-medium">De 0 a 10, o quanto você recomendaria a empresa como lugar para trabalhar?</Label>
              <div className="flex items-center gap-3 mt-3">
                <Slider value={[nps]} min={0} max={10} step={1} onValueChange={(v) => setNps(v[0])} className="flex-1" />
                <span className="text-3xl font-semibold w-12 text-right">{nps}</span>
              </div>
            </div>
            <Separator />
            {EXIT_QUESTIONS.map(q => (
              <div key={q.key}>
                <Label className="text-sm font-medium">{q.label}</Label>
                <Textarea rows={3} value={answers[q.key] || ""} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })} className="mt-1.5" />
              </div>
            ))}
            <Button onClick={submit} className="w-full" size="lg">Enviar respostas</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
