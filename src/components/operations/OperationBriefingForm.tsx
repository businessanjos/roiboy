import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export interface OperationBriefingData {
  id?: string;
  tempo_atuacao: string;
  ja_fez_mentoria: string;
  conhece_cliente_nossa: string;
  ultimos_faturamentos: string;
  ticket_medio: string;
  margem_lucro: string;
  horas_atende_dia: string;
  foco_atuacao: string;
  objetivo_mentoria: string;
  cidade: string;
  estrutura_clinica: string;
  numero_funcionarios: string;
  meta_faturamento: string;
  especialidade: string;
  da_aulas: boolean;
  dias_atende_semana: string;
  trafego_investimento: string;
  da_cursos: boolean;
  tem_caixa: string;
  equipamentos: string;
  observacoes: string;
  is_complete: boolean;
}

const EMPTY: OperationBriefingData = {
  tempo_atuacao: "",
  ja_fez_mentoria: "",
  conhece_cliente_nossa: "",
  ultimos_faturamentos: "",
  ticket_medio: "",
  margem_lucro: "",
  horas_atende_dia: "",
  foco_atuacao: "",
  objetivo_mentoria: "",
  cidade: "",
  estrutura_clinica: "",
  numero_funcionarios: "",
  meta_faturamento: "",
  especialidade: "",
  da_aulas: false,
  dias_atende_semana: "",
  trafego_investimento: "",
  da_cursos: false,
  tem_caixa: "",
  equipamentos: "",
  observacoes: "",
  is_complete: false,
};

// Campos essenciais para considerar "completo" e liberar o ganho
export const REQUIRED_BRIEFING_FIELDS: (keyof OperationBriefingData)[] = [
  "tempo_atuacao",
  "ultimos_faturamentos",
  "ticket_medio",
  "margem_lucro",
  "foco_atuacao",
  "objetivo_mentoria",
  "cidade",
  "estrutura_clinica",
  "numero_funcionarios",
  "meta_faturamento",
  "especialidade",
];

