import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useTvCanManage, updateTvScreen } from "@/hooks/useTvWall";
import { toPublicTvUrl } from "@/lib/tv/tvUrl";

export function SendToTvButton() {
  const { data: canManage } = useTvCanManage();
  const { data: screens = [] } = useQuery({
    queryKey: ["tv-screens-list"],
    enabled: !!canManage,
    queryFn: async () => {
      const { data } = await (supabase as any).from("tv_screens").select("slot,name,location").order("slot");
      return (data ?? []) as { slot: number; name: string; location: string | null }[];
    },
  });
  if (!canManage) return null;
  const send = async (slot: number, name: string) => {
    try {
      await updateTvScreen(slot, { url: toPublicTvUrl(window.location.href) });
      toast.success(`Enviado para ${name} — aparece em até 30 s`);
    } catch (e: any) { toast.error(e.message ?? "Não foi possível enviar"); }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Enviar para TV">
          <Tv className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Enviar para TV</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Mostrar esta visualização na…</DropdownMenuLabel>
        {screens.map((s) => (
          <DropdownMenuItem key={s.slot} onClick={() => send(s.slot, s.name)}>
            {s.name}{s.location ? <span className="ml-2 text-xs text-muted-foreground">{s.location}</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
