import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapPin, Target, Zap, TrendingUp, ArrowLeft, Info, AlertTriangle } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// ============================================================
// Base assumptions — mercado de ESTÉTICA AVANÇADA/MÉDICA BR
// TAM default = 50.000 clínicas (fração do CNAE 9602-5/02 que
// faz procedimento avançado — não confundir com o universo bruto
// de ~115k do CNAE que inclui salão de beleza).
// Distribuição por UF: mix população, renda per capita e
// concentração conhecida do setor (Sebrae/ABF/IBGE — qualitativo).
// ============================================================
const UF_META: Record<string, { name: string; region: string; weight: number }> = {
  SP: { name: "São Paulo", region: "Sudeste", weight: 0.305 },
  RJ: { name: "Rio de Janeiro", region: "Sudeste", weight: 0.105 },
  MG: { name: "Minas Gerais", region: "Sudeste", weight: 0.095 },
  RS: { name: "Rio Grande do Sul", region: "Sul", weight: 0.070 },
  PR: { name: "Paraná", region: "Sul", weight: 0.065 },
  SC: { name: "Santa Catarina", region: "Sul", weight: 0.060 },
  BA: { name: "Bahia", region: "Nordeste", weight: 0.045 },
  DF: { name: "Distrito Federal", region: "Centro-Oeste", weight: 0.035 },
  GO: { name: "Goiás", region: "Centro-Oeste", weight: 0.035 },
  PE: { name: "Pernambuco", region: "Nordeste", weight: 0.030 },
  CE: { name: "Ceará", region: "Nordeste", weight: 0.028 },
  ES: { name: "Espírito Santo", region: "Sudeste", weight: 0.022 },
  MT: { name: "Mato Grosso", region: "Centro-Oeste", weight: 0.018 },
  MS: { name: "Mato Grosso do Sul", region: "Centro-Oeste", weight: 0.015 },
  PA: { name: "Pará", region: "Norte", weight: 0.014 },
  MA: { name: "Maranhão", region: "Nordeste", weight: 0.010 },
  PB: { name: "Paraíba", region: "Nordeste", weight: 0.010 },
  RN: { name: "Rio Grande do Norte", region: "Nordeste", weight: 0.010 },
  AM: { name: "Amazonas", region: "Norte", weight: 0.009 },
  AL: { name: "Alagoas", region: "Nordeste", weight: 0.007 },
  PI: { name: "Piauí", region: "Nordeste", weight: 0.006 },
  SE: { name: "Sergipe", region: "Nordeste", weight: 0.005 },
  TO: { name: "Tocantins", region: "Norte", weight: 0.004 },
  RO: { name: "Rondônia", region: "Norte", weight: 0.004 },
  AC: { name: "Acre", region: "Norte", weight: 0.002 },
  AP: { name: "Amapá", region: "Norte", weight: 0.002 },
  RR: { name: "Roraima", region: "Norte", weight: 0.001 },
};

// DDD → UF (para inferir UF de leads que só têm telefone)
const DDD_TO_UF: Record<string, string> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP", "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  "21": "RJ", "22": "RJ", "24": "RJ",
  "27": "ES", "28": "ES",
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG",
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  "61": "DF", "62": "GO", "64": "GO", "63": "TO", "65": "MT", "66": "MT", "67": "MS",
  "68": "AC", "69": "RO",
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE", "81": "PE", "87": "PE", "82": "AL", "83": "PB", "84": "RN", "85": "CE", "88": "CE",
  "86": "PI", "89": "PI", "91": "PA", "93": "PA", "94": "PA", "92": "AM", "97": "AM",
  "95": "RR", "96": "AP", "98": "MA", "99": "MA",
};

