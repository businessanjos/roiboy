import { useState } from "react";
import { Link } from "react-router-dom";
import { Grid3X3, ChevronRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NavItem } from "@/config/sectors";
import { matchesScreenSearch } from "@/lib/navigation/mobileNavigation";
import { cn } from "@/lib/utils";

export function MobileSectorMenu({ items, activeTarget, onNavigate, onZapp, zappLoading }: {
  items: NavItem[]; activeTarget: string | null; onNavigate: () => void;
  onZapp?: () => void; zappLoading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => matchesScreenSearch(item.label, item.group || "", query));
  const groups = Array.from(new Set(filtered.map((item) => item.group || "Telas")));
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="px-4 pb-3">
      <Input aria-label="Buscar tela do setor" placeholder="Buscar tela…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-11" />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" data-vaul-no-drag>
      {groups.map((group) => <section key={group} className="mb-4">
        <h3 className="mb-1 px-3 text-xs font-semibold text-muted-foreground">{group}</h3>
        {filtered.filter((i) => (i.group || "Telas") === group).map((item) => <Button key={item.to} asChild variant="ghost" className={cn("h-auto min-h-11 w-full justify-start gap-3 py-3 text-left", activeTarget === item.to && "bg-primary/15")}>
          <Link to={item.to} onClick={onNavigate} aria-current={activeTarget === item.to ? "page" : undefined}>
            <item.icon className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 whitespace-normal break-words">{item.label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </Button>)}
      </section>)}
      {filtered.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">Nenhuma tela encontrada</p>}
      <div className="space-y-1 border-t border-border pt-3">
        {onZapp && !query && <Button variant="ghost" className="h-11 w-full justify-start gap-3" disabled={zappLoading} onClick={onZapp}><MessageSquare className="h-5 w-5" />ROY zAPP</Button>}
        <Button asChild variant="outline" className="h-11 w-full justify-start gap-3"><Link to="/setores" onClick={onNavigate}><Grid3X3 className="h-5 w-5" />Trocar de área</Link></Button>
      </div>
    </div>
  </div>;
}