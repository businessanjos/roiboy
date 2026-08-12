import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Loader2, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { CountryStateCity, type LocationFields } from "./CountryStateCity";
import { getCountry } from "@/lib/countries";
import { useExchangeRate, formatBRL, formatCurrency } from "@/hooks/useExchangeRate";
import { clearLocalAutosaveDraft, readLocalAutosaveDraft, writeLocalAutosaveDraft } from "@/hooks/useLocalAutosaveDraft";

type Periodo = "mensal" | "trimestral" | "semestral" | "anual";

export interface OperationBriefingData {
  id?: string;

  // Localização
  pais: string;
  pais_codigo: string;
  estado: string;
  estado_uf: string;
  cidade: string;
  moeda_codigo: string;

  // Estruturados (preferenciais para análise) — valores na moeda do país
  tempo_atuacao_anos: string;
  faturamento_mes_1: string;
  faturamento_mes_2: string;
  faturamento_mes_3: string;
  ticket_medio: string;
  margem_lucro_percent: string;
  meta_faturamento: string;
  trafego_investimento_valor: string;
  trafego_investimento_periodo: Periodo | "";
  tem_caixa_bool: boolean | null;
  caixa_valor: string;
  horas_atende_dia_num: string;
  dias_atende_semana_num: string;
  numero_funcionarios_num: string;
  numero_salas: string;
  ja_fez_mentoria_bool: boolean | null;
  ja_fez_mentoria_quem: string;
  conhece_cliente_nossa_bool: boolean | null;
  conhece_cliente_nossa_quem: string;

  // Texto livre / categóricos
  foco_atuacao: string;
  objetivo_mentoria: string;
  estrutura_clinica: string;
  especialidade: string;
  da_aulas: boolean;
  da_cursos: boolean;
  equipamentos: string;
  observacoes: string;

  is_complete: boolean;
}

const EMPTY: OperationBriefingData = {
  pais: "",
  pais_codigo: "",
  estado: "",
  estado_uf: "",
  cidade: "",
  moeda_codigo: "BRL",
  tempo_atuacao_anos: "",
  faturamento_mes_1: "",
  faturamento_mes_2: "",
  faturamento_mes_3: "",
  ticket_medio: "",
  margem_lucro_percent: "",
  meta_faturamento: "",
  trafego_investimento_valor: "",
  trafego_investimento_periodo: "",
  tem_caixa_bool: null,
  caixa_valor: "",
  horas_atende_dia_num: "",
  dias_atende_semana_num: "",
  numero_funcionarios_num: "",
  numero_salas: "",
  ja_fez_mentoria_bool: null,
  ja_fez_mentoria_quem: "",
  conhece_cliente_nossa_bool: null,
  conhece_cliente_nossa_quem: "",
  foco_atuacao: "",
  objetivo_mentoria: "",
  estrutura_clinica: "",
  especialidade: "",
  da_aulas: false,
  da_cursos: false,
  equipamentos: "",
  observacoes: "",
  is_complete: false,
};

// Validação contextual: estado só obrigatório no Brasil.
export function getMissingFields(b: Partial<OperationBriefingData> | null | undefined): string[] {
  if (!b) return ["briefing"];
  const missing: string[] = [];
  const must: (keyof OperationBriefingData)[] = [
    "tempo_atuacao_anos",
    "faturamento_mes_1",
    "faturamento_mes_2",
    "faturamento_mes_3",
    "ticket_medio",
    "margem_lucro_percent",
    "foco_atuacao",
    "objetivo_mentoria",
    "pais_codigo",
    "cidade",
    "estrutura_clinica",
    "numero_funcionarios_num",
    "meta_faturamento",
    "especialidade",
  ];
  for (const f of must) {
    const v = (b as any)[f];
    if (v === null || v === undefined || String(v).trim() === "") missing.push(f);
  }
  // Estado só obrigatório quando o país é Brasil
  if ((b.pais_codigo || "").toUpperCase() === "BR") {
    if (!String(b.estado_uf || "").trim()) missing.push("estado_uf");
  }
  return missing;
}

export const REQUIRED_BRIEFING_FIELDS: (keyof OperationBriefingData)[] = [
  "tempo_atuacao_anos",
  "faturamento_mes_1",
  "faturamento_mes_2",
  "faturamento_mes_3",
  "ticket_medio",
  "margem_lucro_percent",
  "foco_atuacao",
  "objetivo_mentoria",
  "pais_codigo",
  "cidade",
  "estrutura_clinica",
  "numero_funcionarios_num",
  "meta_faturamento",
  "especialidade",
];

