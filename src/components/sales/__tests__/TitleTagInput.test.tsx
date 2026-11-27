import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TitleTagInput } from "../TitleTagInput";

afterEach(cleanup);

describe("Sugestões de título para Clínica Ryka", () => {
  it.each(["CARTEIRA-CR", "ORG-CR", "TRAF-CR", "IND-CR"])(
    "aplica %s ao digitar CR preservando o nome do contato",
    (tag) => {
      const onValueChange = vi.fn();
      render(<TitleTagInput value="CR TESTE QA" onValueChange={onValueChange} />);
      fireEvent.focus(screen.getByRole("textbox"));
      fireEvent.click(screen.getByRole("button", { name: `[${tag}]` }));
      expect(onValueChange).toHaveBeenCalledWith(`[${tag}] TESTE QA`);
    },
  );

  it("preserva a seleção das sugestões anteriores", () => {
    const onValueChange = vi.fn();
    render(<TitleTagInput value="EM TESTE QA" onValueChange={onValueChange} />);
    fireEvent.focus(screen.getByRole("textbox"));
    fireEvent.click(screen.getByRole("button", { name: "[IND-EM]" }));
    expect(onValueChange).toHaveBeenCalledWith("[IND-EM] TESTE QA");
  });
});