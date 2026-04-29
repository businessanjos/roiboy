import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileSignature, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContractSummaryPanelProps {
  dealId: string;
}

interface ContractRow {
  id: string;
  contract_number: string | null;
  status: string;
  total_value: number | null;
  installments: number | null;
  signed_at: string | null;
  updated_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  sent: { label: "Enviado", variant: "default" },
  signed: { label: "Assinado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const formatBRL = (v: number | null | undefined) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

export function ContractSummaryPanel({ dealId }: ContractSummaryPanelProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractRow[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("digital_contracts")
        .select("id, contract_number, status, total_value, installments, signed_at, updated_at")
        .eq("deal_id", dealId)
        .order("updated_at", { ascending: false });
      if (!active) return;
      setContracts((data as ContractRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [dealId]);

  const goToContracts = () => {
    navigate(`/sales/contracts?deal=${dealId}`);
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
              <FileSignature className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Contratos deste lead</h3>
              <p className="text-xs text-muted-foreground">
                A gestão completa de contratos foi movida para a área de Contratos Digitais.
              </p>
            </div>
          </div>
        </div>

        {contracts.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Nenhum contrato gerado para este lead ainda.
            </p>
            <Button size="sm" onClick={goToContracts} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Gerar contrato em Contratos Digitais
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => {
              const status = STATUS_LABELS[c.status] ?? { label: c.status, variant: "outline" as const };
              return (
                <div
                  key={c.id}
                  className="rounded-md border bg-muted/30 p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {c.contract_number || "Contrato sem número"}
                      </span>
                      <Badge variant={status.variant} className="h-5 px-1.5 text-[10px]">
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span>Valor: <span className="text-foreground">{formatBRL(c.total_value)}</span></span>
                      {c.installments ? (
                        <span>Parcelas: <span className="text-foreground">{c.installments}x</span></span>
                      ) : null}
                      {c.signed_at ? (
                        <span>
                          Assinado em{" "}
                          <span className="text-foreground">
                            {format(new Date(c.signed_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </span>
                      ) : (
                        <span>
                          Atualizado em{" "}
                          <span className="text-foreground">
                            {format(new Date(c.updated_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={goToContracts} className="w-full gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir em Contratos Digitais
          </Button>
        </div>
      </Card>
    </div>
  );
}
