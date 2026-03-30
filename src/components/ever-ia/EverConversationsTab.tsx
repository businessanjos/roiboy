import { Bot, MessageSquareText, ArrowRightLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EverConversationsTab() {
  return (
    <div className="p-6">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
            <MessageSquareText className="h-8 w-8 text-violet-500" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Conversas com IA</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Aqui você verá todas as conversas onde a IA está ativa. Poderá monitorar, 
            assumir o atendimento manualmente ou devolver para a IA.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-violet-500" />
              IA atendendo
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowRightLeft className="h-4 w-4 text-amber-500" />
              Transferir para humano
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-6 italic">
            Configure um agente e ative-o para começar a ver conversas aqui
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
