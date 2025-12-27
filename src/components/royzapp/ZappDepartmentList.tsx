import { memo } from "react";
import { Building2, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  auto_distribution: boolean;
  sector_id?: string | null;
}

interface Agent {
  id: string;
  department_id: string | null;
}

interface ZappDepartmentListProps {
  departments: Department[];
  agents: Agent[];
  onOpenDepartmentDialog: (dept?: Department) => void;
  onDeleteDepartment: (id: string) => void;
}

// Map sector/color names to actual CSS colors
const COLOR_MAP: Record<string, string> = {
  primary: "hsl(39 60% 55%)",
  emerald: "hsl(152 55% 45%)",
  amber: "hsl(39 60% 55%)",
  blue: "hsl(217 91% 60%)",
  purple: "hsl(271 81% 56%)",
  slate: "hsl(215 20% 65%)",
  green: "hsl(142 71% 45%)",
  red: "hsl(0 72% 51%)",
  orange: "hsl(25 95% 53%)",
  yellow: "hsl(48 96% 53%)",
  teal: "hsl(172 66% 50%)",
  cyan: "hsl(187 85% 53%)",
  indigo: "hsl(239 84% 67%)",
  pink: "hsl(330 81% 60%)",
};

const getColorValue = (color: string): string => {
  // If color is already a valid CSS color, return it
  if (color.startsWith("#") || color.startsWith("hsl") || color.startsWith("rgb")) {
    return color;
  }
  // Map known color names
  return COLOR_MAP[color] || "hsl(var(--zapp-accent))";
};

export const ZappDepartmentList = memo(function ZappDepartmentList({
  departments,
  agents,
  onOpenDepartmentDialog,
  onDeleteDepartment,
}: ZappDepartmentListProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zapp-text font-medium">Departamentos</h3>
        <Button
          size="sm"
          className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
          onClick={() => onOpenDepartmentDialog()}
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo
        </Button>
      </div>

      {departments.length === 0 ? (
        <div className="text-center py-8">
          <Building2 className="h-12 w-12 text-zapp-text-muted mx-auto mb-3" />
          <p className="text-zapp-text-muted text-sm">Nenhum departamento cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="p-3 bg-zapp-panel rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getColorValue(dept.color) }}
                  />
                  <span className="text-zapp-text font-medium">{dept.name}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zapp-text-muted hover:bg-zapp-bg-dark">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border">
                    <DropdownMenuItem className="text-zapp-text" onClick={() => onOpenDepartmentDialog(dept)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zapp-border" />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => onDeleteDepartment(dept.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {dept.description && (
                <p className="text-zapp-text-muted text-xs mt-1">{dept.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-zapp-text-muted">
                <span>{agents.filter((a) => a.department_id === dept.id).length} atendentes</span>
                <span>•</span>
                <span>{dept.auto_distribution ? "Distribuição automática" : "Manual"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
