import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MarketingTaskRow from "./MarketingTaskRow";
import { cn } from "@/lib/utils";

interface MarketingTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  due_time: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  custom_status_id: string | null;
  activity_type_id: string | null;
  assigned_user: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  custom_status: {
    id: string;
    name: string;
    color: string;
    is_completed_status: boolean;
  } | null;
  activity_type: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface MarketingTaskSectionProps {
  id: string;
  name: string;
  color: string | null;
  tasks: MarketingTask[];
  onAddTask: () => void;
  onEditTask: (task: MarketingTask) => void;
  onToggleComplete: (task: MarketingTask) => void;
}

export default function MarketingTaskSection({
  id,
  name,
  color,
  tasks,
  onAddTask,
  onEditTask,
  onToggleComplete,
}: MarketingTaskSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const completedCount = tasks.filter(t => t.completed_at).length;
  const totalCount = tasks.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 p-3 w-full hover:bg-muted/50 rounded-lg transition-colors text-left">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
          {color && (
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="font-medium">{name}</span>
          <Badge variant="secondary" className="ml-2 font-normal">
            {completedCount}/{totalCount}
          </Badge>
        </button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="ml-4 border-l-2 border-muted pl-4 pb-2">
          {tasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="w-[140px]">Responsável</TableHead>
                  <TableHead className="w-[120px]">Prazo</TableHead>
                  <TableHead className="w-[100px]">Prioridade</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <MarketingTaskRow
                    key={task.id}
                    task={task}
                    onEdit={() => onEditTask(task)}
                    onToggleComplete={() => onToggleComplete(task)}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4 pl-2">
              Nenhuma tarefa nesta seção
            </p>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddTask}
            className="mt-2 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar tarefa...
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
