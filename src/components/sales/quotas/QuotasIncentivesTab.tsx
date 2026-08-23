import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Crosshair, Dice5, Presentation, Download, Link2 } from "lucide-react";
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
    <Tabs defaultValue="goals" className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <TabsList>
          <TabsTrigger value="goals" className="gap-1.5">
            <Crosshair className="h-4 w-4" />
            Meta
          </TabsTrigger>
          <TabsTrigger value="incentives" className="gap-1.5">
            <Gift className="h-4 w-4" />
            Plano de Incentivo
          </TabsTrigger>
          <TabsTrigger value="roulette" className="gap-1.5">
            <Dice5 className="h-4 w-4" />
            Roletas
          </TabsTrigger>
        </TabsList>
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
