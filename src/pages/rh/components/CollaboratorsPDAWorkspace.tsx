import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
            <Select value={filters.sector} onValueChange={v => setFilter("sector", v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {optionsFor("pda_sectors").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.level} onValueChange={v => setFilter("level", v)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                {optionsFor("pda_level").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.phase} onValueChange={v => setFilter("phase", v)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Fase" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fases</SelectItem>
                {optionsFor("pda_phase").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.thermo} onValueChange={v => setFilter("thermo", v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Termômetro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {optionsFor("pda_thermometer").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.company} onValueChange={v => setFilter("company", v)}>
              <SelectTrigger className="w-[210px]"><SelectValue placeholder="Empresa de registro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {optionsFor("registration_company").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasActivePdaFilters(filters) && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_PDA_FILTERS)}>
                <X className="h-4 w-4 mr-1" /> Limpar filtros
              </Button>
            )}
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
