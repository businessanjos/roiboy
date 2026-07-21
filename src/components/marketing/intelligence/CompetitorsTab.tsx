import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, RefreshCw, Trash2, ExternalLink, Loader2, ChevronDown,
  ShieldAlert, Lightbulb, Target, TrendingUp, TrendingDown, Sparkles,
} from "lucide-react";

type Competitor = {
  id: string;
  name: string;
  website: string;
  notes: string | null;
  tags: string[] | null;
  last_scanned_at: string | null;
  created_at: string;
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
  low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  high: "bg-red-500/10 text-red-700 border-red-500/30",
};

export default function CompetitorsTab() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", website: "", notes: "" });
  const [scanningId, setScanningId] = useState<string | null>(null);

  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ["mi-competitors", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_competitors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Competitor[];
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

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.website.trim()) throw new Error("Nome e site obrigatórios");
      if (!currentUser?.account_id) throw new Error("Sem conta");
      const { error } = await supabase.from("mi_competitors").insert({
        account_id: currentUser.account_id,
        name: form.name.trim(),
        website: form.website.trim(),
        notes: form.notes.trim() || null,
        created_by: currentUser.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Concorrente adicionado");
      setForm({ name: "", website: "", notes: "" });
      setOpen(false);
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
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Concorrentes monitorados</CardTitle>
            <CardDescription>
              Cadastre sites de concorrentes. A cada scan, o Firecrawl extrai o conteúdo e a IA gera
              uma análise estruturada (posicionamento, ofertas, preços, ameaças e oportunidades) do
              ponto de vista da Eternum.
            </CardDescription>
          </div>
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
                <div>
                  <label className="text-xs font-medium">Site</label>
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
        </CardHeader>
      </Card>

      {isLoading && <Card><CardContent className="pt-6 text-sm text-muted-foreground">Carregando…</CardContent></Card>}

      {!isLoading && competitors.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            Nenhum concorrente cadastrado. Clique em "Adicionar" para começar.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {competitors.map((c) => {
          const snap = snapshotsMap[c.id];
          const a = snap?.ai_analysis || null;
          return (
            <Card key={c.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{c.name}</h3>
                      <a
                        href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {c.website} <ExternalLink className="h-3 w-3" />
                      </a>
                      {a?.urgency && (
                        <Badge variant="outline" className={urgencyColors[a.urgency] || ""}>
                          urgência {a.urgency}
                        </Badge>
                      )}
                      {typeof a?.overlap_score === "number" && (
                        <Badge variant="outline">overlap {a.overlap_score}%</Badge>
                      )}
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.last_scanned_at
                        ? `Último scan: ${new Date(c.last_scanned_at).toLocaleString("pt-BR")}`
                        : "Ainda não escaneado"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => scan(c.id)}
                      disabled={scanningId === c.id}
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
