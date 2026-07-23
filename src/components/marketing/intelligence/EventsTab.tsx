import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calendar, MapPin, ExternalLink, Search, Loader2, Sparkles, Globe, Flag, Plus, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MONTH_TO_INDEX: Record<string, number> = {
  Jan: 0, Fev: 1, Mar: 2, Abr: 3, Mai: 4, Jun: 5,
  Jul: 6, Ago: 7, Set: 8, Out: 9, Nov: 10, Dez: 11,
};

const LS_KEY = "mi:events:userAdded:v1";

function loadUserEvents(): EventItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && e.name && e.month);
  } catch {
    return [];
  }
}
function saveUserEvents(list: EventItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {}
}

type EventItem = {
  name: string;
  city: string;
  country: "BR" | "INT";
  region?: string;
  month: string; // ex: "Ago"
  monthIndex: number; // 0-11 for sorting
  audience: string;
  scale: "Grande" | "Médio" | "Regional";
  focus: string[];
  organizer?: string;
  url?: string;
  notes?: string;
  source?: "curated" | "ai";
};

// Curated base — mercado de estética avançada/médica (Brasil + mundo).
// Datas variam ano a ano; mês é referência histórica típica.
const EVENTS: EventItem[] = [
  // ============ BRASIL ============
  {
    name: "Congresso Brasileiro de Medicina Estética (BSAM)",
    city: "São Paulo",
    country: "BR",
    region: "Sudeste",
    month: "Mai",
    monthIndex: 4,
    audience: "Médicos estetas",
    scale: "Grande",
    focus: ["Injetáveis", "Harmonização", "Laser"],
    organizer: "Sociedade Brasileira de Medicina Estética",
    url: "https://www.medicinaestetica.com.br/",
  },
  {
    name: "Congresso Brasileiro de Dermatologia (SBD)",
    city: "Varia (BR)",
    country: "BR",
    month: "Set",
    monthIndex: 8,
    audience: "Dermatologistas",
    scale: "Grande",
    focus: ["Dermato clínica", "Dermato estética"],
    organizer: "Sociedade Brasileira de Dermatologia",
    url: "https://www.sbd.org.br/",
  },
  {
    name: "BEAUTY FAIR",
    city: "São Paulo",
    country: "BR",
    region: "Sudeste",
    month: "Set",
    monthIndex: 8,
    audience: "Profissionais de beleza e estética",
    scale: "Grande",
    focus: ["Estética avançada", "Tecnologias", "Cosmética"],
    organizer: "Beauty Fair",
    url: "https://www.beautyfair.com.br/",
    notes: "Maior feira de beleza da América Latina — trilha específica de estética avançada.",
  },
  {
    name: "Estetika Mercosul",
    city: "Porto Alegre",
    country: "BR",
    region: "Sul",
    month: "Out",
    monthIndex: 9,
    audience: "Esteticistas, biomédicos, médicos",
    scale: "Médio",
    focus: ["Injetáveis", "Tecnologias", "Corporal"],
    url: "https://www.estetikamercosul.com.br/",
  },
  {
    name: "Estetika (Congresso + Feira)",
    city: "São Paulo",
    country: "BR",
    region: "Sudeste",
    month: "Ago",
    monthIndex: 7,
    audience: "Esteticistas, biomédicos, dermato, médicos estetas",
    scale: "Grande",
    focus: ["Estética avançada", "Injetáveis", "Biomedicina estética", "Tecnologias"],
    organizer: "Yázigi/Estetika (grupo Lett)",
    url: "https://congressoestetika.com.br/",
    notes: "3 dias de congresso científico + feira com +180 marcas + Biomed Talks. Público forte de biomédicas esteta e esteticistas avançadas — ICP direto Eternum.",
  },
  {
    name: "Hair Brasil (Trilha Estética)",
    city: "São Paulo",
    country: "BR",
    region: "Sudeste",
    month: "Abr",
    monthIndex: 3,
    audience: "Profissionais de beleza/estética",
    scale: "Grande",
    focus: ["Cosmética", "Estética"],
    url: "https://www.hairbrasil.com/",
  },
  {
    name: "IMCAS Americas (São Paulo)",
    city: "São Paulo",
    country: "BR",
    region: "Sudeste",
    month: "Set",
    monthIndex: 8,
    audience: "Médicos estetas, dermato, cirurgiões plásticos",
    scale: "Grande",
    focus: ["Injetáveis", "Anti-aging", "Laser"],
    organizer: "IMCAS",
    url: "https://www.imcas.com/en/attend/imcas-americas",
  },
  {
    name: "Expo Estética Nordeste",
    city: "Recife",
    country: "BR",
    region: "Nordeste",
    month: "Ago",
    monthIndex: 7,
    audience: "Estetas e biomédicos",
    scale: "Regional",
    focus: ["Estética avançada"],
  },
  {
    name: "Congresso Brasileiro de Cirurgia Plástica (SBCP)",
    city: "Varia (BR)",
    country: "BR",
    month: "Nov",
    monthIndex: 10,
    audience: "Cirurgiões plásticos",
    scale: "Grande",
    focus: ["Cirúrgico", "Pós-op estético"],
    organizer: "SBCP",
    url: "https://www.cirurgiaplastica.org.br/",
  },
  {
    name: "Congresso Brasileiro de Biomedicina Estética (ABBE)",
    city: "São Paulo",
    country: "BR",
    region: "Sudeste",
    month: "Jul",
    monthIndex: 6,
    audience: "Biomédicos estetas",
    scale: "Médio",
    focus: ["Injetáveis", "Laser", "Bioestimuladores"],
    organizer: "Assoc. Brasileira de Biomedicina Estética",
  },
  {
    name: "Congresso HOF (Harmonização Orofacial CFO)",
    city: "Varia (BR)",
    country: "BR",
    month: "Jun",
    monthIndex: 5,
    audience: "Cirurgiões-dentistas HOF",
    scale: "Médio",
    focus: ["Harmonização orofacial", "Injetáveis"],
    organizer: "CFO / entidades odontológicas",
  },
  {
    name: "COBRAPE (Cong. Bras. Peelings e Bioestimuladores)",
    city: "São Paulo",
    country: "BR",
    region: "Sudeste",
    month: "Mar",
    monthIndex: 2,
    audience: "Médicos e biomédicos",
    scale: "Médio",
    focus: ["Peelings", "Bioestimuladores"],
  },
  {
    name: "Expo Aesthetics",
    city: "São Paulo",
    country: "BR",
    region: "Sudeste",
    month: "Out",
    monthIndex: 9,
    audience: "Multi-profissional estética",
    scale: "Médio",
    focus: ["Tecnologias", "Injetáveis"],
  },
  {
    name: "FCE Cosmetique",
    city: "São Paulo",
    country: "BR",
    region: "Sudeste",
    month: "Set",
    monthIndex: 8,
    audience: "Indústria cosmética + estética",
    scale: "Grande",
    focus: ["Cosmética", "Insumos"],
    url: "https://www.fcecosmetique.com.br/",
  },

  // ============ INTERNACIONAL ============
  {
    name: "IMCAS World Congress",
    city: "Paris",
    country: "INT",
    region: "Europa",
    month: "Jan",
    monthIndex: 0,
    audience: "Dermato, medicina estética, cirurgia plástica",
    scale: "Grande",
    focus: ["Injetáveis", "Laser", "Anti-aging"],
    organizer: "IMCAS",
    url: "https://www.imcas.com/",
    notes: "Referência global — 15k+ participantes.",
  },
  {
    name: "AMWC (Aesthetic & Anti-Aging Medicine World Congress)",
    city: "Monaco",
    country: "INT",
    region: "Europa",
    month: "Mar",
    monthIndex: 2,
    audience: "Medicina estética global",
    scale: "Grande",
    focus: ["Anti-aging", "Injetáveis", "Regenerativa"],
    url: "https://www.euromedicom.com/amwc",
  },
  {
    name: "AAD Annual Meeting",
    city: "Varia (EUA)",
    country: "INT",
    region: "América do Norte",
    month: "Mar",
    monthIndex: 2,
    audience: "Dermatologistas",
    scale: "Grande",
    focus: ["Dermato clínica", "Dermato estética"],
    organizer: "American Academy of Dermatology",
    url: "https://www.aad.org/",
  },
  {
    name: "ASDS Annual Meeting",
    city: "Varia (EUA)",
    country: "INT",
    region: "América do Norte",
    month: "Out",
    monthIndex: 9,
    audience: "Dermato cirurgia estética",
    scale: "Grande",
    focus: ["Injetáveis", "Laser", "Cirurgia dermato"],
    url: "https://www.asds.net/",
  },
  {
    name: "The Aesthetic Meeting (ASAPS/Aesthetic Society)",
    city: "Varia (EUA)",
    country: "INT",
    region: "América do Norte",
    month: "Mai",
    monthIndex: 4,
    audience: "Cirurgiões plásticos estéticos",
    scale: "Grande",
    focus: ["Cirúrgico estético"],
    url: "https://www.theaestheticsociety.org/",
  },
  {
    name: "FACE Conference",
    city: "Londres",
    country: "INT",
    region: "Europa",
    month: "Jun",
    monthIndex: 5,
    audience: "Injetáveis / medicina estética facial",
    scale: "Médio",
    focus: ["Injetáveis", "Harmonização"],
    url: "https://faceconference.com/",
  },
  {
    name: "Vegas Cosmetic Surgery (VCS)",
    city: "Las Vegas",
    country: "INT",
    region: "América do Norte",
    month: "Jun",
    monthIndex: 5,
    audience: "Multiprofissional estética",
    scale: "Grande",
    focus: ["Cirúrgico", "Não-cirúrgico", "Laser"],
    url: "https://vegascosmeticsurgery.net/",
  },
  {
    name: "5CC (5 Continent Congress)",
    city: "Varia (Europa)",
    country: "INT",
    region: "Europa",
    month: "Set",
    monthIndex: 8,
    audience: "Medicina estética / dermato",
    scale: "Grande",
    focus: ["Injetáveis", "Tecnologias"],
    url: "https://5-cc.com/",
  },
  {
    name: "Cosmoprof Bologna",
    city: "Bolonha",
    country: "INT",
    region: "Europa",
    month: "Mar",
    monthIndex: 2,
    audience: "Beleza + estética profissional",
    scale: "Grande",
    focus: ["Cosmética", "Equipamentos"],
    url: "https://www.cosmoprof.com/",
  },
  {
    name: "Cosmoprof North America (Las Vegas)",
    city: "Las Vegas",
    country: "INT",
    region: "América do Norte",
    month: "Jul",
    monthIndex: 6,
    audience: "Beleza + estética profissional",
    scale: "Grande",
    focus: ["Cosmética", "Equipamentos"],
    url: "https://www.cosmoprofnorthamerica.com/",
  },
  {
    name: "IMCAS Asia",
    city: "Varia (Ásia)",
    country: "INT",
    region: "Ásia",
    month: "Jul",
    monthIndex: 6,
    audience: "Medicina estética Ásia-Pacífico",
    scale: "Grande",
    focus: ["Injetáveis", "Laser", "K-beauty"],
    url: "https://www.imcas.com/en/attend/imcas-asia",
  },
  {
    name: "DASIL (Dermatologic & Aesthetic Surgery Intl League)",
    city: "Varia (global)",
    country: "INT",
    month: "Out",
    monthIndex: 9,
    audience: "Dermato estética global",
    scale: "Médio",
    focus: ["Dermato estética", "Laser"],
  },
  {
    name: "K-Beauty Expo",
    city: "Seul",
    country: "INT",
    region: "Ásia",
    month: "Out",
    monthIndex: 9,
    audience: "Cosmética + estética coreana",
    scale: "Grande",
    focus: ["K-beauty", "Skinbooster"],
  },
  {
    name: "Dubai Derma",
    city: "Dubai",
    country: "INT",
    region: "Oriente Médio",
    month: "Abr",
    monthIndex: 3,
    audience: "Dermato + estética Oriente Médio",
    scale: "Grande",
    focus: ["Dermato estética", "Laser", "Injetáveis"],
    url: "https://www.dubaiderma.com/",
  },
];

