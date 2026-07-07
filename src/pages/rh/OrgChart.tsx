import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Network, Users, Search, Download, Cake, X } from "lucide-react";
import html2canvas from "html2canvas";

interface Person {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  hire_date: string | null;
  birth_date: string | null;
  status: string | null;
  employment_type: string | null;
}

const norm = (v: string | null | undefined) =>
  (v ?? "").trim().toLocaleLowerCase("pt-BR");

interface ColumnConfig {
  key: string;
  label: string;
  headerColor: string;
  badgeColor: string;
  gestorNames: string[]; // lower-cased partial match
  deptMatches: string[]; // lower-cased dept names
}

const COLUMNS: ColumnConfig[] = [
  {
    key: "marketing",
    label: "Marketing",
    headerColor: "from-pink-500 to-pink-600",
    badgeColor: "bg-pink-500/15 text-pink-700 border-pink-300 dark:text-pink-300 dark:border-pink-700",
    gestorNames: [], // sem gestor — reporta direto à COO
    deptMatches: ["marketing"],
  },
  {
    key: "comercial",
    label: "Comercial",
    headerColor: "from-blue-500 to-blue-600",
    badgeColor: "bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-700",
    gestorNames: ["jonathan marcato"],
    deptMatches: ["comercial", "vendas"],
  },
  {
    key: "operacao",
    label: "Operações",
    headerColor: "from-amber-500 to-amber-600",
    badgeColor: "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-700",
    gestorNames: ["jessica marcato"],
    deptMatches: ["customer success", "cs", "operação", "operações", "operacao", "operacoes", "eventos"],
  },
  {
    key: "administrativo",
    label: "Administrativo",
    headerColor: "from-slate-500 to-slate-600",
    badgeColor: "bg-slate-500/15 text-slate-700 border-slate-300 dark:text-slate-300 dark:border-slate-700",
    gestorNames: ["arthur mudri"],
    deptMatches: ["administrativo", "financeiro", "recursos humanos", "rh", "jurídico", "juridico"],
  },
];

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function getTenureLabel(hireDate: string | null): string | null {
  if (!hireDate) return null;
  const hire = new Date(hireDate);
  const now = new Date();
  let months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
  if (now.getDate() < hire.getDate()) months--;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return years > 0 ? `${years}a ${rem}m` : `${rem}m`;
}

function isBirthdayThisMonth(birthDate: string | null): boolean {
  if (!birthDate) return false;
  return new Date(birthDate).getMonth() === new Date().getMonth();
}

