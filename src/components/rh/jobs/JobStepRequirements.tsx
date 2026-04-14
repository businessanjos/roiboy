import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { EDUCATION_LEVEL_LABELS, LANGUAGE_OPTIONS, LANGUAGE_LEVEL_OPTIONS } from "@/constants/jobOptions";
import type { JobFormData, EducationLevel } from "@/types/job";

interface Props { form: UseFormReturn<JobFormData>; }

export function JobStepRequirements({ form }: Props) {
  const [newSkill, setNewSkill] = useState("");
  const [newDesiredSkill, setNewDesiredSkill] = useState("");

  const addSkill = (type: "required_skills" | "desired_skills", value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    const current = form.getValues(type);
    if (!current.includes(value.trim())) {
      form.setValue(type, [...current, value.trim()]);
    }
    setter("");
  };

  const removeSkill = (type: "required_skills" | "desired_skills", skill: string) => {
    form.setValue(type, form.getValues(type).filter(s => s !== skill));
  };

  const addLanguage = () => {
    const current = form.getValues("languages");
    form.setValue("languages", [...current, { language: "", level: "basic" }]);
  };

  const removeLanguage = (index: number) => {
    form.setValue("languages", form.getValues("languages").filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Requisitos</h2>
        <p className="text-muted-foreground">Habilidades e qualificações necessárias</p>
      </div>
      <div className="grid gap-6">
        {/* Required Skills */}
        <div className="space-y-2">
          <FormLabel>Habilidades Obrigatórias</FormLabel>
          <div className="flex gap-2">
            <Input placeholder="Ex: React, TypeScript" value={newSkill} onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill("required_skills", newSkill, setNewSkill); } }} />
            <Button type="button" variant="outline" size="icon" onClick={() => addSkill("required_skills", newSkill, setNewSkill)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.watch("required_skills").map(s => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button type="button" onClick={() => removeSkill("required_skills", s)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Desired Skills */}
        <div className="space-y-2">
          <FormLabel>Habilidades Desejáveis</FormLabel>
          <div className="flex gap-2">
            <Input placeholder="Ex: Docker, AWS" value={newDesiredSkill} onChange={e => setNewDesiredSkill(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill("desired_skills", newDesiredSkill, setNewDesiredSkill); } }} />
            <Button type="button" variant="outline" size="icon" onClick={() => addSkill("desired_skills", newDesiredSkill, setNewDesiredSkill)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.watch("desired_skills").map(s => (
              <Badge key={s} variant="outline" className="gap-1">
                {s}
                <button type="button" onClick={() => removeSkill("desired_skills", s)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="experience_years" render={({ field }) => (
            <FormItem>
              <FormLabel>Anos de Experiência</FormLabel>
              <FormControl>
                <Input type="number" min={0} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="education_level" render={({ field }) => (
            <FormItem>
              <FormLabel>Escolaridade Mínima</FormLabel>
              <Select value={field.value || "_none"} onValueChange={v => field.onChange(v === "_none" ? "" : v)}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="_none">Não especificado</SelectItem>
                  {(Object.entries(EDUCATION_LEVEL_LABELS) as [EducationLevel, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FormLabel>Idiomas</FormLabel>
            <Button type="button" variant="outline" size="sm" onClick={addLanguage}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
          </div>
          {form.watch("languages").map((lang, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={lang.language} onValueChange={v => {
                const langs = [...form.getValues("languages")];
                langs[i] = { ...langs[i], language: v };
                form.setValue("languages", langs);
              }}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Idioma" /></SelectTrigger>
                <SelectContent>{LANGUAGE_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={lang.level} onValueChange={v => {
                const langs = [...form.getValues("languages")];
                langs[i] = { ...langs[i], level: v };
                form.setValue("languages", langs);
              }}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGE_LEVEL_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeLanguage(i)}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>

        <FormField control={form.control} name="requirements" render={({ field }) => (
          <FormItem>
            <FormLabel>Requisitos Adicionais (texto livre)</FormLabel>
            <FormControl><Textarea placeholder="Descreva outros requisitos..." rows={4} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </div>
  );
}
