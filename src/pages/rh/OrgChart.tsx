import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, Network, Users, Search, Download, LayoutGrid, List,
  Cake, Clock, TreePine, Palmtree, Filter, X, ChevronDown, ChevronUp,
  BarChart3, UserPlus
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import html2canvas from "html2canvas";

interface Collaborator {
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

interface DepartmentGroup {
  name: string;
  collaborators: Collaborator[];
}

const DEPARTMENT_COLORS: Record<string, string> = {
  Comercial: "bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-700",
  CS: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700",
  Marketing: "bg-pink-500/15 text-pink-700 border-pink-300 dark:text-pink-300 dark:border-pink-700",
  Operações: "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-700",
  Financeiro: "bg-violet-500/15 text-violet-700 border-violet-300 dark:text-violet-300 dark:border-violet-700",
  Administrativo: "bg-slate-500/15 text-slate-700 border-slate-300 dark:text-slate-300 dark:border-slate-700",
};

const DEPARTMENT_HEADER_COLORS: Record<string, string> = {
  Comercial: "from-blue-500 to-blue-600",
  CS: "from-emerald-500 to-emerald-600",
  Marketing: "from-pink-500 to-pink-600",
  Operações: "from-amber-500 to-amber-600",
  Financeiro: "from-violet-500 to-violet-600",
  Administrativo: "from-slate-500 to-slate-600",
};

const DEPARTMENT_ORDER = ["Comercial", "CS", "Marketing", "Operações", "Financeiro", "Administrativo"];

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function getTenure(hireDate: string | null): { years: number; months: number; label: string } | null {
  if (!hireDate) return null;
  const hire = new Date(hireDate);
  const now = new Date();
  let months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
  if (now.getDate() < hire.getDate()) months--;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0) return { years, months: rem, label: `${years}a ${rem}m` };
  return { years: 0, months: rem, label: `${rem}m` };
}

function isBirthdayThisMonth(birthDate: string | null): boolean {
  if (!birthDate) return false;
  const now = new Date();
  const bd = new Date(birthDate);
  return bd.getMonth() === now.getMonth();
}

function getDeptAvgTenureMonths(collabs: Collaborator[]): number {
  const withHire = collabs.filter(c => c.hire_date);
  if (withHire.length === 0) return 0;
  const now = new Date();
  const totalMonths = withHire.reduce((sum, c) => {
    const hire = new Date(c.hire_date!);
    let m = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
    if (now.getDate() < hire.getDate()) m--;
    return sum + m;
  }, 0);
  return Math.round(totalMonths / withHire.length);
}

