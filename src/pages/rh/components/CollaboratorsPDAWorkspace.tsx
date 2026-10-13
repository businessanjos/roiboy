import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
}: {
  collaborators: HRCollaborator[];
  canSeeSalary?: boolean;
  canEdit?: boolean;
  onChanged?: () => void;
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

  const pdaFilterFields = (
    <>
      <Select value={filters.sector} onValueChange={v => setFilter("sector", v)}>
        <SelectTrigger className="h-11 md:h-10" aria-label="Setor"><SelectValue placeholder="Setor" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os setores</SelectItem>
          {optionsFor("pda_sectors").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.level} onValueChange={v => setFilter("level", v)}>
        <SelectTrigger className="h-11 md:h-10" aria-label="Nível"><SelectValue placeholder="Nível" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os níveis</SelectItem>
          {optionsFor("pda_level").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.phase} onValueChange={v => setFilter("phase", v)}>
        <SelectTrigger className="h-11 md:h-10" aria-label="Fase"><SelectValue placeholder="Fase" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as fases</SelectItem>
          {optionsFor("pda_phase").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.thermo} onValueChange={v => setFilter("thermo", v)}>
        <SelectTrigger className="h-11 md:h-10" aria-label="Termômetro"><SelectValue placeholder="Termômetro" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {optionsFor("pda_thermometer").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.company} onValueChange={v => setFilter("company", v)}>
        <SelectTrigger className="h-11 md:h-10" aria-label="Empresa de registro"><SelectValue placeholder="Empresa de registro" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as empresas</SelectItem>
          {optionsFor("registration_company").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </>
  );

  const clearPdaFilters = () => setFilters(EMPTY_PDA_FILTERS);

  const clearButton = hasActivePdaFilters(filters) && (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearPdaFilters}>
      <X className="h-3 w-3 mr-1" /> Limpar
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={v => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="board">Quadro</TabsTrigger>
            <TabsTrigger value="dashboard">Painel</TabsTrigger>
            <TabsTrigger value="calendar">Calendário</TabsTrigger>
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

            {/* Mobile: sheet lateral inferior */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-11 md:hidden" aria-label="Filtros dos colaboradores">
                  <SlidersHorizontal className="h-4 w-4 mr-1.5" />
                  Filtros
                  {activePdaFilters.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{activePdaFilters.length}</Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85dvh] overflow-y-auto">
                <SheetHeader className="text-left">
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>Refina a lista, o quadro e o painel dos colaboradores.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 grid gap-3">{pdaFilterFields}</div>
                {hasActivePdaFilters(filters) && (
                  <Button variant="ghost" className="mt-3 h-11 w-full" onClick={clearPdaFilters}>
                    <X className="h-4 w-4 mr-1" /> Limpar filtros
                  </Button>
                )}
                <SheetClose asChild>
                  <Button className="mt-4 h-11 w-full">Concluir</Button>
                </SheetClose>
              </SheetContent>
            </Sheet>
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
