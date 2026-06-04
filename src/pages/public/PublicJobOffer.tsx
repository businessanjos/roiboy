import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Sparkles, MapPin, Briefcase, Calendar, DollarSign, Gift, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { WORK_MODEL_LABELS, CONTRACT_TYPE_LABELS, JOB_SENIORITY_LABELS } from "@/constants/jobOptions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Offer = {
  id: string;
  public_token: string;
  candidate_name: string;
  position_title: string;
  department: string | null;
  seniority: string | null;
  work_model: string | null;
  contract_type: string | null;
  unit: string | null;
  reports_to: string | null;
  salary_amount: number | null;
  salary_currency: string;
  salary_note: string | null;
  variable_compensation: string | null;
  benefits: string[];
  perks: { title: string; description: string }[];
  start_date: string | null;
  offer_expires_at: string | null;
  hero_headline: string | null;
  company_intro: string | null;
  role_pitch: string | null;
  next_steps: string | null;
  signer_name: string | null;
  signer_role: string | null;
  accent_color: string;
  cover_image_url: string | null;
  status: string;
  responded_at: string | null;
  first_viewed_at: string | null;
  view_count: number;
};

export default function PublicJobOffer() {
  const { token } = useParams();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [response, setResponse] = useState<"accept" | "decline" | null>(null);
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data } = await supabase
        .from("hr_job_offers")
        .select("*")
        .eq("public_token", token)
        .maybeSingle();
      if (data) {
        setOffer(data as any);
        // registrar visualização
        if (!data.first_viewed_at || data.status === "sent") {
          await supabase
            .from("hr_job_offers")
            .update({
              first_viewed_at: data.first_viewed_at || new Date().toISOString(),
              view_count: (data.view_count || 0) + 1,
              status: data.status === "sent" ? "viewed" : data.status,
            })
            .eq("public_token", token);
        }
      }
      setLoading(false);
    })();
  }, [token]);

  const respond = async (status: "accepted" | "declined") => {
    if (!offer) return;
    setResponding(true);
    const { error } = await supabase
      .from("hr_job_offers")
      .update({
        status,
        responded_at: new Date().toISOString(),
        response_message: message || null,
      })
      .eq("public_token", offer.public_token);
    if (error) {
      toast({ title: "Erro ao registrar resposta", description: error.message, variant: "destructive" });
    } else {
      setOffer({ ...offer, status, responded_at: new Date().toISOString() });
    }
    setResponding(false);
    setResponse(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md space-y-3">
          <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold">Offer não encontrada</h1>
          <p className="text-sm text-muted-foreground">O link expirou ou foi removido. Entre em contato com o responsável pela vaga.</p>
        </div>
      </div>
    );
  }

  const accent = offer.accent_color || "#6366F1";
  const isResolved = offer.status === "accepted" || offer.status === "declined";

  const formatMoney = (v: number) => {
    const symbols: Record<string, string> = { BRL: "R$", USD: "$", EUR: "€" };
    return `${symbols[offer.salary_currency] || offer.salary_currency} ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero */}
      <div
        className="relative text-white"
        style={{
          background: offer.cover_image_url
            ? `linear-gradient(135deg, ${accent}EE, ${accent}AA), url(${offer.cover_image_url}) center/cover`
            : `linear-gradient(135deg, ${accent}, ${accent}99)`,
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-90 mb-4">
            <Sparkles className="h-4 w-4" />
            <span>Carta-Proposta · Eternum</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">
            {offer.hero_headline || `${offer.candidate_name}, esta proposta é para você.`}
          </h1>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm">{offer.position_title}</span>
            {offer.department && <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm">{offer.department}</span>}
            {offer.seniority && <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm">{JOB_SENIORITY_LABELS[offer.seniority as keyof typeof JOB_SENIORITY_LABELS] || offer.seniority}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {/* Sobre a empresa */}
        {offer.company_intro && (
          <section>
            <h2 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: accent }}>
              Sobre a Eternum
            </h2>
            <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-line text-foreground/80 leading-relaxed">
              {offer.company_intro}
            </div>
          </section>
        )}

        {/* Sobre a vaga */}
        {offer.role_pitch && (
          <section>
            <h2 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: accent }}>
              Sobre a vaga
            </h2>
            <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-line text-foreground/80 leading-relaxed">
              {offer.role_pitch}
            </div>
          </section>
        )}

        {/* Detalhes da posição */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {offer.work_model && (
            <DetailCard icon={<Briefcase className="h-4 w-4" />} label="Modelo" value={WORK_MODEL_LABELS[offer.work_model as keyof typeof WORK_MODEL_LABELS]} accent={accent} />
          )}
          {offer.contract_type && (
            <DetailCard icon={<Briefcase className="h-4 w-4" />} label="Contratação" value={CONTRACT_TYPE_LABELS[offer.contract_type as keyof typeof CONTRACT_TYPE_LABELS]} accent={accent} />
          )}
          {offer.unit && (
            <DetailCard icon={<MapPin className="h-4 w-4" />} label="Local" value={offer.unit} accent={accent} />
          )}
          {offer.reports_to && (
            <DetailCard icon={<Briefcase className="h-4 w-4" />} label="Reporta-se a" value={offer.reports_to} accent={accent} />
          )}
          {offer.start_date && (
            <DetailCard icon={<Calendar className="h-4 w-4" />} label="Início previsto" value={format(new Date(offer.start_date + "T00:00:00"), "dd 'de' MMMM, yyyy", { locale: ptBR })} accent={accent} />
          )}
          {offer.offer_expires_at && (
            <DetailCard icon={<Calendar className="h-4 w-4" />} label="Validade da proposta" value={format(new Date(offer.offer_expires_at + "T00:00:00"), "dd 'de' MMMM, yyyy", { locale: ptBR })} accent={accent} />
          )}
        </section>

        {/* Remuneração */}
        {(offer.salary_amount || offer.variable_compensation) && (
          <section className="rounded-2xl p-8 text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}CC)` }}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-90 mb-3">
              <DollarSign className="h-4 w-4" /> Remuneração
            </div>
            {offer.salary_amount && (
              <div>
                <p className="text-4xl md:text-5xl font-bold">{formatMoney(Number(offer.salary_amount))}</p>
                <p className="text-sm opacity-80 mt-1">salário mensal {offer.salary_note && `· ${offer.salary_note}`}</p>
              </div>
            )}
            {offer.variable_compensation && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-xs uppercase tracking-wider opacity-80 mb-1">Variável</p>
                <p className="text-sm whitespace-pre-line">{offer.variable_compensation}</p>
              </div>
            )}
          </section>
        )}

        {/* Benefícios */}
        {offer.benefits.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: accent }}>
              Benefícios
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {offer.benefits.map((b) => (
                <div key={b} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-900 border">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: accent }} />
                  <span className="text-sm">{b}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Perks */}
        {offer.perks?.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-widest font-semibold mb-4 flex items-center gap-2" style={{ color: accent }}>
              <Gift className="h-4 w-4" /> Perks especiais
            </h2>
            <div className="space-y-3">
              {offer.perks.map((p, i) => (
                <div key={i} className="p-4 rounded-xl border bg-white dark:bg-slate-900">
                  <p className="font-semibold">{p.title}</p>
                  {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Próximos passos */}
        {offer.next_steps && (
          <section>
            <h2 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: accent }}>
              Próximos passos
            </h2>
            <div className="whitespace-pre-line text-foreground/80 leading-relaxed">{offer.next_steps}</div>
          </section>
        )}

        {/* Assinatura */}
        {(offer.signer_name || offer.signer_role) && (
          <section className="pt-6 border-t">
            <p className="text-sm text-muted-foreground">Com carinho,</p>
            <p className="font-semibold mt-1">{offer.signer_name}</p>
            {offer.signer_role && <p className="text-sm text-muted-foreground">{offer.signer_role} · Eternum</p>}
          </section>
        )}

        {/* CTA */}
        {!isResolved ? (
          <section className="sticky bottom-4 z-10">
            {response === null ? (
              <div className="rounded-2xl border-2 p-6 bg-white dark:bg-slate-900 shadow-xl space-y-4" style={{ borderColor: accent }}>
                <div>
                  <h3 className="font-semibold text-lg">Pronto para responder?</h3>
                  <p className="text-sm text-muted-foreground">Esta resposta será registrada e enviada para nosso time.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => setResponse("accept")} className="flex-1 gap-2 text-base h-12" style={{ background: accent }}>
                    <CheckCircle2 className="h-5 w-5" /> Aceitar oferta
                  </Button>
                  <Button onClick={() => setResponse("decline")} variant="outline" className="flex-1 gap-2 h-12">
                    <XCircle className="h-5 w-5" /> Recusar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 p-6 bg-white dark:bg-slate-900 shadow-xl space-y-4" style={{ borderColor: accent }}>
                <h3 className="font-semibold text-lg">
                  {response === "accept" ? "Bem-vindo(a) à Eternum! 🎉" : "Tudo bem, agradecemos sua sinceridade."}
                </h3>
                <Textarea
                  placeholder={response === "accept" ? "Deixe uma mensagem para o time (opcional)..." : "Conte rapidamente o motivo (opcional)..."}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setResponse(null)} disabled={responding}>Voltar</Button>
                  <Button
                    onClick={() => respond(response === "accept" ? "accepted" : "declined")}
                    disabled={responding}
                    className="flex-1 gap-2"
                    style={response === "accept" ? { background: accent } : undefined}
                    variant={response === "decline" ? "destructive" : "default"}
                  >
                    {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Confirmar resposta
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl p-8 text-center border-2 bg-white dark:bg-slate-900" style={{ borderColor: accent }}>
            {offer.status === "accepted" ? (
              <>
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3" style={{ color: accent }} />
                <h3 className="text-xl font-semibold">Proposta aceita! 🎉</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Recebemos sua resposta {offer.responded_at && `em ${format(new Date(offer.responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}. Nosso time entrará em contato em breve.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-xl font-semibold">Proposta recusada</h3>
                <p className="text-sm text-muted-foreground mt-2">Obrigado por considerar a oportunidade. Desejamos sucesso na sua jornada!</p>
              </>
            )}
          </section>
        )}

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Eternum · Carta-Proposta confidencial
        </footer>
      </div>
    </div>
  );
}

function DetailCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="p-4 rounded-xl border bg-white dark:bg-slate-900 flex items-start gap-3">
      <div className="p-2 rounded-lg" style={{ background: `${accent}15`, color: accent }}>{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-medium text-sm mt-0.5">{value}</p>
      </div>
    </div>
  );
}
