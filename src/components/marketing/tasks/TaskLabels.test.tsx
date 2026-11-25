import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TaskLabelEditor, TaskLabelFilter } from "./TaskLabels";
import type { TaskLabel } from "@/lib/marketing/taskDetails";

afterEach(cleanup);
describe("Criação e seleção pelo filtro de etiquetas", () => {
  it("excluir exige confirmação e cancelar preserva a etiqueta e a seleção", () => {
    const label: TaskLabel = { name: "TESTE QA", color: "green" }; const remove = vi.fn(); const change = vi.fn();
    render(<TooltipProvider><TaskLabelFilter catalog={[label]} selected={["teste qa"]} onChange={change} onCreate={item => item} onEdit={async (_old, item) => item} onDelete={remove} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por etiquetas" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar etiqueta TESTE QA" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir etiqueta TESTE QA" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(remove).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
  });
  it("confirmar exclusão limpa só a etiqueta excluída do filtro", async () => {
    const label: TaskLabel = { name: "TESTE QA", color: "green" }; const remove = vi.fn(async () => {}); const change = vi.fn();
    render(<TooltipProvider><TaskLabelFilter catalog={[label]} selected={["teste qa", "outra"]} onChange={change} onCreate={item => item} onEdit={async (_old, item) => item} onDelete={remove} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por etiquetas" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar etiqueta TESTE QA" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir etiqueta TESTE QA" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir etiqueta" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(label));
    expect(change).toHaveBeenCalledWith(["outra"]);
  });
  it("exclusão na edição remove só a etiqueta do rascunho sem submeter a tarefa", async () => {
    const label: TaskLabel = { name: "TESTE QA", color: "green" }; const other: TaskLabel = { name: "Outra", color: "blue" }; const change = vi.fn(); const submit = vi.fn(); const remove = vi.fn(async () => {});
    render(<TooltipProvider><form onSubmit={submit}><TaskLabelEditor value={[label, other]} catalog={[label, other]} portalContainer={null} onChange={change} onEdit={async (_old, item) => item} onDelete={remove} /></form></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar etiquetas da tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar etiqueta TESTE QA" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir etiqueta TESTE QA" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir etiqueta" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith([other]));
    expect(remove).toHaveBeenCalledWith(label); expect(submit).not.toHaveBeenCalled();
  });
  it("falha na exclusão mantém confirmação e seleção para tentar novamente", async () => {
    const label: TaskLabel = { name: "TESTE QA", color: "green" }; const change = vi.fn(); const remove = vi.fn(async () => { throw new Error("Acesso negado"); });
    render(<TooltipProvider><TaskLabelFilter catalog={[label]} selected={["teste qa"]} onChange={change} onCreate={item => item} onEdit={async (_old, item) => item} onDelete={remove} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por etiquetas" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar etiqueta TESTE QA" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir etiqueta TESTE QA" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir etiqueta" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Acesso negado"));
    expect(change).not.toHaveBeenCalled();
  });
  it("editar cor personalizada mantém o nome e a seleção existentes", async () => {
    const original: TaskLabel = { name: "TESTE QA Existente", color: "yellow" }; const change = vi.fn(); const save = vi.fn(async (_old: TaskLabel, label: TaskLabel) => label);
    render(<TooltipProvider><TaskLabelEditor value={[original]} catalog={[original]} portalContainer={null} onChange={change} onEdit={save} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar etiquetas da tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar etiqueta TESTE QA Existente" }));
    fireEvent.change(screen.getByLabelText("Código da cor personalizada"), { target: { value: "#12AB34" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar etiqueta" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(original, { name: original.name, color: "#12ab34" }));
    expect(change).toHaveBeenCalledWith([{ name: original.name, color: "#12ab34" }]);
  });
  it("cria etiqueta com uma das novas cores sem ativar o filtro", () => {
    const create = vi.fn((label: TaskLabel) => label); const change = vi.fn();
    render(<TooltipProvider><TaskLabelFilter catalog={[]} selected={[]} onChange={change} onCreate={create} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por etiquetas" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "TESTE QA Laranja" } });
    fireEvent.click(screen.getByRole("radio", { name: "Laranja" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    expect(create).toHaveBeenCalledWith({ name: "TESTE QA Laranja", color: "#ea580c" });
    expect(change).not.toHaveBeenCalled();
  });
  it("permite cor personalizada por código ou seletor sem submeter a tarefa", () => {
    const change = vi.fn(); const submit = vi.fn();
    render(<TooltipProvider><form onSubmit={submit}><TaskLabelEditor value={[]} catalog={[]} portalContainer={null} onChange={change} onCreate={label => label} /></form></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar etiquetas da tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "TESTE QA Cor livre" } });
    fireEvent.change(screen.getByLabelText("Escolher cor personalizada"), { target: { value: "#112233" } });
    fireEvent.change(screen.getByLabelText("Código da cor personalizada"), { target: { value: "#0AF" } });
    fireEvent.keyDown(screen.getByLabelText("Código da cor personalizada"), { key: "Enter" });
    expect(change).toHaveBeenCalledWith([{ name: "TESTE QA Cor livre", color: "#00aaff" }]);
    expect(submit).not.toHaveBeenCalled();
  });
  it("cor incompleta bloqueia a criação até corrigir ou escolher outra cor", () => {
    const create = vi.fn((label: TaskLabel) => label);
    render(<TooltipProvider><TaskLabelFilter catalog={[]} selected={[]} onChange={vi.fn()} onCreate={create} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por etiquetas" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "TESTE QA" } });
    fireEvent.change(screen.getByLabelText("Código da cor personalizada"), { target: { value: "#12" } });
    fireEvent.keyDown(screen.getByLabelText("Nome da etiqueta"), { key: "Enter" });
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar etiqueta" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Turquesa" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar etiqueta" }));
    expect(create).toHaveBeenCalledWith({ name: "TESTE QA", color: "#0f766e" });
  });
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
  it("editar nome/cor mantém a seleção e não submete o formulário da tarefa", async () => {
    const original = { name: "Instagram Eternum", color: "yellow" as const };
    const save = vi.fn(async (_old: TaskLabel, label: TaskLabel) => label); const submit = vi.fn(); const change = vi.fn();
    render(<TooltipProvider><form onSubmit={submit}><TaskLabelEditor value={[original]} catalog={[original]} portalContainer={null} onChange={change} onEdit={save} /></form></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar etiquetas da tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar etiqueta Instagram Eternum" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "Instagram ROY" } });
    fireEvent.click(screen.getByRole("radio", { name: "Verde" }));
    fireEvent.keyDown(screen.getByLabelText("Nome da etiqueta"), { key: "Enter" });
    await waitFor(() => expect(change).toHaveBeenCalledWith([{ name: "Instagram ROY", color: "green" }]));
    expect(save).toHaveBeenCalledWith(original, { name: "Instagram ROY", color: "green" });
    expect(submit).not.toHaveBeenCalled();
  });
  it("cancelar edição não salva; falha mantém o nome digitado e não muda a seleção", async () => {
    const original = { name: "Vídeo", color: "blue" as const }; const change = vi.fn();
    const save = vi.fn(async () => { throw new Error("Acesso negado"); });
    render(<TooltipProvider><TaskLabelEditor value={[original]} catalog={[original]} portalContainer={null} onChange={change} onEdit={save} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar etiquetas da tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar etiqueta Vídeo" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "Filme" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Editar etiqueta Vídeo" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "Filme" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar etiqueta" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Acesso negado"));
    expect(screen.getByLabelText("Nome da etiqueta")).toHaveValue("Filme");
    expect(change).not.toHaveBeenCalled();
  });
  it("renomear pelo filtro preserva a escolha sem ativar outras etiquetas", async () => {
    const original = { name: "Vídeo", color: "blue" as const }; const change = vi.fn();
    render(<TooltipProvider><TaskLabelFilter catalog={[original]} selected={["vídeo"]} onChange={change} onCreate={(label) => label} onEdit={async (_old, label) => label} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Filtrar por etiquetas" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar etiqueta Vídeo" }));
    fireEvent.change(screen.getByLabelText("Nome da etiqueta"), { target: { value: "Filme" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar etiqueta" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith(["filme"]));
  });
});