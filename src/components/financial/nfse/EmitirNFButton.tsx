import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Receipt, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Props {
  installmentId?: string;
  invoiceId?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

/**
 * Botão para emitir NFS-e via Notazz a partir de uma parcela ou fatura.
 * Mostra status atual (emitida/processando/rejeitada) e permite reemitir.
 */
export function EmitirNFButton({ installmentId, invoiceId, size = "sm", variant = "outline", className }: Props) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  // Busca emissão existente
  const { data: existing } = useQuery({
    queryKey: ["nfse-issuance-for", installmentId ?? invoiceId],
    queryFn: async () => {
      let q = supabase.from("nfse_issuances" as any).select("id, status, nfse_number, pdf_url, rejected_reason");
      if (installmentId) q = q.eq("installment_id", installmentId);
      else if (invoiceId) q = q.eq("invoice_id", invoiceId).is("installment_id", null);
      const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data as any;
    },
    enabled: !!(installmentId || invoiceId),
    staleTime: 30_000,
  });

  const emit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfse-issue", {
        body: installmentId ? { installment_id: installmentId } : { invoice_id: invoiceId },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error || "Falha na emissão");
      toast.success(data?.already_issued ? "NF já emitida" : "Emissão enviada ao Notazz");
      qc.invalidateQueries({ queryKey: ["nfse-issuance-for", installmentId ?? invoiceId] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao emitir NF");
    } finally {
      setLoading(false);
    }
  };

  // Estados visuais
  if (existing?.status === "issued") {
    return (
      <Button
        size={size}
        variant="ghost"
        className={className}
        onClick={() => existing.pdf_url && window.open(existing.pdf_url, "_blank")}
        title={`NFS-e ${existing.nfse_number ?? ""}`}
      >
        <Receipt className="h-3.5 w-3.5 mr-1 text-emerald-600" />
        NF {existing.nfse_number ?? "✓"}
      </Button>
    );
  }

  if (existing?.status === "queued" || existing?.status === "processing") {
    return (
      <Button size={size} variant="ghost" className={className} disabled title="Em processamento">
        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        Processando NF
      </Button>
    );
  }

  if (existing?.status === "rejected") {
    return (
      <Button size={size} variant="outline" className={className} onClick={emit} disabled={loading}
        title={`Rejeitada: ${existing.rejected_reason ?? ""}`}>
        <Receipt className="h-3.5 w-3.5 mr-1 text-destructive" />
        {loading ? "Reemitindo..." : "Reemitir NF"}
      </Button>
    );
  }

  return (
    <Button size={size} variant={variant} className={className} onClick={emit} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Receipt className="h-3.5 w-3.5 mr-1" />}
      Emitir NF
    </Button>
  );
}
