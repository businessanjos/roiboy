import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PayerFormDialog } from "@/components/financial/payers/PayerFormDialog";

interface Payer {
  id: string;
  document_type: string;
  document: string;
  legal_name: string;
  trade_name: string | null;
  email_billing: string | null;
  phone_billing: string | null;
  is_active: boolean;
  client_count?: number;
}

const formatDoc = (doc: string, type: string) => {
  if (type === "cpf" && doc.length === 11)
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  if (type === "cnpj" && doc.length === 14)
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  return doc;
};

export default function FinancialPayersPage() {
  const { accountId } = useCurrentUser();
  const [payers, setPayers] = useState<Payer[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Payer | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!accountId) return;
    setLoading(true);
    const { data } = await supabase
      .from("payers")
      .select("id, document_type, document, legal_name, trade_name, email_billing, phone_billing, is_active")
      .eq("account_id", accountId)
      .order("legal_name");

    // counts em batch
    const ids = (data || []).map((p) => p.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: cp } = await supabase
        .from("client_payers")
        .select("payer_id")
        .in("payer_id", ids);
      (cp || []).forEach((row: any) => {
        counts[row.payer_id] = (counts[row.payer_id] || 0) + 1;
      });
    }
    setPayers((data || []).map((p) => ({ ...p, client_count: counts[p.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [accountId]);

  const filtered = payers.filter(
    (p) =>
      p.legal_name.toLowerCase().includes(search.toLowerCase()) ||
      p.document.includes(search.replace(/\D/g, ""))
  );

  return (
    <div className="container max-w-7xl py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pagadores</h1>
          <p className="text-sm text-muted-foreground">
            Pessoas físicas e jurídicas que pagam pelas contratações. Separados dos clientes que utilizam o serviço.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Pagador
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <span className="ml-auto text-sm text-muted-foreground">{filtered.length} pagadores</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão Social / Nome</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead className="text-center">Clientes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nenhum pagador cadastrado. Clique em "Novo Pagador" para começar.
              </TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.legal_name}</div>
                  {p.trade_name && <div className="text-xs text-muted-foreground">{p.trade_name}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {formatDoc(p.document, p.document_type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.email_billing && <div>{p.email_billing}</div>}
                  {p.phone_billing && <div>{p.phone_billing}</div>}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" /> {p.client_count}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={p.is_active ? "default" : "outline"}>
                    {p.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(p as any); setFormOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <PayerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        payer={editing as any}
        onSaved={() => load()}
      />
    </div>
  );
}
