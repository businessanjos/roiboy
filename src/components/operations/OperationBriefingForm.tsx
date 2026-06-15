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
import { ClipboardList, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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

export function OperationBriefingForm({ dealId, clientId, onSaved, readOnly = false }: OperationBriefingFormProps) {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OperationBriefingData>(EMPTY);
  const [originalId, setOriginalId] = useState<string | null>(null);
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
    let query = supabase.from("deal_operation_briefings").select("*").limit(1);
    if (dealId) query = query.eq("deal_id", dealId);
    else if (clientId) query = query.eq("client_id", clientId);

    const { data: row, error } = await query.maybeSingle();
    if (error && error.code !== "PGRST116") {
      console.error("Erro ao carregar briefing:", error);
    }
    if (row) {
      setOriginalId(row.id);
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
      setData({ ...loadedData, ...(readLocalAutosaveDraft<Partial<OperationBriefingData>>(draftKey) || {}) });
    } else {
      setOriginalId(null);
      setData({ ...EMPTY, ...(readLocalAutosaveDraft<Partial<OperationBriefingData>>(draftKey) || {}) });
    }
    setLoading(false);
  }, [dealId, clientId, draftKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (readOnly || loading || !draftKey) return;
    writeLocalAutosaveDraft(draftKey, data);
  }, [readOnly, loading, draftKey, data]);

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

  const handleSave = async () => {
    if (!currentUser?.account_id) {
      toast.error("Usuário sem conta vinculada");
      return;
    }
    setSaving(true);
    const complete = isBriefingComplete(data);

    const symbolForResume = country?.currencySymbol || "R$";
    const faturamentosResumo = [data.faturamento_mes_1, data.faturamento_mes_2, data.faturamento_mes_3]
      .map((v) => (v ? `${symbolForResume} ${v}` : "-"))
      .join(" / ");

    const trafegoResumo = data.trafego_investimento_valor
      ? `${symbolForResume} ${data.trafego_investimento_valor}/${data.trafego_investimento_periodo || "—"}`
      : "";

    const payload: any = {
      account_id: currentUser.account_id,
      deal_id: dealId || null,
      client_id: clientId || null,

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
      if (inserted) setOriginalId(inserted.id);
    }
    setSaving(false);

    if (error) {
      console.error("Erro ao salvar briefing:", error);
      toast.error("Erro ao salvar briefing operacional");
      return;
    }
    toast.success(complete ? "Briefing salvo e completo" : "Briefing salvo (campos pendentes)");
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

  // Componente local que injeta a moeda corrente
  const Money = (props: Omit<MoneyFieldProps, "currencySymbol" | "currencyCode" | "fxRate" | "showConversion">) => (
    <MoneyField
      {...props}
      currencySymbol={symbol}
      currencyCode={currencyCode}
      fxRate={fxRate}
      showConversion={showConversion}
    />
  );

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
              <Money label="Mês -3" value={data.faturamento_mes_3} onChange={(v) => update("faturamento_mes_3", v)} placeholder="60000" readOnly={readOnly} compact />
              <Money label="Mês -2" value={data.faturamento_mes_2} onChange={(v) => update("faturamento_mes_2", v)} placeholder="55000" readOnly={readOnly} compact />
              <Money label="Mês -1" value={data.faturamento_mes_1} onChange={(v) => update("faturamento_mes_1", v)} placeholder="70000" readOnly={readOnly} compact />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Digite só o número, sem &quot;mil&quot;. Ex.: 60000 (não &quot;60 mil&quot;).
            </p>
          </div>

          <Money label="Ticket médio *" value={data.ticket_medio} onChange={(v) => update("ticket_medio", v)} placeholder="4000" readOnly={readOnly} />
          <NumberField label="Margem de lucro *" value={data.margem_lucro_percent} onChange={(v) => update("margem_lucro_percent", v)} placeholder="50" suffix="%" readOnly={readOnly} max={100} />
          <Money label="Meta de faturamento *" value={data.meta_faturamento} onChange={(v) => update("meta_faturamento", v)} placeholder="100000" readOnly={readOnly} />

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
                <Money label="" value={data.caixa_valor} onChange={(v) => update("caixa_valor", v)} placeholder="Valor" readOnly={readOnly} compact className="flex-1" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tráfego / Investimento</Label>
            <div className="flex gap-2">
              <Money label="" value={data.trafego_investimento_valor} onChange={(v) => update("trafego_investimento_valor", v)} placeholder="2200" readOnly={readOnly} compact className="flex-1" />
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
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Campos obrigatórios pendentes: {missing.length}. O Negócio só poderá ser marcado como Ganho com o briefing completo.
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
