import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Editor, UseEditorOptions } from "@tiptap/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { readTaskComment } from "@/lib/marketing/taskCommentContent";
import { TaskComments } from "./TaskComments";

const state = vi.hoisted(() => ({ editor: null as Editor | null, send: vi.fn(), remove: vi.fn() }));
vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>();
  return { ...actual, useEditor: (options: UseEditorOptions) => {
    const editor = actual.useEditor(options); state.editor = editor; return editor;
  } };
});
vi.mock("@/hooks/useMarketingTaskComments", () => ({ useMarketingTaskComments: () => ({
  comments: [], isLoading: false, error: null, currentUser: { id: "person" },
  add: { mutateAsync: state.send, isPending: false }, remove: { mutateAsync: state.remove, isPending: false },
}) }));
beforeEach(() => { cleanup(); state.editor = null; state.send.mockReset(); state.remove.mockReset(); });
async function setup(taskId: string | null = "task") {
  const view = render(<TooltipProvider><TaskComments taskId={taskId} /></TooltipProvider>);
  await waitFor(() => expect(state.editor).not.toBeNull());
  const editor = state.editor;
  if (!editor) throw new Error("Editor unavailable");
  return { view, editor };
}
describe("Escrever comentários formatados", () => {
  it("envia a formatação selecionada e limpa o rascunho somente após sucesso", async () => {
    state.send.mockResolvedValue(undefined);
    const { view, editor } = await setup();
    act(() => { editor.commands.insertContent("Revisar a arte"); editor.commands.setTextSelection({ from: 1, to: 8 }); });
    fireEvent.click(view.getByRole("button", { name: "Negrito" }));
    fireEvent.click(view.getByRole("button", { name: "Marca-texto" }));
    fireEvent.click(await view.findByRole("button", { name: "Destacar em Amarelo" }));
    fireEvent.click(view.getByRole("button", { name: "Comentar" }));
    await waitFor(() => expect(state.send).toHaveBeenCalledTimes(1));
    const content = readTaskComment(state.send.mock.calls[0][0]);
    expect(content.text).toBe("Revisar a arte");
    expect(content.document?.content?.[0].content?.[0].marks).toEqual([{ type: "bold" }, { type: "highlight", attrs: { color: "var(--task-marker-yellow)" } }]);
    await waitFor(() => expect(editor.getText()).toBe(""));
  });
  it("mantém texto e formatação quando o envio falha", async () => {
    state.send.mockRejectedValue(new Error("Falha de envio"));
    const { view, editor } = await setup();
    act(() => { editor.commands.insertContent("Revisar"); editor.commands.setTextSelection({ from: 1, to: 8 }); editor.commands.setItalic(); });
    const before = editor.getJSON();
    fireEvent.click(view.getByRole("button", { name: "Comentar" }));
    await waitFor(() => expect(state.send).toHaveBeenCalledTimes(1));
    expect(editor.getJSON()).toEqual(before);
  });
  it("não envia texto vazio ou comentário de tarefa ainda não salva", async () => {
    const { view, editor } = await setup(null);
    act(() => { editor.commands.insertContent("Rascunho"); });
    fireEvent.click(view.getByRole("button", { name: "Comentar" }));
    expect(state.send).not.toHaveBeenCalled();
    cleanup();
    const { view: saved } = await setup();
    fireEvent.click(saved.getByRole("button", { name: "Comentar" }));
    expect(state.send).not.toHaveBeenCalled();
  });
});