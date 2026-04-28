import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ContractDocument, type DigitalContractData } from "@/components/sales/contracts/ContractDocument";

export default function PublicDigitalContract() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DigitalContractData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-digital-contract?token=${token}`;
        const res = await fetch(url);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error ?? "Contrato não encontrado");
        }
        const json = await res.json();
        setData(json.contract.data as DigitalContractData);
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        {error ?? "Contrato não disponível."}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background py-8">
      <ContractDocument data={data} />
    </div>
  );
}
