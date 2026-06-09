import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface PeopleMultiSelectProps {
  /** Comma-separated names (legacy storage format) */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function PeopleMultiSelect({ value, onChange, placeholder = 'Selecione as pessoas...' }: PeopleMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedNames = value
    ? value.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .order('name', { ascending: true });
      if (!cancelled && data) setUsers(data as User[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (name: string) => {
    const exists = selectedNames.includes(name);
    const next = exists
      ? selectedNames.filter((n) => n !== name)
      : [...selectedNames, name];
    onChange(next.join(', '));
  };

  const remove = (name: string) => {
    onChange(selectedNames.filter((n) => n !== name).join(', '));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-sm text-muted-foreground">
              {selectedNames.length > 0
                ? `${selectedNames.length} pessoa(s) selecionada(s)`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar pessoa..." />
            <CommandList>
              <CommandEmpty>{loading ? 'Carregando...' : 'Ninguém encontrado.'}</CommandEmpty>
              <CommandGroup>
                {users.map((u) => {
                  const isSelected = selectedNames.includes(u.name);
                  return (
                    <CommandItem
                      key={u.id}
                      value={u.name}
                      onSelect={() => toggle(u.name)}
                      className="flex items-center gap-2"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {u.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{u.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedNames.map((name) => {
            const u = users.find((x) => x.name === name);
            return (
              <Badge key={name} variant="secondary" className="gap-1.5 pl-1 pr-1.5">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={u?.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs">{name}</span>
                <button
                  type="button"
                  onClick={() => remove(name)}
                  className="ml-0.5 rounded hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
