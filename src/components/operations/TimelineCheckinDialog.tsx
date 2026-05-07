import { useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, NotebookPen, Eye, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  summary: z.string().trim().min(10, "Resuma em pelo menos 10 caracteres").max(800),
  wins: z.string().trim().min(3, "Liste ao menos uma vitória").max(500),
  blockers: z.string().trim().min(3, "Liste ao menos uma frustração ou bloqueio").max(500),
  nextStep: z.string().trim().min(3, "Combine um próximo passo claro").max(300),
  nextDate: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

function buildPreview(v: Partial<FormValues>, weekLabel: string): string {
  return [
    `📋 *Check-in semanal* (${weekLabel})`,
    ``,
    `🗒 *Resumo:* ${v.summary || "—"}`,
    ``,
    `✅ *Vitórias:* ${v.wins || "—"}`,
    ``,
    `⚠️ *Frustrações / bloqueios:* ${v.blockers || "—"}`,
    ``,
    `🎯 *Próximo passo combinado:* ${v.nextStep || "—"}`,
    v.nextDate ? `📅 *Próximo check-in:* ${v.nextDate}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
  weekLabel: string;
}

export function TimelineCheckinDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  weekLabel,
}: Props) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [values, setValues] = useState<FormValues>({
    summary: "",
    wins: "",
    blockers: "",
    nextStep: "",
    nextDate: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const reset = () => {
    setValues({ summary: "", wins: "", blockers: "", nextStep: "", nextDate: "" });
    setErrors({});
  };

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(values);
      if (!parsed.success) {
        const e: Partial<Record<keyof FormValues, string>> = {};
        for (const issue of parsed.error.issues) {
          e[issue.path[0] as keyof FormValues] = issue.message;
        }
        setErrors(e);
        throw new Error("Preencha os campos obrigatórios");
      }
      setErrors({});
      if (!currentUser?.id || !currentUser?.account_id) {
        throw new Error("Sessão sem contexto");
      }
      const v = parsed.data;
      const today = new Date().toLocaleDateString("pt-BR");
      const title = `Check-in semanal — ${today}`;
      const content = buildPreview(v, weekLabel);

      const { error } = await supabase.from("client_followups").insert({
        account_id: currentUser.account_id,
        client_id: clientId,
        user_id: currentUser.id,
        type: "note",
        title,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Registrado na Timeline de ${clientName}`);
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
      qc.invalidateQueries({ queryKey: ["client_followups", clientId] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e?.message && e.message !== "Preencha os campos obrigatórios") {
        toast.error("Erro: " + e.message);
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <NotebookPen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Registrar check-in na Timeline</DialogTitle>
              <DialogDescription>
                Modelo padrão pra {clientName} · {weekLabel} — todos os campos abaixo são obrigatórios.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field
            label="Resumo da conversa"
            help="Em 2-3 linhas, o que ficou desta call."
            error={errors.summary}
          >
            <Textarea
              rows={3}
              maxLength={800}
              value={values.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="Ex.: Conversamos sobre o resultado da última semana, ela tá animada com X mas insegura com Y…"
            />
          </Field>

          <Field
            label="Vitórias da semana"
            help="Mesmo as pequenas. Cliente que reconhece vitória renova."
            error={errors.wins}
          >
            <Textarea
              rows={2}
              maxLength={500}
              value={values.wins}
              onChange={(e) => set("wins", e.target.value)}
              placeholder="Ex.: Bateu meta de avaliações, fechou 2 pacotes premium…"
            />
          </Field>

          <Field
            label="Frustrações / bloqueios"
            help="O que travou ou pesou. Aqui mora o churn invisível."
            error={errors.blockers}
          >
            <Textarea
              rows={2}
              maxLength={500}
              value={values.blockers}
              onChange={(e) => set("blockers", e.target.value)}
              placeholder="Ex.: Está cansada, equipe faltou 2x, estoque atrasado…"
            />
          </Field>

          <Field
            label="Próximo passo combinado"
            help="Uma única ação concreta pra próxima semana."
            error={errors.nextStep}
          >
            <Input
              maxLength={300}
              value={values.nextStep}
              onChange={(e) => set("nextStep", e.target.value)}
              placeholder="Ex.: Gravar 3 stories de bastidor por dia até sexta."
            />
          </Field>

          <Field label="Próximo check-in (opcional)" help="Data e hora ou só dia da semana.">
            <Input
              maxLength={100}
              value={values.nextDate}
              onChange={(e) => set("nextDate", e.target.value)}
              placeholder="Ex.: Quinta-feira 14h"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar na Timeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : help ? (
        <p className="text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  );
}