// DDD → cidade principal (capital ou maior cidade da área).
// Usado APENAS como fallback quando o lead não tem cidade cadastrada.
// Marcamos claramente como "(inferido)" na UI.
const DDD_TO_CITY: Record<string, string> = {
  "11": "São Paulo", "12": "São José dos Campos", "13": "Santos", "14": "Bauru",
  "15": "Sorocaba", "16": "Ribeirão Preto", "17": "São José do Rio Preto",
  "18": "Presidente Prudente", "19": "Campinas",
  "21": "Rio de Janeiro", "22": "Campos dos Goytacazes", "24": "Petrópolis",
  "27": "Vitória", "28": "Cachoeiro de Itapemirim",
  "31": "Belo Horizonte", "32": "Juiz de Fora", "33": "Governador Valadares",
  "34": "Uberlândia", "35": "Poços de Caldas", "37": "Divinópolis", "38": "Montes Claros",
  "41": "Curitiba", "42": "Ponta Grossa", "43": "Londrina", "44": "Maringá",
  "45": "Cascavel", "46": "Francisco Beltrão",
  "47": "Joinville", "48": "Florianópolis", "49": "Chapecó",
  "51": "Porto Alegre", "53": "Pelotas", "54": "Caxias do Sul", "55": "Santa Maria",
  "61": "Brasília", "62": "Goiânia", "63": "Palmas", "64": "Rio Verde",
  "65": "Cuiabá", "66": "Rondonópolis", "67": "Campo Grande",
  "68": "Rio Branco", "69": "Porto Velho",
  "71": "Salvador", "73": "Ilhéus", "74": "Juazeiro", "75": "Feira de Santana", "77": "Vitória da Conquista",
  "79": "Aracaju", "81": "Recife", "82": "Maceió", "83": "João Pessoa", "84": "Natal",
  "85": "Fortaleza", "86": "Teresina", "87": "Petrolina", "88": "Juazeiro do Norte",
  "89": "Picos", "91": "Belém", "92": "Manaus", "93": "Santarém", "94": "Marabá",
  "95": "Boa Vista", "96": "Macapá", "97": "Tefé", "98": "São Luís", "99": "Imperatriz",
};

const normalizeUf = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const up = s.trim().toUpperCase();
  if (UF_META[up]) return up;
  for (const [uf, meta] of Object.entries(UF_META)) {
    if (meta.name.toUpperCase() === up) return uf;
  }
  return null;
};

const dddFromPhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  const ddd = digits.slice(0, 2);
  return ddd.length === 2 ? ddd : null;
};

// Robustez: só considera "55" prefixo de país quando o número tem
// tamanho compatível (12–13 dígitos). Evita que um número local
// com DDD 55 (RS) seja interpretado como country code.
const ufFromPhone = (phone: string | null | undefined): string | null => {
  const ddd = dddFromPhone(phone);
  return ddd ? DDD_TO_UF[ddd] || null : null;
};

const cityFromPhone = (phone: string | null | undefined): string | null => {
  const ddd = dddFromPhone(phone);
  return ddd ? DDD_TO_CITY[ddd] || null : null;
};

