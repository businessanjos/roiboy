import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { AgencyCampaign } from "@/hooks/useAgencyMetrics";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");

export function AgencyCampaignsTable({ campaigns, title = "Campanhas" }: { campaigns: AgencyCampaign[]; title?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma campanha vinculada a essa agência ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Invest.</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">CPL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : "outline"} className="capitalize">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{fmtBRL(Number(c.spend) || 0)}</TableCell>
                  <TableCell className="text-right">{fmtNum(Number(c.impressions) || 0)}</TableCell>
                  <TableCell className="text-right">{fmtNum(Number(c.conversions) || 0)}</TableCell>
                  <TableCell className="text-right">{c.cpl ? fmtBRL(Number(c.cpl)) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
