import { memo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Braces, User, Briefcase, Calendar, UserCog } from 'lucide-react';

interface VariableCategory {
  label: string;
  icon: React.ReactNode;
  variables: { key: string; label: string; example: string }[];
}

const variableCategories: VariableCategory[] = [
  {
    label: 'Cliente/Lead',
    icon: <User className="h-4 w-4" />,
    variables: [
      { key: 'nome_cliente', label: 'Nome completo', example: 'João Silva' },
      { key: 'primeiro_nome', label: 'Primeiro nome', example: 'João' },
      { key: 'email_cliente', label: 'Email', example: 'joao@email.com' },
      { key: 'telefone_cliente', label: 'Telefone', example: '(11) 99999-0000' },
      { key: 'empresa_cliente', label: 'Empresa', example: 'Tech Corp' },
    ],
  },
  {
    label: 'Negócio',
    icon: <Briefcase className="h-4 w-4" />,
    variables: [
      { key: 'nome_deal', label: 'Nome do negócio', example: 'Projeto Premium' },
      { key: 'valor_deal', label: 'Valor formatado', example: 'R$ 5.000,00' },
      { key: 'etapa_deal', label: 'Etapa atual', example: 'Proposta' },
    ],
  },
  {
    label: 'Atendente',
    icon: <UserCog className="h-4 w-4" />,
    variables: [
      { key: 'nome_atendente', label: 'Nome do atendente', example: 'Maria Santos' },
      { key: 'email_atendente', label: 'Email do atendente', example: 'maria@empresa.com' },
    ],
  },
  {
    label: 'Datas',
    icon: <Calendar className="h-4 w-4" />,
    variables: [
      { key: 'data_hoje', label: 'Data de hoje', example: '06/01/2026' },
      { key: 'hora_atual', label: 'Hora atual', example: '14:30' },
      { key: 'dia_semana', label: 'Dia da semana', example: 'Segunda-feira' },
    ],
  },
];

interface VariablePickerDropdownProps {
  onSelectVariable: (variable: string) => void;
  disabled?: boolean;
}

export const VariablePickerDropdown = memo(function VariablePickerDropdown({
  onSelectVariable,
  disabled,
}: VariablePickerDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1.5"
        >
          <Braces className="h-3.5 w-3.5" />
          Inserir Variável
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto">
        {variableCategories.map((category, catIndex) => (
          <div key={category.label}>
            {catIndex > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
              {category.icon}
              {category.label}
            </DropdownMenuLabel>
            {category.variables.map((variable) => (
              <DropdownMenuItem
                key={variable.key}
                onClick={() => onSelectVariable(`{{${variable.key}}}`)}
                className="flex justify-between items-center"
              >
                <span className="text-sm">{variable.label}</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {`{{${variable.key}}}`}
                </code>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// Export the full list of available variables for documentation
export const availableVariables = variableCategories.flatMap(cat => cat.variables);
