import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Agent, Department } from "../types";

interface ZappTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferTarget: { type: "agent" | "department"; id: string };
  onTransferTargetChange: (target: { type: "agent" | "department"; id: string }) => void;
  agents: Agent[];
  departments: Department[];
  currentAgentId?: string | null;
  onTransfer: () => void;
}

export const ZappTransferDialog = memo(function ZappTransferDialog({
  open,
  onOpenChange,
  transferTarget,
  onTransferTargetChange,
  agents,
  departments,
  currentAgentId,
  onTransfer,
}: ZappTransferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zapp-bg border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle className="text-zapp-text">Transferir Conversa</DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Selecione para quem transferir
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Tabs defaultValue="agent" onValueChange={(v) => onTransferTargetChange({ ...transferTarget, type: v as "agent" | "department" })}>
            <TabsList className="w-full bg-zapp-bg-dark">
              <TabsTrigger value="agent" className="flex-1 data-[state=active]:bg-zapp-accent data-[state=active]:text-zapp-bg-dark ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                Atendente
              </TabsTrigger>
              <TabsTrigger value="department" className="flex-1 data-[state=active]:bg-zapp-accent data-[state=active]:text-zapp-bg-dark ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                Departamento
              </TabsTrigger>
            </TabsList>
            <TabsContent value="agent" className="mt-4">
              <Select
                value={transferTarget.id}
                onValueChange={(value) => onTransferTargetChange({ ...transferTarget, id: value })}
              >
                <SelectTrigger className="bg-zapp-bg-dark border-zapp-border text-zapp-text">
                  <SelectValue placeholder="Selecione um atendente" />
                </SelectTrigger>
                <SelectContent className="bg-zapp-panel border-zapp-border">
                  {agents.filter(a => a.is_online && a.id !== currentAgentId).map((agent) => (
                    <SelectItem key={agent.id} value={agent.id} className="text-zapp-text">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-zapp-accent" />
                        {agent.user?.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>
            <TabsContent value="department" className="mt-4">
              <Select
                value={transferTarget.id}
                onValueChange={(value) => onTransferTargetChange({ ...transferTarget, id: value })}
              >
                <SelectTrigger className="bg-zapp-bg-dark border-zapp-border text-zapp-text">
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent className="bg-zapp-panel border-zapp-border">
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id} className="text-zapp-text">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color }} />
                        {dept.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zapp-border text-zapp-text-muted hover:bg-zapp-hover">
            Cancelar
          </Button>
          <Button 
            onClick={onTransfer}
            className="bg-zapp-accent hover:bg-zapp-accent-hover text-zapp-bg-dark border-0 ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0" 
            disabled={!transferTarget.id}
          >
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
