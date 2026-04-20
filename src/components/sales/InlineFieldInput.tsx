import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Instagram, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { LocationAutocomplete, LocationValue } from "@/components/custom-fields/LocationAutocomplete";

interface InlineFieldInputProps {
  field: CustomField;
  value: any;
  onChange: (newValue: any) => void;
}

const colorClasses: Record<string, string> = {
  green: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30",
  red: "bg-red-500/10 hover:bg-red-500/20 border-red-500/30",
  yellow: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30",
  blue: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30",
  purple: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30",
  pink: "bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/30",
  orange: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30",
  gray: "bg-muted hover:bg-muted/80 border-border",
};

const colorSelected: Record<string, string> = {
  green: "bg-emerald-500 text-white border-emerald-500",
  red: "bg-red-500 text-white border-red-500",
  yellow: "bg-amber-500 text-white border-amber-500",
  blue: "bg-blue-500 text-white border-blue-500",
  purple: "bg-purple-500 text-white border-purple-500",
  pink: "bg-pink-500 text-white border-pink-500",
  orange: "bg-orange-500 text-white border-orange-500",
  gray: "bg-foreground text-background border-foreground",
};

export function InlineFieldInput({ field, value, onChange }: InlineFieldInputProps) {
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (field.field_type === "user") {
      supabase
        .from("users")
        .select("id, name")
        .order("name")
        .then(({ data }) => {
          if (data) setTeamUsers(data as any);
        });
    }
  }, [field.field_type]);

  // Boolean
  if (field.field_type === "boolean") {
    return (
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value === true ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(true)}
        >
          Sim
        </Button>
        <Button
          type="button"
          variant={value === false ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(false)}
        >
          Não
        </Button>
      </div>
    );
  }

  // Select
  if (field.field_type === "select") {
    return (
      <div className="flex flex-wrap gap-2">
        {field.options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border transition-colors",
                selected ? colorSelected[opt.color] || colorSelected.gray : colorClasses[opt.color] || colorClasses.gray
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Multi-select
  if (field.field_type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (v: string) => {
      onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
    };
    return (
      <div className="flex flex-wrap gap-2">
        {field.options.map((opt) => {
          const isSel = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border transition-colors",
                isSel ? colorSelected[opt.color] || colorSelected.gray : colorClasses[opt.color] || colorClasses.gray
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // User
  if (field.field_type === "user") {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (id: string) => {
      onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    };
    return (
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border rounded-md p-2">
        {teamUsers.map((u) => (
          <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
            <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{u.name}</span>
          </label>
        ))}
      </div>
    );
  }

  // Number / Currency
  if (field.field_type === "number" || field.field_type === "currency") {
    return (
      <Input
        type="number"
        step={field.field_type === "currency" ? "0.01" : "1"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
        placeholder={field.field_type === "currency" ? "R$ 0,00" : "0"}
      />
    );
  }

  // Date
  if (field.field_type === "date") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(new Date(value), "PPP", { locale: ptBR }) : "Selecionar data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : null)}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Instagram
  if (field.field_type === "instagram") {
    return (
      <div className="flex items-center gap-2">
        <Instagram className="h-4 w-4 text-pink-500 flex-shrink-0" />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="@usuario"
        />
      </div>
    );
  }

  // Multi-instagram
  if (field.field_type === "multi_instagram") {
    const list: string[] = Array.isArray(value) ? value : [];
    const add = () => {
      const handle = draft.replace(/^@/, "").trim();
      if (handle && !list.includes(handle)) {
        onChange([...list, handle]);
        setDraft("");
      }
    };
    const remove = (i: number) => onChange(list.filter((_, idx) => idx !== i));
    return (
      <div className="space-y-2">
        {list.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {list.map((ig, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 text-xs border border-pink-500/20">
                <Instagram className="h-3 w-3" />@{ig}
                <button type="button" onClick={() => remove(i)} className="ml-1 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-pink-500 flex-shrink-0" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="@usuario"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" size="sm" onClick={add} disabled={!draft.trim()}>
            Adicionar
          </Button>
        </div>
      </div>
    );
  }

  // Location
  if (field.field_type === "location") {
    return (
      <LocationAutocomplete
        value={value as LocationValue}
        onChange={(v) => onChange(v)}
      />
    );
  }

  // Text (default) — use textarea for long text
  const isUrlLike = field.name.toLowerCase().includes("link") || field.name.toLowerCase().includes("url");
  if (!isUrlLike && (field.name.toLowerCase().includes("descrição") || field.name.toLowerCase().includes("observa") || field.name.toLowerCase().includes("informa"))) {
    return (
      <Textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="Digite..."
        rows={3}
      />
    );
  }
  return (
    <Input
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={isUrlLike ? "https://..." : "Digite..."}
    />
  );
}
