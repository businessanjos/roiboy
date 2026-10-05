import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BenefitGroup } from "../RHBenefits";
import type { HRCompanyBenefit } from "@/hooks/useHRCompanyBenefits";

const makeItems = (n: number): HRCompanyBenefit[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `b-${i + 1}`,
    account_id: "acc-1",
    name: `Benefício ${i + 1}`,
    category: "saude",
    provider: null,
    description: null,
    monthly_value: 0,
    employee_contribution: 0,
    contract_types: [],
    is_highlight: false,
    include_in_jobs_by_default: false,
    use_in_benchmark: false,
    is_active: true,
    sort_order: 0,
    created_at: "",
    updated_at: "",
  }));

describe("BenefitGroup", () => {
  it("paginação por grupo: 100 itens mostra 20 e exibe '1–20 de 100'", () => {
    const items = makeItems(100);
    render(
      <BenefitGroup
        category="saude"
        items={items}
        resetKey=""
        openDialog={vi.fn()}
        updateBenefit={vi.fn()}
        handleDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Benefício 1")).toBeInTheDocument();
    expect(screen.getByText("Benefício 20")).toBeInTheDocument();
    expect(screen.queryByText("Benefício 21")).not.toBeInTheDocument();
    expect(screen.getByText("1–20 de 100")).toBeInTheDocument();
  });
});
