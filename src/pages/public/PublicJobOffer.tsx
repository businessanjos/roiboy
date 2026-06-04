import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle, MapPin, Briefcase, Calendar, Gift, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { WORK_MODEL_LABELS, CONTRACT_TYPE_LABELS, JOB_SENIORITY_LABELS } from "@/constants/jobOptions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import letreiro from "@/assets/eternum/letreiro.png.asset.json";
import everBru from "@/assets/eternum/ever-bru.png.asset.json";
import clientesFoto from "@/assets/eternum/clientes.jpg.asset.json";

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
  success_metrics: { label: string; target: string; horizon: string }[];
  start_date: string | null;
  offer_expires_at: string | null;
  hero_headline: string | null;
  company_intro: string | null;
  role_pitch: string | null;
  next_steps: string | null;
  signer_name: string | null;
  signer_role: string | null;
  status: string;
  responded_at: string | null;
  first_viewed_at: string | null;
  view_count: number;
  candidate_photo_url: string | null;
};

// Paleta Eternum
const BG = "#2a1b0f";
const BG_DEEP = "#1d1208";
const CARD = "#ede6cb";
const TEXT_DARK = "#3b2510";
const GOLD = "#c9a86a";
const GOLD_SOFT = "#d7b46a";

const SANS = "'Montserrat', system-ui, sans-serif";
const SERIF = "'Merriweather', Georgia, serif";

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
      const { data } = await supabase.from("hr_job_offers").select("*").eq("public_token", token).maybeSingle();
      if (data) {
        setOffer(data as any);
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
      .update({ status, responded_at: new Date().toISOString(), response_message: message || null })
      .eq("public_token", offer.public_token);
    if (error) toast({ title: "Erro ao registrar resposta", description: error.message, variant: "destructive" });
    else setOffer({ ...offer, status, responded_at: new Date().toISOString() });
    setResponding(false);
    setResponse(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG, fontFamily: SANS }}>
        <div className="text-center max-w-md space-y-3" style={{ color: CARD }}>
          <XCircle className="h-12 w-12 mx-auto opacity-60" />
          <h1 className="text-xl font-semibold" style={{ fontFamily: SERIF }}>Offer não encontrada</h1>
          <p className="text-sm opacity-70">O link expirou ou foi removido.</p>
        </div>
      </div>
    );
  }

  const isResolved = offer.status === "accepted" || offer.status === "declined";
  const firstName = (offer.candidate_name || "").split(" ")[0] || offer.candidate_name;

  // Heurística simples de gênero pelo primeiro nome (pt-BR)
  const guessGender = (name: string): "f" | "m" => {
    const n = (name || "").toLowerCase().trim();
    if (!n) return "m";
    const maleExceptions = ["luca", "costa", "kostya", "joshua", "elias", "tobias", "matias", "matheus", "lucas", "thomas", "andrea", "noah"];
    const femaleExceptions = ["beatriz", "isis", "ines", "inês", "carmen", "miriam", "raquel", "esther", "ester", "abigail", "rute", "ruth", "agar"];
    if (femaleExceptions.includes(n)) return "f";
    if (maleExceptions.includes(n)) return "m";
    if (/(a|ah|ce|ene|isa|ine|elle|ette)$/.test(n)) return "f";
    return "m";
  };
  const gender = guessGender(firstName);
  const pronto = gender === "f" ? "pronta" : "pronto";

  const formatMoney = (v: number) => {
    const symbols: Record<string, string> = { BRL: "R$", USD: "$", EUR: "€" };
    return `${symbols[offer.salary_currency] || offer.salary_currency} ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background: BG,
        color: CARD,
        fontFamily: SANS,
        backgroundImage: `radial-gradient(circle at 20% 0%, ${GOLD}15, transparent 50%), radial-gradient(circle at 80% 100%, ${GOLD}10, transparent 50%)`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* HERO */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${BG_DEEP} 0%, ${BG} 100%)` }}>
        {/* textura sutil */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(${GOLD} 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-10 pb-14 sm:pt-12 sm:pb-16 md:pt-16 md:pb-24">
          {/* Logo */}
          <div className="flex justify-center mb-8 sm:mb-10">
            <img src={letreiro.url} alt="Eternum" className="h-6 sm:h-7 md:h-9 object-contain opacity-95" />
          </div>

          {offer.candidate_photo_url ? (
            // Hero personalizado com foto do candidato
            <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 sm:gap-12 md:gap-12 items-center">
              <div className="order-2 md:order-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 sm:gap-4 mb-5 sm:mb-6">
                  <span className="h-px w-8 sm:w-10" style={{ background: GOLD }} />
                  <span
                    className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] font-light"
                    style={{ color: GOLD, fontFamily: SANS }}
                  >
                    Carta-Proposta · Confidencial
                  </span>
                </div>
                <p
                  className="text-xs sm:text-sm md:text-base uppercase tracking-[0.25em] sm:tracking-[0.3em] mb-3 sm:mb-4"
                  style={{ color: GOLD, fontFamily: SANS, fontWeight: 500 }}
                >
                  Para {firstName}
                </p>
                <h1
                  className="text-[28px] leading-[1.1] sm:text-4xl md:text-5xl lg:text-6xl"
                  style={{ fontFamily: SERIF, color: CARD, fontWeight: 300, letterSpacing: "-0.01em" }}
                >
                  {offer.hero_headline || `Bem-${gender === "f" ? "vinda" : "vindo"} à sua nova jornada.`}
                </h1>
                <p
                  className="mt-5 sm:mt-6 text-[15px] sm:text-base md:text-lg max-w-xl mx-auto md:mx-0 leading-relaxed"
                  style={{ color: "#e8dcc0", fontFamily: SERIF, fontWeight: 300, fontStyle: "italic", opacity: 0.85 }}
                >
                  Esta é a sua cadeira na Eternum — feita sob medida, com o seu nome.
                </p>
              </div>
              <div className="order-1 md:order-2 relative px-2 sm:px-0">
                {/* moldura dourada premium */}
                <div
                  className="relative mx-auto aspect-[4/5] w-full max-w-[280px] sm:max-w-sm rounded-sm overflow-hidden"
                  style={{
                    boxShadow: `0 40px 100px -30px rgba(0,0,0,0.85), 0 0 0 1px ${GOLD}66, 0 0 60px ${GOLD}22`,
                  }}
                >
                  <img
                    src={offer.candidate_photo_url}
                    alt={offer.candidate_name}
                    className="w-full h-full object-cover object-top"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `linear-gradient(180deg, transparent 55%, ${BG_DEEP}66 100%)` }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-5 py-3 sm:py-4" style={{ background: `linear-gradient(0deg, ${BG_DEEP}f5, transparent)` }}>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.35em]" style={{ color: GOLD }}>Eternum · Time</p>
                    <p className="text-base sm:text-lg md:text-xl mt-1" style={{ fontFamily: SERIF, color: CARD, fontWeight: 400 }}>
                      {offer.candidate_name}
                    </p>
                  </div>
                </div>
                {/* ornamento dourado */}
                <div className="absolute -top-2 -left-0 sm:-top-3 sm:-left-3 w-10 h-10 sm:w-12 sm:h-12 border-t-2 border-l-2 pointer-events-none" style={{ borderColor: GOLD }} />
                <div className="absolute -bottom-2 -right-0 sm:-bottom-3 sm:-right-3 w-10 h-10 sm:w-12 sm:h-12 border-b-2 border-r-2 pointer-events-none" style={{ borderColor: GOLD }} />
              </div>
            </div>
          ) : (
            <>
              {/* Linha dourada + tag */}
              <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <span className="h-px w-10 sm:w-12" style={{ background: GOLD }} />
                <span
                  className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] font-light"
                  style={{ color: GOLD, fontFamily: SANS }}
                >
                  Carta-Proposta · Confidencial
                </span>
                <span className="h-px w-10 sm:w-12" style={{ background: GOLD }} />
              </div>

              <h1
                className="text-center text-[30px] leading-[1.15] sm:text-4xl md:text-5xl lg:text-6xl max-w-3xl mx-auto pb-4"
                style={{ fontFamily: SERIF, color: CARD, fontWeight: 300, letterSpacing: "-0.01em" }}
              >
                {offer.hero_headline || `Uma jornada feita para quem busca o extraordinário.`}
              </h1>
            </>
          )}
        </div>
      </header>

      {/* CORPO */}
      <main className="max-w-4xl mx-auto px-5 sm:px-6 py-12 sm:py-16 md:py-24 space-y-12 sm:space-y-16 md:space-y-20">
        {/* SOBRE A ETERNUM */}
        <section>
          <SectionLabel>A Eternum</SectionLabel>
          <div className="grid md:grid-cols-5 gap-8 items-center">
            <div className="md:col-span-3 space-y-5">
              {(offer.company_intro || DEFAULT_COMPANY_INTRO).split("\n").filter(Boolean).map((p, i) => (
                <p
                  key={i}
                  className="text-[15px] md:text-base leading-relaxed"
                  style={{ fontFamily: SERIF, color: "#e8dcc0", fontWeight: 300 }}
                >
                  {p}
                </p>
              ))}
            </div>
            <div className="md:col-span-2">
              <div
                className="relative rounded-sm overflow-hidden"
                style={{ boxShadow: `0 20px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px ${GOLD}30` }}
              >
                <img src={everBru.url} alt="Fundadores da Eternum" className="w-full h-auto block" />
                <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(180deg, transparent 60%, ${BG_DEEP}cc)` }} />
                <div className="absolute bottom-3 left-4 right-4" style={{ color: CARD }}>
                  <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD }}>Fundadores</p>
                  <p className="text-sm mt-1" style={{ fontFamily: SERIF }}>Ever & Bruna</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* O CONVITE / VAGA */}
        <section>
          <SectionLabel>O convite</SectionLabel>
          <Card>
            <p
              className="text-sm uppercase tracking-[0.3em] mb-4"
              style={{ color: GOLD, fontFamily: SANS, fontWeight: 600 }}
            >
              {offer.position_title}
            </p>
            <div className="space-y-4">
              {(offer.role_pitch || DEFAULT_ROLE_PITCH).split("\n").filter(Boolean).map((p, i) => (
                <p
                  key={i}
                  className="text-[15px] md:text-base leading-relaxed"
                  style={{ color: TEXT_DARK, fontFamily: i === 0 ? SERIF : SANS, fontWeight: i === 0 ? 400 : 400, fontStyle: i === 0 ? "italic" : "normal" }}
                >
                  {p}
                </p>
              ))}
            </div>
          </Card>
        </section>

        {/* DETALHES DA POSIÇÃO */}
        <section>
          <SectionLabel>Detalhes da posição</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {offer.work_model && <DetailCard icon={<Briefcase className="h-4 w-4" />} label="Modelo de trabalho" value={WORK_MODEL_LABELS[offer.work_model as keyof typeof WORK_MODEL_LABELS]} />}
            {offer.contract_type && <DetailCard icon={<Briefcase className="h-4 w-4" />} label="Contratação" value={CONTRACT_TYPE_LABELS[offer.contract_type as keyof typeof CONTRACT_TYPE_LABELS]} />}
            {offer.unit && <DetailCard icon={<MapPin className="h-4 w-4" />} label="Local" value={offer.unit} />}
            {offer.reports_to && <DetailCard icon={<Briefcase className="h-4 w-4" />} label="Reporta-se a" value={offer.reports_to} />}
            {offer.start_date && <DetailCard icon={<Calendar className="h-4 w-4" />} label="Início previsto" value={format(new Date(offer.start_date + "T00:00:00"), "dd 'de' MMMM, yyyy", { locale: ptBR })} />}
            {offer.offer_expires_at && <DetailCard icon={<Calendar className="h-4 w-4" />} label="Validade da proposta" value={format(new Date(offer.offer_expires_at + "T00:00:00"), "dd 'de' MMMM, yyyy", { locale: ptBR })} />}
          </div>
        </section>

        {/* REMUNERAÇÃO */}
        {(offer.salary_amount || offer.variable_compensation) && (
          <section>
            <SectionLabel>Remuneração</SectionLabel>
            <div
              className="rounded-sm p-8 md:p-12 text-center relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${CARD} 0%, #f4eed5 100%)`,
                boxShadow: `0 30px 80px -30px rgba(0,0,0,0.5), inset 0 0 0 1px ${GOLD}40`,
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
              {offer.salary_amount && (
                <>
                  <p className="text-[10px] uppercase tracking-[0.4em] mb-3" style={{ color: GOLD, fontWeight: 600 }}>
                    Investimento mensal em você
                  </p>
                  <p
                    className="text-5xl md:text-7xl font-light"
                    style={{ fontFamily: SERIF, color: TEXT_DARK, letterSpacing: "-0.02em" }}
                  >
                    {formatMoney(Number(offer.salary_amount))}
                  </p>
                  {offer.salary_note && (
                    <p className="text-sm mt-3 italic" style={{ color: TEXT_DARK, fontFamily: SERIF, opacity: 0.7 }}>
                      {offer.salary_note}
                    </p>
                  )}
                </>
              )}
              {offer.variable_compensation && (
                <div className="mt-8 pt-8" style={{ borderTop: `1px solid ${GOLD}40` }}>
                  <p className="text-[10px] uppercase tracking-[0.4em] mb-2" style={{ color: GOLD, fontWeight: 600 }}>
                    Remuneração variável
                  </p>
                  <p className="text-sm md:text-base whitespace-pre-line" style={{ color: TEXT_DARK }}>
                    {offer.variable_compensation}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* BENEFÍCIOS */}
        {offer.benefits.length > 0 && (
          <section>
            <SectionLabel>O que oferecemos</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {offer.benefits.map((b) => (
                <div
                  key={b}
                  className="flex items-center gap-3 px-5 py-4 rounded-sm transition-transform hover:translate-x-1"
                  style={{ background: CARD, color: TEXT_DARK, boxShadow: `inset 0 0 0 1px ${GOLD}30` }}
                >
                  <div
                    className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center"
                    style={{ background: `${GOLD}25`, color: TEXT_DARK }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{b}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PERKS */}
        {offer.perks?.length > 0 && (
          <section>
            <SectionLabel><Gift className="h-3.5 w-3.5 inline mr-2 -mt-0.5" />Perks exclusivos</SectionLabel>
            <div className="space-y-3">
              {offer.perks.map((p, i) => (
                <div
                  key={i}
                  className="p-6 rounded-sm"
                  style={{ background: CARD, color: TEXT_DARK, boxShadow: `inset 0 0 0 1px ${GOLD}30` }}
                >
                  <p className="font-semibold text-base" style={{ fontFamily: SERIF }}>{p.title}</p>
                  {p.description && <p className="text-sm mt-2 leading-relaxed opacity-80">{p.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}


        {/* MÉTRICAS DE SUCESSO */}
        {offer.success_metrics?.length > 0 && (
          <section>
            <SectionLabel>Como o sucesso será medido</SectionLabel>
            <p className="text-sm md:text-base mb-6 leading-relaxed opacity-80" style={{ color: CARD }}>
              Transparência total desde o dia um. Estes são os indicadores que vamos acompanhar juntos.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offer.success_metrics.map((m, i) => (
                <div
                  key={i}
                  className="relative p-6 md:p-7 rounded-sm overflow-hidden group"
                  style={{
                    background: CARD,
                    color: TEXT_DARK,
                    boxShadow: `inset 0 0 0 1px ${GOLD}50, 0 20px 50px -30px rgba(0,0,0,0.6)`,
                  }}
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }}
                  />
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className="text-[10px] uppercase tracking-[0.3em] font-semibold"
                      style={{ color: GOLD, fontFamily: SANS }}
                    >
                      KPI {String(i + 1).padStart(2, "0")}
                    </div>
                    {m.horizon && (
                      <div
                        className="text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-sm"
                        style={{ background: `${TEXT_DARK}10`, color: TEXT_DARK, fontFamily: SANS }}
                      >
                        {m.horizon}
                      </div>
                    )}
                  </div>
                  <p
                    className="text-base md:text-lg font-semibold leading-tight mb-3"
                    style={{ fontFamily: SANS }}
                  >
                    {m.label}
                  </p>
                  {m.target && (
                    <p
                      className="text-2xl md:text-3xl leading-tight"
                      style={{ fontFamily: SERIF, color: TEXT_DARK, fontWeight: 400 }}
                    >
                      {m.target}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* COMUNIDADE - foto dos clientes */}
        <section>
          <SectionLabel>Você se junta a uma comunidade</SectionLabel>
          <div
            className="relative rounded-sm overflow-hidden"
            style={{ boxShadow: `0 30px 80px -30px rgba(0,0,0,0.7), 0 0 0 1px ${GOLD}30` }}
          >
            <img src={clientesFoto.url} alt="Comunidade Eternum" className="w-full h-auto block" />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `linear-gradient(180deg, ${BG_DEEP}40 0%, transparent 30%, ${BG_DEEP}ee 100%)` }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-center">
              <Sparkles className="h-5 w-5 mx-auto mb-3" style={{ color: GOLD }} />
              <p className="text-lg md:text-2xl" style={{ fontFamily: SERIF, color: CARD, fontWeight: 300 }}>
                Centenas de líderes que escolheram construir algo memorável.
              </p>
              <p className="text-xs uppercase tracking-[0.3em] mt-3" style={{ color: GOLD }}>
                Eternum Club
              </p>
            </div>
          </div>
        </section>

        {/* PRÓXIMOS PASSOS */}
        {offer.next_steps && (
          <section>
            <SectionLabel>Próximos passos</SectionLabel>
            <p
              className="text-[15px] md:text-base leading-relaxed whitespace-pre-line"
              style={{ fontFamily: SERIF, color: "#e8dcc0", fontWeight: 300 }}
            >
              {offer.next_steps}
            </p>
          </section>
        )}

        {/* ASSINATURA */}
        {(offer.signer_name || offer.signer_role) && (
          <section className="text-center py-8" style={{ borderTop: `1px solid ${GOLD}30` }}>
            <p className="text-sm italic opacity-70" style={{ fontFamily: SERIF }}>Com você na construção,</p>
            <p className="text-2xl mt-3" style={{ fontFamily: SERIF, color: GOLD_SOFT, fontWeight: 300 }}>
              {offer.signer_name}
            </p>
            {offer.signer_role && (
              <p className="text-xs uppercase tracking-[0.3em] mt-2 opacity-70">
                {offer.signer_role} · Eternum
              </p>
            )}
          </section>
        )}

        {/* CTA */}
        {!isResolved ? (
          <section>
            {response === null ? (
              <div
                className="rounded-sm p-6 md:p-8 space-y-5"
                style={{
                  background: CARD,
                  color: TEXT_DARK,
                  boxShadow: `0 30px 80px -20px rgba(0,0,0,0.7), inset 0 0 0 1px ${GOLD}60`,
                }}
              >
                <div className="text-center">
                  <h3 className="text-xl md:text-2xl" style={{ fontFamily: SERIF, fontWeight: 400 }}>
                    {firstName}, {pronto} para iniciar?
                  </h3>
                  <p className="text-sm mt-2 opacity-70">Sua resposta será registrada e enviada ao nosso time imediatamente.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => setResponse("accept")}
                    className="flex-1 gap-2 text-base h-14 rounded-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                    style={{ background: TEXT_DARK, color: CARD, fontFamily: SANS, letterSpacing: "0.15em", fontSize: 13 }}
                  >
                    <CheckCircle2 className="h-5 w-5" /> Aceitar a proposta
                  </Button>
                  <Button
                    onClick={() => setResponse("decline")}
                    variant="outline"
                    className="flex-1 gap-2 h-14 rounded-sm hover:bg-transparent"
                    style={{ borderColor: `${TEXT_DARK}40`, color: TEXT_DARK, background: "transparent", fontFamily: SANS, fontSize: 13, letterSpacing: "0.15em" }}
                  >
                    Recusar
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="rounded-sm p-6 md:p-8 space-y-4"
                style={{ background: CARD, color: TEXT_DARK, boxShadow: `0 30px 80px -20px rgba(0,0,0,0.7), inset 0 0 0 1px ${GOLD}60` }}
              >
                <h3 className="text-xl" style={{ fontFamily: SERIF }}>
                  {response === "accept" ? `Bem-vindo(a) à Eternum, ${firstName}.` : "Agradecemos sua sinceridade."}
                </h3>
                <Textarea
                  placeholder={response === "accept" ? "Deixe uma mensagem para o time (opcional)..." : "Conte rapidamente o motivo (opcional)..."}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  style={{ background: "#fff", borderColor: `${TEXT_DARK}30`, color: TEXT_DARK }}
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setResponse(null)} disabled={responding} style={{ borderColor: `${TEXT_DARK}40`, color: TEXT_DARK, background: "transparent" }}>
                    Voltar
                  </Button>
                  <Button
                    onClick={() => respond(response === "accept" ? "accepted" : "declined")}
                    disabled={responding}
                    className="flex-1 gap-2 h-12"
                    style={{ background: response === "accept" ? TEXT_DARK : "#8a1a1a", color: CARD }}
                  >
                    {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Confirmar resposta
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section
            className="rounded-sm p-10 text-center"
            style={{ background: CARD, color: TEXT_DARK, boxShadow: `inset 0 0 0 1px ${GOLD}60` }}
          >
            {offer.status === "accepted" ? (
              <>
                <Sparkles className="h-10 w-10 mx-auto mb-4" style={{ color: GOLD }} />
                <h3 className="text-3xl" style={{ fontFamily: SERIF, fontWeight: 300 }}>Bem-vindo(a) à Eternum.</h3>
                <p className="text-sm opacity-70 mt-3">
                  Recebemos sua resposta {offer.responded_at && `em ${format(new Date(offer.responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}. Nosso time entrará em contato em breve.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-10 w-10 mx-auto mb-4 opacity-50" />
                <h3 className="text-2xl" style={{ fontFamily: SERIF, fontWeight: 300 }}>Proposta recusada</h3>
                <p className="text-sm opacity-70 mt-2">Obrigado por considerar a oportunidade. Desejamos sucesso na sua jornada.</p>
              </>
            )}
          </section>
        )}
      </main>

      <footer className="text-center py-12 px-6" style={{ borderTop: `1px solid ${GOLD}20` }}>
        <img src={letreiro.url} alt="Eternum" className="h-4 mx-auto opacity-50 mb-3" />
        <p className="text-[10px] uppercase tracking-[0.4em] opacity-50">
          © {new Date().getFullYear()} · Carta-Proposta confidencial
        </p>
      </footer>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="px-4 py-1.5 text-xs uppercase tracking-[0.2em]"
      style={{ color: CARD, border: `1px solid ${GOLD}60`, borderRadius: 2, fontWeight: 500 }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <span className="h-px flex-1" style={{ background: `${GOLD}40` }} />
      <h2 className="text-[11px] uppercase tracking-[0.4em] font-semibold" style={{ color: GOLD, fontFamily: SANS }}>
        {children}
      </h2>
      <span className="h-px flex-1" style={{ background: `${GOLD}40` }} />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-sm p-8 md:p-10"
      style={{
        background: CARD,
        color: TEXT_DARK,
        boxShadow: `0 20px 60px -20px rgba(0,0,0,0.5), inset 0 0 0 1px ${GOLD}40`,
      }}
    >
      {children}
    </div>
  );
}

function DetailCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="p-5 rounded-sm flex items-start gap-4"
      style={{ background: CARD, color: TEXT_DARK, boxShadow: `inset 0 0 0 1px ${GOLD}30` }}
    >
      <div
        className="p-2.5 rounded-sm flex-shrink-0"
        style={{ background: `${GOLD}25`, color: TEXT_DARK }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.3em] opacity-60 font-semibold">{label}</p>
        <p className="font-medium text-sm mt-1.5" style={{ fontFamily: SERIF }}>{value}</p>
      </div>
    </div>
  );
}

const DEFAULT_COMPANY_INTRO = `A Eternum é o ecossistema de mentoria, tecnologia e gestão que ajuda líderes a construírem negócios memoráveis no Brasil.

Não nos contentamos com o comum. Atraímos quem busca legado, profundidade e excelência em cada detalhe — porque é assim que se constrói algo eterno.`;

const DEFAULT_ROLE_PITCH = `Esta é mais do que uma vaga. É um convite para escrever um capítulo importante da sua trajetória ao lado de pessoas que jogam o jogo no mais alto nível.

Aqui, você terá autonomia para construir, recursos para executar e uma cultura que cobra entrega — mas devolve crescimento real.`;