const MONTHS_ORDER = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// Ordem de prioridade: primeiro eventos de estética (esteticistas/biomédicos/multi),
// depois sociedades médicas (médicos, dermato, cirurgiões plásticos, HOF).
function audiencePriority(ev: EventItem): number {
  const a = ev.audience.toLowerCase();
  const org = (ev.organizer || "").toLowerCase();
  const isMedicalSociety =
    /dermato|médico|medico|cirurgi|plástic|plastic|hof|orofacial|dentista/.test(a) ||
    /sociedade|sbd|bsam|sbcp|asds|aad|imcas|asaps|cfo|dasil/.test(org);
  const isAesthetic =
    /estetic|estét|biomed|biomédic|beleza|multi|profission/.test(a);
  if (isAesthetic && !isMedicalSociety) return 0;
  if (isMedicalSociety) return 2;
  return 1;
}

function EventCard({ ev }: { ev: EventItem }) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-sm leading-tight">{ev.name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {ev.city}
              {ev.region && <span className="text-muted-foreground/70">· {ev.region}</span>}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            <Calendar className="h-3 w-3 mr-1" /> {ev.month}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge
            variant="outline"
            className={
              ev.scale === "Grande"
                ? "bg-purple-500/10 text-purple-700 border-purple-500/30 text-[10px]"
                : ev.scale === "Médio"
                ? "bg-blue-500/10 text-blue-700 border-blue-500/30 text-[10px]"
                : "bg-slate-500/10 text-slate-700 border-slate-500/30 text-[10px]"
            }
          >
            {ev.scale}
          </Badge>
          {ev.focus.map((f) => (
            <Badge key={f} variant="secondary" className="text-[10px]">
              {f}
            </Badge>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Público:</span> {ev.audience}
        </p>
        {ev.organizer && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Organizador:</span> {ev.organizer}
          </p>
        )}
        {ev.notes && (
          <p className="text-xs text-muted-foreground italic">{ev.notes}</p>
        )}
        {ev.url && (
          <a
            href={ev.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Site oficial <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export default function EventsTab() {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "BR" | "INT">("all");
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiCitations, setAiCitations] = useState<any[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EVENTS
      .filter((e) => (scope === "all" ? true : e.country === scope))
      .filter((e) => {
        if (!q) return true;
        return (
          e.name.toLowerCase().includes(q) ||
          e.city.toLowerCase().includes(q) ||
          (e.region || "").toLowerCase().includes(q) ||
          e.audience.toLowerCase().includes(q) ||
          e.focus.some((f) => f.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.monthIndex !== b.monthIndex) return a.monthIndex - b.monthIndex;
        const pa = audiencePriority(a);
        const pb = audiencePriority(b);
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      });
  }, [search, scope]);

  const byMonth = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of filtered) {
      const key = e.month;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(
      (a, b) => MONTHS_ORDER.indexOf(a[0]) - MONTHS_ORDER.indexOf(b[0]),
    );
  }, [filtered]);

  const total = filtered.length;
  const totalBR = filtered.filter((e) => e.country === "BR").length;
  const totalINT = filtered.filter((e) => e.country === "INT").length;

  const aiMutation = useMutation({
    mutationFn: async (query: string) => {
      const { data, error } = await supabase.functions.invoke("mi-market-research", {
        body: {
          query,
          focus: "tendencias",
          recency: "year",
          model: "sonar-pro",
        },
      });
      if (error) throw error;
      return data as { answer: string; citations: any[] };
    },
    onSuccess: (data) => {
      setAiAnswer(data.answer);
      setAiCitations(data.citations || []);
    },
  });

  const runDiscover = () => {
    const q =
      aiQuery.trim() ||
      "Liste os principais eventos, congressos e feiras do mercado de estética avançada/médica em 2026 no Brasil e no mundo (nome, cidade, mês, público-alvo, foco). Foque em injetáveis, laser, harmonização, dermato estética e medicina estética. Não inclua eventos exclusivos de beleza comum (salão, cabelo).";
    aiMutation.mutate(q);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600" /> Eventos do mercado de estética
          </CardTitle>
          <CardDescription>
            Mapa curado dos principais congressos, feiras e encontros do setor de estética avançada/médica —
            Brasil e mundo. Use para planejar presença comercial, prospecção de clínicas e captação em bancada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, cidade, foco..."
                className="pl-8 h-9"
              />
            </div>
            <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs gap-1">
                  <Globe className="h-3 w-3" /> Todos ({EVENTS.length})
                </TabsTrigger>
                <TabsTrigger value="BR" className="text-xs gap-1">
                  <Flag className="h-3 w-3" /> Brasil ({EVENTS.filter((e) => e.country === "BR").length})
                </TabsTrigger>
                <TabsTrigger value="INT" className="text-xs gap-1">
                  <Globe className="h-3 w-3" /> Internacional ({EVENTS.filter((e) => e.country === "INT").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <p className="text-xs text-muted-foreground">
            {total} evento(s) — {totalBR} no Brasil · {totalINT} internacionais. Ordenados por mês.
          </p>
        </CardContent>
      </Card>

      {byMonth.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento encontrado com esse filtro.</p>
          </CardContent>
        </Card>
      ) : (
        byMonth.map(([month, list]) => (
          <div key={month} className="space-y-2">
            <div className="flex items-center gap-2 sticky top-0 z-10 bg-background/95 backdrop-blur py-1">
              <Badge variant="outline" className="text-xs font-semibold">
                {month}
              </Badge>
              <span className="text-xs text-muted-foreground">{list.length} evento(s)</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((ev, i) => (
                <EventCard key={`${ev.name}-${i}`} ev={ev} />
              ))}
            </div>
          </div>
        ))
      )}

      <Card className="border-purple-500/30 bg-purple-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" /> Descobrir mais eventos com IA
          </CardTitle>
          <CardDescription>
            Consulta em tempo real (Perplexity) para trazer eventos adicionais, edições atualizadas ou nichos
            específicos que não estão no mapa curado acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Ex.: eventos de harmonização orofacial no Sul em 2026"
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") runDiscover();
              }}
            />
            <Button onClick={runDiscover} disabled={aiMutation.isPending} size="sm">
              {aiMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-2" />
              )}
              Descobrir
            </Button>
          </div>
          {aiMutation.error && (
            <p className="text-xs text-red-600">
              Erro: {(aiMutation.error as Error).message}
            </p>
          )}
          {aiAnswer && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-3 prose-headings:mb-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAnswer}</ReactMarkdown>
              </div>
              {aiCitations.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Fontes</p>
                  <ol className="text-xs space-y-1 list-decimal list-inside">
                    {aiCitations.slice(0, 10).map((c) => (
                      <li key={c.index}>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {c.title || c.url}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
