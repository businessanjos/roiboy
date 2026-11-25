import { useQuery } from "@tanstack/react-query";
import { Check, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pipelineRenameNotice, type PipelineRenameImpact } from "@/lib/sales/pipelineRoles";

/** Aviso mostrado na edição do funil assim que o nome é alterado, antes de salvar. */
export function PipelineRenameNotice({ pipelineId, oldName, newName }: { pipelineId: string; oldName: string; newName: string }) {
  const { data: impact, isLoading } = useQuery({
    queryKey: ["pipeline-rename-impact", pipelineId, oldName],
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pipeline_rename_impact", { p_pipeline_id: pipelineId });
      if (error) throw error;
      return data as unknown as PipelineRenameImpact;
    },
  });
  const notice = pipelineRenameNotice(oldName, impact ?? null);

  return (
    <div role="status" aria-live="polite" className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
      <p className="text-sm font-medium text-foreground">
        Trocar o nome de "{oldName}" para "{newName}"
      </p>
      <div className="space-y-1">
        <p className="font-medium text-foreground">Continua funcionando sozinho</p>
        <ul className="space-y-1">
          {(isLoading ? notice.keeps.slice(0, 1) : notice.keeps).map(line => (
            <li key={line} className="flex gap-1.5">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
          {isLoading && <li className="pl-5">Conferindo painéis e regras ligados a este funil…</li>}
        </ul>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">O que muda</p>
        <ul className="space-y-1">
          {notice.changes.map(line => (
            <li key={line} className="flex gap-1.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
