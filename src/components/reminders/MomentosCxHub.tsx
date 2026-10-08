import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CxSendQueue from "./CxSendQueue";
import MomentosCxCampaign from "./MomentosCxCampaign";

/** Separa a fila automática (padrão) do disparo manual em massa. */
export default function MomentosCxHub() {
  const [view, setView] = useState<"auto" | "manual">("auto");

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as "auto" | "manual")} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            {view === "auto" ? "Fila automática" : "Disparo manual"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {view === "auto"
              ? "O ROY envia sozinho às 8h. Aqui você acompanha, inclui ou tira clientes da fila."
              : "Use só para campanhas extraordinárias, fora da rotina automática."}
          </p>
        </div>
        <TabsList className="grid h-11 w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="auto" className="h-9 gap-2 px-4">
            <Bot className="h-4 w-4" /> Fila automática
          </TabsTrigger>
          <TabsTrigger value="manual" className="h-9 gap-2 px-4">
            <Send className="h-4 w-4" /> Disparo manual
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="auto" className="mt-0">
        <CxSendQueue />
      </TabsContent>
      <TabsContent value="manual" className="mt-0">
        <MomentosCxCampaign />
      </TabsContent>
    </Tabs>
  );
}
