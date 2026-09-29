import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check } from "lucide-react";

export type CsUser = { id: string; name: string };

export function useCsTeamUsers() {
  return useQuery({
    queryKey: ["cs-team-users"],
    queryFn: async (): Promise<CsUser[]> => {
      // Lista fixa: Camila Menaldo e Andréia Barros
      const ids = ["95828516-4536-45ab-93a2-4aa278081d33", "e0017d78-21d4-413a-befc-5197df7ad666"];
      const { data: users } = await supabase.from("users").select("id, name, is_active").in("id", ids);
      return (users || [])
        .filter((u: any) => u.is_active !== false && u.name && !/tester|suporte/i.test(u.name))
        .map((u: any) => ({ id: u.id, name: String(u.name).trim() }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
  });
}

export function RenewalResponsibleDialog({
  open,
  currentId,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  currentId?: string | null;
  onCancel: () => void;
  onConfirm: (user: CsUser) => void;
}) {
  const { data: users = [], isLoading } = useCsTeamUsers();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quem é o responsável pela renovação?</DialogTitle>
          <DialogDescription>Escolha a pessoa do Customer Success que vai cuidar desta renovação.</DialogDescription>
        </DialogHeader>
        <Command className="border rounded-md">
          <CommandInput placeholder="Buscar pessoa do CS..." />
          <CommandList className="max-h-64">
            <CommandEmpty>{isLoading ? "Carregando..." : "Ninguém encontrado."}</CommandEmpty>
            {users.map((u) => (
              <CommandItem key={u.id} value={u.name} onSelect={() => onConfirm(u)}>
                <Check className={`mr-2 h-4 w-4 ${currentId === u.id ? "opacity-100" : "opacity-0"}`} />
                {u.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
