import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Percent, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Rate = { percent: number; fixed: number };
type Product = { id: string; name: string; price: number | null };

interface Props {
  products: Product[];
  getRate: (productId: string) => Rate;
  setDraftRates: React.Dispatch<React.SetStateAction<Record<string, Rate>>>;
  positionTitle?: string;
}

export function ProductCommissionCard({ products, getRate, setDraftRates, positionTitle }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "configured" | "unconfigured">("all");

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const rate = getRate(p.id);
      const isConfigured = rate.percent > 0 || rate.fixed > 0;
      if (filter === "configured" && !isConfigured) return false;
      if (filter === "unconfigured" && isConfigured) return false;
      if (!term) return true;
      return p.name.toLowerCase().includes(term);
    });
  }, [products, search, filter, getRate]);

  const configuredCount = products.filter((p) => {
    const r = getRate(p.id);
    return r.percent > 0 || r.fixed > 0;
  }).length;

  const updateRate = (productId: string, patch: Partial<Rate>) => {
    setDraftRates((prev) => ({
      ...prev,
      [productId]: { ...getRate(productId), ...patch },
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Comissão por Produto {positionTitle && <span className="text-muted-foreground font-normal">— {positionTitle}</span>}
            </CardTitle>
            <CardDescription className="mt-0.5">
              {configuredCount} de {products.length} produtos configurados
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              Todos <span className="ml-1 opacity-60">{products.length}</span>
            </FilterChip>
            <FilterChip active={filter === "configured"} onClick={() => setFilter("configured")}>
              Configurados <span className="ml-1 opacity-60">{configuredCount}</span>
            </FilterChip>
            <FilterChip active={filter === "unconfigured"} onClick={() => setFilter("unconfigured")}>
              Pendentes <span className="ml-1 opacity-60">{products.length - configuredCount}</span>
            </FilterChip>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 h-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearch("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhum produto encontrado
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-3 -mr-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {filteredProducts.map((product) => {
                const rate = getRate(product.id);
                const isConfigured = rate.percent > 0 || rate.fixed > 0;
                return (
                  <div
                    key={product.id}
                    className={`group flex items-center gap-3 rounded-lg border bg-card px-3 py-2 transition-colors hover:border-primary/40 ${
                      isConfigured ? "border-primary/20" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">{product.name}</span>
                        {isConfigured && (
                          <Badge variant="secondary" className="h-4 px-1 text-[9px] shrink-0">OK</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        R$ {(Number(product.price) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          placeholder="0"
                          value={rate.percent || ""}
                          onChange={(e) =>
                            updateRate(product.id, { percent: parseFloat(e.target.value) || 0 })
                          }
                          className="w-16 h-8 text-center text-sm pr-5"
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                          R$
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={rate.fixed ? rate.fixed.toLocaleString("pt-BR") : ""}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "");
                            updateRate(product.id, { fixed: digits ? parseInt(digits, 10) : 0 });
                          }}
                          className="w-24 h-8 text-center text-sm pl-7"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
