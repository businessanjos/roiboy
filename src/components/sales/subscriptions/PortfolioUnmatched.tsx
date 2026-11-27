import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PortfolioClinic } from "@/lib/sales/payPortfolio";
import { PayLinkManagerDialog } from "@/components/sales/PayLinkManagerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const dayBR = (value: string | null) => (value ? value.slice(0, 10).split("-").reverse().join("/") : null);
const REASON: Record<string, string> = {
  needs_document: "Sem CPF/CNPJ ou e-mail no ROY",
  not_found: "Nada pago no RykaPay",
};

/** Negócios ganhos de CR que ficaram fora dos números: quem são, por quê e o atalho para vincular o pagamento. */
export function PortfolioUnmatched({ clinics, onLinked }: { clinics: PortfolioClinic[]; onLinked: () => void }) {
  const [linkDeal, setLinkDeal] = useState<string | null>(null);
  // Mesmo critério do ganho: só a gestão vincula direto; o servidor confere de novo.
  const { data: canLink } = useQuery({
    queryKey: ["can-manage-pay-links"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return false;
      const { data } = await (supabase as any).rpc("can_manage_spiff_payments", { _auth_user_id: auth.user.id });
      return data === true;
    },
  });

  return (
    <Card data-testid="portfolio-unmatched">
      <CardHeader>
        <CardTitle className="text-base">Ganhos sem pagamento localizado ({clinics.length})</CardTitle>
        <CardDescription>Negócios ganhos de CR que não entram nos números porque o RykaPay não mostrou pagamento deles.</CardDescription>
      </CardHeader>
      <CardContent>
        {clinics.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> Todos os negócios ganhos foram localizados no RykaPay.</p>
        ) : (
          <ul className="divide-y">
            {clinics.map(c => (
              <li key={c.dealId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[c.sellerName || "Sem vendedor", dayBR(c.wonAt) ? `Ganho em ${dayBR(c.wonAt)}` : null].filter(Boolean).join(" · ")}
                  </p>
                  <Badge variant="outline" className="mt-1 font-normal">{REASON[c.state] ?? REASON.not_found}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="h-11 sm:h-9">
                    <Link to={`/pipeline?deal=${c.dealId}`}><ExternalLink className="h-4 w-4" strokeWidth={1.5} /> Abrir negócio</Link>
                  </Button>
                  {canLink && (
                    <Button size="sm" className="h-11 sm:h-9" onClick={() => setLinkDeal(c.dealId)}>
                      <Link2 className="h-4 w-4" strokeWidth={1.5} /> Vincular pagamento
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {linkDeal && (
        <PayLinkManagerDialog open onOpenChange={open => !open && setLinkDeal(null)} dealId={linkDeal} onLinked={onLinked} />
      )}
    </Card>
  );
}
