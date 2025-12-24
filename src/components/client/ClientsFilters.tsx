import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, ChevronDown, X } from "lucide-react";
import { Product, TeamUser } from "@/hooks/useClientsPage";

interface ClientsFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterProduct: string;
  setFilterProduct: (value: string) => void;
  filterVNPS: string;
  setFilterVNPS: (value: string) => void;
  filterContract: string;
  setFilterContract: (value: string) => void;
  filterResponsible: string;
  setFilterResponsible: (value: string) => void;
  products: Product[];
  teamUsers: TeamUser[];
  totalCount: number;
  filteredCount: number;
}

export function ClientsFilters({
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterProduct,
  setFilterProduct,
  filterVNPS,
  setFilterVNPS,
  filterContract,
  setFilterContract,
  filterResponsible,
  setFilterResponsible,
  products,
  teamUsers,
  totalCount,
  filteredCount,
}: ClientsFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [
    filterStatus !== "all",
    filterProduct !== "all",
    filterVNPS !== "all",
    filterContract !== "all",
    filterResponsible !== "all",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterStatus("all");
    setFilterProduct("all");
    setFilterVNPS("all");
    setFilterContract("all");
    setFilterResponsible("all");
  };

  return (
    <div className="space-y-3">
      {/* Search and Filter Toggle */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button 
          variant={showFilters || activeFilterCount > 0 ? "secondary" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2 shrink-0"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Status Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                  <SelectItem value="prospect">Prospecto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Produto</label>
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* V-NPS Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">V-NPS</label>
              <Select value={filterVNPS} onValueChange={setFilterVNPS}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="promoter">Promotor</SelectItem>
                  <SelectItem value="neutral">Neutro</SelectItem>
                  <SelectItem value="detractor">Detrator</SelectItem>
                  <SelectItem value="none">Sem V-NPS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contract Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Contrato</label>
              <Select value={filterContract} onValueChange={setFilterContract}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                  <SelectItem value="urgent">Expira em 30 dias</SelectItem>
                  <SelectItem value="warning">Expira em 60 dias</SelectItem>
                  <SelectItem value="ok">Vigente</SelectItem>
                  <SelectItem value="none">Sem contrato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Responsible Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Responsável</label>
              <Select value={filterResponsible} onValueChange={setFilterResponsible}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {teamUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <div className="flex justify-end pt-2 border-t border-border/50">
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1.5 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            </div>
          )}

          {/* Active Filters Summary */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground mr-1">Filtros ativos:</span>
              {filterStatus !== "all" && (
                <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                  Status: {filterStatus === "active" ? "Ativo" : filterStatus === "paused" ? "Pausado" : filterStatus === "churned" ? "Churned" : "Prospecto"}
                  <button onClick={() => setFilterStatus("all")} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filterProduct !== "all" && (
                <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                  Produto: {products.find(p => p.id === filterProduct)?.name || "..."}
                  <button onClick={() => setFilterProduct("all")} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filterVNPS !== "all" && (
                <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                  V-NPS: {filterVNPS === "promoter" ? "Promotor" : filterVNPS === "neutral" ? "Neutro" : filterVNPS === "detractor" ? "Detrator" : "Sem V-NPS"}
                  <button onClick={() => setFilterVNPS("all")} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filterContract !== "all" && (
                <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                  Contrato: {filterContract === "expired" ? "Expirado" : filterContract === "urgent" ? "30 dias" : filterContract === "warning" ? "60 dias" : filterContract === "ok" ? "Vigente" : "Sem contrato"}
                  <button onClick={() => setFilterContract("all")} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filterResponsible !== "all" && (
                <Badge variant="secondary" className="text-xs gap-1 px-2 py-0.5">
                  Responsável: {filterResponsible === "none" ? "Sem responsável" : teamUsers.find(u => u.id === filterResponsible)?.name || "..."}
                  <button onClick={() => setFilterResponsible("all")} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filteredCount} cliente{filteredCount !== 1 ? "s" : ""} encontrado{filteredCount !== 1 ? "s" : ""}
          {activeFilterCount > 0 && ` (de ${totalCount} total)`}
        </span>
      </div>
    </div>
  );
}
