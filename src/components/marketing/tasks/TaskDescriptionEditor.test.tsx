import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Editor, UseEditorOptions } from "@tiptap/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor";
import { plainTaskDocument } from "@/lib/marketing/taskDescription";

const captured = vi.hoisted(() => ({ editor: null as Editor | null }));
vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>();
  return { ...actual, useEditor: (options: UseEditorOptions) => {
    const editor = actual.useEditor(options);
    captured.editor = editor;
    return editor;
  } };
});
beforeEach(() => { cleanup(); captured.editor = null; });

describe("Abrir a descrição da tarefa", () => {
  it("carrega o texto existente sem disparar alteração ao habilitar ou desabilitar o editor", async () => {
    const changed = vi.fn();
    const content = plainTaskDocument("Revisar a arte antes da publicação.");
    const editor = (disabled: boolean) => <TooltipProvider><TaskDescriptionEditor initialContent={content} valueKey="task" onChange={changed} colors={[]} onColorsChange={vi.fn()} disabled={disabled} portalContainer={null} /></TooltipProvider>;
    const view = render(editor(false));
    await waitFor(() => expect(view.getByRole("textbox", { name: "Descrição" }).textContent).toBe("Revisar a arte antes da publicação."));
    view.rerender(editor(true));
    await waitFor(() => expect(view.getByRole("textbox", { name: "Descrição" }).getAttribute("contenteditable")).toBe("false"));
    view.rerender(editor(false));
    await waitFor(() => expect(view.getByRole("textbox", { name: "Descrição" }).getAttribute("contenteditable")).toBe("true"));
    expect(view.getByRole("textbox", { name: "Descrição" }).textContent).toBe("Revisar a arte antes da publicação.");
    expect(changed).not.toHaveBeenCalled();
  });
  it("clicar novamente no marca-texto remove a seleção destacada sem alterar texto ou negrito", async () => {
    const changed = vi.fn();
    const view = render(<TooltipProvider><TaskDescriptionEditor initialContent={plainTaskDocument("Revisar arte antes da publicação.")} valueKey="task" onChange={changed} colors={[]} onColorsChange={vi.fn()} portalContainer={null} /></TooltipProvider>);
    await waitFor(() => expect(captured.editor).not.toBeNull());
    const editor = captured.editor;
    if (!editor) throw new Error("Editor unavailable");
    act(() => { editor.commands.setTextSelection({ from: 1, to: 13 }); editor.commands.setBold(); });
    fireEvent.click(view.getByRole("button", { name: "Marca-texto" }));
    fireEvent.click(await view.findByRole("button", { name: "Destacar em Amarelo" }));
    expect(editor.isActive("highlight")).toBe(true);
    fireEvent.click(view.getByRole("button", { name: "Marca-texto" }));
    expect(editor.isActive("highlight")).toBe(false);
    expect(editor.isActive("bold")).toBe(true);
    expect(editor.getText()).toBe("Revisar arte antes da publicação.");
    expect(editor.getJSON().content?.[0].content?.[0]).toEqual({ type: "text", marks: [{ type: "bold" }], text: "Revisar arte" });
  });
  it("desliga a escrita destacada no cursor sem apagar o destaque já aplicado", async () => {
    const view = render(<TooltipProvider><TaskDescriptionEditor initialContent={plainTaskDocument("Revisar")} valueKey="task" onChange={vi.fn()} colors={[]} onColorsChange={vi.fn()} portalContainer={null} /></TooltipProvider>);
    await waitFor(() => expect(captured.editor).not.toBeNull());
    const editor = captured.editor;
    if (!editor) throw new Error("Editor unavailable");
    act(() => { editor.commands.setTextSelection({ from: 1, to: 8 }); });
    fireEvent.click(view.getByRole("button", { name: "Marca-texto" }));
    fireEvent.click(await view.findByRole("button", { name: "Destacar em Amarelo" }));
    act(() => { editor.commands.setTextSelection(8); });
    fireEvent.click(view.getByRole("button", { name: "Marca-texto" }));
    act(() => { editor.commands.insertContent(" arte"); });
    const segments = editor.getJSON().content?.[0].content;
    expect(segments?.[0]).toMatchObject({ type: "text", text: "Revisar" });
    expect(segments?.[0].marks?.some((mark) => mark.type === "highlight")).toBe(true);
    expect(segments?.[1]).toEqual({ type: "text", text: " arte" });
  });
});