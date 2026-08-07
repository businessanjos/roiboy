import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Clock, Eye, Search, FileSignature, Copy, ExternalLink } from "lucide-react";
import { sanitizeDocumentHtml } from "@/lib/hr/admissionDocVars";
import { getPublicOrigin } from "@/lib/publicLink";
import { useHRAdmissions, type HRAdmissionDocument } from "@/hooks/useHRAdmissions";
import { toast } from "sonner";

type Row = HRAdmissionDocument & {
  candidate_name: string;
  position_title: string | null;
  public_token: string | null;
  created_at?: string | null;
};

export default function SignedDocsTab() {
  const { data: admissions } = useHRAdmissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "signed" | "pending">("all");
  const [viewing, setViewing] = useState<Row | null>(null);

  const admissionIds = useMemo(() => (admissions || []).map((a) => a.id), [admissions]);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["hr-signature-docs", admissionIds],
    enabled: admissionIds.length > 0,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_admission_documents" as any)
        .select("*")
        .in("admission_id", admissionIds)
        .eq("doc_type", "signature")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as HRAdmissionDocument[];
    },
  });

  const rows: Row[] = useMemo(() => {
    const map = new Map((admissions || []).map((a) => [a.id, a]));
    return (docs || []).map((d) => {
      const a = map.get(d.admission_id);
      return {
        ...d,
        candidate_name: a?.candidate_name || "—",
        position_title: a?.position_title || null,
        public_token: a?.public_token || null,
      };
    });
  }, [docs, admissions]);

  const filtered = rows.filter((r) => {
    if (status === "signed" && !r.signed_at) return false;
    if (status === "pending" && r.signed_at) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.candidate_name.toLowerCase().includes(q) || r.label.toLowerCase().includes(q);
  });

  const signed = rows.filter((r) => !!r.signed_at).length;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Documentos gerados ({rows.length})
          </CardTitle>
          <Badge variant="outline" className="text-xs">{signed} assinados · {rows.length - signed} pendentes</Badge>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por candidato ou documento"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="signed">Assinados</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
            Nenhum documento encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidato</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{r.candidate_name}</p>
                      <p className="text-xs text-muted-foreground">{r.position_title || "—"}</p>
                    </TableCell>
                    <TableCell className="text-sm">{r.label}</TableCell>
                    <TableCell>
                      {r.signed_at ? (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Assinado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
                          <Clock className="h-3 w-3 mr-1" /> Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.signed_at
                        ? `${r.signer_name || "—"} · ${new Date(r.signed_at).toLocaleString("pt-BR")}`
                        : "Aguardando o candidato"}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewing(r)} title="Ver documento">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.label}</DialogTitle>
            <DialogDescription>
              {viewing?.signed_at
                ? `Assinado por ${viewing.signer_name} · CPF ${viewing.signer_cpf || "—"} · ${new Date(viewing.signed_at).toLocaleString("pt-BR")} · IP ${viewing.signer_ip || "—"}`
                : `Aguardando assinatura de ${viewing?.candidate_name}`}
            </DialogDescription>
          </DialogHeader>
          <div
            className="admission-doc rounded-md border border-border bg-background p-5 text-sm"
            dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(viewing?.signed_html || viewing?.body_html || "") }}
          />
          {viewing?.signature_image_url && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-1">Assinatura do colaborador</p>
              <img src={viewing.signature_image_url} alt="Assinatura do colaborador" className="h-20 object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
