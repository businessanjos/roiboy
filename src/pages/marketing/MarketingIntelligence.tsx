import { Telescope } from "lucide-react";

export default function MarketingIntelligence() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Telescope className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Market Intelligence</h1>
          <p className="text-muted-foreground">
            Inteligência de mercado, concorrência e tendências
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        Área em construção. Em breve: análise competitiva, benchmarks, tendências
        de busca e sinais de mercado.
      </div>
    </div>
  );
}
