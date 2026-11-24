import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pipeline } from "@/hooks/usePipelines";
import { PipelineOrderDialog } from "../PipelineOrderDialog";

const pipelines = ["a", "b", "c"].map((id, index) => ({ id, name: `TESTE QA ${id}`, display_order: index })) as Pipeline[];

describe("Reorganização dos funis", () => {
  it("salva a sequência escolhida com as setas", async () => {
    const onSave = vi.fn(async () => true);
    const onClose = vi.fn();
    render(<PipelineOrderDialog pipelines={pipelines} activePipelineId="b" onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Subir TESTE QA c" }));
    fireEvent.click(screen.getByRole("button", { name: "Subir TESTE QA c" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordem" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(["c", "a", "b"]));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("cancelamento não salva e a nova abertura parte da ordem original", async () => {
    const onSave = vi.fn(async () => true);
    const onClose = vi.fn();
    const first = render(<PipelineOrderDialog pipelines={pipelines} activePipelineId="a" onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Descer TESTE QA a" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
    first.unmount();
    render(<PipelineOrderDialog pipelines={pipelines} activePipelineId="a" onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Subir TESTE QA c" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordem" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(["a", "c", "b"]));
  });
  it("uma recusa permite tentar de novo e não fecha a janela", async () => {
    const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const onClose = vi.fn();
    render(<PipelineOrderDialog pipelines={pipelines} activePipelineId="a" onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Subir TESTE QA c" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordem" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar ordem" })).not.toBeDisabled());
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordem" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});