export default function OrgChart() {
  const navigate = useNavigate();
  const orgRef = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [{ data: collabs }, { data: providers }] = await Promise.all([
      supabase
        .from("hr_collaborators")
        .select("id, full_name, department, position, avatar_url, hire_date, birth_date, status, employment_type")
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("hr_service_providers")
        .select("id, full_name, department, position, avatar_url, hire_date, birth_date, status, provider_kind")
        .in("provider_kind", ["director"])
        .eq("status", "active")
        .order("full_name"),
    ]);

    const all: Person[] = [
      ...((collabs || []) as Person[]),
      ...((providers || []).map((d: any) => ({
        id: `provider:${d.id}`,
        full_name: d.full_name,
        department: d.department,
        position: d.position,
        avatar_url: d.avatar_url,
        hire_date: d.hire_date,
        birth_date: d.birth_date,
        status: d.status,
        employment_type: d.provider_kind === "director" ? "PJ Diretor" : "PJ",
      }))),
    ];

    setPeople(all);
    setLoading(false);
  }

  // Detect CEO / COO
  const ceo = useMemo(
    () => people.find((p) => norm(p.position) === "ceo") ?? null,
    [people]
  );
  const coo = useMemo(
    () => people.find((p) => norm(p.position) === "coo") ?? null,
    [people]
  );

  // Build columns
  const columns = useMemo(() => {
    const excludeIds = new Set<string>();
    if (ceo) excludeIds.add(ceo.id);
    if (coo) excludeIds.add(coo.id);

    return COLUMNS.map((col) => {
      const gestor = col.gestorNames.length
        ? people.find((p) => col.gestorNames.some((n) => norm(p.full_name).includes(n))) ?? null
        : null;
      if (gestor) excludeIds.add(gestor.id);

      const members = people.filter((p) => {
        if (excludeIds.has(p.id)) return false;
        const d = norm(p.department);
        return col.deptMatches.some((m) => d === m || d.includes(m));
      });
      members.forEach((m) => excludeIds.add(m.id));

      return { ...col, gestor, members };
    });
  }, [people, ceo, coo]);

  const others = useMemo(() => {
    const assigned = new Set<string>();
    if (ceo) assigned.add(ceo.id);
    if (coo) assigned.add(coo.id);
    columns.forEach((c) => {
      if (c.gestor) assigned.add(c.gestor.id);
      c.members.forEach((m) => assigned.add(m.id));
    });
    return people.filter((p) => !assigned.has(p.id));
  }, [people, ceo, coo, columns]);

  const matchesSearch = (p: Person) => {
    if (!search.trim()) return true;
    const q = norm(search);
    return norm(p.full_name).includes(q) || norm(p.position).includes(q);
  };

  const totalActive = people.length;

  async function handleExport() {
    if (!orgRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(orgRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `organograma-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  }

  const goToProfile = (p: Person) => {
    if (p.id.startsWith("provider:")) navigate(`/rh/service-providers/${p.id.slice(9)}`);
    else navigate(`/rh/collaborators/${p.id}`);
  };

  const renderPersonCard = (
    p: Person,
    opts: { size?: "sm" | "md" | "lg"; badgeColor?: string; label?: string } = {}
  ) => {
    const { size = "md", badgeColor, label } = opts;
    const dim = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
    const dimmed = !matchesSearch(p) && !!search.trim();
    const birthday = isBirthdayThisMonth(p.birth_date);
    const tenure = getTenureLabel(p.hire_date);

    return (
      <button
        key={p.id}
        onClick={() => goToProfile(p)}
        className={`group flex flex-col items-center gap-1.5 p-2.5 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all min-w-[130px] max-w-[160px] ${
          dimmed ? "opacity-30" : ""
        }`}
      >
        {label && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            {label}
          </span>
        )}
        <div className="relative">
          <Avatar className={`${dim} ring-2 ring-offset-2 ring-offset-background ring-border group-hover:ring-primary/40 transition-all`}>
            <AvatarImage src={p.avatar_url || undefined} alt={p.full_name} />
            <AvatarFallback className="bg-muted text-xs font-medium">
              {getInitials(p.full_name)}
            </AvatarFallback>
          </Avatar>
          {birthday && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-pink-500 flex items-center justify-center">
                  <Cake className="h-3 w-3 text-white" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Aniversariante do mês</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-xs font-semibold text-foreground text-center leading-tight line-clamp-2">
          {p.full_name}
        </p>
        {p.position && (
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 h-4 font-normal ${badgeColor ?? ""}`}
          >
            {p.position}
          </Badge>
        )}
        {tenure && (
          <span className="text-[9px] text-muted-foreground">{tenure}</span>
        )}
      </button>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-5 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/rh")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Organograma</h1>
              <p className="text-sm text-muted-foreground">
                {totalActive} pessoas ativas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou cargo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exportando..." : "Exportar"}
            </Button>
          </div>
        </div>

        {loading ? (
          <Card className="h-96 animate-pulse bg-muted/50" />
        ) : (
          <div ref={orgRef} className="bg-background p-6 rounded-lg overflow-x-auto">
            <div className="min-w-[900px] flex flex-col items-center">
              {/* CEO */}
              {ceo && (
                <div className="flex flex-col items-center">
                  {renderPersonCard(ceo, { size: "lg", label: "CEO" })}
                  <div className="w-px h-6 bg-border" />
                </div>
              )}

              {/* Barra horizontal do CEO — vai do centro da coluna Marketing ao centro da Administrativo */}
              <div className="relative w-full max-w-[1100px] h-px">
                <div className="absolute top-0 left-[12.5%] right-[12.5%] h-px bg-border" />
              </div>

              {/* Tier intermediário: COO acima da coluna Marketing; demais colunas apenas propagam a linha */}
              <div className="grid grid-cols-4 gap-4 w-full max-w-[1100px]">
                <div className="flex flex-col items-center">
                  <div className="w-px h-6 bg-border" />
                  {coo && renderPersonCard(coo, { size: "md", label: "COO" })}
                  <div className="w-px h-8 bg-border" />
                </div>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex justify-center">
                    <div className="w-px h-full bg-border" />
                  </div>
                ))}
              </div>

              {/* Columns — Marketing responde à COO; demais respondem ao CEO */}
              <div className="grid grid-cols-4 gap-4 w-full max-w-[1100px] relative">
                {columns.map((col) => {
                  const isMarketing = col.key === "marketing";
                  const columnHead = col.gestor;
                  const headLabel = "Gestor";
                  return (
                    <div key={col.key} className="flex flex-col items-center relative">


                      {/* Header */}
                      <div
                        className={`w-full rounded-lg px-3 py-2 mb-3 bg-gradient-to-r ${col.headerColor} shadow-sm`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-white/80" />
                            <h2 className="text-sm font-semibold text-white">{col.label}</h2>
                          </div>
                          <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px]">
                            {(columnHead ? 1 : 0) + col.members.length}
                          </Badge>
                        </div>
                        {isMarketing && (
                          <p className="text-[10px] text-white/80 mt-0.5">
                            liderado pela COO
                          </p>
                        )}
                      </div>

                      {/* Head (Gestor ou COO no caso de Marketing) */}
                      {columnHead ? (
                        <div className="flex flex-col items-center">
                          {renderPersonCard(columnHead, { size: "md", badgeColor: col.badgeColor, label: headLabel })}
                          {col.members.length > 0 && <div className="w-px h-6 bg-border" />}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center mb-2">
                          <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 min-w-[130px] max-w-[160px]">
                            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                              <Users className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                            <p className="text-[11px] text-muted-foreground text-center leading-tight">
                              Sem gestor
                            </p>
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
                              vaga aberta
                            </span>
                          </div>
                          {col.members.length > 0 && <div className="w-px h-6 bg-border" />}
                        </div>
                      )}

                      {/* Members */}
                      <div className="flex flex-col items-center gap-2 w-full">
                        {col.members.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">
                            sem membros
                          </p>
                        ) : (
                          col.members.map((m) =>
                            renderPersonCard(m, { size: "sm", badgeColor: col.badgeColor })
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Outros / sem departamento mapeado */}
              {others.length > 0 && (
                <div className="w-full max-w-[1100px] mt-10 pt-6 border-t border-border">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">
                    Sem departamento mapeado ({others.length})
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {others.map((p) => renderPersonCard(p, { size: "sm" }))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
