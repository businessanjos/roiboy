import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Editor, JSONContent, UseEditorOptions } from "@tiptap/react";
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
  it("digitar 26:49 aplica negrito só no tempo, não na frase que vem depois", async () => {
    const changed=vi.fn();
    render(<TooltipProvider><TaskDescriptionEditor initialContent={plainTaskDocument("")} valueKey="time" onChange={changed} colors={[]} onColorsChange={vi.fn()} portalContainer={null} /></TooltipProvider>);
    await waitFor(()=>expect(captured.editor).not.toBeNull());
    const editor=captured.editor; if (!editor) throw new Error("Editor unavailable");
    act(()=>{ for (const character of "26:49 — Tira o então.") editor.commands.insertContent(character); });
    expect(editor.getJSON().content?.[0].content).toEqual([
      {type:"text",text:"26:49",marks:[{type:"bold"}]}, {type:"text",text:" — Tira o então."},
    ]);
    expect(changed.mock.calls.at(-1)?.[0]).toBe("26:49 — Tira o então.");
  });
  it("colar vários tempos preserva itálico, listas e texto", async () => {
    render(<TooltipProvider><TaskDescriptionEditor initialContent={plainTaskDocument("")} valueKey="paste" onChange={vi.fn()} colors={[]} onColorsChange={vi.fn()} portalContainer={null} /></TooltipProvider>);
    await waitFor(()=>expect(captured.editor).not.toBeNull());
    const editor=captured.editor; if (!editor) throw new Error("Editor unavailable");
    act(()=>editor.commands.insertContent('<ul><li><p><em>26:24 a 27:09</em></p></li><li><p>26:49 — Tira</p></li></ul>'));
    const document: JSONContent=editor.getJSON();
    const first=document.content?.find(node=>node.type==="bulletList")?.content?.[0].content?.[0].content;
    expect(first).toEqual([
      {type:"text",text:"26:24",marks:[{type:"bold"},{type:"italic"}]},
      {type:"text",text:" a ",marks:[{type:"italic"}]},
      {type:"text",text:"27:09",marks:[{type:"bold"},{type:"italic"}]},
    ]);
    expect(editor.getText()).toContain("26:49 — Tira");
  });
  it("carregar a descrição formata tempos sem disparar alteração ou autosalvar", async () => {
    const changed=vi.fn();
    const view=render(<TooltipProvider><TaskDescriptionEditor initialContent={plainTaskDocument("26:49 — Tira")} valueKey="existing" onChange={changed} colors={[]} onColorsChange={vi.fn()} portalContainer={null} /></TooltipProvider>);
    await waitFor(()=>expect(view.getByRole("textbox").textContent).toBe("26:49 — Tira"));
    expect(captured.editor?.getJSON().content?.[0].content?.[0]).toMatchObject({text:"26:49",marks:[{type:"bold"}]});
    expect(changed).not.toHaveBeenCalled();
  });
  it("o editor compacto dos comentários não recebe o negrito automático", async () => {
    render(<TooltipProvider><TaskDescriptionEditor initialContent={plainTaskDocument("")} valueKey="comment" compact label="Novo comentário" onChange={vi.fn()} colors={[]} onColorsChange={vi.fn()} portalContainer={null} /></TooltipProvider>);
    await waitFor(()=>expect(captured.editor).not.toBeNull());
    const editor=captured.editor; if (!editor) throw new Error("Editor unavailable");
    act(()=>editor.commands.insertContent("26:49 — Tira"));
    expect(editor.getJSON().content?.[0].content).toEqual([{type:"text",text:"26:49 — Tira"}]);
  });
  it("abre um link existente em outra aba sem modificar ou salvar a descrição", async () => {
    const changed = vi.fn();
    const url = "https://drive.google.com/drive/folders/creative-assets?usp=sharing";
    render(<TooltipProvider><TaskDescriptionEditor initialContent={plainTaskDocument(url)} valueKey="link" onChange={changed} colors={[]} onColorsChange={vi.fn()} portalContainer={null} /></TooltipProvider>);
    await waitFor(() => expect(captured.editor).not.toBeNull());
    const editor = captured.editor;
    if (!editor) throw new Error("Editor unavailable");
    const anchor = editor.view.dom.querySelector("a");
    if (!anchor) throw new Error("URL was not recognized");
    const opened = vi.spyOn(window, "open").mockImplementation(() => null);
    const event = new MouseEvent("click", { button: 0, cancelable: true });
    Object.defineProperty(event, "target", { value: anchor });
    editor.view.someProp("handleClick", (handler) => handler(editor.view, 1, event));
    expect(opened).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
    expect(editor.getText()).toBe(url);
    expect(changed).not.toHaveBeenCalled();
    opened.mockRestore();
  });
  it("reconhece endereço digitado e mantém a frase depois dele fora do link", async () => {
    render(<TooltipProvider><TaskDescriptionEditor initialContent={plainTaskDocument("")} valueKey="typed-link" onChange={vi.fn()} colors={[]} onColorsChange={vi.fn()} portalContainer={null} /></TooltipProvider>);
    await waitFor(() => expect(captured.editor).not.toBeNull());
    const editor = captured.editor;
    if (!editor) throw new Error("Editor unavailable");
    const url = "https://drive.google.com/file?usp=sharing";
    act(() => { for (const character of `${url} revisar`) editor.commands.insertContent(character); });
    expect(editor.getText()).toBe(`${url} revisar`);
    const document: JSONContent = editor.getJSON();
    const nodes = document.content?.[0].content ?? [];
    expect(nodes.filter((node) => node.marks?.some((mark) => mark.type === "link")).map((node) => node.text).join("")).toBe(url);
    expect(nodes.at(-1)?.marks?.some((mark) => mark.type === "link") ?? false).toBe(false);
  });
});