const normalizeCity = (s: string | null | undefined) =>
  (s || "").trim().replace(/\s+/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

type Row = {
  uf: string;
  name: string;
  region: string;
  tam: number;
  clients: number;
  leads: number;
  penetrationPct: number;
  opportunity: number;
  score: number;
};

type CityRow = {
  city: string;
  clients: number;
  leads: number;
  leadsInferred: number; // MQLs cuja cidade veio do DDD (não do cadastro)
};

export default function PenetrationTab() {
  const { currentUser } = useCurrentUser();
  const [totalTam, setTotalTam] = useState(50000);
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [includeChurnRisk, setIncludeChurnRisk] = useState(false);
  const drilldownRef = useRef<HTMLDivElement | null>(null);

  const openDrilldown = (uf: string) => {
    setSelectedUf(uf);
    // aguarda render antes de rolar
    setTimeout(() => {
      drilldownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  // Busca ativos + churn_risk (relevante para penetração histórica).
  // Filtro final é aplicado em memória via toggle.
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["mi-pen-clients-v2", currentUser?.account_id],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, state, city, status")
          .in("status", ["active", "churn_risk"])
          .range(from, from + size - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < size) break;
        from += size;
      }
      return all;
    },
    enabled: !!currentUser?.account_id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["mi-pen-leads-v2", currentUser?.account_id],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("leads")
          .select("id, state, city, business_state, business_city, phone, mql")
          .ilike("mql", "SIM%")
          .range(from, from + size - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < size) break;
        from += size;
      }
      return all;
    },
    enabled: !!currentUser?.account_id,
    staleTime: 5 * 60 * 1000,
  });

  // Base considerada (respeita toggle churn_risk)
  const consideredClients = useMemo(
    () => clients.filter((c) => includeChurnRisk || c.status === "active"),
    [clients, includeChurnRisk]
  );

  // Métricas de cobertura de dados (transparência)
  const coverage = useMemo(() => {
    const totalActive = clients.filter((c) => c.status === "active").length;
    const totalChurnRisk = clients.filter((c) => c.status === "churn_risk").length;
    const clientsNoUf = consideredClients.filter((c) => !normalizeUf(c.state)).length;
    const leadsNoSignal = leads.filter(
      (l) =>
        !normalizeUf(l.business_state) &&
        !normalizeUf(l.state) &&
        !ufFromPhone(l.phone)
    ).length;
    return {
      totalActive,
      totalChurnRisk,
      totalConsidered: consideredClients.length,
      clientsNoUf,
      clientsCoveragePct: consideredClients.length
        ? ((consideredClients.length - clientsNoUf) / consideredClients.length) * 100
        : 0,
      totalLeads: leads.length,
      leadsNoSignal,
      leadsCoveragePct: leads.length ? ((leads.length - leadsNoSignal) / leads.length) * 100 : 0,
    };
  }, [clients, consideredClients, leads]);

  const rows: Row[] = useMemo(() => {
    const clientsByUf = new Map<string, number>();
    for (const c of consideredClients) {
      const uf = normalizeUf(c.state);
      if (!uf) continue;
      clientsByUf.set(uf, (clientsByUf.get(uf) || 0) + 1);
    }
    const leadsByUf = new Map<string, number>();
    for (const l of leads) {
      const uf =
        normalizeUf(l.business_state) ||
        normalizeUf(l.state) ||
        ufFromPhone(l.phone);
      if (!uf) continue;
      leadsByUf.set(uf, (leadsByUf.get(uf) || 0) + 1);
    }

    return Object.entries(UF_META).map(([uf, meta]) => {
      const tam = Math.round(totalTam * meta.weight);
      const c = clientsByUf.get(uf) || 0;
      const l = leadsByUf.get(uf) || 0;
      const pen = tam ? (c / tam) * 100 : 0;
      const opportunity = Math.max(tam - c, 0);
      const penNorm = Math.min(pen / 5, 1);
      const leadsBoost = Math.log10(1 + l);
      const score = (1 - penNorm) * Math.log10(1 + tam) * (1 + leadsBoost);
      return {
        uf,
        name: meta.name,
        region: meta.region,
        tam,
        clients: c,
        leads: l,
        penetrationPct: pen,
        opportunity,
        score,
      };
    });
  }, [consideredClients, leads, totalTam]);

  const filteredRows = useMemo(() => {
    if (regionFilter === "all") return rows;
    return rows.filter((r) => r.region === regionFilter);
  }, [rows, regionFilter]);

  const totals = useMemo(() => {
    const withUf = rows.reduce((s, r) => s + r.clients, 0);
    const mqlsWithSignal = rows.reduce((s, r) => s + r.leads, 0);
    // Penetração nacional usa a base considerada INTEIRA (com ou sem UF).
    // Faz sentido porque o cliente existe no mercado mesmo sem estado cadastrado —
    // só não conseguimos alocá-lo no mapa por UF. Usar apenas os com UF
    // subestimaria a penetração real.
    const penNacional = totalTam ? (consideredClients.length / totalTam) * 100 : 0;
    return { penNacional, withUf, mqlsWithSignal };
  }, [rows, totalTam, consideredClients]);

  const cityRows: CityRow[] = useMemo(() => {
    if (!selectedUf) return [];
    const byCity = new Map<string, { clients: number; leads: number; leadsInferred: number }>();
    const bump = (city: string, key: "clients" | "leads" | "leadsInferred") => {
      const cur = byCity.get(city) || { clients: 0, leads: 0, leadsInferred: 0 };
      cur[key] += 1;
      byCity.set(city, cur);
    };
    for (const c of consideredClients) {
      if (normalizeUf(c.state) !== selectedUf) continue;
      bump(normalizeCity(c.city) || "(sem cidade)", "clients");
    }
    for (const l of leads) {
      const uf =
        normalizeUf(l.business_state) ||
        normalizeUf(l.state) ||
        ufFromPhone(l.phone);
      if (uf !== selectedUf) continue;
      const cadastro = normalizeCity(l.business_city || l.city);
      if (cadastro) {
        bump(cadastro, "leads");
      } else {
        const inferida = cityFromPhone(l.phone);
        bump(inferida ? `${inferida} (inferido)` : "(sem cidade)", "leadsInferred");
      }
    }
    return Array.from(byCity.entries())
      .map(([city, v]) => ({ city, ...v }))
      .sort(
        (a, b) =>
          b.clients + (b.leads + b.leadsInferred) * 0.3 -
          (a.clients + (a.leads + a.leadsInferred) * 0.3)
      );
  }, [selectedUf, consideredClients, leads]);

  const loading = loadingClients || loadingLeads;

  const topWhitespace = [...filteredRows].sort((a, b) => b.score - a.score).slice(0, 5);
  const topSaturated = [...filteredRows]
    .filter((r) => r.clients > 0)
    .sort((a, b) => b.penetrationPct - a.penetrationPct)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const dataQualityLow = coverage.clientsCoveragePct < 50 || coverage.leadsCoveragePct < 50;

  return (
    <div className="space-y-6">
      {/* Alerta de qualidade dos dados */}
      {dataQualityLow && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">Cobertura de dados limitada</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <div>
              <strong>{coverage.clientsNoUf}</strong> de {coverage.totalConsidered} clientes considerados
              estão <strong>sem UF cadastrada</strong> ({coverage.clientsCoveragePct.toFixed(0)}% de cobertura).
              Esses clientes não aparecem no mapeamento por estado.
            </div>
            <div>
              <strong>{coverage.leadsNoSignal}</strong> de {coverage.totalLeads} MQLs sem UF nem DDD válido
              ({coverage.leadsCoveragePct.toFixed(0)}% de cobertura). Preencher cidade/estado ou telefone
              melhora a análise.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Cabeçalho + configuração TAM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Penetração de mercado
          </CardTitle>
          <CardDescription>
            Cruza a base ativa da Eternum + MQLs com o TAM estimado de clínicas
            de estética avançada por UF. Use para escolher onde atacar
            (whitespace) e onde defender (regiões maduras).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">
                TAM Brasil (clínicas de estética avançada) — hoje{" "}
                <strong>{totalTam.toLocaleString("pt-BR")}</strong>
              </Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[totalTam]}
                  min={10000}
                  max={120000}
                  step={5000}
                  onValueChange={(v) => setTotalTam(v[0])}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={totalTam}
                  onChange={(e) => setTotalTam(Number(e.target.value) || 0)}
                  className="w-28"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Faixa útil: 45k–60k (estética avançada) · 100k+ inclui salão/beleza (não é seu ICP).
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Filtrar por região</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {["all", "Sudeste", "Sul", "Nordeste", "Centro-Oeste", "Norte"].map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={regionFilter === r ? "default" : "outline"}
                      onClick={() => setRegionFilter(r)}
                    >
                      {r === "all" ? "Todas" : r}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="include-churn"
                  checked={includeChurnRisk}
                  onCheckedChange={setIncludeChurnRisk}
                />
                <Label htmlFor="include-churn" className="text-xs cursor-pointer">
                  Incluir clientes em <strong>churn_risk</strong> ({coverage.totalChurnRisk}) —
                  útil para ver penetração histórica.
                </Label>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MetricMini
              label="Base considerada"
              value={coverage.totalConsidered.toString()}
              hint={
                includeChurnRisk
                  ? `${coverage.totalActive} ativos + ${coverage.totalChurnRisk} risco`
                  : `${coverage.totalActive} ativos`
              }
            />
            <MetricMini
              label="Com UF mapeada"
              value={totals.withUf.toString()}
              hint={`${coverage.clientsCoveragePct.toFixed(0)}% de cobertura`}
              accent={coverage.clientsCoveragePct < 50 ? "text-amber-600" : "text-foreground"}
            />
            <MetricMini
              label="MQLs com sinal geo"
              value={totals.mqlsWithSignal.toString()}
              hint={`${coverage.totalLeads} MQLs · ${coverage.leadsCoveragePct.toFixed(0)}% via UF/DDD`}
            />
            <MetricMini
              label="Penetração nacional"
              value={`${totals.penNacional.toFixed(2)}%`}
              hint={`${coverage.totalConsidered} / ${totalTam.toLocaleString("pt-BR")} (base total, com ou sem UF)`}
              accent="text-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Top oportunidades vs saturadas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-600" /> Top 5 UFs para atacar (whitespace)
            </CardTitle>
            <CardDescription>Score = TAM alto × baixa penetração × sinal de demanda (MQLs).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topWhitespace.map((r, i) => (
              <div
                key={r.uf}
                className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-muted/50 cursor-pointer"
                onClick={() => setSelectedUf(r.uf)}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{i + 1}º</Badge>
                  <span className="font-medium text-sm">{r.uf}</span>
                  <span className="text-xs text-muted-foreground">{r.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">TAM {r.tam.toLocaleString("pt-BR")}</span>
                  <span className="text-muted-foreground">{r.clients} ativos</span>
                  <span className="text-emerald-600 font-medium">{r.leads} MQL</span>
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                    score {r.score.toFixed(1)}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" /> Top 5 UFs mais penetradas
            </CardTitle>
            <CardDescription>Onde já temos share alto — foco em retenção, upsell e defesa da posição.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSaturated.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Nenhum estado com cliente mapeado no filtro atual.
              </p>
            )}
            {topSaturated.map((r, i) => (
              <div
                key={r.uf}
                className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-muted/50 cursor-pointer"
                onClick={() => setSelectedUf(r.uf)}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{i + 1}º</Badge>
                  <span className="font-medium text-sm">{r.uf}</span>
                  <span className="text-xs text-muted-foreground">{r.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">TAM {r.tam.toLocaleString("pt-BR")}</span>
                  <span className="text-muted-foreground">{r.clients} ativos</span>
                  <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                    {r.penetrationPct.toFixed(2)}%
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Tabela completa por UF */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Ranking completo por UF
          </CardTitle>
          <CardDescription>
            Clique em uma UF para ver o drilldown por cidade. Ordenado por score de prioridade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground uppercase">
                  <th className="text-left py-2 pr-2">UF</th>
                  <th className="text-left py-2 pr-2">Estado</th>
                  <th className="text-right py-2 pr-2">TAM</th>
                  <th className="text-right py-2 pr-2">Ativos</th>
                  <th className="text-right py-2 pr-2">MQL</th>
                  <th className="text-right py-2 pr-2">Penetração</th>
                  <th className="text-right py-2 pr-2">Whitespace</th>
                  <th className="text-right py-2 pr-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredRows].sort((a, b) => b.score - a.score).map((r) => (
                  <tr
                    key={r.uf}
                    className="border-b hover:bg-muted/40 cursor-pointer"
                    onClick={() => setSelectedUf(r.uf)}
                  >
                    <td className="py-2 pr-2 font-medium">{r.uf}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{r.name}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.tam.toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.clients}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.leads}</td>
                    <td className="py-2 pr-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={Math.min(r.penetrationPct * 10, 100)} className="w-16 h-1.5" />
                        <span className="tabular-nums w-14 text-right">
                          {r.penetrationPct.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-emerald-600">
                      {r.opportunity.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <Badge variant="outline" className="tabular-nums">
                        {r.score.toFixed(1)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Drilldown cidade */}
      {selectedUf && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Drilldown · {selectedUf} — {UF_META[selectedUf].name}
                </CardTitle>
                <CardDescription>
                  Top cidades com clientes ativos e MQLs.{" "}
                  {cityRows.length === 0 && "Sem dados por cidade nessa UF."}
                </CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedUf(null)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Fechar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {cityRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground uppercase">
                      <th className="text-left py-2">Cidade</th>
                      <th className="text-right py-2">Clientes ativos</th>
                      <th className="text-right py-2">MQL cadastrado</th>
                      <th className="text-right py-2" title="MQLs cuja cidade foi inferida a partir do DDD do telefone">
                        MQL inferido (DDD)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cityRows.slice(0, 30).map((c) => (
                      <tr key={c.city} className="border-b">
                        <td className="py-2">{c.city}</td>
                        <td className="py-2 text-right tabular-nums">{c.clients}</td>
                        <td className="py-2 text-right tabular-nums">{c.leads}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground italic">
                          {c.leadsInferred || ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nada mapeado.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-3 pb-3 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
          <div className="space-y-1">
            <div>
              <strong className="text-foreground">Como o score é calculado:</strong>{" "}
              <code>(1 − penetração/5%) × log₁₀(1+TAM) × (1 + log₁₀(1+MQL))</code>. Penetração acima de 5% pesa como "maduro".
            </div>
            <div>
              <strong className="text-foreground">Fontes dos dados:</strong> ativos e churn_risk da base
              <code> clients</code>; MQLs = <code>leads</code> com <code>mql ILIKE 'SIM%'</code> (cobre
              "Sim" legado e "SIM - Acima de 30k"). UF do lead é inferida do DDD quando <code>state</code>/
              <code>business_state</code> vazios. TAM por UF é distribuído por peso qualitativo (Sebrae/ABF/IBGE).
            </div>
            <div>
              <strong className="text-foreground">Numerador da penetração:</strong> o KPI
              <em> nacional </em> usa a base considerada inteira (cliente existe no mercado mesmo sem UF).
              Já o <em>ranking por UF</em> só conta clientes com estado preenchido — por isso a soma das
              linhas pode ser menor que a base total. Preencher o cadastro melhora a acurácia do mapa.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricMini({
  label,
  value,
  hint,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border p-3 bg-card">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
