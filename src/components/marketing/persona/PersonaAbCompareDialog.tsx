import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, Sparkles, Instagram } from "lucide-react";
import { useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fieldLabel: string;
  variantA: string | string[];
  variantB: string | string[];
  isArray: boolean;
  hasHighlights: boolean;
  onChoose: (variant: "a" | "b") => void;
  onFeedback: (variant: "a" | "b", feedback: "up" | "down") => void;
}

export function PersonaAbCompareDialog({
  open, onOpenChange, fieldLabel, variantA, variantB, isArray, hasHighlights, onChoose, onFeedback,
}: Props) {
  const [feedbackA, setFeedbackA] = useState<"up" | "down" | null>(null);
  const [feedbackB, setFeedbackB] = useState<"up" | "down" | null>(null);

  const handleFeedback = (variant: "a" | "b", fb: "up" | "down") => {
    if (variant === "a") setFeedbackA(fb);
    else setFeedbackB(fb);
    onFeedback(variant, fb);
  };

  const renderValue = (v: string | string[]) => {
    if (isArray && Array.isArray(v)) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {v.map((item, i) => (
            <Badge key={i} variant="secondary" className="text-xs font-normal">{item}</Badge>
          ))}
        </div>
      );
    }
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{v as string}</p>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Comparar sugestões — {fieldLabel}
          </DialogTitle>
          <DialogDescription>
            A IA gerou 2 versões em paralelo. Escolha a melhor — sua decisão treina o sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Variante A */}
          <Card className="p-4 border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-background flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-pink-500 hover:bg-pink-600">A</Badge>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Instagram className="h-3 w-3" /> Com DESTAQUES
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant={feedbackA === "up" ? "default" : "ghost"}
                  className="h-7 w-7"
                  onClick={() => handleFeedback("a", "up")}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant={feedbackA === "down" ? "destructive" : "ghost"}
                  className="h-7 w-7"
                  onClick={() => handleFeedback("a", "down")}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 mb-3">{renderValue(variantA)}</div>
            <Button onClick={() => onChoose("a")} className="w-full" variant="default">
              Usar esta versão
            </Button>
          </Card>

          {/* Variante B */}
          <Card className="p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">B</Badge>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Sem DESTAQUES (controle)
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant={feedbackB === "up" ? "default" : "ghost"}
                  className="h-7 w-7"
                  onClick={() => handleFeedback("b", "up")}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant={feedbackB === "down" ? "destructive" : "ghost"}
                  className="h-7 w-7"
                  onClick={() => handleFeedback("b", "down")}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 mb-3">{renderValue(variantB)}</div>
            <Button onClick={() => onChoose("b")} className="w-full" variant="outline">
              Usar esta versão
            </Button>
          </Card>
        </div>

        {!hasHighlights && (
          <p className="text-xs text-muted-foreground text-center">
            ℹ️ Sem destaques de Instagram disponíveis: as duas variantes foram geradas a partir de CRM + diagnósticos, então podem ser similares.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
