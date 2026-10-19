import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { emailHasHRAccess } from "@/lib/access/hrAccess";
import type { HRCollaborator } from "@/hooks/useHRCollaborators";
import { useHRPdaOptions } from "@/hooks/useHRPdaOptions";
import { useHRPositions } from "@/hooks/useHRPositions";
import { roleProfileFromPosition } from "@/lib/rh/pdaContent";
import {
  applyPdaFilters, EMPTY_PDA_FILTERS, hasActivePdaFilters, isPdaTerminated, type PdaFilters,
} from "@/lib/rh/pdaFilters";
import CollaboratorsPDATable from "./CollaboratorsPDATable";
import PdaBoardView from "./PdaBoardView";
import PdaCalendarView from "./PdaCalendarView";
import PdaDashboardView from "./PdaDashboardView";

type View = "list" | "board" | "dashboard" | "calendar";

export default function CollaboratorsPDAWorkspace({
  collaborators,
  canSeeSalary = true,
  canEdit = true,
  onChanged,
  deptFilter,
  onDeptFilterChange,
  departments,
}: {
  collaborators: HRCollaborator[];
  canSeeSalary?: boolean;
  canEdit?: boolean;
  onChanged?: () => void;
  /** Filtro de departamento da página, exibido no mesmo painel mobile. */
  deptFilter?: string;
  onDeptFilterChange?: (v: string) => void;
  departments?: (string | null)[];
}) {
  const { optionsFor } = useHRPdaOptions();
  const { currentUser } = useCurrentUser();
  const { positions } = useHRPositions();
  const [view, setView] = useState<View>("list");
  const [filters, setFilters] = useState<PdaFilters>(EMPTY_PDA_FILTERS);

  /** Perfil da Vaga herda do cargo quando a pessoa não tem valor próprio. */
  const withInheritedProfile = useMemo(() => {
    const byTitle = new Map(
      positions.map(p => [
        (p.title || "").trim().toLowerCase(),
        roleProfileFromPosition((p as any).ideal_primary_profile, (p as any).ideal_secondary_profile),
      ]),
    );
    return collaborators.map(c => {
      if ((c as any).pda_role_profile) return c;
      const inherited = byTitle.get(((c as any).position || "").trim().toLowerCase());
      return inherited ? ({ ...c, pda_role_profile: inherited } as HRCollaborator) : c;
    });
  }, [collaborators, positions]);

  const setFilter = (key: keyof PdaFilters, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  /**
   * RH/diretoria vê todo mundo; quem não é (ex.: gestor com acesso ao setor RH)
   * vê apenas a própria equipe (pessoas cujo Gestor é ele) e a si mesmo.
   */
  const scoped = useMemo(() => {
    const email = (currentUser?.email || "").toLowerCase();
    const role = (currentUser as any)?.role as string | undefined;
    const isHrOrDirector = emailHasHRAccess(email) || ["admin", "super_admin", "head"].includes(role || "");
    if (isHrOrDirector) return withInheritedProfile;
    const me = withInheritedProfile.find(
      c => (c as any).user_id === currentUser?.id || (c.email || "").toLowerCase() === email,
    );
    if (!me) return [];
    return withInheritedProfile.filter(c => c.id === me.id || (c as any).manager_id === me.id);
  }, [withInheritedProfile, currentUser]);

  const filtered = useMemo(() => applyPdaFilters(scoped, filters), [scoped, filters]);
  const dashboardRows = useMemo(() => filtered.filter(c => !isPdaTerminated(c)), [filtered]);

  const activePdaFilters = useMemo(
    () =>
      (Object.entries(filters) as [keyof PdaFilters, string][])
        .filter(([, v]) => v !== "all"),
    [filters],
  );

  /** Resumo curto do que está filtrado, no formato dos Checkpoints. */
  const pdaFilterSummary = useMemo(() => {
    if (activePdaFilters.length === 0) return "Filtros";
    const valueLabel = (key: string, value: string): string => {
      switch (key) {
        case "sector": return optionsFor("pda_sectors").find(o => o.value === value)?.label || value;
        case "level": return optionsFor("pda_level").find(o => o.value === value)?.label || value;
        case "phase": return optionsFor("pda_phase").find(o => o.value === value)?.label || value;
        case "thermo": return optionsFor("pda_thermometer").find(o => o.value === value)?.label || value;
        case "company": return optionsFor("registration_company").find(o => o.value === value)?.label || value;
        default: return value;
      }
    };
    return activePdaFilters
      .slice(0, 2)
      .map(([key, value]) => valueLabel(key as string, value))
      .join(" · ");
  }, [activePdaFilters, optionsFor]);

  /** Campo de filtro com rótulo visível (o painel rola, então o contexto não se perde). */
  const labeledField = (label: string, field: React.ReactNode) => (
    <div className="space-y-1.5" key={label}>
      <Label className="text-xs">{label}</Label>
      {field}
    </div>
  );

  const pdaFilterFields = (
    <>
      {labeledField("Setor", (
        <Select value={filters.sector} onValueChange={v => setFilter("sector", v)}>
          <SelectTrigger className="h-11 md:h-10" aria-label="Setor"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {optionsFor("pda_sectors").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
      {labeledField("Nível", (
        <Select value={filters.level} onValueChange={v => setFilter("level", v)}>
          <SelectTrigger className="h-11 md:h-10" aria-label="Nível"><SelectValue placeholder="Nível" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            {optionsFor("pda_level").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
      {labeledField("Fase", (
        <Select value={filters.phase} onValueChange={v => setFilter("phase", v)}>
          <SelectTrigger className="h-11 md:h-10" aria-label="Fase"><SelectValue placeholder="Fase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fases</SelectItem>
            {optionsFor("pda_phase").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
      {labeledField("Termômetro", (
        <Select value={filters.thermo} onValueChange={v => setFilter("thermo", v)}>
          <SelectTrigger className="h-11 md:h-10" aria-label="Termômetro"><SelectValue placeholder="Termômetro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {optionsFor("pda_thermometer").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
      {labeledField("Empresa de registro", (
        <Select value={filters.company} onValueChange={v => setFilter("company", v)}>
          <SelectTrigger className="h-11 md:h-10" aria-label="Empresa de registro"><SelectValue placeholder="Empresa de registro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {optionsFor("registration_company").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
    </>
  );

  const clearPdaFilters = () => setFilters(EMPTY_PDA_FILTERS);

  const clearButton = hasActivePdaFilters(filters) && (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearPdaFilters}>
      <X className="h-3 w-3 mr-1" /> Limpar
    </Button>
  );

  /** Painel inferior unificado (departamento da página + filtros PDA), com rótulos visíveis. */
  const mobileFiltersSheet = (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-11 flex-1 md:hidden max-w-full" aria-label="Filtros dos colaboradores">
          <SlidersHorizontal className="h-4 w-4 mr-1.5 shrink-0" />
          <span className="truncate">
            {[
              deptFilter && deptFilter !== "all" ? deptFilter : null,
              activePdaFilters.length > 0 ? pdaFilterSummary : null,
            ].filter(Boolean).join(" · ") || "Filtros"}
          </span>
          {(activePdaFilters.length + (deptFilter && deptFilter !== "all" ? 1 : 0)) > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] shrink-0">
              {activePdaFilters.length + (deptFilter && deptFilter !== "all" ? 1 : 0)}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Refina a lista, o quadro e o painel dos colaboradores. Status e vínculo não se aplicam ao PDA.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid gap-3">
          {onDeptFilterChange && (
            <div className="space-y-1.5">
              <Label className="text-xs">Departamento</Label>
              <Select value={deptFilter || "all"} onValueChange={onDeptFilterChange}>
                <SelectTrigger className="h-11" aria-label="Departamento"><SelectValue placeholder="Departamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os departamentos</SelectItem>
                  {(departments || []).map(d => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {pdaFilterFields}
        </div>
        {(hasActivePdaFilters(filters) || (deptFilter && deptFilter !== "all")) && (
          <Button
            variant="ghost"
            className="mt-3 h-11 w-full"
            onClick={() => { clearPdaFilters(); onDeptFilterChange?.("all"); }}
          >
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        )}
        <SheetClose asChild>
          <Button className="mt-4 h-11 w-full">Concluir</Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
        <Tabs value={view} onValueChange={v => setView(v as View)} className="w-full md:w-auto">
          <TabsList className="w-full grid grid-cols-4 md:w-auto md:inline-flex h-auto">
            <TabsTrigger value="list" className="min-h-11 md:min-h-9">Lista</TabsTrigger>
            <TabsTrigger value="board" className="min-h-11 md:min-h-9">Quadro</TabsTrigger>
            <TabsTrigger value="dashboard" className="min-h-11 md:min-h-9">Painel</TabsTrigger>
            <TabsTrigger value="calendar" className="min-h-11 md:min-h-9">Calendário</TabsTrigger>
          </TabsList>
        </Tabs>

        {view !== "calendar" && (
          <>
            {/* Desktop: gatilho discreto com resumo do que está filtrado */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Filtrar colaboradores"
                  className="hidden h-8 gap-1.5 px-2.5 text-xs font-normal text-muted-foreground hover:text-foreground md:flex"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span className="max-w-[260px] truncate">{pdaFilterSummary}</span>
                  {activePdaFilters.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-4">
                      {activePdaFilters.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto min-w-[280px] p-3">
                <div className="grid gap-2.5">{pdaFilterFields}</div>
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-2.5">
                  {clearButton}
                </div>
              </PopoverContent>
            </Popover>

            {/* Mobile: na visão Lista o painel fica na mesma faixa de Opções/Colunas (slot da tabela) */}
            {view !== "list" && mobileFiltersSheet}
          </>
        )}
      </div>

      {view === "list" && (
        <CollaboratorsPDATable
          collaborators={filtered}
          canSeeSalary={canSeeSalary}
          canEdit={canEdit}
          onChanged={onChanged}
          hideFilters
          mobileControls={mobileFiltersSheet}
        />
      )}
      {view === "board" && <PdaBoardView collaborators={filtered} />}
      {view === "dashboard" && (
        <PdaDashboardView
          collaborators={dashboardRows}
          canSeeSalary={canSeeSalary}
          onSlice={(field, value) => {
            setFilter(field, value);
            setView("list");
          }}
        />
      )}
      {view === "calendar" && <PdaCalendarView collaborators={scoped} />}
    </div>
  );
}