export default function OrgChart() {
  const navigate = useNavigate();
  const orgRef = useRef<HTMLDivElement>(null);
  const [allDepartments, setAllDepartments] = useState<DepartmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [viewMode, setViewMode] = useState<"expanded" | "compact">("expanded");
  const [showMetrics, setShowMetrics] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [{ data: collabs }, { data: directors }] = await Promise.all([
      supabase
        .from("hr_collaborators")
        .select("id, full_name, department, position, avatar_url, hire_date, birth_date, status, employment_type")
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("hr_service_providers")
        .select("id, full_name, department, position, avatar_url, hire_date, birth_date, status, provider_kind")
        .eq("provider_kind", "director")
        .eq("status", "active")
        .order("full_name"),
    ]);

    const data: Collaborator[] = [
      ...((collabs || []) as Collaborator[]),
      ...((directors || []).map((d: any) => ({
        id: `provider:${d.id}`,
        full_name: d.full_name,
        department: d.department,
        position: d.position,
        avatar_url: d.avatar_url,
        hire_date: d.hire_date,
        birth_date: d.birth_date,
        status: d.status,
        employment_type: "PJ Diretor",
      }))),
    ];

    if (data.length === 0) { setLoading(false); return; }

    const grouped = new Map<string, Collaborator[]>();
    for (const c of data) {
      const dept = c.department || "Sem departamento";
      if (!grouped.has(dept)) grouped.set(dept, []);
      grouped.get(dept)!.push(c);
    }

    for (const [, members] of grouped) {
      members.sort((a, b) => {
        const rank = (p: string | null) => {
          const low = p?.toLowerCase() || "";
          if (low === "ceo" || low === "diretor" || low === "sócio") return 0;
          if (low.includes("head")) return 1;
          return 2;
        };
        const aHead = rank(a.position);
        const bHead = rank(b.position);
        if (aHead !== bHead) return aHead - bHead;
        return a.full_name.localeCompare(b.full_name);
      });
    }

    const sorted = Array.from(grouped.entries()).sort(([a], [b]) => {
      const ai = DEPARTMENT_ORDER.indexOf(a);
      const bi = DEPARTMENT_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    setAllDepartments(sorted.map(([name, collaborators]) => ({ name, collaborators })));
    setLoading(false);
  }

  const departments = useMemo(() => {
    let filtered = allDepartments;
    if (filterDept !== "all") {
      filtered = filtered.filter(d => d.name === filterDept);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered
        .map(d => ({
          ...d,
          collaborators: d.collaborators.filter(c =>
            c.full_name.toLowerCase().includes(q) ||
            c.position?.toLowerCase().includes(q)
          ),
        }))
        .filter(d => d.collaborators.length > 0);
    }
    return filtered;
  }, [allDepartments, filterDept, search]);

  const totalCollaborators = allDepartments.reduce((sum, d) => sum + d.collaborators.length, 0);
  const birthdaysThisMonth = allDepartments
    .flatMap(d => d.collaborators)
    .filter(c => isBirthdayThisMonth(c.birth_date));

  const toggleCollapse = (dept: string) => {
    setCollapsedDepts(prev => {
      const next = new Set(prev);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });
  };

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
                {totalCollaborators} colaboradores em {allDepartments.length} departamentos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMetrics(!showMetrics)}
              className="gap-1.5"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {showMetrics ? "Ocultar métricas" : "Métricas"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "expanded" ? "compact" : "expanded")}
              className="gap-1.5"
            >
              {viewMode === "expanded" ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
              {viewMode === "expanded" ? "Compacto" : "Expandido"}
            </Button>
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

        {/* Summary metrics */}
        {showMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground font-medium">Total colaboradores</p>
              <p className="text-2xl font-bold text-foreground">{totalCollaborators}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground font-medium">Departamentos</p>
              <p className="text-2xl font-bold text-foreground">{allDepartments.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground font-medium">Aniversariantes do mês</p>
              <p className="text-2xl font-bold text-foreground">{birthdaysThisMonth.length}</p>
              {birthdaysThisMonth.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {birthdaysThisMonth.slice(0, 3).map(c => (
                    <Badge key={c.id} variant="outline" className="text-[10px] px-1.5 py-0">
                      {c.full_name.split(" ")[0]}
                    </Badge>
                  ))}
                  {birthdaysThisMonth.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      +{birthdaysThisMonth.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground font-medium">Maior departamento</p>
              <p className="text-2xl font-bold text-foreground">
                {allDepartments.length > 0 ? allDepartments.reduce((a, b) => a.collaborators.length > b.collaborators.length ? a : b).name : "—"}
              </p>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou cargo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos departamentos</SelectItem>
              {allDepartments.map(d => (
                <SelectItem key={d.name} value={d.name}>{d.name} ({d.collaborators.length})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Org chart */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Card key={i} className="h-64 animate-pulse bg-muted/50" />)}
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum resultado encontrado</p>
            <p className="text-sm">Tente ajustar os filtros ou a busca</p>
          </div>
        ) : (
          <div ref={orgRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {departments.map(dept => {
              const headerColor = DEPARTMENT_HEADER_COLORS[dept.name] || "from-gray-500 to-gray-600";
              const badgeColor = DEPARTMENT_COLORS[dept.name] || "bg-gray-500/15 text-gray-700 border-gray-300";
              const avgTenure = getDeptAvgTenureMonths(dept.collaborators);
              const isCollapsed = collapsedDepts.has(dept.name);
              const head = dept.collaborators.find(c => {
                const p = c.position?.toLowerCase() || "";
                return p === "ceo" || p === "diretor" || p === "sócio" || p.includes("head");
              });

              return (
                <Card key={dept.name} className="overflow-hidden border-0 shadow-md flex flex-col">
                  {/* Department header */}
                  <button
                    onClick={() => toggleCollapse(dept.name)}
                    className={`bg-gradient-to-r ${headerColor} px-5 py-4 w-full text-left`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-white/80" />
                        <h2 className="text-base font-semibold text-white">{dept.name}</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                          {dept.collaborators.length}
                        </Badge>
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4 text-white/70" />
                        ) : (
                          <ChevronUp className="h-4 w-4 text-white/70" />
                        )}
                      </div>
                    </div>
                    {showMetrics && (
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-white/70">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Média: {avgTenure >= 12 ? `${Math.floor(avgTenure / 12)}a ${avgTenure % 12}m` : `${avgTenure}m`}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Head highlight */}
                  {!isCollapsed && head && viewMode === "expanded" && (
                    <button
                      onClick={() => navigate(`/rh/collaborators/${head.id}`)}
                      className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 flex items-center gap-3 text-left hover:from-primary/10 hover:to-primary/15 transition-colors"
                    >
                      <Avatar className="h-12 w-12 ring-2 ring-offset-2 ring-offset-background ring-primary/40">
                        <AvatarImage src={head.avatar_url || undefined} alt={head.full_name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {getInitials(head.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{head.full_name}</p>
                        <Badge variant="outline" className={`mt-0.5 text-[10px] px-1.5 py-0 h-4 font-normal ${badgeColor}`}>
                          {head.position}
                        </Badge>
                        {head.hire_date && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {getTenure(head.hire_date)?.label} na empresa
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        {isBirthdayThisMonth(head.birth_date) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Cake className="h-4 w-4 text-pink-500" />
                            </TooltipTrigger>
                            <TooltipContent>Aniversariante do mês! 🎉</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </button>
                  )}

                  {/* Members */}
                  {!isCollapsed && (
                    <div className="p-3 space-y-0.5 flex-1">
                      {dept.collaborators
                        .filter(c => viewMode === "expanded" ? c.id !== head?.id : true)
                        .map((c) => {
                          const isHead = (() => { const p = c.position?.toLowerCase() || ""; return p === "ceo" || p === "diretor" || p === "sócio" || p.includes("head"); })();
                          const tenure = getTenure(c.hire_date);
                          const birthday = isBirthdayThisMonth(c.birth_date);

                          if (viewMode === "compact") {
                            return (
                              <button
                                key={c.id}
                                onClick={() => navigate(`/rh/collaborators/${c.id}`)}
                                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/80 text-left"
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={c.avatar_url || undefined} alt={c.full_name} />
                                  <AvatarFallback className="text-[9px] bg-muted">{getInitials(c.full_name)}</AvatarFallback>
                                </Avatar>
                                <span className={`text-xs truncate flex-1 ${isHead ? "font-semibold" : "font-medium"} text-foreground`}>
                                  {c.full_name}
                                </span>
                                {birthday && <Cake className="h-3 w-3 text-pink-500 flex-shrink-0" />}
                                {c.position && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{c.position}</span>
                                )}
                              </button>
                            );
                          }

                          return (
                            <button
                              key={c.id}
                              onClick={() => navigate(`/rh/collaborators/${c.id}`)}
                              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/80 text-left ${isHead ? "bg-muted/40" : ""}`}
                            >
                              <Avatar className={isHead ? "h-10 w-10 ring-2 ring-offset-2 ring-offset-background ring-primary/30" : "h-9 w-9"}>
                                <AvatarImage src={c.avatar_url || undefined} alt={c.full_name} />
                                <AvatarFallback className={`text-xs font-medium ${isHead ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                                  {getInitials(c.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${isHead ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                                  {c.full_name}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {c.position && (
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-normal ${badgeColor}`}>
                                      {c.position}
                                    </Badge>
                                  )}
                                  {tenure && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                      <Clock className="h-2.5 w-2.5" />
                                      {tenure.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {birthday && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Cake className="h-4 w-4 text-pink-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>Aniversariante do mês! 🎉</TooltipContent>
                                  </Tooltip>
                                )}
                                {c.employment_type && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal text-muted-foreground border-muted-foreground/20">
                                        {c.employment_type}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>Regime: {c.employment_type}</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
