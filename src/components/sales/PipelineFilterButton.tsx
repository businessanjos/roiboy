import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Filter,
  Search,
  Users,
  Star,
  Settings2,
  Plus,
  Lock,
  Globe,
  X,
  ChevronDown,
  Trash2,
  Package,
} from "lucide-react";
import { usePipelineFilters, RECOMMENDED_FILTERS, ActiveFilter, PipelineFilter } from "@/hooks/usePipelineFilters";
import { PipelineFilterDialog, CustomFieldOption } from "./PipelineFilterDialog";
import { DealStage } from "@/hooks/useDeals";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";

interface SalesUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  color: string | null;
}

interface PipelineFilterButtonProps {
  salesUsers: SalesUser[];
  stages: DealStage[];
  activeFilter: ActiveFilter | null;
  onFilterChange: (filter: ActiveFilter | null) => void;
  availableTags: string[];
  products?: ProductOption[];
}

export function PipelineFilterButton({
  salesUsers,
  stages,
  activeFilter,
  onFilterChange,
  availableTags,
  products = [],
}: PipelineFilterButtonProps) {
  const { currentUser } = useCurrentUser();
  const { filters, fetchFilters, createFilter, updateFilter, deleteFilter } = usePipelineFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("vendedores");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<PipelineFilter | null>(null);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const filteredSalesUsers = useMemo(() => {
    if (!searchQuery.trim()) return salesUsers;
    return salesUsers.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [salesUsers, searchQuery]);

  const filteredRecommended = useMemo(() => {
    if (!searchQuery.trim()) return RECOMMENDED_FILTERS;
    return RECOMMENDED_FILTERS.filter(f =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const filteredCustomFilters = useMemo(() => {
    if (!searchQuery.trim()) return filters;
    return filters.filter(f =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [filters, searchQuery]);

  const handleSelectSalesperson = (user: SalesUser) => {
    onFilterChange({
      type: 'salesperson',
      id: user.id,
      name: user.name,
    });
    setIsOpen(false);
  };

  const handleSelectRecommended = (filter: typeof RECOMMENDED_FILTERS[0]) => {
    onFilterChange({
      type: 'recommended',
      id: filter.id,
      name: filter.name,
      conditions: filter.conditions,
      match_type: filter.match_type,
    });
    setIsOpen(false);
  };

  const handleSelectCustom = (filter: PipelineFilter) => {
    onFilterChange({
      type: 'custom',
      id: filter.id,
      name: filter.name,
      conditions: filter.conditions,
      match_type: filter.match_type,
    });
    setIsOpen(false);
  };

  const handleSelectProduct = (product: ProductOption) => {
    onFilterChange({
      type: 'product',
      id: product.id,
      name: product.name,
    });
    setIsOpen(false);
  };

  const handleClearFilter = () => {
    onFilterChange(null);
  };

  const handleCreateFilter = () => {
    setEditingFilter(null);
    setIsDialogOpen(true);
  };

  const handleEditFilter = (filter: PipelineFilter, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFilter(filter);
    setIsDialogOpen(true);
  };

  const handleDeleteFilter = async (filterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteFilter(filterId);
    if (activeFilter?.id === filterId) {
      onFilterChange(null);
    }
  };

  const handleSaveFilter = async (
    name: string,
    conditions: any[],
    matchType: 'all' | 'any',
    isPublic: boolean
  ) => {
    if (editingFilter) {
      await updateFilter(editingFilter.id, { name, conditions, match_type: matchType, is_public: isPublic });
    } else {
      await createFilter(name, conditions, matchType, isPublic);
    }
    setIsDialogOpen(false);
    setEditingFilter(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activeFilter ? "default" : "outline"}
            size="sm"
            className="h-9 gap-2"
          >
            <Filter className="h-4 w-4" />
            {activeFilter ? (
              <>
                <span className="max-w-[120px] truncate">{activeFilter.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearFilter();
                  }}
                  className="ml-1 hover:bg-background/20 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                Filtros
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0" align="start">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar filtro..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4 h-10 rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="vendedores"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1 text-[11px]"
              >
                <Users className="h-3.5 w-3.5" />
                Vendedores
              </TabsTrigger>
              <TabsTrigger
                value="produtos"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1 text-[11px]"
              >
                <Package className="h-3.5 w-3.5" />
                Produtos
              </TabsTrigger>
              <TabsTrigger
                value="recomendados"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1 text-[11px]"
              >
                <Star className="h-3.5 w-3.5" />
                Recomendados
              </TabsTrigger>
              <TabsTrigger
                value="personalizados"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1 text-[11px]"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Personalizados
              </TabsTrigger>
            </TabsList>

            {/* Vendedores Tab */}
            <TabsContent value="vendedores" className="m-0">
              <ScrollArea className="h-[280px]">
                <div className="p-2 space-y-1">
                  {/* All salespeople option */}
                  <button
                    onClick={() => {
                      onFilterChange(null);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left ${
                      !activeFilter ? "bg-accent" : ""
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-sm">Todos os vendedores</span>
                  </button>

                  {filteredSalesUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectSalesperson(user)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left ${
                        activeFilter?.type === "salesperson" && activeFilter?.id === user.id
                          ? "bg-accent"
                          : ""
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{user.name}</span>
                    </button>
                  ))}

                  {filteredSalesUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum vendedor encontrado
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Produtos Tab */}
            <TabsContent value="produtos" className="m-0">
              <ScrollArea className="h-[280px]">
                <div className="p-2 space-y-1">
                  {/* All products option */}
                  <button
                    onClick={() => {
                      onFilterChange(null);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left ${
                      !activeFilter ? "bg-accent" : ""
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-sm">Todos os produtos</span>
                  </button>

                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left ${
                        activeFilter?.type === "product" && activeFilter?.id === product.id
                          ? "bg-accent"
                          : ""
                      }`}
                    >
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: product.color || 'hsl(var(--primary))' }}
                      >
                        <Package className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-medium text-sm">{product.name}</span>
                    </button>
                  ))}

                  {filteredProducts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum produto encontrado
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Recomendados Tab */}
            <TabsContent value="recomendados" className="m-0">
              <ScrollArea className="h-[280px]">
                <div className="p-2 space-y-1">
                  {filteredRecommended.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => handleSelectRecommended(filter)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left ${
                        activeFilter?.type === "recommended" && activeFilter?.id === filter.id
                          ? "bg-accent"
                          : ""
                      }`}
                    >
                      <Star className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-sm">{filter.name}</span>
                    </button>
                  ))}

                  {filteredRecommended.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum filtro encontrado
                    </p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Personalizados Tab */}
            <TabsContent value="personalizados" className="m-0">
              <ScrollArea className="h-[280px]">
                <div className="p-2 space-y-1">
                  {filteredCustomFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => handleSelectCustom(filter)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left group ${
                        activeFilter?.type === "custom" && activeFilter?.id === filter.id
                          ? "bg-accent"
                          : ""
                      }`}
                    >
                      {filter.is_public ? (
                        <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm flex-1 truncate">{filter.name}</span>
                      
                      {filter.created_by === currentUser?.id && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleEditFilter(filter, e)}
                            className="p-1 hover:bg-background rounded"
                          >
                            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteFilter(filter.id, e)}
                            className="p-1 hover:bg-background rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      )}
                    </button>
                  ))}

                  {filteredCustomFilters.length === 0 && !searchQuery && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum filtro personalizado criado
                    </p>
                  )}

                  {filteredCustomFilters.length === 0 && searchQuery && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum filtro encontrado
                    </p>
                  )}
                </div>
              </ScrollArea>

              {/* Create New Filter Button */}
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  onClick={handleCreateFilter}
                >
                  <Plus className="h-4 w-4" />
                  Criar novo filtro
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      <PipelineFilterDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingFilter(null);
        }}
        onSave={handleSaveFilter}
        editingFilter={editingFilter}
        stages={stages}
        salesUsers={salesUsers}
        availableTags={availableTags}
      />
    </>
  );
}
