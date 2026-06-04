// Sugestões inteligentes de KPIs por cargo/departamento
// Cada item já vem com label, target sugerido e horizonte — basta clicar pra adicionar.

export type KpiSuggestion = { label: string; target: string; horizon: string };

type Pack = {
  id: string;
  name: string; // nome amigável do pack
  match: (ctx: { title: string; department: string }) => boolean;
  metrics: KpiSuggestion[];
};

const has = (s: string, ...kw: string[]) => {
  const n = s.toLowerCase();
  return kw.some((k) => n.includes(k));
};

const PACKS: Pack[] = [
  {
    id: "sdr",
    name: "SDR / Pré-vendas",
    match: ({ title }) => has(title, "sdr", "pré-vend", "pre-vend", "prospec", "bdr"),
    metrics: [
      { label: "Reuniões qualificadas (MQLs → SQL)", target: "≥ 60/mês", horizon: "Mensal" },
      { label: "Taxa de conexão por tentativa", target: "≥ 25%", horizon: "Mensal" },
      { label: "Show-rate das reuniões agendadas", target: "≥ 70%", horizon: "Mensal" },
      { label: "Receita influenciada (pipeline gerado)", target: "R$ 500k", horizon: "Trimestral" },
    ],
  },
  {
    id: "closer",
    name: "Closer / Executivo de vendas",
    match: ({ title }) => has(title, "closer", "executivo de vend", "vendedor", "account executive", "ae"),
    metrics: [
      { label: "Receita nova fechada (MRR/Contratos)", target: "R$ 1M", horizon: "Trimestral" },
      { label: "Taxa de conversão SQL → Venda", target: "≥ 30%", horizon: "Mensal" },
      { label: "Ticket médio", target: "≥ R$ 25k", horizon: "Mensal" },
      { label: "Ciclo de venda (dias)", target: "≤ 21 dias", horizon: "Mensal" },
    ],
  },
  {
    id: "cs",
    name: "Customer Success",
    match: ({ title, department }) =>
      has(department, "customer success", "cs", "sucesso") ||
      has(title, "cs ", "customer success", "sucesso do cliente", "csm"),
    metrics: [
      { label: "NPS dos clientes da carteira", target: "≥ 70", horizon: "Trimestral" },
      { label: "Churn de receita (revenue churn)", target: "≤ 3%", horizon: "Mensal" },
      { label: "Retenção líquida (NRR)", target: "≥ 110%", horizon: "Trimestral" },
      { label: "Health score médio da carteira", target: "≥ 8/10", horizon: "Mensal" },
    ],
  },
  {
    id: "mentor",
    name: "Mentor / Operação",
    match: ({ title }) => has(title, "mentor", "consultor", "implementad"),
    metrics: [
      { label: "Resultado médio do mentorado (ROI)", target: "≥ 3x em 6 meses", horizon: "Semestral" },
      { label: "Satisfação pós-mentoria (CSAT)", target: "≥ 9,2/10", horizon: "Mensal" },
      { label: "Taxa de renovação dos clientes ativos", target: "≥ 80%", horizon: "Anual" },
      { label: "Casos de sucesso documentados", target: "≥ 4/trimestre", horizon: "Trimestral" },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    match: ({ title, department }) =>
      has(department, "marketing") || has(title, "marketing", "growth", "conteúdo", "social media", "trafego", "tráfego"),
    metrics: [
      { label: "MQLs gerados por mês", target: "≥ 400", horizon: "Mensal" },
      { label: "Custo por lead qualificado (CPL)", target: "≤ R$ 80", horizon: "Mensal" },
      { label: "Receita influenciada por marketing", target: "≥ 35% do total", horizon: "Trimestral" },
      { label: "Crescimento orgânico (sessões)", target: "+25%", horizon: "Trimestral" },
    ],
  },
  {
    id: "finance",
    name: "Financeiro",
    match: ({ title, department }) =>
      has(department, "financ") || has(title, "financ", "controlad", "contábil", "fp&a", "tesoura"),
    metrics: [
      { label: "Fechamento contábil dentro do prazo", target: "≤ dia 5 útil", horizon: "Mensal" },
      { label: "Inadimplência da carteira", target: "≤ 2%", horizon: "Mensal" },
      { label: "Acurácia do forecast de caixa", target: "≥ 95%", horizon: "Mensal" },
      { label: "Redução de custos operacionais", target: "-10%", horizon: "Anual" },
    ],
  },
  {
    id: "rh",
    name: "Pessoas / RH",
    match: ({ title, department }) =>
      has(department, "pessoas", "rh", "people") || has(title, "rh", "people", "recrut", "talent"),
    metrics: [
      { label: "Time to hire (dias)", target: "≤ 30 dias", horizon: "Mensal" },
      { label: "eNPS (satisfação interna)", target: "≥ 70", horizon: "Trimestral" },
      { label: "Turnover voluntário", target: "≤ 8% a.a.", horizon: "Anual" },
      { label: "% de PDIs ativos com acompanhamento", target: "≥ 90%", horizon: "Trimestral" },
    ],
  },
  {
    id: "dev",
    name: "Engenharia / Produto",
    match: ({ title, department }) =>
      has(department, "tecnologia", "engenharia", "produto", "tech") ||
      has(title, "dev", "engenh", "software", "fullstack", "front", "back", "produto", "pm "),
    metrics: [
      { label: "Lead time de entrega (deploy)", target: "≤ 3 dias", horizon: "Mensal" },
      { label: "Disponibilidade (uptime)", target: "≥ 99,9%", horizon: "Mensal" },
      { label: "Bugs críticos em produção", target: "0 por sprint", horizon: "Quinzenal" },
      { label: "Adoção de novas features (DAU)", target: "≥ 40%", horizon: "Trimestral" },
    ],
  },
  {
    id: "design",
    name: "Design",
    match: ({ title, department }) =>
      has(department, "design") || has(title, "design", "ux", "ui", "produto visual"),
    metrics: [
      { label: "Entregas no prazo", target: "≥ 95%", horizon: "Mensal" },
      { label: "Score de usabilidade (SUS)", target: "≥ 80", horizon: "Trimestral" },
      { label: "Consistência do design system (% adoção)", target: "≥ 90%", horizon: "Trimestral" },
    ],
  },
  {
    id: "ops",
    name: "Operações",
    match: ({ title, department }) =>
      has(department, "operaç", "ops") || has(title, "operaç", "ops", "projetos", "pmo"),
    metrics: [
      { label: "SLA de atendimento interno", target: "≥ 95%", horizon: "Mensal" },
      { label: "Projetos entregues no prazo", target: "≥ 90%", horizon: "Trimestral" },
      { label: "Eficiência operacional (custo/entrega)", target: "-15%", horizon: "Anual" },
    ],
  },
  {
    id: "generic",
    name: "Liderança & Genéricos",
    match: () => true, // fallback sempre disponível
    metrics: [
      { label: "Cumprimento das OKRs do trimestre", target: "≥ 80%", horizon: "Trimestral" },
      { label: "Avaliação 360º com pares e gestor", target: "≥ 4,5/5", horizon: "Semestral" },
      { label: "Entregas-chave do plano de 90 dias", target: "100%", horizon: "90 dias" },
    ],
  },
];

export function suggestKpis(title: string, department: string): { pack: string; metrics: KpiSuggestion[] }[] {
  const ctx = { title: title || "", department: department || "" };
  const matched = PACKS.filter((p) => p.id !== "generic" && p.match(ctx));
  const list = matched.length ? matched : [];
  // Sempre adiciona o pack genérico no fim
  list.push(PACKS.find((p) => p.id === "generic")!);
  return list.map((p) => ({ pack: p.name, metrics: p.metrics }));
}