export const BRIEFING_FIELD_LABELS: Record<string, string> = {
  tempo_atuacao_anos: "Tempo de atuação (anos)",
  faturamento_mes_1: "Faturamento Mês -1",
  faturamento_mes_2: "Faturamento Mês -2",
  faturamento_mes_3: "Faturamento Mês -3",
  ticket_medio: "Ticket médio",
  margem_lucro_percent: "Margem de lucro (%)",
  foco_atuacao: "Foco de atuação",
  objetivo_mentoria: "Objetivo com a mentoria",
  pais_codigo: "País",
  estado_uf: "Estado (UF)",
  cidade: "Cidade",
  estrutura_clinica: "Estrutura da clínica",
  numero_funcionarios_num: "Nº de funcionários",
  meta_faturamento: "Meta de faturamento",
  especialidade: "Especialidade",

  briefing: "Briefing",
};

export function labelForBriefingField(field: string): string {
  return BRIEFING_FIELD_LABELS[field] || field;
}

export function isBriefingComplete(b: Partial<OperationBriefingData> | null | undefined): boolean {
  return getMissingFields(b).length === 0;
}


interface OperationBriefingFormProps {
  dealId?: string | null;
  clientId?: string | null;
  onSaved?: (data: OperationBriefingData) => void;
  readOnly?: boolean;
}

const toStr = (v: any) => (v === null || v === undefined ? "" : String(v));
const toNum = (v: string): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// Erros de RLS/permissão do PostgREST (política restritiva, grant ausente, sessão sem setor)
const isAccessError = (err: any): boolean => {
  if (!err) return false;
  const code = String(err.code || "");
  const msg = `${err.message || ""} ${err.details || ""} ${err.hint || ""}`.toLowerCase();
  return (
    code === "42501" ||
    code === "PGRST301" ||
    code === "PGRST116" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("not authorized") ||
    msg.includes("jwt")
  );
};


