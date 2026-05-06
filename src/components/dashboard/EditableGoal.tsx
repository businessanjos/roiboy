import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface EditableGoalProps {
  accountId?: string | null;
  field: "dashboard_churn_goal" | "dashboard_renewal_goal" | "dashboard_nps_goal";
  value: number;
  prefix: string; // "≤", "≥"
  suffix?: string; // "%"
  className?: string;
  textClassName?: string;
}

export function EditableGoal({
  accountId,
  field,
  value,
  prefix,
  suffix = "",
  className = "",
  textClassName = "",
}: EditableGoalProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    if (!accountId) return;
    const num = parseFloat(draft.replace(",", "."));
    if (isNaN(num) || num < 0 || num > 1000) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("account_settings")
      .update({ [field]: num } as any)
      .eq("account_id", accountId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar meta");
      return;
    }
    toast.success("Meta atualizada");
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ["dashboard-goals"] });
  };

  if (editing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Input
          ref={inputRef}
          type="number"
          step="0.1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-7 w-16 text-sm px-2"
          disabled={saving}
        />
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={save} disabled={saving}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(false)} disabled={saving}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group inline-flex items-center gap-1 hover:opacity-80 transition ${className}`}
      title="Clique para editar a meta"
    >
      <span className={textClassName}>
        {prefix} {value}
        {suffix}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition" />
    </button>
  );
}
