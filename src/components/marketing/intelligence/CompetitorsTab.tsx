import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, RefreshCw, Trash2, ExternalLink, Loader2, ChevronDown, Search,
  ShieldAlert, Lightbulb, Target, TrendingUp, TrendingDown, Sparkles, Swords, Users,
  BadgeCheck, AlertTriangle, EyeOff,
} from "lucide-react";
import { MiSectionHeader } from "./MiSectionHeader";
import { MiEmptyState } from "./MiEmptyState";
import { CompetitorsSyncPanel } from "./CompetitorsSyncPanel";
import { formatTicketRange, tierLabel } from "./tierTicket";

type CompetitorType = "direto" | "indireto" | "transversal";

type Competitor = {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  tags: string[] | null;
  last_scanned_at: string | null;
  created_at: string;
  competitor_type: CompetitorType;
  audience: string | null;
  tier: string | null;
  source: string | null;
  name_confidence: string | null;
  mentors: string[] | null;
  positioning: string | null;
  previous_tier?: string | null;
  tier_changed_at?: string | null;
  verification_status?: string | null;
  verification_note?: string | null;
  verified_at?: string | null;
};


type Snapshot = {
  id: string;
  competitor_id: string;
  scanned_at: string;
  summary: string | null;
  ai_analysis: any;
  source_url: string | null;
};

const urgencyColors: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  high: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};