export function isBriefingComplete(b: Partial<OperationBriefingData> | null | undefined): boolean {
  if (!b) return false;
  return REQUIRED_BRIEFING_FIELDS.every((f) => {
    const v = (b as any)[f];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
}

interface OperationBriefingFormProps {
  dealId?: string | null;
  clientId?: string | null;
  onSaved?: (data: OperationBriefingData) => void;
  /** Quando true, mostra apenas leitura (ex.: visualização rápida) */
  readOnly?: boolean;
}

export function OperationBriefingForm({ dealId, clientId, onSaved, readOnly = false }: OperationBriefingFormProps) {
  const { currentUser } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OperationBriefingData>(EMPTY);
  const [originalId, setOriginalId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dealId && !clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = supabase.from("deal_operation_briefings").select("*").limit(1);
    if (dealId) query = query.eq("deal_id", dealId);
    else if (clientId) query = query.eq("client_id", clientId);

    const { data: rows, error } = await query.maybeSingle();
    if (error && error.code !== "PGRST116") {
      console.error("Erro ao carregar briefing:", error);
    }
    if (rows) {
      setOriginalId(rows.id);
      setData({
        ...EMPTY,
        ...Object.fromEntries(
          Object.entries(rows).map(([k, v]) => [k, v === null ? (typeof (EMPTY as any)[k] === "boolean" ? false : "") : v])
        ),
        ticket_medio: rows.ticket_medio?.toString() ?? "",
        meta_faturamento: rows.meta_faturamento?.toString() ?? "",
      } as OperationBriefingData);
    } else {
      setOriginalId(null);
      setData(EMPTY);
    }
    setLoading(false);
  }, [dealId, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = <K extends keyof OperationBriefingData>(key: K, value: OperationBriefingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!currentUser?.account_id) {
      toast.error("Usuário sem conta vinculada");
      return;
    }
    setSaving(true);
    const complete = isBriefingComplete(data);
    const payload: any = {
      account_id: currentUser.account_id,
      deal_id: dealId || null,
      client_id: clientId || null,
      tempo_atuacao: data.tempo_atuacao || null,
      ja_fez_mentoria: data.ja_fez_mentoria || null,
      conhece_cliente_nossa: data.conhece_cliente_nossa || null,
      ultimos_faturamentos: data.ultimos_faturamentos || null,
      ticket_medio: data.ticket_medio ? Number(String(data.ticket_medio).replace(",", ".")) : null,
      margem_lucro: data.margem_lucro || null,
      horas_atende_dia: data.horas_atende_dia || null,
      foco_atuacao: data.foco_atuacao || null,
      objetivo_mentoria: data.objetivo_mentoria || null,
      cidade: data.cidade || null,
      estrutura_clinica: data.estrutura_clinica || null,
      numero_funcionarios: data.numero_funcionarios || null,
      meta_faturamento: data.meta_faturamento ? Number(String(data.meta_faturamento).replace(",", ".")) : null,
      especialidade: data.especialidade || null,
      da_aulas: data.da_aulas,
      dias_atende_semana: data.dias_atende_semana || null,
      trafego_investimento: data.trafego_investimento || null,
      da_cursos: data.da_cursos,
      tem_caixa: data.tem_caixa || null,
      equipamentos: data.equipamentos || null,
      observacoes: data.observacoes || null,
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
    onSaved?.({ ...data, is_complete: complete });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const complete = isBriefingComplete(data);
  const missing = REQUIRED_BRIEFING_FIELDS.filter((f) => !String((data as any)[f] ?? "").trim());

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2">
            <ClipboardList className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <CardTitle className="text-base">Briefing para Operação</CardTitle>
              <CardDescription>
                Informações estruturadas que a Operação precisa receber do Comercial
              </CardDescription>
            </div>
          </div>
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
      </CardHeader>
      <CardContent className="space-y-6">
        <Section title="Negócio do cliente">
          <Field label="Tempo de atuação *" value={data.tempo_atuacao} onChange={(v) => update("tempo_atuacao", v)} placeholder="ex.: 12 anos" readOnly={readOnly} />
          <Field label="Especialidade *" value={data.especialidade} onChange={(v) => update("especialidade", v)} placeholder="ex.: Sobrancelha" readOnly={readOnly} />
          <Field label="Foco de atuação *" value={data.foco_atuacao} onChange={(v) => update("foco_atuacao", v)} placeholder="ex.: Sobrancelha, Lash" readOnly={readOnly} />
          <Field label="Cidade *" value={data.cidade} onChange={(v) => update("cidade", v)} placeholder="ex.: Santa Cruz do Sul" readOnly={readOnly} />
        </Section>

        <Section title="Faturamento e finanças">
          <Field label="Últimos 3 faturamentos *" value={data.ultimos_faturamentos} onChange={(v) => update("ultimos_faturamentos", v)} placeholder="ex.: 60 mil / 55 / 70" readOnly={readOnly} />
          <Field label="Ticket médio (R$) *" type="number" value={data.ticket_medio} onChange={(v) => update("ticket_medio", v)} placeholder="ex.: 4000" readOnly={readOnly} />
          <Field label="Margem de lucro *" value={data.margem_lucro} onChange={(v) => update("margem_lucro", v)} placeholder="ex.: 50%" readOnly={readOnly} />
          <Field label="Meta de faturamento (R$) *" type="number" value={data.meta_faturamento} onChange={(v) => update("meta_faturamento", v)} placeholder="ex.: 100000" readOnly={readOnly} />
          <Field label="Tem caixa?" value={data.tem_caixa} onChange={(v) => update("tem_caixa", v)} placeholder="Sim / Não / valor" readOnly={readOnly} />
          <Field label="Tráfego / investimento" value={data.trafego_investimento} onChange={(v) => update("trafego_investimento", v)} placeholder="ex.: R$ 2.200/mês" readOnly={readOnly} />
        </Section>

        <Section title="Estrutura da clínica">
          <Field label="Estrutura *" value={data.estrutura_clinica} onChange={(v) => update("estrutura_clinica", v)} placeholder="ex.: 3 salas" readOnly={readOnly} />
          <Field label="Nº de funcionários *" value={data.numero_funcionarios} onChange={(v) => update("numero_funcionarios", v)} placeholder="ex.: 1 colaboradora + 1 biomédica aluga sala" readOnly={readOnly} />
          <Field label="Horas atende por dia" value={data.horas_atende_dia} onChange={(v) => update("horas_atende_dia", v)} placeholder="ex.: 8h" readOnly={readOnly} />
          <Field label="Dias atende na semana" value={data.dias_atende_semana} onChange={(v) => update("dias_atende_semana", v)} placeholder="ex.: 3 dias e meio" readOnly={readOnly} />
          <FieldArea label="Equipamentos" value={data.equipamentos} onChange={(v) => update("equipamentos", v)} placeholder="ex.: Laser que fica 15 dias na clínica" readOnly={readOnly} />
        </Section>

        <Section title="Histórico e objetivo">
          <Field label="Já fez mentoria?" value={data.ja_fez_mentoria} onChange={(v) => update("ja_fez_mentoria", v)} placeholder="ex.: Sim - Alan Spadoni / Fernanda Toquito" readOnly={readOnly} />
          <Field label="Conhece alguma cliente nossa?" value={data.conhece_cliente_nossa} onChange={(v) => update("conhece_cliente_nossa", v)} placeholder="Sim/Não - quem" readOnly={readOnly} />
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground/90 border-b pb-1">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", readOnly,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} type={type} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly} />
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
