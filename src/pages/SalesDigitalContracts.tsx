import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DigitalContractTab } from "@/components/sales/contracts/DigitalContractTab";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, ExternalLink, FilePlus2, FileSignature, FileText, Files, Loader2, Search, Settings2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { buildPublicContractUrl } from "@/lib/publicLink";

interface DigitalContractListItem {
  id: string;
  deal_id: string | null;
  client_id: string | null;
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

interface DealOption {
  id: string;
  title: string;
  status: string;
  value: number | null;
  updated_at: string;
  client?: { full_name: string | null } | null;
  lead?: { full_name: string | null } | null;
  stage?: { name: string | null } | null;
  responsible?: { name: string | null } | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [contracts, setContracts] = useState<DigitalContractListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [dealSearch, setDealSearch] = useState("");
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [editorDeal, setEditorDeal] = useState<{ id: string | null; clientId: string | null; clientName: string; value: number | null; contractId?: string | null } | null>(null);

  useEffect(() => {
    async function loadContracts() {
      if (!currentUser?.account_id) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("digital_contracts")
          .select(
            "id, deal_id, client_id, contract_number, status, client_name, total_value, installments, installment_value, share_token, signed_at, updated_at, created_at",
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

  useEffect(() => {
    async function loadDealsForContract() {
      if (!generateOpen || !currentUser?.account_id) return;

      setLoadingDeals(true);
      try {
        // Buscar todas as stages do funil Closer (qualquer etapa pode gerar contrato)
        const { data: stagesData, error: stagesError } = await supabase
          .from("deal_stages")
          .select("id, name, pipeline:pipelines!inner(name)")
          .eq("account_id", currentUser.account_id);

        if (stagesError) throw stagesError;

        const closerStageIds = (stagesData ?? [])
          .filter((s: any) => (s.pipeline?.name ?? "").toLowerCase() === "closer")
          .map((s: any) => s.id);

        if (closerStageIds.length === 0) {
          setDeals([]);
          return;
        }

        const { data, error } = await supabase
          .from("deals")
          .select("id, title, status, value, updated_at, client:clients(full_name), lead:leads(full_name), stage:deal_stages(name), responsible:users!deals_responsible_user_id_fkey(name)")
          .eq("account_id", currentUser.account_id)
          .in("stage_id", closerStageIds)
          .not("status", "in", "(won,lost)")
          .order("updated_at", { ascending: false })
          .limit(200);

        if (error) throw error;
        setDeals((data ?? []) as unknown as DealOption[]);
      } catch (error: unknown) {
        console.error("[SalesDigitalContracts] deals load error:", error);
        toast.error(error instanceof Error ? error.message : "Erro ao carregar negócios");
      } finally {
        setLoadingDeals(false);
      }
    }

    loadDealsForContract();
  }, [currentUser?.account_id, generateOpen]);

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

  const filteredDeals = useMemo(() => {
    const term = dealSearch.trim().toLowerCase();
    const base = deals.filter((deal) => deal.status !== "won");
    if (!term) return base;

    return base.filter((deal) =>
      [deal.title, deal.client?.full_name, deal.lead?.full_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [dealSearch, deals]);

  const getDealClientName = (deal: DealOption) => deal.client?.full_name || deal.lead?.full_name || "Cliente não identificado";

  const openDealContractEditor = async (dealId: string) => {
    setGenerateOpen(false);
    // Tenta achar nos deals já carregados
    const known = deals.find((d) => d.id === dealId);
    if (known) {
      setEditorDeal({
        id: dealId,
        clientId: null,
        clientName: getDealClientName(known),
        value: known.value ?? null,
      });
      return;
    }
    // Fallback: busca pontual
    const { data } = await supabase
      .from("deals")
      .select("id, value, client_id, client:clients(full_name), lead:leads(full_name)")
      .eq("id", dealId)
      .maybeSingle();
    if (data) {
      const name = (data as any).client?.full_name || (data as any).lead?.full_name || "Cliente";
      setEditorDeal({
        id: dealId,
        clientId: (data as any).client_id ?? null,
        clientName: name,
        value: (data as any).value ?? null,
      });
    } else {
      toast.error("Negócio não encontrado");
    }
  };

  // Suporta deep link ?deal=<id>
  useEffect(() => {
    const dealId = searchParams.get("deal");
    if (!dealId || !currentUser?.account_id) return;
    openDealContractEditor(dealId).finally(() => {
      const next = new URLSearchParams(searchParams);
      next.delete("deal");
      setSearchParams(next, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.account_id]);

  const copyPublicLink = async (token: string) => {
    const url = buildPublicContractUrl(token);
    await navigator.clipboard.writeText(url);
    toast.success("Link público copiado");
  };

  const duplicateContract = async (contractId: string) => {
    if (!currentUser?.account_id) return;
    if (!window.confirm("Duplicar este contrato como novo rascunho? O original será preservado.")) return;
    try {
      // Carrega contrato completo
      const { data: src, error: srcErr } = await supabase
        .from("digital_contracts")
        .select("*")
        .eq("id", contractId)
        .maybeSingle();
      if (srcErr) throw srcErr;
      if (!src) throw new Error("Contrato não encontrado");

      // Gera novo número
      const { data: numData, error: numErr } = await supabase.rpc(
        "next_digital_contract_number" as any,
        { p_account_id: currentUser.account_id } as any,
      );
      if (numErr) throw numErr;
      const newNumber = numData as unknown as string;

      // Remove campos que não devem ser copiados
      const {
        id: _id,
        created_at: _ca,
        updated_at: _ua,
        share_token: _st,
        zapsign_document_token: _zt,
        zapsign_signers: _zs,
        signed_pdf_path: _sp,
        signed_at: _sa,
        contract_number: _cn,
        status: _status,
        created_by: _cb,
        ...rest
      } = src as any;

      const insertPayload: any = {
        ...rest,
        contract_number: newNumber,
        status: "draft",
        created_by: currentUser.auth_user_id ?? null,
        zapsign_document_token: null,
        zapsign_signers: null,
        signed_pdf_path: null,
        signed_at: null,
      };

      const { data: created, error: insErr } = await supabase
        .from("digital_contracts")
        .insert(insertPayload)
        .select("id, deal_id, contract_number, status, client_name, total_value, installments, installment_value, share_token, signed_at, updated_at, created_at")
        .single();
      if (insErr) throw insErr;

      setContracts((prev) => [created as DigitalContractListItem, ...prev]);
      toast.success(`Contrato duplicado como ${newNumber}`);

      // Abre editor automaticamente
      if (created.deal_id) {
        openDealContractEditor(created.deal_id);
      }
    } catch (e: any) {
      console.error("[SalesDigitalContracts] duplicate error:", e);
      toast.error(e?.message ?? "Erro ao duplicar contrato");
    }
  };

  const deleteContract = async (contractId: string, contractNumber: string, status: string) => {
    if (!currentUser?.account_id) return;
    const isSigned = status === "signed";
    const warning = isSigned
      ? `ATENÇÃO: o contrato ${contractNumber} já está ASSINADO. Excluir aqui não cancela na ZapSign nem invalida o documento assinado. Tem certeza que deseja remover do sistema?`
      : status === "sent"
      ? `O contrato ${contractNumber} foi enviado para assinatura. Excluir aqui não cancela na ZapSign. Deseja remover do sistema mesmo assim?`
      : `Excluir o contrato ${contractNumber}? Esta ação não pode ser desfeita.`;
    if (!window.confirm(warning)) return;
    try {
      const { error } = await supabase
        .from("digital_contracts")
        .delete()
        .eq("id", contractId);
      if (error) throw error;
      setContracts((prev) => prev.filter((c) => c.id !== contractId));
      toast.success(`Contrato ${contractNumber} excluído`);
    } catch (e: any) {
      console.error("[SalesDigitalContracts] delete error:", e);
      toast.error(e?.message ?? "Erro ao excluir contrato");
    }
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
          <Button onClick={() => setGenerateOpen(true)}>
            <FilePlus2 className="mr-2 h-4 w-4" />
            Gerar contrato
          </Button>
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
                Clique em Gerar contrato, escolha o negócio e preencha o wizard.
              </p>
            </div>
            <Button onClick={() => setGenerateOpen(true)}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              Gerar contrato
            </Button>
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
                        title="Copiar link público"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => duplicateContract(contract.id)}
                        aria-label="Duplicar contrato"
                        title="Duplicar como novo rascunho"
                      >
                        <Files className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (contract.deal_id) {
                            openDealContractEditor(contract.deal_id);
                          } else {
                            setEditorDeal({
                              id: null,
                              clientId: null,
                              clientName: contract.client_name || contract.contract_number,
                              value: contract.total_value ?? null,
                              contractId: contract.id,
                            });
                          }
                        }}
                        aria-label="Abrir contrato"
                        title={contract.deal_id ? "Abrir contrato" : "Abrir contrato (sem negócio vinculado)"}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteContract(contract.id, contract.contract_number, contract.status)}
                        aria-label="Excluir contrato"
                        title="Excluir contrato"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>Gerar contrato</DialogTitle>
            <DialogDescription>
              Escolha o negócio. O wizard do contrato abre direto na aba correta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={dealSearch}
                onChange={(event) => setDealSearch(event.target.value)}
                placeholder="Buscar por cliente ou nome do negócio"
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-[52vh] overflow-y-auto rounded-md border border-border">
              {loadingDeals ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando negócios...
                </div>
              ) : filteredDeals.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum negócio encontrado.
                </div>
              ) : (
                filteredDeals.map((deal) => (
                  <button
                    key={deal.id}
                    type="button"
                    onClick={() => openDealContractEditor(deal.id)}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{getDealClientName(deal)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{deal.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {deal.stage?.name && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                            {deal.stage.name}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          Vendedor: <span className="font-medium text-foreground">{deal.responsible?.name ?? "—"}</span>
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-medium text-foreground">{formatCurrency(deal.value)}</span>
                      <Badge variant={deal.status === "won" ? "default" : deal.status === "lost" ? "destructive" : "secondary"} className="h-5 px-1.5 text-[10px]">
                        {deal.status === "won" ? "Ganho" : deal.status === "lost" ? "Perdido" : "Aberto"}
                      </Badge>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editorDeal} onOpenChange={(o) => !o && setEditorDeal(null)}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="border-b border-border px-5 py-3 shrink-0">
            <DialogTitle>Contrato — {editorDeal?.clientName}</DialogTitle>
            <DialogDescription>
              Edite, gere o PDF e envie para assinatura sem sair da área de Contratos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5">
            {editorDeal && (
              <DigitalContractTab
                dealId={editorDeal.id}
                dealValue={editorDeal.value}
                clientId={editorDeal.clientId}
                clientName={editorDeal.clientName}
                contractId={editorDeal.contractId ?? null}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}