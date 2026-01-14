import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, MessageSquare, type LucideIcon } from "lucide-react";
import { SectorInstanceCard, SectorInstance } from "./SectorInstanceCard";
import { AddInstanceDialog } from "./AddInstanceDialog";
import { EditInstanceDialog } from "./EditInstanceDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SectorConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

interface SectorInstancesAccordionProps {
  sector: SectorConfig;
  instances: SectorInstance[];
  isAdmin: boolean;
  onRefresh: () => void;
}

export function SectorInstancesAccordion({
  sector,
  instances,
  isAdmin,
  onRefresh,
}: SectorInstancesAccordionProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingInstance, setEditingInstance] = useState<SectorInstance | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const Icon = sector.icon;
  const connectedCount = instances.filter(i => i.status === "connected").length;
  const existingInstanceNames = instances.map(i => i.instance_name);

  const handleRemoveInstance = async (instance: SectorInstance) => {
    setRemovingId(instance.id);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "unlink_instance",
          integration_id: instance.id,
        },
      });

      if (error) throw error;

      toast.success("Instância removida do setor");
      onRefresh();
    } catch (err) {
      console.error("Failed to remove instance:", err);
      toast.error("Erro ao remover instância");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value={sector.id} className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${sector.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{sector.name}</p>
                  <p className="text-xs text-muted-foreground">{sector.description}</p>
                </div>
              </div>
              <Badge variant="secondary" className="ml-auto mr-2">
                {instances.length === 0 ? (
                  "Sem instâncias"
                ) : (
                  <>
                    {connectedCount}/{instances.length} conectadas
                  </>
                )}
              </Badge>
            </div>
          </AccordionTrigger>

          <AccordionContent className="pb-4">
            <div className="space-y-3">
              {instances.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma instância neste setor</p>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowAddDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Instância
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {instances.map((instance) => (
                    <SectorInstanceCard
                      key={instance.id}
                      instance={instance}
                      isAdmin={isAdmin}
                      onEdit={setEditingInstance}
                      onRemove={handleRemoveInstance}
                    />
                  ))}

                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setShowAddDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Instância
                    </Button>
                  )}
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Add instance dialog */}
      <AddInstanceDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        sectorId={sector.id}
        sectorName={sector.name}
        existingInstanceNames={existingInstanceNames}
        onSuccess={onRefresh}
      />

      {/* Edit instance dialog */}
      <EditInstanceDialog
        open={!!editingInstance}
        onOpenChange={(open) => !open && setEditingInstance(null)}
        instance={editingInstance}
        onSuccess={onRefresh}
      />
    </>
  );
}
