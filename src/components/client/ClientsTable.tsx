import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { ClientsTableRow } from "./ClientsTableRow";
import { CustomField } from "@/components/custom-fields";
import {
  ContractData,
  WhatsAppData,
  TeamUser,
} from "@/hooks/useClientsPage";

interface ClientsTableProps {
  clients: any[];
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
  const tableHeader = useMemo(() => (
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="font-medium sticky left-0 bg-muted z-20 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Cliente</TableHead>
        <TableHead className="font-medium text-center min-w-[120px]">Produto</TableHead>
        <TableHead className="font-medium text-center min-w-[100px]">Graduação</TableHead>
        <TableHead className="font-medium text-center min-w-[140px]">Área de Atuação</TableHead>
        <TableHead className="font-medium text-center min-w-[140px]">Contrato</TableHead>
        <TableHead className="font-medium text-center min-w-[100px]">Conexão</TableHead>
        <TableHead className="font-medium text-center min-w-[120px]">Responsável</TableHead>
        <TableHead className="font-medium text-right min-w-[80px]">Ação</TableHead>
      </TableRow>
    </TableHeader>
  ), [customFields]);

  if (clients.length === 0) {
    return (
      <Card className="shadow-card">
        <div className="flex items-center justify-center py-16">
          <span className="text-muted-foreground">Nenhum cliente encontrado</span>
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
