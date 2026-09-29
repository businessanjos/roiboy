import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, Plus, ArrowLeft } from "lucide-react";

export type CsUser = { id: string; name: string };

// Lista padrão: Camila Menaldo, Andréia Barros, Everton Pieri, Jonathan Marcato
const DEFAULT_IDS = [
  "95828516-4536-45ab-93a2-4aa278081d33",
  "e0017d78-21d4-413a-befc-5197df7ad666",
  "de43a643-0109-4afb-ac35-be768dbf4090",
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f",
];

function normalize(list: any[]): CsUser[] {
  return (list || [])
    .filter((u: any) => u.is_active !== false && u.name && !/tester|suporte/i.test(u.name))
    .map((u: any) => ({ id: u.id, name: String(u.name).trim() }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function useCsTeamUsers() {
  return useQuery({
    queryKey: ["cs-team-users", DEFAULT_IDS],
    queryFn: async (): Promise<CsUser[]> => {
      const { data } = await supabase.from("users").select("id, name, is_active").in("id", DEFAULT_IDS);
      return normalize(data || []);
    },
  });
}

function useAllActiveUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["renewal-all-users"],
    enabled,
    queryFn: async (): Promise<CsUser[]> => {
      const { data } = await supabase.from("users").select("id, name, is_active").eq("is_active", true);
      return normalize(data || []);
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
  const [showAll, setShowAll] = useState(false);
  const { data: users = [], isLoading } = useCsTeamUsers();
  const { data: allUsers = [], isLoading: loadingAll } = useAllActiveUsers(showAll);
  const others = allUsers.filter((u) => !DEFAULT_IDS.includes(u.id));
  const list = showAll ? others : users;
  const loading = showAll ? loadingAll : isLoading;

  const close = () => { setShowAll(false); onCancel(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quem é o responsável pela renovação?</DialogTitle>
          <DialogDescription>
            {showAll ? "Escolha outra pessoa da equipe." : "Escolha quem vai cuidar desta renovação."}
          </DialogDescription>
        </DialogHeader>
        <Command className="border rounded-md">
          <CommandInput placeholder="Buscar pessoa..." />
          <CommandList className="max-h-64">
            <CommandEmpty>{loading ? "Carregando..." : "Ninguém encontrado."}</CommandEmpty>
            <CommandGroup>
              {list.map((u) => (
                <CommandItem key={u.id} value={u.name} onSelect={() => { setShowAll(false); onConfirm(u); }}>
                  <Check className={`mr-2 h-4 w-4 ${currentId === u.id ? "opacity-100" : "opacity-0"}`} />
                  {u.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>
          {showAll ? <><ArrowLeft className="mr-1 h-4 w-4" /> Voltar à lista principal</> : <><Plus className="mr-1 h-4 w-4" /> Adicionar outra pessoa</>}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