export function OperationBriefingForm({ dealId, clientId, onSaved, readOnly = false }: OperationBriefingFormProps) {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [ingestionIssues, setIngestionIssues] = useState<string[]>([]);

  const [data, setData] = useState<OperationBriefingData>(EMPTY);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [originalDealId, setOriginalDealId] = useState<string | null>(null);
  const [originalClientId, setOriginalClientId] = useState<string | null>(null);
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const draftKey = !readOnly && (dealId || clientId)
    ? `roy:sales:operation-briefing-draft:${dealId ? `deal:${dealId}` : `client:${clientId}`}`
    : null;

  // Cotação para a moeda atual (puxa apenas se ≠ BRL)
  const { data: fx } = useExchangeRate(data.moeda_codigo);
  const country = useMemo(() => getCountry(data.pais_codigo), [data.pais_codigo]);
  const symbol = country?.currencySymbol || "R$";
  const currencyCode = data.moeda_codigo || "BRL";
  const isBRL = currencyCode === "BRL";

  const load = useCallback(async () => {
    if (!dealId && !clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setAccessError(null);
    setNotFound(false);

    let row: any = null;
    let lastError: any = null;

    if (dealId) {
      const { data: r, error } = await supabase
        .from("deal_operation_briefings")
        .select("*")
        .eq("deal_id", dealId)
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("Erro ao carregar briefing:", error);
        lastError = error;
      }
      row = r;
    } else if (clientId) {
      // 1) Briefing já vinculado diretamente ao cliente
      const { data: r, error } = await supabase
        .from("deal_operation_briefings")
        .select("*")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("Erro ao carregar briefing:", error);
        lastError = error;
      }
      row = r;

      // 2) Fallback legado: briefing antigo ainda sem client_id, vinculado ao negócio.
      //    O CS não tem acesso à tabela `deals` (isolamento por setor), então um erro
      //    aqui é esperado e NÃO deve virar "acesso negado" na ficha do cliente.
      if (!row) {
        const { data: deals } = await supabase
          .from("deals")
          .select("id")
          .eq("client_id", clientId);
        const dealIds = (deals || []).map((d: any) => d.id);
        if (dealIds.length > 0) {
          const { data: r2, error: e2 } = await supabase
            .from("deal_operation_briefings")
            .select("*")
            .in("deal_id", dealIds)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (e2 && e2.code !== "PGRST116") lastError = lastError || e2;
          row = r2;
        }
      }
    }

    if (!row) {
      if (lastError && isAccessError(lastError)) {
        setAccessError(lastError.message || "Acesso negado pelas políticas de segurança.");
      } else {
        setNotFound(true);
      }
    }


    if (row) {
      setOriginalId(row.id);
      setOriginalDealId(row.deal_id ?? null);
      setOriginalClientId(row.client_id ?? null);
      const r: any = row;

      const loadedData: OperationBriefingData = {
        ...EMPTY,
        pais: toStr(r.pais),
        pais_codigo: toStr(r.pais_codigo) || (r.cidade ? "BR" : ""),
        estado: toStr(r.estado),
        estado_uf: toStr(r.estado_uf),
        cidade: toStr(r.cidade),
        moeda_codigo: toStr(r.moeda_codigo) || "BRL",
        tempo_atuacao_anos: toStr(r.tempo_atuacao_anos ?? extractFirstNumber(r.tempo_atuacao)),
        faturamento_mes_1: toStr(r.faturamento_mes_1),
        faturamento_mes_2: toStr(r.faturamento_mes_2),
        faturamento_mes_3: toStr(r.faturamento_mes_3),
        ticket_medio: toStr(r.ticket_medio),
        margem_lucro_percent: toStr(r.margem_lucro_percent ?? extractFirstNumber(r.margem_lucro)),
        meta_faturamento: toStr(r.meta_faturamento),
        trafego_investimento_valor: toStr(r.trafego_investimento_valor),
        trafego_investimento_periodo: (r.trafego_investimento_periodo as Periodo) || "",
        tem_caixa_bool: r.tem_caixa_bool,
        caixa_valor: toStr(r.caixa_valor),
        horas_atende_dia_num: toStr(r.horas_atende_dia_num ?? extractFirstNumber(r.horas_atende_dia)),
        dias_atende_semana_num: toStr(r.dias_atende_semana_num ?? extractFirstNumber(r.dias_atende_semana)),
        numero_funcionarios_num: toStr(r.numero_funcionarios_num ?? extractFirstNumber(r.numero_funcionarios)),
        numero_salas: toStr(r.numero_salas ?? extractFirstNumber(r.estrutura_clinica)),
        ja_fez_mentoria_bool: r.ja_fez_mentoria_bool,
        ja_fez_mentoria_quem: toStr(r.ja_fez_mentoria_quem ?? r.ja_fez_mentoria),
        conhece_cliente_nossa_bool: r.conhece_cliente_nossa_bool,
        conhece_cliente_nossa_quem: toStr(r.conhece_cliente_nossa_quem ?? r.conhece_cliente_nossa),
        foco_atuacao: toStr(r.foco_atuacao),
        objetivo_mentoria: toStr(r.objetivo_mentoria),
        estrutura_clinica: toStr(r.estrutura_clinica),
        especialidade: toStr(r.especialidade),
        da_aulas: !!r.da_aulas,
        da_cursos: !!r.da_cursos,
        equipamentos: toStr(r.equipamentos),
        observacoes: toStr(r.observacoes),
        is_complete: !!r.is_complete,
      };
      // Um registro persistido é a fonte de verdade. Rascunhos antigos (inclusive
      // os vazios criados quando a RLS ocultava a linha) nunca podem apagar na UI
      // o briefing que o Comercial já salvou para o CS.
      clearLocalAutosaveDraft(draftKey);
      setData(loadedData);
    } else {
      setOriginalId(null);
      setOriginalDealId(null);
      setOriginalClientId(null);
      setData({ ...EMPTY, ...(readLocalAutosaveDraft<Partial<OperationBriefingData>>(draftKey) || {}) });
    }
    setLoadedDraftKey(draftKey);
    setLoading(false);
  }, [dealId, clientId, draftKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Aguarda o carregamento do contexto atual para não copiar os dados do
    // cliente anterior durante a troca de rota/aba. Registros existentes já
    // possuem persistência no banco e não precisam de uma segunda cópia local.
    if (readOnly || loading || !draftKey || loadedDraftKey !== draftKey || originalId) return;
    writeLocalAutosaveDraft(draftKey, data);
  }, [readOnly, loading, draftKey, loadedDraftKey, originalId, data]);

  const update = <K extends keyof OperationBriefingData>(key: K, value: OperationBriefingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const updateLocation = (loc: LocationFields) => {
    setData((prev) => ({ ...prev, ...loc }));
  };

  // Quando muda o país, automaticamente troca a moeda padrão
  const handleCountryChange = (code: string) => {
    const c = getCountry(code);
    if (c) update("moeda_codigo", c.currency);
  };

  // Verificação de ingestão pós-salvamento: relê a linha pelos mesmos caminhos
  // que o time de CS usa (por id e por client_id) e valida vínculos/permissão.
  const verifyIngestion = async (
    savedId: string | null,
    resolvedClientId: string | null,
  ): Promise<string[]> => {
    const issues: string[] = [];
    if (!savedId) {
      return ["Não foi possível confirmar o registro salvo (id ausente)."];
    }

    const { data: row, error } = await supabase
      .from("deal_operation_briefings")
      .select("id, account_id, client_id, deal_id, is_complete")
      .eq("id", savedId)
      .maybeSingle();

    if (error) {
      return [
        isAccessError(error)
          ? "O briefing foi gravado, mas as políticas de acesso impedem a releitura — o CS provavelmente também não conseguirá abrir."
          : `Falha ao reler o briefing salvo: ${error.message}`,
      ];
    }
    if (!row) {
      return ["O briefing não retornou na releitura (bloqueio de permissão/políticas). O CS não conseguirá visualizá-lo."];
    }

    if (row.account_id !== currentUser?.account_id) {
      issues.push("O briefing ficou vinculado a outra conta — o CS desta conta não conseguirá lê-lo.");
    }
    if (!row.client_id) {
      issues.push(
        "O briefing não está vinculado a um cliente. O CS busca por cliente: vincule o negócio a um cliente para que ele apareça na Operação.",
      );
    }
    if (!row.deal_id) {
      issues.push("O briefing não está vinculado a um negócio do Comercial (deal).");
    }

    // Confirma que a consulta por cliente (caminho do CS) devolve este registro
    const clientKey = row.client_id || resolvedClientId;
    if (clientKey) {
      const { data: byClient, error: byClientErr } = await supabase
        .from("deal_operation_briefings")
        .select("id")
        .eq("client_id", clientKey)
        .eq("id", savedId)
        .maybeSingle();
      if (byClientErr || !byClient) {
        issues.push(
          "A consulta por cliente (usada pelo Customer Success) não retornou este briefing. Verifique acesso aos setores Vendas/Operações.",
        );
      }
    }

    return issues;
  };


  const handleSave = async () => {
    if (!currentUser?.account_id) {
      toast.error("Usuário sem conta vinculada");
      return;
    }
    const missingNow = getMissingFields(data);
    if (missingNow.length > 0) {
      setShowErrors(true);
      toast.error(
        `Preencha todos os campos obrigatórios (${missingNow.length} pendente(s))`,
        { description: missingNow.map(labelForBriefingField).join(", ") },
      );
      return;
    }
    setShowErrors(false);
    setSaving(true);
    const complete = true;


    const symbolForResume = country?.currencySymbol || "R$";
    const faturamentosResumo = [data.faturamento_mes_1, data.faturamento_mes_2, data.faturamento_mes_3]
      .map((v) => (v ? `${symbolForResume} ${v}` : "-"))
      .join(" / ");

    const trafegoResumo = data.trafego_investimento_valor
      ? `${symbolForResume} ${data.trafego_investimento_valor}/${data.trafego_investimento_periodo || "—"}`
      : "";

    // Garante o vínculo com o cliente para que o time de CS enxergue o briefing
    let resolvedClientId = clientId || originalClientId || null;
    if (!resolvedClientId && (dealId || originalDealId)) {
      const { data: deal } = await supabase
        .from("deals")
        .select("client_id")
        .eq("id", (dealId || originalDealId) as string)
        .maybeSingle();
      resolvedClientId = deal?.client_id ?? null;
    }

    const payload: any = {
      account_id: currentUser.account_id,
      deal_id: dealId || originalDealId || null,
      client_id: resolvedClientId,

      // Localização
      pais: data.pais || null,
      pais_codigo: data.pais_codigo || null,
      estado: data.estado || null,
      estado_uf: data.estado_uf || null,
      cidade: data.cidade || null,
      moeda_codigo: data.moeda_codigo || "BRL",

      // Estruturados
      tempo_atuacao_anos: toNum(data.tempo_atuacao_anos),
      faturamento_mes_1: toNum(data.faturamento_mes_1),
      faturamento_mes_2: toNum(data.faturamento_mes_2),
      faturamento_mes_3: toNum(data.faturamento_mes_3),
      ticket_medio: toNum(data.ticket_medio),
      margem_lucro_percent: toNum(data.margem_lucro_percent),
      meta_faturamento: toNum(data.meta_faturamento),
      trafego_investimento_valor: toNum(data.trafego_investimento_valor),
      trafego_investimento_periodo: data.trafego_investimento_periodo || null,
      tem_caixa_bool: data.tem_caixa_bool,
      caixa_valor: toNum(data.caixa_valor),
      horas_atende_dia_num: toNum(data.horas_atende_dia_num),
      dias_atende_semana_num: toNum(data.dias_atende_semana_num),
      numero_funcionarios_num: data.numero_funcionarios_num ? Math.trunc(Number(data.numero_funcionarios_num)) : null,
      numero_salas: data.numero_salas ? Math.trunc(Number(data.numero_salas)) : null,
      ja_fez_mentoria_bool: data.ja_fez_mentoria_bool,
      ja_fez_mentoria_quem: data.ja_fez_mentoria_quem || null,
      conhece_cliente_nossa_bool: data.conhece_cliente_nossa_bool,
      conhece_cliente_nossa_quem: data.conhece_cliente_nossa_quem || null,

      foco_atuacao: data.foco_atuacao || null,
      objetivo_mentoria: data.objetivo_mentoria || null,
      estrutura_clinica: data.estrutura_clinica || null,
      especialidade: data.especialidade || null,
      da_aulas: data.da_aulas,
      da_cursos: data.da_cursos,
      equipamentos: data.equipamentos || null,
      observacoes: data.observacoes || null,

      // Legado
      tempo_atuacao: data.tempo_atuacao_anos ? `${data.tempo_atuacao_anos} anos` : null,
      ultimos_faturamentos: faturamentosResumo,
      margem_lucro: data.margem_lucro_percent ? `${data.margem_lucro_percent}%` : null,
      horas_atende_dia: data.horas_atende_dia_num ? `${data.horas_atende_dia_num}h` : null,
      dias_atende_semana: data.dias_atende_semana_num ? `${data.dias_atende_semana_num} dias` : null,
      numero_funcionarios: data.numero_funcionarios_num || null,
      trafego_investimento: trafegoResumo || null,
      tem_caixa:
        data.tem_caixa_bool === null
          ? null
          : data.tem_caixa_bool
            ? data.caixa_valor ? `Sim - ${symbolForResume} ${data.caixa_valor}` : "Sim"
            : "Não",
      ja_fez_mentoria:
        data.ja_fez_mentoria_bool === null
          ? null
          : data.ja_fez_mentoria_bool
            ? data.ja_fez_mentoria_quem ? `Sim - ${data.ja_fez_mentoria_quem}` : "Sim"
            : "Não",
      conhece_cliente_nossa:
        data.conhece_cliente_nossa_bool === null
          ? null
          : data.conhece_cliente_nossa_bool
            ? data.conhece_cliente_nossa_quem ? `Sim - ${data.conhece_cliente_nossa_quem}` : "Sim"
            : "Não",

      is_complete: complete,
      completed_at: complete ? new Date().toISOString() : null,
      completed_by: complete ? currentUser.id : null,
    };

    let error: any = null;
    let savedId: string | null = originalId;
    if (originalId) {
      ({ error } = await supabase.from("deal_operation_briefings").update(payload).eq("id", originalId));
    } else {
      payload.created_by = currentUser.id;
      const { data: inserted, error: insErr } = await supabase
        .from("deal_operation_briefings")
        .insert(payload)
        .select("id")
        .single();
      error = insErr;
      if (inserted) {
        savedId = inserted.id;
        setOriginalId(inserted.id);
      }
    }

    if (error) {
      setSaving(false);
      console.error("Erro ao salvar briefing:", error);
      toast.error("Erro ao salvar briefing operacional");
      return;
    }

    // Verificação de ingestão: confirma que o registro realmente ficou legível
    // pelo mesmo caminho que o CS usa (por cliente) e com os vínculos corretos.
    const problems = await verifyIngestion(savedId, resolvedClientId);
    setIngestionIssues(problems);
    setSaving(false);

    if (problems.length > 0) {
      toast.warning("Briefing salvo, mas pode não chegar ao CS", {
        description: problems[0],
      });
    } else {
      toast.success(complete ? "Briefing salvo e completo" : "Briefing salvo (campos pendentes)");
    }
    clearLocalAutosaveDraft(draftKey);
    onSaved?.({ ...data, is_complete: complete });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const missing = getMissingFields(data);
  const complete = missing.length === 0;
  const fxRate = fx?.rate ?? 0;
  const showConversion = !isBRL && fxRate > 0;

  // Props comuns de moeda — espalhadas em cada MoneyField para manter a
  // identidade do componente estável entre renders (evita perda de foco).
  const moneyProps = { currencySymbol: symbol, currencyCode, fxRate, showConversion };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2">
            <ClipboardList className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <CardTitle className="text-base">Briefing para Operação</CardTitle>
              <CardDescription>
                Dados estruturados — usados em análises, BI e dashboards.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isBRL && (
              <Badge variant="outline" className="gap-1">
                Moeda: {currencyCode}
                {showConversion && <span className="text-muted-foreground">· 1 {currencyCode} = {formatBRL(fxRate)}</span>}
              </Badge>
            )}
            {complete ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Completo
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" /> {missing.length} pendente(s)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {accessError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  Nenhum briefing pôde ser carregado — acesso bloqueado
                </p>
                <p className="text-xs text-muted-foreground">
                  O registro pode existir, mas as políticas de segurança do seu usuário não permitem lê-lo.
                  Isso costuma acontecer quando o usuário não tem acesso ao setor de <strong>Vendas</strong> ou{" "}
                  <strong>Operações/CS</strong>, ou quando o briefing pertence a outra conta.
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                  <li>Peça a um administrador para liberar o setor correspondente no seu perfil.</li>
                  <li>Confira se o negócio/cliente está vinculado à sua conta.</li>
                  <li>Se você acabou de receber acesso, saia e entre novamente para atualizar a sessão.</li>
                </ul>
                <p className="text-[11px] text-muted-foreground/80">Detalhe técnico: {accessError}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => load()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {!accessError && notFound && (
          <div className="rounded-lg border bg-muted/40 p-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Nenhum briefing preenchido ainda</p>
              <p className="text-xs text-muted-foreground">
                {readOnly
                  ? "O time Comercial ainda não enviou o briefing deste cliente. Próximo passo: solicitar ao responsável pelo negócio o preenchimento do Briefing para Operação."
                  : "Preencha os campos abaixo e salve para que o time de Customer Success visualize o briefing."}
              </p>
            </div>
          </div>
        )}
        {ingestionIssues.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Briefing salvo, mas pode não chegar ao Customer Success</p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                {ingestionIssues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <Section title="Localização">
          <CountryStateCity
            value={{
              pais: data.pais,
              pais_codigo: data.pais_codigo,
              estado: data.estado,
              estado_uf: data.estado_uf,
              cidade: data.cidade,
            }}
            onChange={updateLocation}
            onCountryChange={handleCountryChange}
            disabled={readOnly}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Moeda dos valores financeiros</Label>
            <Select value={data.moeda_codigo} onValueChange={(v) => update("moeda_codigo", v)} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currencyCode, "BRL", "USD", "EUR", "GBP"].filter((v, i, a) => a.indexOf(v) === i).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Valores monetários são salvos na moeda original. {showConversion && `Conversão automática para BRL com cotação do dia (1 ${currencyCode} = ${formatBRL(fxRate)}).`}
            </p>
          </div>
        </Section>

        <Section title="Negócio do cliente">
          <NumberField
            label="Tempo de atuação (anos) *"
            value={data.tempo_atuacao_anos}
            onChange={(v) => update("tempo_atuacao_anos", v)}
            placeholder="ex.: 12"
            suffix="anos"
            readOnly={readOnly}
          />
          <TextField label="Especialidade *" value={data.especialidade} onChange={(v) => update("especialidade", v)} placeholder="ex.: Sobrancelha" readOnly={readOnly} />
          <TextField label="Foco de atuação *" value={data.foco_atuacao} onChange={(v) => update("foco_atuacao", v)} placeholder="ex.: Sobrancelha, Lash" readOnly={readOnly} />
        </Section>

        <Section title="Faturamento e finanças">
          <div className="sm:col-span-2 space-y-2 rounded-md border p-3">
            <Label className="text-xs font-semibold">Últimos 3 faturamentos ({currencyCode}) *</Label>
            <div className="grid grid-cols-3 gap-2">
              <MoneyField {...moneyProps} label="Mês -3 *" value={data.faturamento_mes_3} onChange={(v) => update("faturamento_mes_3", v)} placeholder="60000" readOnly={readOnly} compact />
              <MoneyField {...moneyProps} label="Mês -2 *" value={data.faturamento_mes_2} onChange={(v) => update("faturamento_mes_2", v)} placeholder="55000" readOnly={readOnly} compact />
              <MoneyField {...moneyProps} label="Mês -1 *" value={data.faturamento_mes_1} onChange={(v) => update("faturamento_mes_1", v)} placeholder="70000" readOnly={readOnly} compact />

            </div>
            <p className="text-[11px] text-muted-foreground">
              Digite só o número, sem &quot;mil&quot;. Ex.: 60000 (não &quot;60 mil&quot;).
            </p>
          </div>

          <MoneyField {...moneyProps} label="Ticket médio *" value={data.ticket_medio} onChange={(v) => update("ticket_medio", v)} placeholder="4000" readOnly={readOnly} />
          <NumberField label="Margem de lucro *" value={data.margem_lucro_percent} onChange={(v) => update("margem_lucro_percent", v)} placeholder="50" suffix="%" readOnly={readOnly} max={100} />
          <MoneyField {...moneyProps} label="Meta de faturamento *" value={data.meta_faturamento} onChange={(v) => update("meta_faturamento", v)} placeholder="100000" readOnly={readOnly} />

          <div className="space-y-1.5">
            <Label className="text-xs">Tem caixa?</Label>
            <div className="flex gap-2 items-stretch">
              <Select
                value={data.tem_caixa_bool === null ? "" : data.tem_caixa_bool ? "sim" : "nao"}
                onValueChange={(v) => {
                  update("tem_caixa_bool", v === "sim" ? true : v === "nao" ? false : null);
                  if (v !== "sim") update("caixa_valor", "");
                }}
                disabled={readOnly}
              >
                <SelectTrigger className="w-28"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
              {data.tem_caixa_bool === true && (
                <MoneyField {...moneyProps} label="" value={data.caixa_valor} onChange={(v) => update("caixa_valor", v)} placeholder="Valor" readOnly={readOnly} compact className="flex-1" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tráfego / Investimento</Label>
            <div className="flex gap-2">
              <MoneyField {...moneyProps} label="" value={data.trafego_investimento_valor} onChange={(v) => update("trafego_investimento_valor", v)} placeholder="2200" readOnly={readOnly} compact className="flex-1" />
              <Select
                value={data.trafego_investimento_periodo}
                onValueChange={(v) => update("trafego_investimento_periodo", v as Periodo)}
                disabled={readOnly}
              >
                <SelectTrigger className="w-36"><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section title="Estrutura da clínica">
          <TextField label="Estrutura *" value={data.estrutura_clinica} onChange={(v) => update("estrutura_clinica", v)} placeholder="ex.: 3 salas, recepção, copa" readOnly={readOnly} />
          <NumberField label="Nº de salas" value={data.numero_salas} onChange={(v) => update("numero_salas", v)} placeholder="3" readOnly={readOnly} integer />
          <NumberField label="Nº de funcionários *" value={data.numero_funcionarios_num} onChange={(v) => update("numero_funcionarios_num", v)} placeholder="2" readOnly={readOnly} integer />
          <NumberField label="Horas atende por dia" value={data.horas_atende_dia_num} onChange={(v) => update("horas_atende_dia_num", v)} placeholder="8" suffix="h" readOnly={readOnly} max={24} />
          <NumberField label="Dias atende por semana" value={data.dias_atende_semana_num} onChange={(v) => update("dias_atende_semana_num", v)} placeholder="5" suffix="dias" readOnly={readOnly} max={7} />
          <FieldArea label="Equipamentos" value={data.equipamentos} onChange={(v) => update("equipamentos", v)} placeholder="ex.: Laser que fica 15 dias na clínica" readOnly={readOnly} />
        </Section>

        <Section title="Histórico e objetivo">
          <BoolWithDetail
            label="Já fez mentoria?"
            boolValue={data.ja_fez_mentoria_bool}
            detailValue={data.ja_fez_mentoria_quem}
            onBoolChange={(b) => {
              update("ja_fez_mentoria_bool", b);
              if (!b) update("ja_fez_mentoria_quem", "");
            }}
            onDetailChange={(v) => update("ja_fez_mentoria_quem", v)}
            detailPlaceholder="Quem? Ex.: Alan Spadoni"
            readOnly={readOnly}
          />
          <BoolWithDetail
            label="Conhece alguma cliente nossa?"
            boolValue={data.conhece_cliente_nossa_bool}
            detailValue={data.conhece_cliente_nossa_quem}
            onBoolChange={(b) => {
              update("conhece_cliente_nossa_bool", b);
              if (!b) update("conhece_cliente_nossa_quem", "");
            }}
            onDetailChange={(v) => update("conhece_cliente_nossa_quem", v)}
            detailPlaceholder="Quem?"
            readOnly={readOnly}
          />
          <FieldArea label="Objetivo com a mentoria *" value={data.objetivo_mentoria} onChange={(v) => update("objetivo_mentoria", v)} placeholder="O que ela quer alcançar" readOnly={readOnly} />
          <div className="grid grid-cols-2 gap-3">
            <SwitchField label="Dá aulas" checked={data.da_aulas} onChange={(v) => update("da_aulas", v)} disabled={readOnly} />
            <SwitchField label="Dá cursos" checked={data.da_cursos} onChange={(v) => update("da_cursos", v)} disabled={readOnly} />
          </div>
          <FieldArea label="Observações livres" value={data.observacoes} onChange={(v) => update("observacoes", v)} placeholder="Qualquer informação adicional" readOnly={readOnly} />
        </Section>

        {!complete && (
          <div
            className={`rounded-md border p-3 text-xs ${
              showErrors
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            <p className="font-semibold">
              {showErrors
                ? `Não foi possível salvar: ${missing.length} campo(s) obrigatório(s) em branco.`
                : `Campos obrigatórios pendentes: ${missing.length}.`}
            </p>
            <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
              {missing.map((f) => (
                <li key={f}>{labelForBriefingField(f)}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-muted-foreground">
              O briefing só pode ser salvo com todos os campos obrigatórios preenchidos.
            </p>
          </div>
        )}


        {!readOnly && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar briefing
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============== Helpers internos ===============

function extractFirstNumber(s: any): string {
  if (!s) return "";
  const m = String(s).match(/\d+(?:[.,]\d+)?/);
  return m ? m[0].replace(",", ".") : "";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground/90 border-b pb-1">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder, readOnly,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly} />
    </div>
  );
}

function NumberField({
  label, value, onChange, placeholder, prefix, suffix, readOnly, compact, className, integer, max,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string;
  readOnly?: boolean; compact?: boolean; className?: string; integer?: boolean; max?: number;
}) {
  const handle = (raw: string) => {
    let cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
    if (integer) cleaned = cleaned.replace(/[.,]/g, "");
    if (cleaned !== "" && max !== undefined) {
      const n = Number(cleaned);
      if (Number.isFinite(n) && n > max) cleaned = String(max);
    }
    onChange(cleaned);
  };

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      {label && <Label className="text-xs">{label}</Label>}
      <div className="relative flex items-center">
        {prefix && (<span className="absolute left-3 text-xs text-muted-foreground pointer-events-none">{prefix}</span>)}
        <Input
          value={value}
          inputMode="decimal"
          onChange={(e) => handle(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`${prefix ? "pl-9" : ""} ${suffix ? "pr-12" : ""} ${compact ? "h-9" : ""}`}
        />
        {suffix && (<span className="absolute right-3 text-xs text-muted-foreground pointer-events-none">{suffix}</span>)}
      </div>
    </div>
  );
}

interface MoneyFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  compact?: boolean;
  className?: string;
  currencySymbol: string;
  currencyCode: string;
  fxRate: number;
  showConversion: boolean;
}

function MoneyField({
  label, value, onChange, placeholder, readOnly, compact, className,
  currencySymbol, currencyCode, fxRate, showConversion,
}: MoneyFieldProps) {
  const numeric = Number(String(value || "").replace(",", "."));
  const valid = Number.isFinite(numeric) && numeric > 0;
  const brlEquivalent = valid && showConversion ? numeric * fxRate : 0;

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <NumberField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        prefix={currencySymbol}
        readOnly={readOnly}
        compact={compact}
      />
      {showConversion && valid && (
        <p className="text-[11px] text-muted-foreground pl-1">
          ≈ {formatBRL(brlEquivalent)} <span className="opacity-70">(cotação de hoje)</span>
        </p>
      )}
      {!showConversion && valid && currencyCode !== "BRL" && fxRate === 0 && (
        <p className="text-[11px] text-muted-foreground pl-1">Cotação indisponível para {currencyCode}</p>
      )}
    </div>
  );
}

function FieldArea({
  label, value, onChange, placeholder, readOnly,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean }) {
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} readOnly={readOnly} />
    </div>
  );
}

function SwitchField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function BoolWithDetail({
  label, boolValue, detailValue, onBoolChange, onDetailChange, detailPlaceholder, readOnly,
}: {
  label: string; boolValue: boolean | null; detailValue: string;
  onBoolChange: (v: boolean) => void; onDetailChange: (v: string) => void;
  detailPlaceholder?: string; readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Select
          value={boolValue === null ? "" : boolValue ? "sim" : "nao"}
          onValueChange={(v) => onBoolChange(v === "sim")}
          disabled={readOnly}
        >
          <SelectTrigger className="w-28"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sim">Sim</SelectItem>
            <SelectItem value="nao">Não</SelectItem>
          </SelectContent>
        </Select>
        {boolValue && (
          <Input
            value={detailValue}
            onChange={(e) => onDetailChange(e.target.value)}
            placeholder={detailPlaceholder}
            readOnly={readOnly}
            className="flex-1"
          />
        )}
      </div>
    </div>
  );
}
