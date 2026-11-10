import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuidedTour, type TourStep } from "../GuidedTour";

// O balão chama scrollIntoView quando o passo aponta um alvo; o jsdom não traz esse método.
if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {};

const STEPS: TourStep[] = [
  { title: "Primeiro", text: "texto um" },
  { title: "Segundo", text: "texto dois" },
];

const stepLabel = () => screen.getByText(/Passo \d+ de \d+/).textContent;

describe("GuidedTour com setas do teclado", () => {
  it("ArrowRight avança de passo", () => {
    render(<GuidedTour steps={STEPS} open onClose={() => {}} />);
    expect(stepLabel()).toBe("Passo 1 de 2");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(stepLabel()).toBe("Passo 2 de 2");
  });

  it("ArrowLeft volta de passo", () => {
    render(<GuidedTour steps={STEPS} open onClose={() => {}} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(stepLabel()).toBe("Passo 2 de 2");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(stepLabel()).toBe("Passo 1 de 2");
  });

  it("ArrowLeft no primeiro passo não volta", () => {
    render(<GuidedTour steps={STEPS} open onClose={() => {}} />);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(stepLabel()).toBe("Passo 1 de 2");
  });

  it("ArrowRight no último passo fecha o tour", () => {
    const onClose = vi.fn();
    render(<GuidedTour steps={STEPS} open onClose={onClose} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape usa onSkip quando informado", () => {
    const onClose = vi.fn();
    const onSkip = vi.fn();
    render(<GuidedTour steps={STEPS} open onClose={onClose} onSkip={onSkip} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("seta digitada dentro de um campo não muda de passo", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    render(<GuidedTour steps={STEPS} open onClose={() => {}} />);
    fireEvent.keyDown(input, { key: "ArrowRight", bubbles: true });
    expect(stepLabel()).toBe("Passo 1 de 2");
    input.remove();
  });
});
