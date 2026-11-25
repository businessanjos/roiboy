import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Deal, DealStage } from "@/hooks/useDeals";
import type { Pipeline } from "@/hooks/usePipelines";
import type { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { InlineFieldInput } from "./InlineFieldInput";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, XCircle, GitBranch, Package, DollarSign, ListFilter, Layers } from "lucide-react";
import { DEAL_FIELD_IDS } from "@/utils/dealToClientContractMapping";
import { bulkDestinationPipelines, parseBulkNumber, type BulkDealAction, type BulkDealResult } from "@/lib/sales/bulkDeals";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: Deal[];
  pipelines: Pipeline[];
  activePipelineId: string | null;
  running: boolean;
  results: BulkDealResult[];
  total: number;
  onRun: (deals: Deal[], action: BulkDealAction) => Promise<BulkDealResult[]>;
  onCancel: () => void;
  onReset: () => void;
}

type Product = { id: string; name: string; color: string | null; company_id: string | null };
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function BulkDealDialog({ open, onOpenChange, deals, pipelines, activePipelineId, running, results, total, onRun, onCancel, onReset }: Props) {
  const { currentUser } = useCurrentUser();
  const [snapshot, setSnapshot] = useState<Deal[]>([]);
  const [type, setType] = useState<BulkDealAction["type"]>("move");
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [stages, setStages] = useState<(DealStage & { pipeline_id: string | null })[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fieldId, setFieldId] = useState("");
  const [productId, setProductId] = useState("");
  const [value, setValue] = useState<unknown>(null);
  const [numericDraft, setNumericDraft] = useState("");
  const [review, setReview] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const wasOpen = useRef(false);
  const applying = useRef(false);
  const destinations = bulkDestinationPipelines(pipelines);
  const field = fields.find(item => item.id === fieldId);
  const product = products.find(item => item.id === productId);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSnapshot([...deals]); setPipelineId(activePipelineId || ""); setStageId("");
      setType("move"); setFieldId(""); setProductId(""); setValue(null); setNumericDraft("");
      setReview(false); setFinished(false); onReset();
    }
    wasOpen.current = open;
  }, [open, deals, activePipelineId, onReset]);

  useEffect(() => {
    if (!open || !currentUser?.account_id) return;
    let cancelled = false;
    setLoading(true); setError("");
    Promise.all([
      supabase.from("deal_stages").select("*").eq("account_id", currentUser.account_id).eq("is_active", true).order("display_order"),
      supabase.from("custom_fields").select("*").eq("account_id", currentUser.account_id).eq("show_in_deals", true).eq("is_active", true).order("display_order"),
      supabase.from("products").select("id, name, color, company_id").eq("account_id", currentUser.account_id).eq("is_active", true).order("name"),
    ]).then(([stageRes, fieldRes, productRes]) => {
      if (cancelled) return;
      if (stageRes.error || fieldRes.error || productRes.error) { setError("Não foi possível carregar as opções. Tente novamente."); return; }
      setStages(stageRes.data || []);
      setFields((fieldRes.data || []).filter(item => item.id !== DEAL_FIELD_IDS.ITEM_VENDA && item.id !== DEAL_FIELD_IDS.PAYMENT_BREAKDOWN).map(item => ({ ...item, field_type: item.field_type as CustomField["field_type"], options: (item.options || []) as unknown as CustomField["options"] })));
      setProducts(productRes.data || []);
    }).catch(() => { if (!cancelled) setError("Não foi possível carregar as opções. Tente novamente."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, currentUser?.account_id, reload]);

  const numeric = parseBulkNumber(numericDraft);
  let action: BulkDealAction | null = null;
  if (type === "move" && destinations.some(p => p.id === pipelineId) && stages.some(s => s.id === stageId && s.pipeline_id === pipelineId)) action = { type, pipelineId, stageId };
  if (type === "product" && product) action = { type, productId };
  if (type === "value" && numeric !== null && numeric >= 0) action = { type, value: numeric };
  if (type === "field" && field) {
    const next = field.field_type === "currency" || field.field_type === "number" ? numeric : value;
    const filled = next !== null && next !== undefined && next !== "" && (!Array.isArray(next) || next.length > 0);
    if (filled) action = { type, field, value: next };
  }
  const label = type === "move" ? `Funil e etapa: ${pipelines.find(p => p.id === pipelineId)?.name || ""} → ${stages.find(s => s.id === stageId)?.name || ""}`
    : type === "product" ? `Produto: ${product?.name || ""}`
    : type === "value" ? `Valor de cada negócio: ${money(numeric || 0)}`
    : `${field?.name || "Campo"}: ${field?.field_type === "select" ? field.options.find(option => option.value === value)?.label || value : typeof value === "boolean" ? value ? "Sim" : "Não" : (field?.field_type === "number" || field?.field_type === "currency") ? numericDraft : Array.isArray(value) ? value.map(v => field?.options.find(o => o.value === v)?.label || v).join(", ") : typeof value === "object" ? JSON.stringify(value) : value || ""}`;
  const successes = results.filter(row => row.success && row.changed !== false).length;
  const unchanged = results.filter(row => row.success && row.changed === false).length;
  const failures = results.filter(row => !row.success);
  const pending = Math.max(0, total - results.length);

  const execute = async () => {
    if (!action || running || applying.current) return;
    applying.current = true;
    try { await onRun(snapshot, action); } catch (error) { setError((error as { message?: string }).message || "Não foi possível confirmar a alteração. Confira o histórico antes de tentar novamente."); }
    finally { applying.current = false; }
    setFinished(true);
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!running) onOpenChange(next); }}>
      <DialogContent className="flex max-h-[86dvh] w-[calc(100%_-_2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-lg p-0" onEscapeKeyDown={event => { if (running) event.preventDefault(); }} onPointerDownOutside={event => { if (running) event.preventDefault(); }}>
        <DialogHeader className="shrink-0 border-b px-4 py-5 pr-14 text-left sm:px-6 sm:pr-14">
          <DialogTitle className="flex items-center gap-2 leading-snug"><Layers className="h-5 w-5 shrink-0 text-primary" />{finished ? "Resultado das alterações" : running ? "Aplicando alterações" : review ? "Confirmar alteração em massa" : "Alterar negócios em massa"}</DialogTitle>
          <DialogDescription>{snapshot.length.toLocaleString("pt-BR")} negócio{snapshot.length === 1 ? " selecionado" : "s selecionados"}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 [&_input]:text-base [&_textarea]:text-base">
          {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={() => setReload(tick => tick + 1)} className="h-11">Tentar novamente</Button></div>}
          {!review && !running && !finished && <>
            <div className="space-y-2"><Label>Alteração</Label>
              <ToggleGroup type="single" variant="outline" value={type} onValueChange={next => { if (next === "move" || next === "product" || next === "value" || next === "field") { setType(next); setValue(null); setNumericDraft(""); } }} aria-label="Tipo de alteração" className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                {[{ value: "move", label: "Funil / etapa", icon: GitBranch }, { value: "product", label: "Produto", icon: Package }, { value: "value", label: "Valor", icon: DollarSign }, { value: "field", label: "Campo", icon: ListFilter }].map(item => <ToggleGroupItem key={item.value} value={item.value} title={item.label} className="h-16 w-full flex-col gap-1.5 rounded-md text-xs data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"><item.icon className="h-4 w-4" />{item.label}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
            {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando opções…</p> : <>
              {type === "move" && <div className="grid min-w-0 gap-4 sm:grid-cols-2 [&>div]:min-w-0 [&_button]:min-w-0">
                <div className="space-y-2"><Label htmlFor="bulk-pipeline">Funil de destino</Label><Select value={pipelineId} onValueChange={next => { setPipelineId(next); setStageId(""); }}><SelectTrigger id="bulk-pipeline" className="h-11"><SelectValue placeholder="Escolha o funil" /></SelectTrigger><SelectContent>{destinations.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="bulk-stage">Etapa de destino</Label><Select value={stageId} onValueChange={setStageId}><SelectTrigger id="bulk-stage" className="h-11"><SelectValue placeholder="Escolha a etapa" /></SelectTrigger><SelectContent>{stages.filter(s => s.pipeline_id === pipelineId).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              </div>}
              {type === "product" && <div className="space-y-2"><Label htmlFor="bulk-product">Produto</Label><Select value={productId} onValueChange={setProductId}><SelectTrigger id="bulk-product" className="h-11"><SelectValue placeholder="Escolha o produto" /></SelectTrigger><SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                {product && <Badge variant="outline" className="max-w-full whitespace-normal" style={product.color ? { color: product.color, borderColor: product.color } : undefined}>{product.name}</Badge>}
              </div>}
              {type === "value" && <div className="space-y-2"><Label htmlFor="bulk-value">Novo valor de cada negócio (R$)</Label><Input id="bulk-value" inputMode="decimal" value={numericDraft} onChange={event => setNumericDraft(event.target.value)} placeholder="35.000,00" className="h-11" /></div>}
              {type === "field" && <div className="space-y-3"><div className="space-y-2"><Label htmlFor="bulk-field">Campo personalizado</Label><Select value={fieldId} onValueChange={next => { setFieldId(next); setValue(null); setNumericDraft(""); }}><SelectTrigger id="bulk-field" className="h-11"><SelectValue placeholder="Escolha o campo" /></SelectTrigger><SelectContent>{fields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
                {field && <div className="space-y-2"><Label>Novo valor</Label>{field.field_type === "number" || field.field_type === "currency" ? <Input aria-label="Novo valor do campo" inputMode="decimal" value={numericDraft} onChange={event => setNumericDraft(event.target.value)} placeholder={field.field_type === "currency" ? "35.000,00" : "0"} className="h-11" /> : <InlineFieldInput key={field.id} field={field} value={value} onChange={setValue} />}</div>}
              </div>}
            </>}
          </>}
          {(review || running || finished) && <>
            <div className="border-l-2 border-primary pl-3 text-sm font-medium break-words">{label}</div>
            {!running && !finished && <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning-strong"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p>A alteração será aplicada {snapshot.length === 1 ? "ao negócio selecionado" : `aos ${snapshot.length} negócios selecionados`}.</p><p className="mt-1">{type === "move" ? "O status atual será mantido: ganhos continuam ganhos, perdidos continuam perdidos e abertos continuam abertos. Datas de fechamento, responsáveis e contratos existentes não mudam." : type === "product" ? "A empresa de cada venda acompanha o produto; o valor do negócio e os contratos existentes não mudam." : "As demais informações, responsáveis e contratos existentes não mudam."}</p></div></div>}
            {(running || finished) && <div className="space-y-2" aria-live="polite"><Progress value={total ? results.length / total * 100 : 0} className="h-1.5" /><p className="text-sm text-muted-foreground tabular-nums">{results.length} de {total} processados · {successes} alterados · {failures.length} não alterados{unchanged ? ` · ${unchanged} já estavam assim` : ""}{finished && pending > 0 ? ` · ${pending} não processados` : ""}</p></div>}
            <ul className="divide-y border-y text-sm">{snapshot.map((deal, index) => {
              const result = results.find(row => row.id === deal.id);
              return <li key={deal.id} className="flex min-h-11 items-start gap-3 py-3"><span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1 break-words">{deal.title}{result?.error && <span className="mt-1 block text-xs text-destructive">{result.error}</span>}</span>{result ? result.success ? <CheckCircle2 aria-label="Alterado" className="h-4 w-4 shrink-0 text-success" /> : <XCircle aria-label="Não alterado" className="h-4 w-4 shrink-0 text-destructive" /> : finished ? <span className="text-xs text-muted-foreground">Não processado</span> : null}</li>;
            })}</ul>
          </>}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 px-4 py-4 sm:px-6 sm:space-x-0 [&_button]:whitespace-normal">
          {running ? <Button variant="outline" onClick={onCancel} className="h-11">Interromper próximos</Button>
            : finished ? <Button onClick={() => onOpenChange(false)} className="h-11">Concluir</Button>
            : <><Button variant="outline" onClick={() => review ? setReview(false) : onOpenChange(false)} className="h-11">{review ? <><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</> : "Cancelar"}</Button><Button onClick={() => review ? execute() : setReview(true)} disabled={!action || loading || !!error || snapshot.length === 0} className="h-11">{review ? `Aplicar em ${snapshot.length} negócio${snapshot.length === 1 ? "" : "s"}` : <>Revisar alteração <ArrowRight className="ml-2 h-4 w-4" /></>}</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}