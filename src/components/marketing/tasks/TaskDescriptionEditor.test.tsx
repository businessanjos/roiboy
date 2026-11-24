import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TaskDescriptionEditor } from "./TaskDescriptionEditor";
import { plainTaskDocument } from "@/lib/marketing/taskDescription";

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
});