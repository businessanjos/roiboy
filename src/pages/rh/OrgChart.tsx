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
import { formatPersonName } from "@/lib/format/personName";
import { getDepartmentColorHsl } from "@/lib/rh/departmentColors";

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
  hr_department_id?: string | null;

}

const norm = (v: string | null | undefined) =>
  (v ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

interface Dept {
  id: string;
  name: string;
  color: string;
  show: boolean;
  parentId: string | null;
  active: boolean;
}

/** Nomes usados no cadastro das pessoas que correspondem a um departamento registrado. */
const DEPT_ALIASES: Record<string, string> = {
  "customer success": "cs",
  "recursos humanos": "rh",
  "suporte/atendimento": "operacoes",
  "suporte": "operacoes",
  "atendimento": "operacoes",
};

/** Ordem de importância do cargo para eleger o gestor da coluna. */
const positionRank = (pos?: string | null) => {
  const s = norm(pos);
  if (!s) return 99;
  if (s.includes("diretor") || s.includes("head")) return 0;
  if (s.includes("gestor") || s.includes("gerente")) return 1;
  if (s.includes("coordenador") || s.includes("lider") || s.includes("supervisor")) return 2;
  return 99;
};


const tint = (color: string, alpha = 0.15) =>
  color.startsWith("hsl(") ? color.replace(")", ` / ${alpha})`) : `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;

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
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [{ data: collabs }, { data: providers }, { data: deptRows }] = await Promise.all([
      supabase
        .from("hr_collaborators")
        .select("id, full_name, department, hr_department_id, position, avatar_url, hire_date, birth_date, status, employment_type")
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("hr_service_providers")
        .select("id, full_name, department, hr_department_id, position, avatar_url, hire_date, birth_date, status, provider_kind")
        .in("provider_kind", ["director"])
        .eq("status", "active")
        .order("full_name"),
      supabase.from("hr_departments").select("id, name, color, show_in_org_chart, parent_department_id, is_active"),
    ]);

    const deptList: Dept[] = (deptRows || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      color: getDepartmentColorHsl(d.color),
      show: d.show_in_org_chart !== false,
      parentId: d.parent_department_id ?? null,
      active: d.is_active !== false,
    }));
    setDepts(deptList);

    const meta = new Map<string, { color: string; show: boolean }>();
    deptList.forEach((d) => meta.set(norm(d.name), { color: d.color, show: d.show }));



    const all: Person[] = [
      ...((collabs || []) as Person[]).map((c) => ({ ...c, full_name: formatPersonName(c.full_name) })),
      ...((providers || []).map((d: any) => ({
        id: `provider:${d.id}`,
        full_name: formatPersonName(d.full_name),
        department: d.department,
        hr_department_id: d.hr_department_id ?? null,

        position: d.position,
        avatar_url: d.avatar_url,
        hire_date: d.hire_date,
        birth_date: d.birth_date,
        status: d.status,
        employment_type: d.provider_kind === "director" ? "PJ Diretor" : "PJ",
      }))),
    ];

    // Exclusões temporárias do organograma
    const HIDDEN_IDS = new Set<string>([
      "eb09d679-8bfb-408e-9c4e-cdba00ec5adb", // Maikol Quintana Parnow (hr_collaborators)
      "provider:eb09d679-8bfb-408e-9c4e-cdba00ec5adb", // Maikol Quintana Parnow (hr_service_providers)
    ]);
    const visible = all.filter((p) => {
      if (HIDDEN_IDS.has(p.id)) return false;
      const info = meta.get(norm(p.department));
      return info ? info.show : true;
    });

    // Mesma pessoa cadastrada como colaborador e como PJ/diretor: manter só um card
    const rank = (pos?: string | null) => {
      const s = norm(pos);
      if (s === "ceo") return 0;
      if (s === "coo") return 1;
      if (s.includes("head") || s.includes("diretor")) return 2;
      if (["gestor", "gerente", "lider", "coordenador"].some((k) => s.includes(k))) return 3;
      return 4;
    };
    const deduped: Person[] = [];
    visible.forEach((p) => {
      const n = norm(p.full_name);
      const idx = deduped.findIndex((d) => {
        const o = norm(d.full_name);
        return o === n || o.startsWith(`${n} `) || n.startsWith(`${o} `);
      });
      if (idx === -1) {
        deduped.push(p);
        return;
      }
      const current = deduped[idx];
      const winner = rank(p.position) < rank(current.position) ? p : current;
      const other = winner === p ? current : p;
      // Mantém o card vencedor, mas aproveita foto/datas que só existem no outro cadastro
      deduped[idx] = {
        ...winner,
        avatar_url: winner.avatar_url || other.avatar_url,
        birth_date: winner.birth_date || other.birth_date,
        hire_date: winner.hire_date || other.hire_date,
        position: winner.position || other.position,
        department: winner.department || other.department,
      };
    });

    setPeople(deduped);
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

  // Colunas = departamentos raiz cadastrados (sub-departamentos entram na coluna do pai)
  const allColumns = useMemo(() => {
    const byId = new Map(depts.map((d) => [d.id, d]));
    const byName = new Map(depts.map((d) => [norm(d.name), d]));

    const rootOf = (dept: Dept | undefined): Dept | null => {
      let cur = dept;
      const seen = new Set<string>();
      while (cur && cur.parentId && !seen.has(cur.id)) {
        seen.add(cur.id);
        const parent = byId.get(cur.parentId);
        if (!parent) break;
        cur = parent;
      }
      return cur ?? null;
    };

    const resolveDept = (p: Person): Dept | null => {
      const direct = p.hr_department_id ? byId.get(p.hr_department_id) : undefined;
      if (direct) return rootOf(direct);
      const key = norm(p.department);
      if (!key) return null;
      const aliased = DEPT_ALIASES[key];
      const found = byName.get(key) ?? (aliased ? byName.get(aliased) : undefined);
      return found ? rootOf(found) : null;
    };

    const roots = depts
      .filter((d) => !d.parentId && d.active && d.show)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const palette = [
      "from-pink-500 to-pink-600",
      "from-info to-info",
      "from-warning to-warning",
      "from-muted-foreground to-muted-foreground",
      "from-primary to-primary",
      "from-success to-success",
    ];

    const used = new Set<string>();
    if (ceo) used.add(ceo.id);
    if (coo) used.add(coo.id);

    return roots.map((root, i) => {
      const inDept = people.filter((p) => !used.has(p.id) && resolveDept(p)?.id === root.id);
      inDept.forEach((p) => used.add(p.id));

      // Gestor da coluna vem do cargo cadastrado
      const sorted = [...inDept].sort((a, b) => positionRank(a.position) - positionRank(b.position));
      const gestor = sorted.length && positionRank(sorted[0].position) < 99 ? sorted[0] : null;

      return {
        key: root.id,
        label: root.name,
        headerColor: palette[i % palette.length],
        badgeColor: "bg-muted-foreground/15 text-foreground border-border",
        gestor,
        members: inDept.filter((p) => p.id !== gestor?.id),
        deptColor: root.color,
      };
    });
  }, [people, depts, ceo, coo]);

  // Pessoas cujo departamento não existe no cadastro
  const others = useMemo(() => {
    const assigned = new Set<string>();
    if (ceo) assigned.add(ceo.id);
    if (coo) assigned.add(coo.id);
    allColumns.forEach((c) => {
      if (c.gestor) assigned.add(c.gestor.id);
      c.members.forEach((m) => assigned.add(m.id));
    });
    return people.filter((p) => !assigned.has(p.id));
  }, [people, ceo, coo, allColumns]);


  const matchesSearch = (p: Person) => {
    if (!search.trim()) return true;
    const q = norm(search);
    return norm(p.full_name).includes(q) || norm(p.position).includes(q);
  };

  const totalActive = people.length;

  const gridTemplateColumns = `repeat(${Math.max(allColumns.length, 1)}, minmax(0, 1fr))`;
  const gridMaxWidth = Math.max(1100, allColumns.length * 260);

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
    opts: { size?: "sm" | "md" | "lg"; badgeColor?: string; label?: string; deptColor?: string | null } = {}
  ) => {
    const { size = "md", badgeColor, label, deptColor } = opts;
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
            className={`text-[9px] px-1.5 py-0 h-4 font-normal ${deptColor ? "" : badgeColor ?? ""}`}
            style={
              deptColor
                ? { backgroundColor: tint(deptColor), color: deptColor, borderColor: deptColor }
                : undefined
            }
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
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-success to-success flex items-center justify-center">
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

              {/* Barra horizontal do CEO — vai do centro da primeira ao centro da última coluna */}
              <div className="relative w-full h-px" style={{ maxWidth: gridMaxWidth }}>
                <div
                  className="absolute top-0 h-px bg-border"
                  style={{ left: `${50 / allColumns.length}%`, right: `${50 / allColumns.length}%` }}
                />
              </div>

              {/* Tier intermediário: COO acima da coluna Marketing; demais colunas apenas propagam a linha */}
              <div className="grid gap-4 w-full" style={{ maxWidth: gridMaxWidth, gridTemplateColumns }}>
                <div className="flex flex-col items-center">
                  <div className="w-px h-6 bg-border" />
                  {coo && renderPersonCard(coo, { size: "md", label: "COO" })}
                  <div className="w-px h-8 bg-border" />
                </div>
                {allColumns.slice(1).map((c) => (
                  <div key={c.key} className="flex justify-center">
                    <div className="w-px h-full bg-border" />
                  </div>
                ))}
              </div>

              {/* Columns — Marketing responde à COO; demais respondem ao CEO */}
              <div className="grid gap-4 w-full relative" style={{ maxWidth: gridMaxWidth, gridTemplateColumns }}>
                {allColumns.map((col) => {
                  const isMarketing = col.key === "marketing";
                  const columnHead = col.gestor;
                  const headLabel = "Gestor";
                  return (
                    <div key={col.key} className="flex flex-col items-center relative">


                      {/* Header */}
                      <div
                        className={`w-full rounded-lg px-3 py-2 mb-3 shadow-sm ${
                          col.deptColor ? "" : `bg-gradient-to-r ${col.headerColor}`
                        }`}
                        style={col.deptColor ? { backgroundColor: col.deptColor } : undefined}
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
                          {renderPersonCard(columnHead, { size: "md", badgeColor: col.badgeColor, deptColor: col.deptColor, label: headLabel })}
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
                            renderPersonCard(m, { size: "sm", badgeColor: col.badgeColor, deptColor: col.deptColor })
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
