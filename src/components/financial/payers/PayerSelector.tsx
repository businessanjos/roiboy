import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, ChevronsUpDown, Check, UserPlus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PayerFormDialog } from "./PayerFormDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PayerOption {
  id: string;
  legal_name: string;
  document: string;
  document_type: string;
}

interface Props {
  value?: string | null;
  onChange: (payerId: string | null) => void;
  clientId?: string | null;
  /** Renderiza botão para criar payer a partir dos dados do cliente */
  allowCreateFromClient?: boolean;
  disabled?: boolean;
}

const formatDoc = (doc: string, type: string) => {
  if (type === "cpf" && doc.length === 11) {
    return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  }
  if (type === "cnpj" && doc.length === 14) {
    return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  }
  return doc;
};

export function PayerSelector({ value, onChange, clientId, allowCreateFromClient = true, disabled }: Props) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [options, setOptions] = useState<PayerOption[]>([]);
  const [selected, setSelected] = useState<PayerOption | null>(null);

  const load = async () => {
    if (!accountId) return;
    const { data } = await supabase
      .from("payers")
      .select("id, legal_name, document, document_type")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("legal_name");
    setOptions(data || []);
    if (value) {
      const found = (data || []).find((p) => p.id === value);
      setSelected(found || null);
    } else {
      setSelected(null);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [accountId, value]);

  const handleCreateFromClient = async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase.rpc("ensure_payer_from_client", { p_client_id: clientId });
      if (error) throw error;
      toast({ title: "Pagador criado a partir do cliente" });
      onChange(data as string);
      await load();
    } catch (e: any) {
      toast({ title: "Não foi possível criar pagador", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
          >
            {selected ? (
              <span className="truncate">
                {selected.legal_name} · <span className="text-xs text-muted-foreground">{formatDoc(selected.document, selected.document_type)}</span>
              </span>
            ) : (
              "Selecionar pagador..."
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[480px]" align="start">
          <Command>
            <CommandInput placeholder="Buscar por nome ou CPF/CNPJ..." />
            <CommandList>
              <CommandEmpty>Nenhum pagador encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.legal_name} ${p.document}`}
                    onSelect={() => { onChange(p.id); setOpen(false); }}
                  >
                    <Check className={cn("h-4 w-4 mr-2", value === p.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col">
                      <span className="font-medium">{p.legal_name}</span>
                      <span className="text-xs text-muted-foreground">{formatDoc(p.document, p.document_type)}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <div className="border-t p-1 flex flex-col gap-1">
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => { setOpen(false); setFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> Novo pagador
                </Button>
                {allowCreateFromClient && clientId && (
                  <Button variant="ghost" size="sm" className="justify-start" onClick={() => { setOpen(false); handleCreateFromClient(); }}>
                    <Sparkles className="h-4 w-4 mr-2" /> Usar dados do cliente
                  </Button>
                )}
              </div>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <PayerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultClientId={clientId || undefined}
        onSaved={(id) => { onChange(id); load(); }}
      />
    </>
  );
}
