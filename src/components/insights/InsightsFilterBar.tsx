import { CalendarDays, ChevronDown, Filter, RotateCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useInsightsFilters, DatePreset } from "@/hooks/useInsightsFilters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "last_month", label: "Mês Passado" },
  { value: "quarter", label: "Este Trimestre" },
  { value: "year", label: "Este Ano" },
];

export function InsightsFilterBar() {
  const {
    filters,
    setPreset,
    setDateRange,
    setUserId,
    setProductId,
    getDateRangeLabel,
    resetFilters,
  } = useInsightsFilters();

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateRange, setDateRangeLocal] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(filters.startDate),
    to: new Date(filters.endDate),
  });

  // Fetch users for filter
  const { data: users = [] } = useQuery({
    queryKey: ["insights-filter-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name")
        .order("name");
      return data || [];
    },
  });

  // Fetch products for filter
  const { data: products = [] } = useQuery({
    queryKey: ["insights-filter-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      setDateRangeLocal({ from: range.from, to: range.to });
      if (range.from && range.to) {
        setDateRange(range.from, range.to);
        setDatePickerOpen(false);
      }
    }
  };

  const selectedUser = users.find((u) => u.id === filters.userId);
  const selectedProduct = products.find((p) => p.id === filters.productId);

  const hasActiveFilters =
    filters.userId !== "all" || filters.productId !== "all";

  return (
    <div className="flex items-center gap-2 p-3 md:p-4 bg-card border rounded-lg overflow-x-auto scrollbar-hide">
      {/* Date Preset Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            {getDateRangeLabel()}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.value}
              onClick={() => setPreset(preset.value)}
              className={cn(
                filters.preset === preset.value && "bg-accent"
              )}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDatePickerOpen(true);
                }}
              >
                Personalizado...
              </DropdownMenuItem>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Date Range Display */}
      {filters.preset !== "custom" && (
        <span className="text-sm text-muted-foreground hidden md:inline">
          {format(new Date(filters.startDate), "dd/MM/yyyy", { locale: ptBR })} -{" "}
          {format(new Date(filters.endDate), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      )}

      <div className="h-4 w-px bg-border mx-2 hidden md:block" />

      {/* User Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={filters.userId !== "all" ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
          >
            <User className="h-4 w-4" />
            {selectedUser?.name || "Todos os Vendedores"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
          <DropdownMenuItem
            onClick={() => setUserId("all")}
            className={cn(filters.userId === "all" && "bg-accent")}
          >
            Todos os Vendedores
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {users.map((user) => (
            <DropdownMenuItem
              key={user.id}
              onClick={() => setUserId(user.id)}
              className={cn(filters.userId === user.id && "bg-accent")}
            >
              {user.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Product Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={filters.productId !== "all" ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            {selectedProduct?.name || "Todos os Produtos"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
          <DropdownMenuItem
            onClick={() => setProductId("all")}
            className={cn(filters.productId === "all" && "bg-accent")}
          >
            Todos os Produtos
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {products.map((product) => (
            <DropdownMenuItem
              key={product.id}
              onClick={() => setProductId(product.id)}
              className={cn(filters.productId === product.id && "bg-accent")}
            >
              {product.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="gap-2 text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
