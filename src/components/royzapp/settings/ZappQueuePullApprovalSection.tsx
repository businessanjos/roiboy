import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

/** Vendas: gestor escolhe se puxar da triagem pede aprovação ou só avisa. */
export function ZappQueuePullApprovalSection() {
  const [enabled, setEnabled] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any).rpc("zapp_queue_pull_approval_enabled").then(({ data }: any) => setEnabled(data !== false));
    (supabase as any).rpc("zapp_can_pull_directly").then(({ data }: any) => setCanEdit(!!data));
  }, []);

  const change = async (v: boolean) => {
    setSaving(true);
    const { error } = await (supabase as any).rpc("set_zapp_queue_pull_approval", { _enabled: v });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setEnabled(v);
    window.dispatchEvent(new Event("zapp-queue-approval-changed"));
    toast.success(v ? "Puxar da triagem agora pede aprovação" : "Vendedores puxam direto; o gestor só é avisado");
  };

  return (
    <div className="space-y-3 pt-4 border-t border-zapp-border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-zapp-text text-sm font-medium">Aprovação para puxar da triagem</p>
          <p className="text-zapp-text-muted text-xs">
            {enabled
              ? "Ligada: o vendedor pede ao gestor, que aprova ou recusa no ROY ou no WhatsApp."
              : "Desligada: o vendedor puxa direto e o gestor recebe só um aviso no ROY de quem puxou qual contato."}
          </p>
          <p className="text-zapp-text-muted text-xs mt-1">
            Conversa que já está com outro vendedor sempre pede aprovação.
            {!canEdit && " Só o gestor de Vendas pode alterar."}
          </p>
        </div>
        <Switch checked={enabled} disabled={!canEdit || saving} onCheckedChange={change}
          className="data-[state=checked]:bg-zapp-accent" aria-label="Aprovação para puxar da triagem" />
      </div>
    </div>
  );
}