const typeMeta: Record<CompetitorType, { label: string; hint: string; className: string }> = {
  direto: {
    label: "Direto",
    hint: "Disputa o mesmo ICP (médico / estética avançada empresário).",
    className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
  },
  indireto: {
    label: "Indireto",
    hint: "Saúde/odonto adjacente — mesmo bolso, ICP vizinho.",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  transversal: {
    label: "Transversal",
    hint: "Mentoria generalista de negócios que também atrai médicos.",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
};

const audienceLabels: Record<string, string> = {
  medicos: "Médicos",
  estetica: "Estética",
  odontologia: "Odontologia",
  saude_geral: "Saúde (geral)",
  mentores: "Mentores / donos de mentoria",
};

type VerificationStatus = "nao_verificado" | "verificado" | "contestado" | "removido";

const verificationMeta: Record<VerificationStatus, { label: string; className: string }> = {
  nao_verificado: {
    label: "Não verificado",
    className: "bg-muted text-muted-foreground border-border",
  },
  verificado: {
    label: "Verificado",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  contestado: {
    label: "Dado contestado",
    className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
  },
  removido: {
    label: "Descartado",
    className: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  },
};

const vStatus = (c: { verification_status?: string | null }): VerificationStatus =>
  (c.verification_status as VerificationStatus) || "nao_verificado";

const tierClass: Record<string, string> = {
  platinum: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  gold: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  silver: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  bronze: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
};

const TIER_RANK: Record<string, number> = {
  gold: 0,
  platinum: 1,
  silver: 2,
  bronze: 3,
};

const tierRank = (tier?: string | null) => {
  const r = TIER_RANK[(tier || "").toLowerCase()];
  return r === undefined ? 99 : r;
};


export default function CompetitorsTab() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; website: string; notes: string; competitor_type: CompetitorType; audience: string }>({
    name: "", website: "", notes: "", competitor_type: "direto", audience: "medicos",
  });
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"todos" | CompetitorType>("todos");
  const [audienceFilter, setAudienceFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<"ativos" | VerificationStatus | "todos">("ativos");
  const [search, setSearch] = useState("");

  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ["mi-competitors", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_competitors")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as unknown as Competitor[];
    },
  });

  const { data: snapshotsMap = {} } = useQuery({
    queryKey: ["mi-competitor-snapshots", competitors.map((c) => c.id).join(",")],
    enabled: competitors.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_competitor_snapshots")
        .select("id, competitor_id, scanned_at, summary, ai_analysis, source_url")
        .in("competitor_id", competitors.map((c) => c.id))
        .order("scanned_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, Snapshot> = {};
      for (const s of data as Snapshot[]) {
        if (!map[s.competitor_id]) map[s.competitor_id] = s;
      }
      return map;
    },
  });

  const counts = useMemo(() => {
    const base = { todos: competitors.length, direto: 0, indireto: 0, transversal: 0 } as Record<string, number>;
    for (const c of competitors) base[c.competitor_type] = (base[c.competitor_type] || 0) + 1;
    return base;
  }, [competitors]);

  const statusCounts = useMemo(() => {
    const base: Record<string, number> = { nao_verificado: 0, verificado: 0, contestado: 0, removido: 0 };
    for (const c of competitors) base[vStatus(c)] = (base[vStatus(c)] || 0) + 1;
    return base;
  }, [competitors]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return competitors.filter((c) => {
      const st = vStatus(c);
      if (statusFilter === "ativos" ? st === "removido" : statusFilter !== "todos" && st !== statusFilter) return false;
      if (typeFilter !== "todos" && c.competitor_type !== typeFilter) return false;
      if (audienceFilter !== "todos" && (c.audience || "") !== audienceFilter) return false;
      if (!term) return true;
      return [c.name, c.positioning, c.notes, (c.mentors || []).join(" "), (c.tags || []).join(" ")]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    }).sort((a, b) => {
      const diff = tierRank(a.tier) - tierRank(b.tier);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [competitors, typeFilter, audienceFilter, statusFilter, search]);


  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome obrigatório");
      if (!currentUser?.account_id) throw new Error("Sem conta");
      const { error } = await supabase.from("mi_competitors").insert({
        account_id: currentUser.account_id,
        name: form.name.trim(),
        website: form.website.trim() || null,
        notes: form.notes.trim() || null,
        competitor_type: form.competitor_type,
        audience: form.audience,
        source: "manual",
        created_by: currentUser.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Concorrente adicionado");
      setForm({ name: "", website: "", notes: "", competitor_type: "direto", audience: "medicos" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["mi-competitors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, competitor_type }: { id: string; competitor_type: CompetitorType }) => {
      const { error } = await supabase.from("mi_competitors").update({ competitor_type } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mi-competitors"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: VerificationStatus; note?: string | null }) => {
      const { error } = await supabase
        .from("mi_competitors")
        .update({
          verification_status: status,
          verification_note: note ?? null,
          verified_by: currentUser?.id ?? null,
          verified_at: new Date().toISOString(),
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(
        v.status === "verificado" ? "Marcado como verificado"
          : v.status === "contestado" ? "Marcado como contestado"
          : v.status === "removido" ? "Descartado do mapa"
          : "Status atualizado",
      );
      qc.invalidateQueries({ queryKey: ["mi-competitors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mi_competitors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["mi-competitors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const scan = async (id: string) => {
    setScanningId(id);
    try {
      const { data, error } = await supabase.functions.invoke("mi-competitor-scan", {
        body: { competitorId: id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Scan concluído");
      qc.invalidateQueries({ queryKey: ["mi-competitors"] });
      qc.invalidateQueries({ queryKey: ["mi-competitor-snapshots"] });
    } catch (e: any) {
      toast.error(e.message || "Falha no scan");
    } finally {
      setScanningId(null);
    }
  };

  return (
    <div className="space-y-4">
      <MiSectionHeader
        icon={Swords}
        title="Mapa de concorrentes"
        description="Diretos, indiretos e transversais. A base inicial veio do screening do Members Book 2026 da MLS (mentorias para médicos, estética e odontologia). Com site cadastrado, o scan usa Firecrawl + IA para detalhar posicionamento, ofertas, preços, ameaças e oportunidades."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo concorrente</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Nome</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Concorrente XYZ"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Tipo</label>
                    <Select value={form.competitor_type} onValueChange={(v) => setForm({ ...form, competitor_type: v as CompetitorType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(typeMeta) as CompetitorType[]).map((t) => (
                          <SelectItem key={t} value={t}>{typeMeta[t].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Público-alvo</label>
                    <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(audienceLabels).map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Site (opcional)</label>
                  <Input
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Notas (opcional)</label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                  {addMutation.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <CompetitorsSyncPanel />

      <div className="flex flex-wrap items-center gap-2">

        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <TabsList>
            <TabsTrigger value="todos">Todos ({counts.todos})</TabsTrigger>
            <TabsTrigger value="direto">Diretos ({counts.direto})</TabsTrigger>
            <TabsTrigger value="indireto">Indiretos ({counts.indireto})</TabsTrigger>
            <TabsTrigger value="transversal">Transversais ({counts.transversal})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={audienceFilter} onValueChange={setAudienceFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Público" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os públicos</SelectItem>
            {Object.entries(audienceLabels).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, mentor ou posicionamento"
          />
        </div>
      </div>

      {typeFilter !== "todos" && (
        <p className="text-xs text-muted-foreground">{typeMeta[typeFilter].hint}</p>
      )}

      {isLoading && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Carregando…</CardContent></Card>
      )}

      {!isLoading && filtered.length === 0 && (
        <MiEmptyState
          icon={Swords}
          title="Nenhum concorrente nesse recorte"
          description='Ajuste os filtros ou clique em "Adicionar" para mapear novos players que disputam o mesmo ICP.'
        />
      )}

      <div className="space-y-3">
        {filtered.map((c) => {
          const snap = snapshotsMap[c.id];
          const a = snap?.ai_analysis || null;
          const meta = typeMeta[c.competitor_type] || typeMeta.direto;
          return (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{c.name}</h3>
                      <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                      {c.audience && (
                        <Badge variant="outline">{audienceLabels[c.audience] || c.audience}</Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={c.tier ? tierClass[c.tier] || "" : "bg-muted text-muted-foreground border-border"}
                      >
                        {c.tier ? `MLS ${tierLabel(c.tier)}` : "Sem categoria"}
                      </Badge>

                      {formatTicketRange(c.tier) && (
                        <Badge variant="outline" className="text-[11px] font-normal">
                          ticket {formatTicketRange(c.tier)}
                        </Badge>
                      )}
                      {c.previous_tier && c.tier_changed_at && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[11px]">
                          mudou de {tierLabel(c.previous_tier)} em {new Date(c.tier_changed_at).toLocaleDateString("pt-BR")}
                        </Badge>
                      )}
                      {c.name_confidence === "baixa" && (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">nome a confirmar</Badge>
                      )}
                      {c.website && (
                        <a
                          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {c.website} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {a?.urgency && (
                        <Badge variant="outline" className={urgencyColors[a.urgency] || ""}>
                          urgência {a.urgency}
                        </Badge>
                      )}
                      {typeof a?.overlap_score === "number" && (
                        <Badge variant="outline">overlap {a.overlap_score}%</Badge>
                      )}
                    </div>
                    {c.mentors && c.mentors.length > 0 ? (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.mentors.map((m) => (
                          <Badge key={m} variant="secondary" className="text-[11px] font-medium">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1.5 inline-flex items-center gap-1">
                        <Users className="h-3 w-3" /> Mentor não identificado
                      </p>
                    )}
                    {c.positioning && <p className="text-sm mt-1">{c.positioning}</p>}
                    {c.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{c.notes}</p>}

                    <p className="text-xs text-muted-foreground mt-1">
                      {c.last_scanned_at
                        ? `Último scan: ${new Date(c.last_scanned_at).toLocaleString("pt-BR")}`
                        : c.website ? "Ainda não escaneado" : "Sem site cadastrado — adicione para habilitar o scan por IA"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={c.competitor_type}
                      onValueChange={(v) => updateTypeMutation.mutate({ id: c.id, competitor_type: v as CompetitorType })}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(typeMeta) as CompetitorType[]).map((t) => (
                          <SelectItem key={t} value={t}>{typeMeta[t].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => scan(c.id)}
                      disabled={scanningId === c.id || !c.website}
                    >
                      {scanningId === c.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      {c.last_scanned_at ? "Re-escanear" : "Escanear"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remover ${c.name}?`)) deleteMutation.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {a && (
                  <div className="mt-4 space-y-3">
                    {a.positioning && (
                      <div className="flex items-start gap-2 text-sm">
                        <Sparkles className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                        <p><span className="font-medium">Posicionamento:</span> {a.positioning}</p>
                      </div>
                    )}
                    {a.target_audience && (
                      <div className="flex items-start gap-2 text-sm">
                        <Target className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                        <p><span className="font-medium">Público-alvo:</span> {a.target_audience}</p>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.isArray(a.threats_to_eternum) && a.threats_to_eternum.length > 0 && (
                        <div className="p-3 rounded border border-red-500/30 bg-red-500/5">
                          <div className="flex items-center gap-1 text-xs font-semibold text-red-700 mb-2">
                            <ShieldAlert className="h-3.5 w-3.5" /> Ameaças à Eternum
                          </div>
                          <ul className="text-xs space-y-1 list-disc pl-4">
                            {a.threats_to_eternum.map((t: string, i: number) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(a.opportunities_for_eternum) && a.opportunities_for_eternum.length > 0 && (
                        <div className="p-3 rounded border border-emerald-500/30 bg-emerald-500/5">
                          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 mb-2">
                            <Lightbulb className="h-3.5 w-3.5" /> Oportunidades p/ Eternum
                          </div>
                          <ul className="text-xs space-y-1 list-disc pl-4">
                            {a.opportunities_for_eternum.map((t: string, i: number) => <li key={i}>{t}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>

                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <ChevronDown className="h-3 w-3 mr-1" /> Ver detalhes (ofertas, forças, fraquezas)
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-3">
                        {Array.isArray(a.offers) && a.offers.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-1">Ofertas detectadas</p>
                            <div className="space-y-1">
                              {a.offers.map((o: any, i: number) => (
                                <div key={i} className="text-xs p-2 rounded bg-muted flex items-center justify-between gap-2 flex-wrap">
                                  <span className="font-medium">{o.name}</span>
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    {o.format && <Badge variant="outline" className="text-[10px]">{o.format}</Badge>}
                                    <span>{o.price || "preço n/d"}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {a.price_range && (
                          <p className="text-xs"><span className="font-semibold">Faixa de preço:</span> {a.price_range}</p>
                        )}
                        <div className="grid gap-3 md:grid-cols-2">
                          {Array.isArray(a.strengths) && a.strengths.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 mb-1">
                                <TrendingUp className="h-3 w-3" /> Forças
                              </div>
                              <ul className="text-xs space-y-1 list-disc pl-4">
                                {a.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(a.weaknesses) && a.weaknesses.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1 text-xs font-semibold text-red-700 mb-1">
                                <TrendingDown className="h-3 w-3" /> Fraquezas
                              </div>
                              <ul className="text-xs space-y-1 list-disc pl-4">
                                {a.weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
