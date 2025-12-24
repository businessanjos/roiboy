import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { ClientsTableRow } from "./ClientsTableRow";
import { CustomField } from "@/components/custom-fields";
import {
  VNPSData,
  ScoreData,
  ContractData,
  WhatsAppData,
  TeamUser,
} from "@/hooks/useClientsPage";

interface ClientsTableProps {
  clients: any[];
  loading: boolean;
  vnpsMap: Record<string, VNPSData>;
  scoreMap: Record<string, ScoreData>;
  contractMap: Record<string, ContractData>;
  whatsappMap: Record<string, WhatsAppData>;
  customFields: CustomField[];
  fieldValues: Record<string, Record<string, any>>;
  teamUsers: TeamUser[];
  accountId: string;
  onProductClick: (client: any) => void;
  onContractClick: (client: any) => void;
  onDeleteClick: (client: any) => void;
  onFieldValueChange: (clientId: string, fieldId: string, value: any) => void;
}

export const ClientsTable = memo(function ClientsTable({
  clients,
  loading,
  vnpsMap,
  scoreMap,
  contractMap,
  whatsappMap,
  customFields,
  fieldValues,
  teamUsers,
  accountId,
  onProductClick,
  onContractClick,
  onDeleteClick,
  onFieldValueChange,
}: ClientsTableProps) {
  // Memoize the table header to prevent re-renders
  const tableHeader = useMemo(() => (
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="font-medium sticky left-0 bg-muted z-20 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Cliente</TableHead>
        <TableHead className="font-medium text-center min-w-[120px]">Produto</TableHead>
        <TableHead className="font-medium text-center min-w-[140px]">Contrato</TableHead>
        <TableHead className="font-medium text-center min-w-[80px]">Roizômetro</TableHead>
        <TableHead className="font-medium text-center min-w-[80px]">E-Score</TableHead>
        <TableHead className="font-medium text-center min-w-[100px]">Conexão</TableHead>
        <TableHead className="font-medium text-center min-w-[80px]">V-NPS</TableHead>
        <TableHead className="font-medium text-center min-w-[120px]">Responsável</TableHead>
        {customFields.map((field) => (
          <TableHead key={field.id} className="font-medium text-center min-w-[120px]">
            {field.name}
          </TableHead>
        ))}
        <TableHead className="font-medium text-right min-w-[80px]">Ação</TableHead>
      </TableRow>
    </TableHeader>
  ), [customFields]);

  if (loading) {
    return (
      <Card className="shadow-card">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando...</span>
        </div>
      </Card>
    );
  }

  if (clients.length === 0) {
    return (
      <Card className="shadow-card">
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Nenhum cliente encontrado.
        </div>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <div className="overflow-x-auto">
        <Table className="min-w-max">
          {tableHeader}
          <TableBody>
            {clients.map((client) => (
              <ClientsTableRow
                key={client.id}
                client={client}
                vnpsData={vnpsMap[client.id]}
                scoreData={scoreMap[client.id]}
                contractData={contractMap[client.id]}
                whatsappData={whatsappMap[client.id]}
                customFields={customFields}
                fieldValues={fieldValues[client.id] || {}}
                teamUsers={teamUsers}
                accountId={accountId}
                onProductClick={onProductClick}
                onContractClick={onContractClick}
                onDeleteClick={onDeleteClick}
                onFieldValueChange={onFieldValueChange}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
});
