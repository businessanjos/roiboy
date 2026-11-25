import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TaskLabelEditor, TaskLabelFilter } from "./TaskLabels";
import type { TaskLabel } from "@/lib/marketing/taskDetails";

afterEach(cleanup);
describe("Criação e seleção pelo filtro de etiquetas", () => {
  it("cria pelo próprio filtro sem ativar um filtro vazio e permite selecionar/desmarcar", () => {
    const onChange = vi.fn(); const onCreate = vi.fn((label: TaskLabel) => label);
    function Filter() {
      const [catalog, setCatalog] = useState<TaskLabel[]>([]);
      const [selected, setSelected] = useState<string[]>([]);
      return <TaskLabelFilter catalog={catalog} selected={selected} onChange={(value) => { setSelected(value); onChange(value); }} onCreate={(label) => { onCreate(label); setCatalog([label]); return label; }} />;
    }
    render(<TooltipProvider><Filter /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por etiquetas" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "  TESTE QA   Vídeo " } });
    fireEvent.click(screen.getByRole("radio", { name: "Roxo" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    expect(onCreate).toHaveBeenCalledWith({ name: "TESTE QA Vídeo", color: "purple" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Filtrar etiqueta TESTE QA Vídeo" }));
    expect(onChange).toHaveBeenLastCalledWith(["teste qa vídeo"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Filtrar etiqueta TESTE QA Vídeo" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("cancelar não cria; falha preserva nome e cor para tentar novamente", () => {
    const create = vi.fn(() => { throw new Error("Não foi possível guardar"); });
    render(<TooltipProvider><TaskLabelFilter catalog={[]} selected={[]} onChange={vi.fn()} onCreate={create} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por etiquetas" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "Vídeo" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "Vídeo" } });
    fireEvent.click(screen.getByRole("radio", { name: "Verde" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    expect(screen.getByLabelText("Nome da etiqueta")).toHaveProperty("value", "Vídeo");
    expect(create).toHaveBeenCalledWith({ name: "Vídeo", color: "green" });
  });

  it("reutiliza etiqueta existente sem substituir cor ou criar duplicata", () => {
    const create = vi.fn(); const change = vi.fn();
    render(<TooltipProvider><TaskLabelEditor value={[]} catalog={[{ name: "Vídeo", color: "green" }]} portalContainer={null} onChange={change} onCreate={create} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar etiquetas da tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "  VÍDEO " } });
    fireEvent.click(screen.getByRole("button", { name: "Usar etiqueta" }));
    expect(create).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledWith([{ name: "Vídeo", color: "green" }]);
  });

  it("criar na edição aplica ao rascunho sem submeter o formulário; retirar não afeta o catálogo", () => {
    const submit = vi.fn(); const change = vi.fn(); const create = vi.fn((label: TaskLabel) => label);
    function Editor() {
      const [value, setValue] = useState<TaskLabel[]>([]);
      return <form onSubmit={submit}><TaskLabelEditor value={value} catalog={[]} portalContainer={null} onCreate={create} onChange={(labels) => { setValue(labels); change(labels); }} /></form>;
    }
    render(<TooltipProvider><Editor /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar etiquetas da tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "Design" } });
    fireEvent.keyDown(screen.getByLabelText("Nome da etiqueta"), { key: "Enter" });
    expect(change).toHaveBeenLastCalledWith([{ name: "Design", color: "blue" }]);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Fechar etiquetas" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover etiqueta Design" }));
    expect(change).toHaveBeenLastCalledWith([]);
    expect(create).toHaveBeenCalledTimes(1);
  });
});