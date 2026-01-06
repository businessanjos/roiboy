import { SalesTeamTab } from "@/components/sales/SalesTeamTab";

export default function SalesTeam() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Vendedores</h1>
        <p className="text-muted-foreground text-xs">
          Acompanhe o desempenho individual da equipe comercial
        </p>
      </div>
      
      <SalesTeamTab />
    </div>
  );
}
