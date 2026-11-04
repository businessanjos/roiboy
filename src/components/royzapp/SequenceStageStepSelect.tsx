import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface StageLite { id: string; name: string; color: string; pipeline_id: string | null; pipeline_name: string }

export function useDealStagesLite() {
  const { currentUser } = useCurrentUser();
  return useQuery({
    queryKey: ["sequence-stages-lite", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async (): Promise<StageLite[]> => {
      const db = supabase as any;
      const [{ data: stages, error }, { data: pipes }] = await Promise.all([
        db.from("deal_stages").select("id, name, color, pipeline_id, display_order")
          .eq("account_id", currentUser!.account_id).eq("is_active", true).order("display_order"),
        db.from("pipelines").select("id, name").eq("account_id", currentUser!.account_id),
      ]);
      if (error) throw error;
      const pn = new Map((pipes || []).map((p: any) => [p.id, p.name]));
      return (stages || []).map((s: any) => ({ ...s, pipeline_name: (pn.get(s.pipeline_id) as string) || "Funil" }));
    },
  });
}

export function SequenceStageStepSelect({ value, onChange, className }: { value?: string | null; onChange: (id: string) => void; className?: string }) {
  const { data: stages = [] } = useDealStagesLite();
  const groups = new Map<string, StageLite[]>();
  stages.forEach((s) => groups.set(s.pipeline_name, [...(groups.get(s.pipeline_name) || []), s]));
  return (
    <div className={className}>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger aria-label="Etapa de destino"><SelectValue placeholder="Escolha funil e etapa" /></SelectTrigger>
        <SelectContent className="max-h-72">
          {[...groups.entries()].map(([pipe, list]) => (
            <SelectGroup key={pipe}>
              <SelectLabel>{pipe}</SelectLabel>
              {list.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
