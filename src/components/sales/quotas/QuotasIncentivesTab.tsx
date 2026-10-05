import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Crosshair, Dice5, Presentation, Download, Link2, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { QuotasSection } from "./QuotasSection";
import { IncentivePlanSection } from "./IncentivePlanSection";
import { TeamGoalsTab } from "@/components/sales/team/TeamGoalsTab";
import { RoulettePoolsManager } from "./RoulettePoolsManager";

const PLAN_PDF_PATH = "/plano-bonus-comercial-2026.pdf";

export function QuotasIncentivesTab() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("goals");

  const pdfUrl = `${window.location.origin}${PLAN_PDF_PATH}`;

  const copyPdfLink = async () => {
    try {
      await navigator.clipboard.writeText(pdfUrl);
      toast.success("Link permanente do PDF copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <div className={isMobile ? "flex items-center gap-2" : "flex items-center justify-between gap-2 flex-wrap"}>
        <TabsList className={isMobile ? "h-12 flex-1 min-w-0 grid grid-cols-3 rounded-xl [&>button]:h-10" : undefined}>
          <TabsTrigger value="goals" className="gap-1.5">
            <Crosshair className="h-4 w-4" />
            Meta
          </TabsTrigger>
          <TabsTrigger value="incentives" className="gap-1.5">
            <Gift className="h-4 w-4" />
            {isMobile ? "Incentivo" : "Plano de Incentivo"}
          </TabsTrigger>
          <TabsTrigger value="roulette" className="gap-1.5">
            <Dice5 className="h-4 w-4" />
            Roletas
          </TabsTrigger>
        </TabsList>
        {isMobile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label="Ações do plano">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="min-h-11" onClick={() => navigate("/sales-team/incentive-presentation/slideshow")}>
                <Presentation className="h-4 w-4 mr-2" />Apresentar plano
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" onClick={copyPdfLink}>
                <Link2 className="h-4 w-4 mr-2" />Copiar link do PDF
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11" asChild>
                <a href={PLAN_PDF_PATH} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />Baixar PDF
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={copyPdfLink} className="gap-1.5">
            <Link2 className="h-4 w-4" />
            Copiar link do PDF
          </Button>
          <Button size="sm" variant="outline" asChild className="gap-1.5">
            <a href={PLAN_PDF_PATH} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              Baixar PDF
            </a>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/sales-team/incentive-presentation/slideshow")}
            className="gap-1.5 bg-gradient-to-r from-warning to-warning hover:from-warning hover:to-warning text-foreground font-semibold"
          >
            <Presentation className="h-4 w-4" />
            Apresentar plano
          </Button>
        </div>
        )}
      </div>


      <TabsContent value="goals" className="space-y-6">
        <TeamGoalsTab />
        <QuotasSection />
      </TabsContent>

      <TabsContent value="incentives">
        <IncentivePlanSection />
      </TabsContent>

      <TabsContent value="roulette">
        <RoulettePoolsManager />
      </TabsContent>
    </Tabs>
  );
}
