import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Search, Stethoscope, ArrowRight, Download, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { EducationSelect } from "@/components/client/EducationSelect";


type Evidence = { source: string; field?: string; text: string };
type FieldEntry = { key: string; label: string; value: string };
type MedicalClient = {
  id: string;
  full_name: string;
  logo_url: string | null;
  education: string | null;
  education_specialty: string | null;
  status?: string | null;
  phone_e164?: string | null;
  city?: string | null;
  state?: string | null;
  products: string[];
  productColors: Record<string, string>;
  evidence: Evidence[];
  recordFields?: FieldEntry[];
  customFields?: FieldEntry[];
};


export default function MedicalClients() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<MedicalClient[]>([]);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});


  const updateClientField = async (id: string, patch: { education?: string | null; education_specialty?: string | null }) => {
    setSavingId(id);
    const { error } = await supabase.from("clients").update(patch).eq("id", id);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } as MedicalClient : c)));
      toast.success("Salvo");
      // A classificação depende da ficha — recarrega para refletir entradas/saídas da lista.
      void load({ silent: true });
    }
    setSavingId(null);
  };

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      setClients([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.functions.invoke("list-medical-clients", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) {
      console.error(error);
      if (!opts?.silent) setClients([]);
    } else {
      setClients(data?.clients ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sincronização automática: a ficha do cliente é a fonte única.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => load({ silent: true }), 800);
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("medical-clients-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_field_values" }, scheduleReload)
      .subscribe();

    const onFocus = () => load({ silent: true });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });

    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, scheduleReload]);


  const products = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => c.products.forEach((p) => s.add(p)));
    return Array.from(s).sort();
  }, [clients]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => c.evidence.forEach((e) => s.add(e.source)));
    return Array.from(s).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (productFilter !== "all" && !c.products.includes(productFilter)) return false;
      if (sourceFilter !== "all" && !c.evidence.some((e) => e.source === sourceFilter)) return false;
      if (classificationFilter === "unclassified" && (c.education || c.education_specialty)) return false;
      if (classificationFilter === "classified" && !c.education && !c.education_specialty) return false;
      if (classificationFilter === "medico" && !(c.education && /m[eé]dic/i.test(c.education))) return false;
      if (!q) return true;
      const hay = [
        c.full_name,
        c.education ?? "",
        c.education_specialty ?? "",
        ...c.products,
        ...c.evidence.map((e) => `${e.field ?? ""} ${e.text}`),
        ...(c.recordFields ?? []).map((f) => `${f.label} ${f.value}`),
        ...(c.customFields ?? []).map((f) => `${f.label} ${f.value}`),
      ]

        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, search, productFilter, sourceFilter, classificationFilter]);

  const exportCsv = () => {
    const rows = [
      ["Nome", "Produtos", "Formação", "Especialidade", "Evidências"],
      ...filtered.map((c) => [
        c.full_name,
        c.products.join(" | "),
        c.education ?? "",
        c.education_specialty ?? "",
        c.evidence.map((e) => `[${e.source}${e.field ? ` · ${e.field}` : ""}] ${e.text}`).join(" || "),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medicos-mentoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sourceLabel = (s: string) =>
    s === "onboarding" ? "Onboarding" : s === "cadastro" ? "Cadastro" : s;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            Área da saúde na Mentoria
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Clientes ativos das mentorias identificados na área da saúde via onboarding ou cadastro.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total identificados</div>
            <div className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-16" /> : clients.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Exibidos com filtro</div>
            <div className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-16" /> : filtered.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Produtos distintos</div>
            <div className="text-3xl font-bold mt-1">
              {loading ? <Skeleton className="h-8 w-16" /> : products.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, produto, especialidade ou evidência..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Fonte da evidência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as fontes</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {sourceLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={classificationFilter} onValueChange={setClassificationFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Classificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="unclassified">Sem classificação</SelectItem>
              <SelectItem value="classified">Já classificados</SelectItem>
              <SelectItem value="medico">Apenas médicos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              Nenhum profissional da área da saúde encontrado com os filtros atuais.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Formação</TableHead>
                  <TableHead>Evidências</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <>
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left hover:text-primary transition-colors"
                        onClick={() => setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))}
                      >
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded[c.id] ? "rotate-180" : ""}`}
                        />
                        {c.full_name}
                      </button>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.products.map((p) => (
                          <Badge
                            key={p}
                            style={{
                              backgroundColor: `${c.productColors[p] ?? "#6b7280"}20`,
                              color: c.productColors[p] ?? "#6b7280",
                              borderColor: `${c.productColors[p] ?? "#6b7280"}60`,
                            }}
                            variant="outline"
                          >
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm min-w-[240px]">
                      <div className="space-y-1.5">
                        <EducationSelect
                          value={c.education}
                          disabled={savingId === c.id}
                          className="h-8 text-xs"
                          placeholder="Formação"
                          onChange={(v) => updateClientField(c.id, { education: v })}
                        />

                        <Input
                          key={`spec-${c.id}-${c.education_specialty ?? ""}`}
                          className="h-8 text-xs"
                          placeholder="Especialidade"
                          defaultValue={c.education_specialty ?? ""}
                          disabled={savingId === c.id}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if ((c.education_specialty ?? "") !== val) {
                              updateClientField(c.id, { education_specialty: val || null });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="space-y-1">
                        {c.evidence.slice(0, 3).map((e, i) => (
                          <div key={i} className="text-xs">
                            <Badge variant="secondary" className="mr-2">
                              {sourceLabel(e.source)}
                            </Badge>
                            {e.field && <span className="text-muted-foreground">{e.field}: </span>}
                            <span>{e.text}</span>
                          </div>
                        ))}
                        {c.evidence.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{c.evidence.length - 3} evidências
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link to={`/clients/${c.id}`}>
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                  {expanded[c.id] && (
                    <TableRow key={`${c.id}-details`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={5} className="p-4">
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                              Ficha do cliente
                            </div>
                            {(c.recordFields ?? []).length === 0 ? (
                              <p className="text-xs text-muted-foreground">Sem dados preenchidos na ficha.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                                {(c.recordFields ?? []).map((f) => (
                                  <div key={f.key} className="text-xs">
                                    <span className="text-muted-foreground">{f.label}: </span>
                                    <span className="font-medium break-words">{f.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                              Campos personalizados
                            </div>
                            {(c.customFields ?? []).length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhum campo personalizado preenchido.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                                {(c.customFields ?? []).map((f) => (
                                  <div key={f.key} className="text-xs">
                                    <span className="text-muted-foreground">{f.label}: </span>
                                    <span className="font-medium break-words">{f.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </>
                ))}

              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
