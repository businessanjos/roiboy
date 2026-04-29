import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, ExternalLink, FileSignature, FileText, Search, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface DigitalContractListItem {
  id: string;
  deal_id: string | null;
  contract_number: string | null;
  status: string;
  client_name: string;
  total_value: number | null;
  installments: number | null;
  installment_value: number | null;
  share_token: string;
  signed_at: string | null;
  updated_at: string;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  ready: "Pronto",
  pending_signature: "Assinatura pendente",
  signed: "Assinado",
  cancelled: "Cancelado",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  ready: "outline",
  pending_signature: "default",
  signed: "default",
  cancelled: "destructive",
};

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
};

export default function SalesDigitalContracts() {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<DigitalContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadContracts() {
      if (!currentUser?.account_id) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("digital_contracts")
          .select(
            "id, deal_id, contract_number, status, client_name, total_value, installments, installment_value, share_token, signed_at, updated_at, created_at",
          )
          .eq("account_id", currentUser.account_id)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        setContracts((data ?? []) as DigitalContractListItem[]);
      } catch (error: unknown) {
        console.error("[SalesDigitalContracts] load error:", error);
        toast.error(error instanceof Error ? error.message : "Erro ao carregar contratos digitais");
      } finally {
        setLoading(false);
      }
    }

    loadContracts();
  }, [currentUser?.account_id]);

  const filteredContracts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contracts;

    return contracts.filter((contract) =>
      [contract.contract_number, contract.client_name, statusLabels[contract.status] ?? contract.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [contracts, search]);

  const totals = useMemo(() => {
    return contracts.reduce(
      (acc, contract) => {
        acc.total += Number(contract.total_value ?? 0);
        if (contract.status === "signed") acc.signed += 1;
        if (contract.status === "pending_signature") acc.pending += 1;
        return acc;
      },
      { total: 0, signed: 0, pending: 0 },
    );
  }, [contracts]);

  const copyPublicLink = async (token: string) => {
    const url = `${window.location.origin}/contrato/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link público copiado");
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contratos de Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Contratos digitais criados pela aba Contrato dos Deals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/sales/contracts/templates">
              <FileText className="mr-2 h-4 w-4" />
              Templates
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/sales/contracts/defaults">
              <Settings2 className="mr-2 h-4 w-4" />
              Padrões da contratada
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Contratos digitais</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{contracts.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Assinados</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{totals.signed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Valor contratado</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrency(totals.total)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cliente, número ou status"
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{totals.pending} pendente(s)</Badge>
        </div>

        {filteredContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FileSignature className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Nenhum contrato digital encontrado</p>
              <p className="text-sm text-muted-foreground">
                Gere o contrato direto na aba Contrato dentro de um Deal.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">
                    {contract.contract_number ?? "Sem número"}
                    {contract.installments ? (
                      <p className="text-xs text-muted-foreground">
                        {contract.installments}x de {formatCurrency(contract.installment_value)}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{contract.client_name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[contract.status] ?? "outline"}>
                      {statusLabels[contract.status] ?? contract.status}
                    </Badge>
                    {contract.signed_at ? (
                      <p className="mt-1 text-xs text-muted-foreground">Assinado em {formatDate(contract.signed_at)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatCurrency(contract.total_value)}</TableCell>
                  <TableCell>{formatDate(contract.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyPublicLink(contract.share_token)}
                        aria-label="Copiar link público"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!contract.deal_id}
                        onClick={() => contract.deal_id && navigate(`/pipeline?deal=${contract.deal_id}`)}
                        aria-label="Abrir Deal"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}